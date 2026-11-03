# M3 Max Wi-Fi 실제 등록 — Lefant 공식 앱 없이

## 구현
- 현장 컴퓨터에서 Tuya Wi-Fi EZ 활성화 토큰 요청과 UDP SmartLink 전송을 실행합니다.
- Cloud 응답으로 등록을 재확인할 때만 CLOUD_PAIRED 상태로 표시합니다.
- Local Key/Device ID는 현장 PC의 ~/.config/m3-max/paired_devices.json 에 권한 0600으로 저장합니다.
- Lefant 앱과 Bluetooth는 사용하지 않습니다. 비밀번호·Tuya Secret·Local Key는 Railway로 보내지 않습니다.
- M3 Max 실기기에서 EZ 등록 성공은 미검증입니다. 제조사 전용 제품은 외부 Tuya 개발자 앱으로 등록되지 않을 수 있습니다.

## 조건
1. M3 Max가 Wi-Fi EZ 등록을 지원해야 합니다. 앱 APK에서 AP 및 EZ 명령을 모두 찾았지만 M3 Max에 실제 허용된 방식은 Lefant 서버의 paired_type_list 데이터가 있어야 확정됩니다.
2. 사용자가 권한을 가진 Tuya IoT 개발자 프로젝트의 Client ID, Secret, App SDK Schema / Channel ID가 필요합니다. 제조사 제품 등록 권한이 없다면 거부됩니다.
3. Mac/PC는 로봇 AP가 아닌 일반 공유기 Wi-Fi (가능하면 2.4 GHz)에 연결하고, 로봇은 EZ 등록 모드로 두어야 합니다.

## 실행
    git clone -b m330-pro-mobile-web https://github.com/lyonbegin/apk-mitm.git
    cd apk-mitm/m330-mobile-web/gateway
    npm install --ignore-scripts --omit=dev
    python3 -m pip install tinytuya
    python3 m3_wifi_local.py

현장 컴퓨터에서 http://127.0.0.1:8765/ 열기 → '3. 실제 Wi-Fi EZ 등록' 입력 → 실제 등록 시작.
Tuya 데이터센터는 본인 프로젝트 데이터센터와 맞추어야 합니다. cn (openapi.tuyacn.com)이 한국에 무조건 적합하다는 뜻은 아닙니다.

등록 성공 후 기존 Railway 관리 웹 https://m330-web-github-production.up.railway.app/ 에 M3 Max 로봇을 등록/선택하고 현장 연결키를 발급합니다.
로컬 페이지 '실제 클라우드 등록 결과 관리 웹에 반영' 버튼에 키를 입력하면 오직 비식별 지문과 현장 에이전트의 등록 성공 보고를 전달합니다.
Railway가 Tuya Cloud를 독립 인증한 것은 아니며 실기기 읽기 및 주행 제어 성공을 의미하지 않습니다.

## Wi-Fi AP 등록 방식 제약
로봇 자체 AP에 PC가 접속하는 기능은 이전부터 있으나, 그것만으로 로봇에 공유기 Wi-Fi 설정이 등록되지는 않습니다.
AP 모드는 Tuya 인증 토큰과 기종별 암호화 프로토콜이 필요합니다. 현재 실기기 AP 프로토콜이 확인되지 않았으므로 무검증 패킷을 보내지 않습니다.
따라서 M3 Max가 AP만 지원하면 이 EZ 등록 기능은 작동하지 않을 수 있습니다.

## 근거
- 원본: Lefant_v3.3.25_APKPure.xapk / APK 정적 분석 M3_MAX_WIFI_REGISTRATION_APK_FORENSICS_2026-11-03.md
- Tuya 등록: https://support.tuya.com/en/help/_detail/K8wkp4syou0x1
- Tuya SmartLink: https://github.com/codetheweb/tuyapi/blob/master/docs/SETUP.md
- 실제 구현 라이브러리: https://github.com/TuyaAPI/link
