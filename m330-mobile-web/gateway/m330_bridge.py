#!/usr/bin/env python3
"""One-way read-only status bridge from the robot's LAN to the M330 web UI.

The bridge deliberately has no API for sending commands to the robot.
The Tuya Local Key stays on the on-site host and is never posted to Railway.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from m330_lan_probe import probe, read_config

DEFAULT_WEB = "https://m330-web-github-production.up.railway.app"
MAX_DPS = 80


def normalise_dps(raw: dict) -> dict:
    """Limit sensitive/unexpected data; no arbitrary nested device payloads."""
    clean = {}
    for k, v in list(raw.items())[:MAX_DPS]:
        key = str(k)
        if not key.isdecimal() or len(key) > 4:
            continue
        if isinstance(v, (bool, int, float)) or v is None:
            clean[key] = v
        elif isinstance(v, str):
            clean[key] = v[:160]
    return clean


def make_payload(probed: dict) -> dict:
    return {
        "mode": "read_only",
        "connected": probed.get("connected") is True,
        "device_ref": str(probed.get("device_ref", ""))[:12],
        "protocol": str(probed.get("protocol", "")),
        "raw_dps": normalise_dps(probed.get("raw_dps", {})),
        "at": str(probed.get("at", "")),
    }


def push(server: str, token: str, payload: dict) -> None:
    parsed = urlparse(server)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Railway 웹주소는 HTTPS URL이어야 합니다.")
    endpoint = server.rstrip("/") + "/api/gateway/observations"
    content = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
    request = Request(endpoint, data=content, method="POST", headers={
        "Content-Type": "application/json",
        "X-M330-Pairing-Key": token,
    })
    with urlopen(request, timeout=10) as response:
        if response.status != 200:
            raise RuntimeError("브리지 서버가 상태를 수락하지 않았습니다.")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="M330 Pro LAN → Railway 읽기 전용 상태 연결")
    parser.add_argument("--once", action="store_true", help="상태 조회 및 업로드 1회만 수행")
    parser.add_argument("--interval", type=int, default=30, help="조회 간격(초, 최소 10)")
    parser.add_argument("--server", default=DEFAULT_WEB, help="웹앱 HTTPS 주소")
    parser.add_argument("--dry-run", action="store_true", help="기기·서버에 접근하지 않고 payload 형식 검증")
    args = parser.parse_args(argv)
    if args.dry_run:
        print(json.dumps({"mode": "simulation", "would_upload": False,
                          "raw_dps": {}, "connected": False}, ensure_ascii=False))
        return 0
    token = os.environ.get("M330_BRIDGE_KEY", "").strip()
    if not token or len(token) < 32:
        print("웹앱에서 발급받은 브리지 연결키를 M330_BRIDGE_KEY에 입력하십시오.", file=sys.stderr)
        return 2
    try:
        config = read_config()
    except (ValueError, RuntimeError):
        print("장치 환경변수(M330_HOST/DEVICE_ID/LOCAL_KEY/PROTOCOL)를 확인하십시오.", file=sys.stderr)
        return 2
    interval = max(args.interval, 10)
    while True:
        try:
            payload = make_payload(probe(config))
            push(args.server, token, payload)
            print(json.dumps({"connected": True, "upload": "accepted",
                              "dp_count": len(payload["raw_dps"])}, ensure_ascii=False), flush=True)
        except (HTTPError, URLError, RuntimeError, TimeoutError, ValueError) as exc:
            # Deliberately never print exception string: third-party errors can contain secrets.
            print(json.dumps({"connected": False, "upload": "failed",
                              "reason": type(exc).__name__}, ensure_ascii=False), flush=True)
            if args.once:
                return 1
        except Exception as exc:
            print(json.dumps({"connected": False, "upload": "failed",
                              "reason": type(exc).__name__}, ensure_ascii=False), flush=True)
            if args.once:
                return 1
        if args.once:
            return 0
        time.sleep(interval)


if __name__ == "__main__":
    raise SystemExit(main())
