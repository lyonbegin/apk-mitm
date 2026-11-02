#!/usr/bin/env python3
"""Lefant M3 Max: official-app-free, read-only local discovery and cloud status relay.

Scans Bluetooth advertisements, local Tuya discovery broadcasts, nearby Wi-Fi AP
names. A candidate is NOT a paired, authenticated or identified robot. No device
command, Wi-Fi credential submission, cloud activation or DP write takes place.
Only counts and sanitized scanner availability are uploaded to Railway.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import platform
import re
import subprocess
import sys
from urllib.parse import urlparse
from urllib.request import Request, urlopen

DEFAULT_WEB = "https://m330-web-github-production.up.railway.app"
CANDIDATE_NAME = re.compile(r"(lefant|m3[ _-]?max|tuya|smartlife|robot)", re.I)


def wifi_candidates():
    """Nearby AP candidates only; do not collect home SSIDs or Wi-Fi secrets."""
    system = platform.system()
    commands = []
    if system == "Linux":
        commands.append(["nmcli", "-t", "-f", "SSID", "dev", "wifi", "list", "--rescan", "yes"])
    elif system == "Darwin":
        commands.extend([
            ["/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport", "-s"],
        ])
    for cmd in commands:
        try:
            run = subprocess.run(cmd, timeout=12, stdout=subprocess.PIPE,
                                 stderr=subprocess.DEVNULL, text=True, check=False)
            if run.returncode == 0:
                rows = [line.strip() for line in run.stdout.splitlines()]
                return min(100, sum(1 for line in rows if CANDIDATE_NAME.search(line))), "complete"
        except (OSError, subprocess.TimeoutExpired):
            pass
    return 0, "unavailable"


def lan_candidates():
    """Tuya UDP broadcast discovery (no key required); all devices are unverified."""
    try:
        import tinytuya
    except ImportError:
        return 0, "unavailable"
    try:
        # No device ID, IP, MAC or local key is transferred to the web service.
        devices = tinytuya.deviceScan(verbose=False, max_retries=2)
        return min(100, len(devices) if isinstance(devices, dict) else 0), "complete"
    except Exception:
        return 0, "unavailable"


async def ble_candidates(seconds=8):
    """Read-only BLE advertisements; no BLE connect, pairing, GATT writes or keys."""
    try:
        from bleak import BleakScanner
    except ImportError:
        return 0, "unavailable"
    try:
        items = await BleakScanner.discover(timeout=seconds, return_adv=True)
        names = []
        if isinstance(items, dict):
            for _, value in items.items():
                if not isinstance(value, tuple) or len(value) != 2:
                    continue
                device, advert = value
                names.append(str(getattr(advert, "local_name", None) or getattr(device, "name", "") or ""))
        return min(100, sum(1 for n in names if CANDIDATE_NAME.search(n))), "complete"
    except Exception:
        return 0, "unavailable"


def scan():
    ap, a = wifi_candidates()
    lan, b = lan_candidates()
    ble, c = asyncio.run(ble_candidates())
    if ble:
        phase = "ble_candidate"
    elif ap:
        phase = "ap_candidate"
    elif lan:
        phase = "lan_candidate"
    else:
        phase = "not_detected"
    phases = (a, b, c)
    scan_state = "complete" if all(x == "complete" for x in phases) else (
        "partial" if any(x == "complete" for x in phases) else "unavailable"
    )
    return {"schema_version": 1, "phase": phase, "diagnostics": {
        "ble_candidates": ble, "ap_candidates": ap, "lan_candidates": lan,
        "scan_state": scan_state
    }}


def push(server, token, payload):
    parsed = urlparse(server)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("HTTPS Railway 웹 주소만 허용합니다.")
    if not re.fullmatch(r"[0-9a-f]{64}", token):
        raise ValueError("64자리 현장 연결키를 지정하십시오.")
    request = Request(
        server.rstrip("/") + "/api/m3/onboarding/observe",
        method="POST",
        data=json.dumps(payload, separators=(",", ":")).encode(),
        headers={"Content-Type": "application/json", "X-M330-Pairing-Key": token},
    )
    with urlopen(request, timeout=12) as response:
        return response.status == 200


def main(argv=None):
    parser = argparse.ArgumentParser(description="M3 Max BLE/AP/Tuya LAN 후보 검색 — 공식 앱 설치 불필요")
    parser.add_argument("--scan", action="store_true", help="현장 기기 후보 검색")
    parser.add_argument("--push", action="store_true", help="Railway 웹으로 비식별 검색결과 전송")
    parser.add_argument("--server", default=DEFAULT_WEB)
    parser.add_argument("--simulate", action="store_true", help="실기기에 접근하지 않고 데이터 형식 시험")
    args = parser.parse_args(argv)
    if not args.scan and not args.simulate:
        parser.error("--scan 또는 --simulate 옵션이 필요합니다.")
    if args.simulate:
        payload = {"schema_version": 1, "phase": "not_detected", "diagnostics": {
            "ble_candidates": 0, "ap_candidates": 0, "lan_candidates": 0,
            "scan_state": "unavailable"
        }}
    else:
        payload = scan()
    # Never print SSID, network password, Bluetooth MAC, device ID, local key or bridge key.
    print(json.dumps({**payload, "verified_hardware": False, "command_writes": False},
                     ensure_ascii=False), flush=True)
    if args.push and not args.simulate:
        try:
            token = os.environ.get("M330_BRIDGE_KEY", "")
            accepted = push(args.server, token, payload)
            print(json.dumps({"railway_discovery_report_accepted": accepted},
                             ensure_ascii=False), flush=True)
            return 0 if accepted else 1
        except Exception as exc:
            print(json.dumps({"railway_discovery_report_accepted": False,
                              "error_type": type(exc).__name__}, ensure_ascii=False),
                  file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
