#!/usr/bin/env python3
"""Read-only Lefant M330 Pro LAN diagnostic gateway.

No commands are sent to the robot (no start, pause, dock or wheel control).
Protocol and datapoints are deliberately not assumed for this model.
"""
from __future__ import annotations
import argparse
import hashlib
import ipaddress
import json
import os
import sys
import time
from datetime import datetime, timezone

def emit(value: dict) -> None:
    print(json.dumps(value, ensure_ascii=False, separators=(",", ":")), flush=True)

def validate_host(host: str) -> str:
    try:
        address = ipaddress.ip_address(host)
    except ValueError as exc:
        raise ValueError("M330_HOST에는 학교 내부의 숫자 IP 주소를 입력하십시오.") from exc
    if not isinstance(address, ipaddress.IPv4Address) or not address.is_private:
        raise ValueError("게이트웨이는 사설 IPv4 주소의 로봇만 조회합니다.")
    return str(address)

def safe_device_ref(device_id: str) -> str:
    return hashlib.sha256(device_id.encode("utf-8")).hexdigest()[:12]

def read_config() -> dict:
    host = os.environ.get("M330_HOST", "").strip()
    device_id = os.environ.get("M330_DEVICE_ID", "").strip()
    local_key = os.environ.get("M330_LOCAL_KEY", "").strip()
    protocol = os.environ.get("M330_PROTOCOL", "").strip()
    missing = [name for name, value in [
        ("M330_HOST", host), ("M330_DEVICE_ID", device_id),
        ("M330_LOCAL_KEY", local_key), ("M330_PROTOCOL", protocol)
    ] if not value]
    if missing:
        raise ValueError("필수 환경변수 미설정: " + ", ".join(missing))
    if protocol not in {"3.1", "3.2", "3.3", "3.4", "3.5"}:
        raise ValueError("M330_PROTOCOL은 실기기에서 확인한 버전으로 지정하십시오.")
    if len(local_key) != 16:
        raise ValueError("Local Key 길이가 유효하지 않습니다. 키는 화면이나 로그에 표시하지 않습니다.")
    return {"host": validate_host(host), "device_id": device_id,
            "local_key": local_key, "protocol": protocol}

def probe(config: dict) -> dict:
    try:
        import tinytuya
    except ImportError as exc:
        raise RuntimeError("tinytuya 설치 필요: pip install tinytuya") from exc
    device = tinytuya.Device(config["device_id"],config["host"],config["local_key"])
    device.set_version(float(config["protocol"]))
    if hasattr(device, "set_socketTimeout"):
        device.set_socketTimeout(6)
    response = device.status()  # READ-ONLY query: no set_status, set_value or commands
    if not isinstance(response, dict):
        raise RuntimeError("로봇의 상태 응답이 JSON 객체가 아닙니다.")
    if response.get("Error") or response.get("Err"):
        raise RuntimeError("통신 오류: " + str(response.get("Error") or response.get("Err"))[:90])
    dps = response.get("dps", {})
    if not isinstance(dps, dict):
        dps = {}
    return {
        "at": datetime.now(timezone.utc).isoformat(),
        "device_ref": safe_device_ref(config["device_id"]),
        "device_host": config["host"],
        "protocol": config["protocol"],
        "connected": True,
        "mode": "read_only",
        "model": "M330 Pro (사용자 지정, 모델명 실기기 검증 별도)",
        "raw_dps": dps,
        "dps_interpretation": "unverified",
        "actual_battery_percentage": None,
        "command_writes_enabled": False,
    }

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="M330 Pro 로컬 상태 조회 · 쓰기 명령 없음")
    parser.add_argument("--scan", action="store_true", help="LAN에서 Tuya 장치 공개 방송 조회(로그인 불필요)")
    parser.add_argument("--probe", action="store_true", help="인증정보로 읽기 전용 상태 1회 조회")
    parser.add_argument("--watch", type=int, default=0, metavar="SECONDS",
                        help="읽기 전용 상태를 일정한 초 간격으로 반복 조회(최소 5초)")
    parser.add_argument("--simulate", action="store_true", help="기기 없이 출력 형식 검증(가상 데이터)")
    args = parser.parse_args(argv)
    if args.simulate:
        emit({"mode":"simulation","connected":False,"raw_dps":{},"command_writes_enabled":False,
              "note":"가상 응답이며 실기기 데이터가 아닙니다."})
        return 0
    if not (args.scan or args.probe or args.watch):
        parser.print_help()
        return 0
    try:
        import tinytuya
        if args.scan:
            found = tinytuya.deviceScan()
            # A broadcast may contain real device IDs. Do not dump them.
            emit({"mode":"scan","count":len(found),"devices":[
                {"host":str(ip),"device_ref":safe_device_ref(str(v.get("gwId","")))}
                for ip,v in found.items() if isinstance(v,dict)]})
            return 0
        cfg=read_config()
        interval=max(5,args.watch) if args.watch else 0
        while True:
            emit(probe(cfg))
            if not interval:
                return 0
            time.sleep(interval)
    except Exception as exc:
        # Errors from third-party clients can contain credentials; never emit full exception.
        emit({"ok":False,"connected":False,"error_type":type(exc).__name__,
              "error":"LAN 조회 실패. 장치 IP·프로토콜·Local Key·Wi-Fi 상태를 확인하십시오."})
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
