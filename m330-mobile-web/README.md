# Lefant M330 Pro 모바일 청소관리 웹

실행 URL: https://m330-mobile-web-production.up.railway.app/

## 현재 배포
- Railway 프로젝트: `LEFANT-M330-PRO-MOBILE-WEB`
- Railway 서비스: `m330-mobile-web` (Bun 1.4 Railway Function)
- 실행 소스: `m330-mobile-web/index.ts`
- 화면: 모바일 퍼스트 반응형 한국어 웹
- API: GET /api/health, GET /api/dashboard, GET /api/diagnostics, POST /api/command, POST /api/tasks, DELETE /api/tasks/:id

## 중요
- 현재 버전은 데모 모드입니다. 로봇 제어 명령은 시뮬레이션으로만 수행되며 실기기에는 전송되지 않습니다.
- 지도는 아직 연동되지 않았습니다.
- 배터리 82% 및 모든 상태 값은 가상 표시입니다.
- 건물당 1~5층 구성도 초기 입력값입니다.
- 데모 명령 및 일정은 Railway Function 프로세스 메모리에 저장됩니다. 서버가 재시작되면 초기화됩니다.
- 외부 URL에 공개된 데모로서 여러 방문자가 같은 데모 상태를 보게 됩니다.
- GitHub의 `m330-pro-mobile-web` 브랜치에만 반영되어 있으며 원본 `main` 브랜치는 건드리지 않았습니다.
- Railway Function은 **GitHub 브랜치와 자동 배포 연결되지 않았습니다**. GitHub 소스 변경 후 Railway Function 소스도 별도로 갱신해야 합니다.

## 로컬 실행
Bun 설치 후:
```sh
bun run m330-mobile-web/index.ts
```
브라우저: http://localhost:3000

## 향후 실기기 연동
M330 Pro의 모델별 DP 명령·인증·로컬 통신을 검증한 후, 학교 로봇과 같은 LAN의 게이트웨이를 통해 운영해야 합니다. 인증 없는 인터넷 공개 로봇 제어는 구현하지 않습니다.

## 자료
앱 정적 분석 결과: 업로드된 `Lefant_v3.3.25_APKPure.xapk`에 대한 대화 내 분석보고서. APK 원본, 키, 인증정보는 저장소에 포함하지 않습니다.
