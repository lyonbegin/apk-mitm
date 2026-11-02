# Lefant M3 Max — Wi-Fi 전용 연결 구현 및 APK v3.3.25 근거 (2026-11-03)

## 적용 원칙

**공식 Lefant 앱 설치 없이, Bluetooth 검색 없이, Wi-Fi 기반으로만 진행한다.**

기존 웹: https://m330-web-github-production.up.railway.app/
GitHub: lyonbegin/apk-mitm 브랜치 m330-pro-mobile-web

## APK 정적 분석

- 원본: Lefant_v3.3.25_APKPure.xapk; SHA-256 66e705abaf0a118436d7e2ff034664fc5032ef2c5623d4b59b8ec7579de3a465.
- classes10.dex: DeviceConnetViewModel.getWifiInfo()에서 WifiUtils.getWIFISSID()와 SharedPrefs.getConnSuccessWifiPsw() 호출을 확인함.
- classes10.dex: DeviceManagerUtils.getActivatorToken() → ThingHomeSdk.getActivatorInstance() → IThingDeviceActivator.getActivatorToken() 호출.
- classes10.dex: BindDeviceViewModel.startActivatorByTuya()가 ThingHomeSdk.getActivator() → IActivator.newMultiModeActivator() → IMultiModeActivator.startActivator()를 호출함.
- classes10.dex: BindDeviceViewModel.startActivatorByLivirobo()에 다른 SDK 등록 경로가 존재함.
- 위 SDK 진입점은 '앱에 들어 있다'는 증거이며 M3 Max 기기의 실제 AP 등록 성공이나 토큰 확보를 증명하지 않음.

Tuya 공식 AP 등록 규약에 따르면 장치 AP에 접근한 뒤 Wi-Fi SSID·비밀번호와 클라우드 활성화 토큰을 암호화된 AP 등록 프로토콜로 전달해야 한다. 활성화 토큰은 제조사 계정·클라우드에 연결된다. 유효한 토큰 없이 SSID만 보낸다고 최초 등록이 완료되지는 않는다.
- https://support.tuya.com/en/help/_detail/K8wkp4syou0x1
- https://developer.tuya.com/en/docs/iot-device-dev/tuyaos-gateway-pairing-wirless?id=Kc1nxtf5qspxb
- https://developer.tuya.com/en/docs/app-development/extension-activator-ap?id=Kcy3878yku80y

## 구현 항목

### 기존 Railway 관리 웹
- M3 Max를 별도 기종으로 등록/선택하고 저장.
- BLE 버튼 제거. Wi-Fi AP/LAN 상태 출력만 수행.
- 현장 연결 프로그램 인증키 발급, 연결 해제, 로봇별 보고 보존.
- POST /api/m3/onboarding/observe: schema_version=2, phase=not_detected|wifi_ap_found|wifi_ap_connected|wifi_lan_detected.
- 진단 허용값: ap_candidates, lan_candidates, scan_state, wifi_ap_joined.
- SSID, Wi-Fi 암호, MAC, Device ID, Local Key 등의 추가 필드는 서버에 저장하지 않음.
- Wi-Fi AP 연결 상태가 보고되더라도 device_authenticated=false, pairing_completed=false, commands_enabled=false.

### 현장 Mac/PC Wi-Fi 도우미
- gateway/m3_onboard.py: Wi-Fi AP 검색(networksetup/airport, nmcli, netsh), Tuya LAN 방송 검색(TinyTuya).
- `--join-ap SSID`: 명시적으로 선택한 로봇 AP에 현장 OS의 Wi-Fi 접속 요청. 성공 시 OS에 현재 연결된 SSID가 일치하는지 확인. 장치 Wi-Fi 최초 등록이나 제조사 인증은 별도.
- `--scan --push`: 현장 후보 검색 결과를 인증된 HTTPS 경유 Railway에 보고. AP 연결 시 인터넷 단절 가능성 존재.
- gateway/m3_wifi_local.py: http://127.0.0.1:8765/ 전용 로컬 웹. Wi-Fi 검색·AP 선택 접속·원격 관리화면 상태 전송. localhost 전용, POST Origin/CSRF 검증. Wi-Fi 변경은 사용자 클릭 후 실행.

## 이용 방법

1. M3 Max 전원을 켭니다. 이미 공유기 Wi-Fi에 등록되어 있다면 초기화하지 않고 그대로 둡니다.
2. 현장 Mac/PC에서 아래 명령으로 소스를 가져옵니다.
   `git clone -b m330-pro-mobile-web https://github.com/lyonbegin/apk-mitm.git`
   `cd apk-mitm/m330-mobile-web/gateway`
3. `python3 -m pip install tinytuya` (LAN 검색용)
4. `python3 m3_wifi_local.py`
5. Mac/PC 브라우저에서 `http://127.0.0.1:8765/` 접속. 주변 M3 Max 계열 AP 후보를 찾고, 사용자 지정한 AP로 연결합니다.
6. 관리 웹의 연결키를 현장 PC의 `M330_BRIDGE_KEY`에 입력하고 현장 프로그램에서 상태를 보고합니다. **서버가 외부에 있으므로 로봇 AP 접속 중 인터넷이 끊어지면 보고가 불가능할 수 있습니다.**
7. 이미 Wi-Fi가 구성된 로봇의 상태 조회는 `m330_lan_probe.py --scan`와 실제 Device ID·Local Key가 확보된 후 `m330_bridge.py`로 확인합니다.

## 검증 경계

완료: Wi-Fi 현장 AP 검색 로직, 명시적인 로컬 Wi-Fi 연결 요청, 같은 네트워크 Tuya 발견, 관리 웹 진단 상태·인증키·개인정보 차단, 자동 시뮬레이션 및 API 테스트.

미완료: M3 Max 특정 로봇 AP의 실측 SSID, AP 내부 인증 통신, 제조사 활성화 토큰, 홈 공유기 SSID/비밀번호 전달 암호화 프로토콜, 실제 기기 인증·Local Key 수신, 실기기 청소/이동 제어.

**중요:** 웹브라우저나 Railway만으로 로컬 컴퓨터의 Wi-Fi를 전환할 수는 없다. 이를 위해 실행하는 현장 프로그램은 Lefant 공식 앱이 아니며 Wi-Fi 전용 코드다.
