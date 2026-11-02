# Lefant M3 Max — v3.3.25 APK 등록·연결 코드 재검토

## 증거 범위
- 사용자 제공 Lefant_v3.3.25_APKPure.xapk, SHA-256: 66e705abaf0a118436d7e2ff034664fc5032ef2c5623d4b59b8ec7579de3a465
- 앱 패키지: com.yunshi.robotlife. classes.dex~classes10.dex. APK의 DEX에서 타입·메서드 호출과 부분 디스어셈블을 추출한 정적 분석.
- 실제 M3 Max 장비 연결, Wi-Fi 최초 설정, 장치 인증 또는 실기기 명령 성공은 확인되지 않음.

## 원본에서 다시 확인한 등록 절차
1. BindDeviceViewModel.startActivatorByTuya:
   - ScanDeviceBean.getUuid/getDeviceType/getAddress/getMac.
   - MultiModeActivatorBean 구성.
   - ThingHomeSdk.getActivator → IActivator.newMultiModeActivator → IMultiModeActivator.startActivator.
   - Bluetooth 발견 기기정보를 이용하는 복합 활성화 SDK 경로가 존재한다.
2. BindDeviceViewModel.startActivatorByLivirobo:
   - LiviroboSDK.get → LiviroboSDK.startActivatorDevice.
   - 별도 Livirobo 활성화 경로도 존재한다. M3 Max의 실제 경로는 추가 검증 필요.
3. DeviceNetDemoActivity, ConnectWifiFragment: 네트워크 등록 UI 관련 클래스.
4. EquipmentConfig.getM3Max/getM3Series, DeviceM3: M3 모델 분기.
5. ThingClips의 IThingDeviceActivator/getActivatorToken 메서드 참조 존재. API가 APK에 존재한다는 것이 실기기 키나 유효 활성화 토큰 보유를 의미하지는 않는다.

## 공식 프로토콜 제약
Tuya 로봇의 AP/BLE 활성화에는 대체로 Wi-Fi 네트워크 정보와 Tuya 클라우드 활성화 토큰이 필요하다.
- https://developer.tuya.com/en/docs/iot-device-dev/robot_distribution_network_active?id=Kd93npo32h4rl
- https://agentic-kit.tuya.com/en/docs/tutorials/openapi-activate/
공식 앱을 설치하지 않는 등록 흐름은 가능성을 검토할 수 있으나, Lefant 제조사 생산품이 임의의 Tuya 개발자 프로젝트로 활성화되는 것은 아직 검증되지 않았다.

## 이번 코드 적용
- 기존 Railway 웹 index.ts에 M3 Max 전용 연결 진단 패널을 추가했다.
- gateway/m3_onboard.py: BLE 광고 후보(Bleak), Wi-Fi AP 후보(nmcli/airport), Tuya LAN 후보(TinyTuya) 스캔.
- 현장 웹 연결키 인증 POST /api/m3/onboarding/observe 에서는 검색 방식별 후보 수·상태만 받고, SSID/암호/MAC/Device ID/Local Key/활성화 토큰을 수집하지 않는다.
- GET /api/m3/onboarding/status?robot_id=... 는 세션에 속한 로봇의 검색 결과만 읽는다.
- pairing_completed:false, device_authenticated:false, commands_enabled:false 유지. 연결된 것처럼 표시하거나 하드웨어 제어 명령을 자동 전송하지 않는다.
- 웹에서 연결키 재발급/해제 시 진단정보도 삭제한다.
- 자동 테스트: Python 구문 및 --simulate, 서버 API 인증·비밀정보 제거·폐기.

## 사용
1. https://m330-web-github-production.up.railway.app/ 열기.
2. 로봇 이름을 M3 Max로 등록하고 선택 후 연결·진단에서 현장 연결키 발급.
3. 현장 PC/Mac에서 git clone -b m330-pro-mobile-web https://github.com/lyonbegin/apk-mitm.git
4. cd apk-mitm/m330-mobile-web/gateway
5. python3 -m pip install tinytuya bleak
6. 쉘에서 키를 비공개 입력: read -s M330_BRIDGE_KEY; export M330_BRIDGE_KEY
7. 로봇의 네트워크 등록모드 및 컴퓨터 Wi-Fi/BLE 확인 후 python3 m3_onboard.py --scan --push
8. 관리 웹의 M3 Max 검색 상태 새로고침. 발견은 등록 완료가 아니며 실제 모터 제어는 여전히 잠겨 있다.

## 미완료 및 실기기 필요 항목
- M3 Max가 사용하는 BLE 서비스/등록 데이터의 실측.
- 제조사 브랜드와 연결되는 클라우드 인증·활성화 토큰 취득 및 장치 등록.
- AP/BLE를 통한 실제 Wi-Fi 설정 및 인증 결과 검증.
- 장치의 원시 상태 조회, 실제 명령 페이로드, 지도 파싱과 이동 제어의 실기기 검증.
