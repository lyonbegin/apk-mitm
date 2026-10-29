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
아직 M330 Pro 실기기 조회 성공은 검증되지 않았으며, 웹 연결 인터페이스는 구현되었으나 실제 현장 장치는 미연결 상태입니다.
해당 파이썬 도구는 로봇에 제어 명령을 보내지 않습니다.

## 현장 PC → Railway 웹 읽기 전용 연결 (2026-10-30 구현)

먼저 [M330 모바일 웹](https://m330-web-github-production.up.railway.app/)의 **설정 → 실기기 LAN 진단 연결 → 연결키 새로 발급** 버튼을 누르십시오. 브라우저 세션마다 다른 키가 만들어지며 재발급 즉시 이전 키는 폐기됩니다.

학교의 로봇과 **동일한 Wi-Fi/LAN에 연결된 PC**에서 이 GitHub 저장소의 `m330-mobile-web/gateway` 폴더를 실행합니다.

```bash
python3 -m pip install tinytuya
cd m330-mobile-web/gateway
python3 m330_bridge.py --dry-run
# 아래 네 항목은 M330 Pro 실기기에서 확인한 정보를 설정합니다.
export M330_HOST='192.168.1.123'
export M330_DEVICE_ID='your-device-id'
export M330_LOCAL_KEY='your-local-key'
export M330_PROTOCOL='3.5' # 확인되지 않은 값으로 실행하지 마십시오.
# 명령 기록에 연결키가 남지 않도록 별도 입력받습니다.
read -rsp '웹에서 발급받은 M330 브리지 연결키: ' M330_BRIDGE_KEY; echo
export M330_BRIDGE_KEY
python3 m330_bridge.py --once
# 실기기 확인 후 30초마다 모니터링
python3 m330_bridge.py --interval 30
```

`m330_bridge.py`는 `m330_lan_probe.probe()`를 사용해 `device.status()` **조회 결과만** `POST /api/gateway/observations`로 HTTPS 전송합니다. Local Key, 원본 Device ID, 로컬 IP는 Railway 서버에 전송하지 않습니다. 서버는 DP 번호의 의미를 가정하지 않고 원시 데이터로 보존·표시합니다.

- 미설정/미연결 상태는 `paired:false`, `online:false`로 나타납니다.
- 조회 성공 데이터가 90초 이내에 수신되면 `online:true`로 표시하지만, **M330 Pro 모델 및 명령 DP가 검증됐다는 뜻은 아닙니다**.
- 웹의 청소/일시정지/복귀 버튼은 계속 시뮬레이션만 수행합니다.
- 실기기 조회 실패 시 패킷 캡처, DP 해석, 모델/프로토콜 확인이 추가로 필요합니다.
- 로컬 PC가 꺼지면 연결은 끊어집니다. Railway에서 학교 Wi-Fi의 사설 IP로 직접 접근하는 기능은 없습니다.

웹 API: `GET /api/gateway/status`, `POST /api/gateway/pair`, `POST /api/gateway/revoke`, `POST /api/gateway/observations`. 관측 전송은 HTTP 헤더 `X-M330-Pairing-Key`로 연결키를 보내야 하며, 연결키 자체는 SQLite에 저장하지 않고 SHA-256 해시만 저장합니다.
