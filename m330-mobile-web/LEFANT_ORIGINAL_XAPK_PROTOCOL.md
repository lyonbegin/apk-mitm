# Lefant v3.3.25 — 원본 APK 기반 직접 통신 계약

원본: 사용자 제공 Lefant_v3.3.25_APKPure.xapk
패키지: com.yunshi.robotlife, v3.3.25
정적 DEX 추출. 제조사 원격 서버의 응답과 M3 Max 실물 동작은 아직 미검증.

## 원본에서 직접 확인한 동작

1. `classes9.dex`의 `SharedPrefs.getHosturl` →
   `InitProjectDataUtils.getHost`는 Lefant인 경우 `https://api.useerobot.com`을 반환한다.
2. `Config$URL.<clinit>`은 `/v5/client/login-with-password`,
   `/v1/device/category-model-tree`,
   `/v1/device/user-all-device-list-group-by-home` 경로를 구성한다.
3. `classes10.dex`의 `LoginViewModel.commonLogin`은 password 로그인 분기에서
   `account`, `password` 필드를 만들고 `LOGIN_WITH_PASSWORD_V5`에 POST한다.
4. `LoginViewModel$18`은 `UserInfoBean.DataEntity.getAccess_token`,
   `getThird_reg_uuid`, `getThird_password`, `getThird_uuid_tuya`를 읽고,
   `LoginViewModel.realLogin`에 전달한다. 앱은 제조사 로그인 결과를 다시
   자체 SDK 계정 연동에 사용하는 형태다.
5. `ProductListViewModel.initData`는 `GET_PRODUCT_LIST`에
   `cmt_cache_md5` 파라미터로 POST한다.
6. `ProductListActivity3.S`는 서버의 `paired_type_list` 값에 따라
   AP/EZ/Bluetooth 지원 여부를 설정한다. 이 값은 M3 Max 전용으로 APK에 하드코딩된 것이 아니다.
7. `BindDeviceActivity.gotoBind`, `DeviceManagerUtils.addDevice`는
   ThingHomeSdk의 `THING_AP`/`THING_EZ`·`ActivatorBuilder.setToken`을 사용한다.
8. `TuyaDeviceHandleUtils.publishDps`는 `IThingDevice.publishDps`에
   원본 기기별 DP 명령을 전달한다.

## 구현 원칙

- **원본 Lefant 계정 + 제조사 API** 사용. 별도의 Tuya IoT 개발자 Client ID/Secret,
  임의로 생성한 앱 Schema 또는 별도 테스트 사용자 계정은 요구하지 않는다.
- `lefant-original-client.ts`는 원본 앱에서 검증된 상대 경로만 호출한다.
  현재 구현은 계정 로그인·제품 목록·기기 목록 **읽기만** 수행한다.
- 민감한 로그인 비밀번호는 요청 직후 폐기하며, 사용자 access_token은 Railway
  서버 프로세스 메모리에서 세션별로 짧게 유지한다. 세부 기기 인증키와 secret은 브라우저로 반환하지 않는다.
- 제조사 SDK가 실제 기기와 수행하는 최초 등록, 지도 P2P, 상태 구독, 기기별 DP 쓰기는
  원본 SDK의 동작을 확인하여 **별도 실기기 검증 후** 지원한다.
- 실물 기기 인증 전에는 시뮬레이션과 실제 청소 제어를 혼합하지 않는다.

## 현재 한계

1. 실제 사용자 Lefant 계정 인증으로 제조사 API 성공을 시험하지 못했다.
2. M3 Max 전용 paired_type_list 및 sdk_source는 원본 제조사 서버 응답이 없어서 미확정.
3. `third_password`, `third_reg_uuid`를 통한 SDK 연동을 서버에서 재현하지 못했다.
4. 원본 UI의 모든 화면을 웹에 옮긴 것이 아니다.
5. 하드웨어 최초 등록, 모니터링, 지도 및 운행 명령은 아직 실기기 검증 전.

## 금지한 이전 방식

- 단독 `@tuyapi/link` EZ 토큰, 외부 IoT 프로젝트 키 입력,
  로봇의 원본 제품 권한과 무관한 22KB 시험 앱을 원본 등록앱이라고 표시하는 행위.
