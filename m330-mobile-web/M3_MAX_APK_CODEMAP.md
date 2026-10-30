# Lefant M3 Max — v3.3.25 APK 정적분석 코드맵 (2026-10-30)

**원본**: 사용자가 업로드한 `Lefant_v3.3.25_APKPure.xapk`; SHA-256 `66e705abaf0a118436d7e2ff034664fc5032ef2c5623d4b59b8ec7579de3a465`; package `com.yunshi.robotlife`.

**범위**: 원본 base APK의 `classes.dex`~`classes10.dex` 10개를 재검사. 앱의 개발 원본 Java/Kotlin 파일은 아니며 DEX 문자열/메서드/정적 상수/부분 디스어셈블이다. 실기기에서 명령 전송·응답 확인은 수행하지 않음.

## M3 Max 분기 증거

- `classes10.dex Lcom/yunshi/robotlife/device/EquipmentConfig;`의 `<clinit>`: `M3 Max` 정확 문자열 및 별도 정적 필드 (`v`) 초기화. `M3`, `M3L`, `M3 Ultra`도 존재.
- `EquipmentConfig$Companion.getM3Max()`, `getM3Series()` getter 존재.
- `device/devices/tuya/DeviceM3;`: `TuyaDevice`를 기반으로 하는 M3 기기 클래스. `canBackWashMop()`, `canWashMop()`, `updateStationType()`.
- `ui2/detail/DeviceM3DetailActivity;`: `initView`, `showDustCollectionDialog`, `setStationCleaningAbnormalDialog`.
- `device/base/DeviceFunctionConfiguration.supportFastMapping()`의 `getM3Max` 비교 부근 `1.10.44` MCU 버전 문자열 발견. 비교 방향은 제어흐름 재구성 필요.
- `DeviceFunctionConfiguration.hideMoppingTab()`에 M3/M3L/M3 Max 목록과 `1.11.0` 버전 검사.
- `DeviceFunctionConfiguration.supportMapManageInAll()`, `supportMopping()`, `supportSensingCleaning()` 등 M3Series 함수 참조.
- `RobotMapSettingSurfaceView.sendAreaCleanByMorePoints()`, `sendLaserByPoint()`에 M3Series 참조.
- `TuyaDeviceHandleUtils`: `switchGo()`, `stopClean()`, `returnCharge()`, `publishDps()`; `publishDps`는 Thing SDK `IThingDevice.publishDps` 호출. `returnCharge`는 JSON 구성 시 `DeviceFunConfigBean.getFunc_dp_id()`와 `chargego` 설정도 사용.

## M3 스테이션 상태

`DeviceM3.canBackWashMop`는 `getMopInstallationStatus`, `isMopModeCurrent`, `isPartialClean`, `isPositionCleaning`와 `Status.Smart` / `Cleaning` / `Paused` / `GotoWash` / `WashPaused` 등을 참조. `canWashMop`에는 `Status.DustCollection` 등이 있음. `updateStationType`에는 `Status.WashMap`, `DustCollection`, `GotoCharge`와 `BaseStationType.STOP_CLEANING` / `STOP_DUST_COLLECTION` / `PAUSE_RECHARGE` / `RETURN` 참조.

## 위험: 프로토콜에 따른 숫자 충돌

| 항목 | Tuya `LaserDP` | TanGe `TanGeLaserDP` |
|---|---:|---:|
| `SWITCH_GO` | 1 | 2 |
| `STATUS` | 5 | 5 |
| 배터리 | 8 | 6 |
| `CLEAN_AREA` | 7 | 16 |
| `CLEAN_TIME` | 6 | 17 |
| `SUCTION` | 9 | 14 |
| `BASE_STATION_FUNC_STATUS` | 158 | 158 |
| `BASE_STATION_FUNC_SETTING` | 159 | 159 |
| `BASE_STATION_CLEANING_FAULT` | 160 | 160 |
| 175의 뜻 | `DRYING_SWITCH` | `BASE_STATION_LACK_WATER_REMINDER` |

같은 숫자 2도 Tuya에선 `PAUSE`, TanGe에선 `SWITCH_GO`. **실기기 펌웨어/프로토콜 확인 없이 DP 쓰기 금지**. 앱에 상수가 있다는 사실이 M3 Max에서 사용하는 확정 명령이라는 뜻은 아님.

## 디지털 트윈 구현에 반영할 것

1. 기존 M330 상태 머신과 별도로 `M3 Max` 프로필 등록.
2. M3의 집진·물걸레 세척·세척 복귀·충전·청소 재개와 오류 상태 머신 구현.
3. Tuya/TanGe DP 어댑터를 격리하고 모델-프로토콜 식별 뒤에만 실제 쓰기 허용.
4. 지도·경로·청소면적 데이터 수신/해석은 실기기 패킷·SDK 응답 확보 후 검증.
5. 실제 선속도, 각속도, 청소폭, 배터리 소모 곡선은 APK에 있는 모델 식별자에서 유도할 수 없으므로 실측을 해야 함. 전 단계에서 가상 시험값은 반드시 `assumed`로 구분.

**재현 자료**: 기존 Library `M330PRO_REVERSE_ENGINEERING_EVIDENCE_2026-10-29.zip`의 `dex_index.py`, `dex_details.py`, `disasm.py`로 재검사 가능. 신규 M3 전용 호출 검색 결과는 별도 분석 패키지에 기록.
