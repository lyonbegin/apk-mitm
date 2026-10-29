# Lefant M330 Pro 현장 LAN 게이트웨이 (읽기 전용)

이 디렉터리는 **로봇과 동일한 학교 LAN**에서 상태를 조회하기 위한 진단 도구입니다.

현재 지원 기능: Tuya 기기 검색, 인증정보 기반 읽기 전용 상태 조회, 원본 DP JSON 출력.
현재 미지원: 청소 시작·일시정지·복귀, 바퀴 제어, 지도 수신, 서버 원격 제어.

## 사용법
Python 3.10+ 및 tinytuya 필요:
```sh
python -m pip install tinytuya
python m330_lan_probe.py --simulate
python m330_lan_probe.py --scan
```

실제 기기의 로컬 IP·Device ID·Local Key·검증된 프로토콜 버전을 환경변수로 설정한 뒤:
```sh
export M330_HOST=192.168.1.123
export M330_DEVICE_ID='your-device-id'
export M330_LOCAL_KEY='your-local-key'
export M330_PROTOCOL='3.5'  # 단순 예시. 실기기 프로토콜 확인 후 입력
python m330_lan_probe.py --probe
python m330_lan_probe.py --watch 15
```

Local Key와 기기 ID를 GitHub, 로그, 웹 화면에 올리지 마십시오.
원본 DP 번호를 검증 없이 배터리 수치나 쓰기 명령으로 해석하지 마십시오.
아직 M330 Pro 실기기 조회 성공은 검증되지 않았고 외부 Railway 앱과 현장 게이트웨이도 연결되지 않았습니다.
해당 파이썬 도구는 로봇에 제어 명령을 보내지 않습니다.
