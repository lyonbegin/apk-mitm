# M330 Pro 다중 로봇 관리 v0.3

## 실배포
- 웹: https://m330-web-github-production.up.railway.app/
- 서비스: Railway LEFANT-M330-PRO-MOBILE-WEB / m330-web-github
- GitHub: lyonbegin/apk-mitm 브랜치 m330-pro-mobile-web
- 데이터베이스: Railway 영구 볼륨 `/data/m330.sqlite`

## 여러 대 운용
1. 모바일 웹 홈의 **전체 로봇 관리**에서 `로봇 추가 · 이름/배치 변경`을 열어 로봇마다 별도 이름과 층을 지정합니다.
2. 등록된 로봇 카드 또는 선택 메뉴에서 로봇을 전환하면 해당 로봇의 가상 상태, 청소 계획, 기록이 나타납니다.
3. 다중 선택 체크박스의 `전체 선택` 또는 개별 선택을 사용한 뒤 일괄 청소 시작/정지/충전 복귀를 실행할 수 있습니다. **현재는 데모 명령만 기록합니다.**
4. 실기기 진단 연결은 로봇별로 별도 연결키를 발급해야 합니다. 공통 연결키를 재사용하지 않습니다.
5. 로봇 등록 해제 시 해당 기기는 더 이상 명령/조회 대상이 아니며 연결키가 폐기됩니다. 과거 이벤트 기록은 보존합니다.

## 로컬 LAN에서 여러 대 동시 진단
- 모든 로봇은 PC와 같은 LAN에 있어야 합니다. Railway에서 로봇 사설 IP에 직접 연결하지 않습니다.
- `gateway/robots.example.json`을 현장 PC에서 `gateway/robots.json`으로 복사해 각 로봇의 IP, Device ID, Local Key, 프로토콜, 웹에서 발급받은 **개별** 연결키를 입력합니다.
- 예제의 프로토콜과 IP는 실기기 확인값이 아니므로 사용자가 검증한 정보로 변경해야 합니다.
- 파일에는 비밀값이 들어가므로 GitHub에 업로드하지 않습니다. 해당 경로는 `.gitignore`에 등록되어 있습니다.

```bash
cd m330-mobile-web/gateway
python3 -m pip install tinytuya
cp robots.example.json robots.json
chmod 600 robots.json
python3 m330_fleet_bridge.py --dry-run
python3 m330_fleet_bridge.py --once
python3 m330_fleet_bridge.py --interval 30
```

이 브리지는 최대 100대의 로봇을 8개 작업 스레드까지 병렬 조회하여 **읽기 전용 DP**를 웹 서버로 전송합니다. 실제 청소 명령을 보내는 코드가 없습니다. DP 의미와 실제 M330 Pro 프로토콜은 실기기 검증 전입니다.

## DB 마이그레이션
- `robots`, `robot_pairs`, `robot_observations` 테이블을 추가하고 `tasks`, `events`에 `robot_id` 컬럼을 안전하게 추가합니다.
- 기존 방문자 세션의 1대용 상태·일정·기록은 최초 로봇에 연결되며 기존 테이블 및 데이터를 삭제하지 않습니다.
- 등록 해제된 로봇의 키와 최신 관측값만 삭제합니다. 일정과 이력은 DB에 남습니다.
- 현재 로봇 목록은 브라우저 세션 쿠키별로 분리됩니다. 여러 관리자가 하나의 공유 계정으로 접속하는 기능은 미구현입니다.

## API
| 메서드 | 경로 | 기능 |
|---|---|---|
| GET | `/api/robots` | 세션별 활성 로봇 목록 |
| POST | `/api/robots` | 로봇 등록: `name`, `floor_id` |
| PATCH / DELETE | `/api/robots/:id` | 정보 수정 / 등록 해제 |
| GET | `/api/dashboard` | 전체 로봇 및 각 로봇 일정/이력 |
| POST | `/api/command` | `robot_id`별 데모 명령 |
| POST | `/api/commands/batch` | `robot_ids` 목록별 일괄 데모 명령 |
| POST | `/api/tasks` | `robot_id`별 청소 계획 |
| GET | `/api/gateway/status?robot_id=ID` | 기기별 상태 조회 |
| POST | `/api/gateway/pair`, `/api/gateway/revoke` | `robot_id`별 연결키 관리 |
| POST | `/api/gateway/observations` | 로봇별 연결키 인증, 원시 DP 수신 |

## 테스트
- GitHub Actions `m330-web-smoke.yml`: 다중 로봇 상태 격리, 별도 스케줄, 개별/일괄 명령, 키 분리, 해제 및 이력 보존 확인.
- GitHub Actions `m330-browser-smoke.yml`: Playwright Chromium에서 모바일 화면의 로봇 추가/선택/일괄 명령/일정 분리/해제를 확인.
- 실제 로봇은 아직 연결되지 않았으므로 하드웨어 제어 및 지도 수신은 성공으로 간주하지 않습니다.
