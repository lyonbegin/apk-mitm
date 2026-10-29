# Lefant M330 Pro 다중 로봇 모바일 청소관리 웹 v0.3

**현재 운영 URL:** https://m330-web-github-production.up.railway.app/

**다중 로봇 운영 절차와 API:** [FLEET.md](./FLEET.md) — 로봇별 관리, 일괄 데모 명령, 개별 연결키, LAN 진단 및 테스트.

## 배포
- GitHub 저장소: `lyonbegin/apk-mitm`, 브랜치 `m330-pro-mobile-web`
- 소스 위치: `m330-mobile-web/index.ts`
- Railway 프로젝트: `LEFANT-M330-PRO-MOBILE-WEB`
- **GitHub 연결 서비스:** `m330-web-github` (Dockerfile, Bun)
- GitHub 브랜치 Push → Railway 자동 빌드·배포 연결 완료
- 영구 볼륨: `m330-sqlite-data` (500MB) → `/data`
- 데이터베이스 경로: `/data/m330.sqlite`
- 상태 확인: `GET /api/health`
- 스모크 테스트: `.github/workflows/m330-web-smoke.yml`
- **구 버전:** `m330-mobile-web` Railway Function은 별도로 남아 있음. 새 GitHub 자동 배포 대상은 위의 새 서비스임.

## 기능
- 모바일 반응형 웹 (한국어)
- 면학동·경애동 각 1~5층 초기 선택 UI (학교 실측값 아님)
- 청소 시작·일시정지·충전 복귀 **데모 시뮬레이션**
- 층별 청소 계획 및 작업 기록 **SQLite 영구 저장**
- 방문자별 HTTP-only 세션 쿠키로 데모 데이터 분리
- 지도: 실제 기기 미연동, 자리 표시 화면만 구현

## 보안 및 실기기 제약
- **현재는 데모 전용으로 실제 로봇으로 명령을 전송하지 않습니다.**
- 배터리 수치·상태는 가상값입니다.
- 일정 저장은 **자동 실행 예약이 아닙니다**.
- 클리프 센서나 위험한 계단 이동 기능을 우회하지 않습니다.
- 실제 M330 Pro 명령 DP·프로토콜·연결 인증은 아직 실기기 검증이 필요합니다.
- Railway 서버는 학교 LAN 내부 로봇의 사설 IP에 바로 연결할 수 없습니다.
- 실기기 연동은 현장 로컬 게이트웨이와 별도 인증 절차가 필요합니다.
- 현 단계의 세션 쿠키는 데모 데이터 분리만 담당하며 운영자 계정 인증 수단이 아닙니다.

## API
| Method | Path | 용도 |
| --- | --- | --- |
| GET | `/` | 모바일 UI |
| GET | `/api/health` | 서버 및 SQLite 준비 확인 |
| GET | `/api/dashboard` | 세션별 상태·청소계획·기록 |
| GET | `/api/diagnostics` | 현재 연동 상태 |
| POST | `/api/command` | **데모** 명령 시뮬레이션 |
| POST | `/api/tasks` | 데모 청소 계획 등록 |
| DELETE | `/api/tasks/:id` | 데모 청소 계획 삭제 |

## 로컬 실행
`Bun`을 설치한 뒤:
```sh
cd m330-mobile-web
M330_DB_PATH=./m330.sqlite bun run index.ts
```
기본 포트: 3000.

## 데이터 보존
Railway 서비스 재배포·재시작 시에도 영구 볼륨의 DB 파일은 보존됩니다. 단, 사용자가 브라우저 쿠키를 삭제하면 이전 세션과 연결이 끊길 수 있으며, 데이터 복구 기능은 아직 없습니다. 별도 DB 백업도 구성하지 않았습니다.

## GitHub 자동 테스트
GitHub Actions 워크플로는 실제 URL에서 UI, 헬스체크, DB를 이용한 일정 등록·조회·삭제, 세션 분리, 실기기 송신 없는 데모 명령 응답을 검증합니다.

## 역공학 근거
업로드된 Lefant v3.3.25 XAPK 정적 분석으로 M330 Pro 모델명, Tuya SDK 경로, 명령 상수를 확인했습니다. 그러나 실제 M330 Pro의 통신·페어링·지도 수신은 아직 성공 검증한 것이 아닙니다. APK와 Device Local Key는 소스 저장소에 업로드하지 않습니다.
