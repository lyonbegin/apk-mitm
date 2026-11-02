#!/usr/bin/env python3
"""M3 Max Wi-Fi ONLY onsite agent.

1. Discover nearby robot Wi-Fi access points (AP) and Tuya LAN broadcasts.
2. Optionally join a selected robot AP on the LOCAL computer with explicit --join-ap.
3. Send sanitized Wi-Fi discovery counts to the existing Railway web gateway.

Does not use Bluetooth or install Lefant. AP association is NOT robot activation.
No SSID/password/device identifier/local key goes to Railway. Cloud activation
token/brand account and exact Wi-Fi provisioning packet are not yet available.
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import re
import subprocess
import sys
import time
from urllib.parse import urlparse
from urllib.request import Request, urlopen

WEB = "https://m330-web-github-production.up.railway.app"
ROBOT_AP = re.compile(r"(?:lefant|tuya|smartlife|smart.?life|robot|m3[ _-]?max)", re.I)
AIRPORT = "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport"


def run(args, timeout=14):
    return subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                          text=True, timeout=timeout, check=False)


def mac_wifi_device():
    try:
        text = run(["networksetup", "-listallhardwareports"]).stdout
        blocks = text.split("\n\n")
        for block in blocks:
            if re.search(r"Hardware Port: (?:Wi-Fi|AirPort)", block, re.I):
                match = re.search(r"Device: ([a-zA-Z0-9]+)", block)
                if match:
                    return match.group(1)
    except (OSError, subprocess.TimeoutExpired):
        pass
    return None


def active_wifi():
    """Return current local SSID, which is never included in uploaded data."""
    try:
        system = platform.system()
        if system == "Darwin":
            device = mac_wifi_device()
            if not device:
                return None
            out = run(["networksetup", "-getairportnetwork", device]).stdout
            m = re.search(r"Current Wi-Fi Network:\s*(.+)", out)
            return m.group(1).strip() if m else None
        if system == "Linux":
            out = run(["nmcli", "-t", "-f", "ACTIVE,SSID", "dev", "wifi"]).stdout
            for line in out.splitlines():
                if line.startswith("yes:"):
                    return line.split(":", 1)[1].strip() or None
        if system == "Windows":
            out = run(["netsh", "wlan", "show", "interfaces"]).stdout
            m = re.search(r"(?m)^\s*SSID\s*:\s*(.+)$", out)
            return m.group(1).strip() if m else None
    except (OSError, subprocess.TimeoutExpired):
        pass
    return None


def wifi_access_points():
    """Nearby robot-like AP SSIDs returned only to the local console."""
    system = platform.system()
    try:
        if system == "Linux":
            out = run(["nmcli", "-t", "-f", "SSID", "dev", "wifi", "list", "--rescan", "yes"])
            if out.returncode != 0:
                return [], "unavailable"
            names = [x.replace(r"\:", ":").strip() for x in out.stdout.splitlines()]
        elif system == "Darwin":
            # airport -s is deprecated on some macOS versions; report unavailable
            # rather than claim there are zero nearby APs.
            out = run([AIRPORT, "-s"])
            if out.returncode != 0:
                return [], "unavailable"
            names = [re.split(r"\s{2,}", x.strip())[0] for x in out.stdout.splitlines()[1:] if x.strip()]
        elif system == "Windows":
            out = run(["netsh", "wlan", "show", "networks", "mode=bssid"])
            if out.returncode != 0:
                return [], "unavailable"
            names = re.findall(r"(?m)^\s*SSID\s+\d+\s*:\s*(.+)$", out.stdout)
        else:
            return [], "unavailable"
        return sorted(set(name for name in names if name and ROBOT_AP.search(name)))[:100], "complete"
    except (OSError, subprocess.TimeoutExpired):
        return [], "unavailable"


def lan_discovery():
    """Passive Tuya UDP LAN discovery; no device read/write or secret extraction."""
    try:
        import tinytuya
    except ImportError:
        return 0, "unavailable"
    try:
        result = tinytuya.deviceScan(verbose=False, max_retries=2)
        return min(100, len(result) if isinstance(result, dict) else 0), "complete"
    except Exception:
        return 0, "unavailable"


def wifi_report():
    aps, wifi_status = wifi_access_points()
    lan_count, lan_status = lan_discovery()
    ssid = active_wifi()
    joined = bool(ssid and ROBOT_AP.search(ssid))
    if joined:
        phase = "wifi_ap_connected"
    elif aps:
        phase = "wifi_ap_found"
    elif lan_count:
        phase = "wifi_lan_detected"
    else:
        phase = "not_detected"
    statuses = [wifi_status, lan_status]
    summary = ("complete" if all(x == "complete" for x in statuses)
               else "partial" if any(x == "complete" for x in statuses) else "unavailable")
    result = {"schema_version": 2, "phase": phase, "diagnostics": {
        "ap_candidates": len(aps), "lan_candidates": lan_count,
        "scan_state": summary, "wifi_ap_joined": joined,
    }}
    return result, aps


def join_ap(ssid, password=None):
    """Explicitly associate LOCAL host with the user-chosen Wi-Fi AP.

    Never transmits home router credentials to a robot. OS confirms association;
    any M3 Max Tuya cloud activation is a separate, currently unimplemented step.
    """
    if not isinstance(ssid, str) or not (1 <= len(ssid) <= 32) or "\x00" in ssid:
        raise ValueError("Wi-Fi AP 이름이 유효하지 않습니다.")
    system = platform.system()
    if system == "Darwin":
        dev = mac_wifi_device()
        if not dev:
            raise RuntimeError("Mac Wi-Fi 장치를 확인하지 못했습니다.")
        cmd = ["networksetup", "-setairportnetwork", dev, ssid]
        if password:
            cmd.append(password)  # local process only; may be visible in OS process list
    elif system == "Linux":
        # The password, if needed, should be configured in an OS credential store,
        # not included in command arguments, logs, browser or cloud requests.
        if password:
            raise RuntimeError("암호가 필요한 AP는 OS Wi-Fi 설정에서 직접 연결하십시오.")
        cmd = ["nmcli", "dev", "wifi", "connect", ssid]
    else:
        raise RuntimeError("이 운영체제에서는 OS Wi-Fi 설정에서 AP에 직접 연결하십시오.")
    # Do not include secrets or full command in errors or logs.
    try:
        out = run(cmd, timeout=25)
    except (OSError, subprocess.TimeoutExpired):
        raise RuntimeError("Wi-Fi AP 연결 명령을 실행하지 못했습니다.") from None
    if out.returncode != 0:
        raise RuntimeError("Wi-Fi AP 연결 실패: AP 신호 및 운영체제 Wi-Fi 설정을 확인하십시오.")
    for _ in range(5):
        if active_wifi() == ssid:
            return True
        time.sleep(1)
    raise RuntimeError("Wi-Fi 연결 명령은 실행됐지만 현재 AP 연결은 확인되지 않았습니다.")


def push(server, secret, payload):
    u = urlparse(server)
    if u.scheme != "https" or not u.hostname or u.username or u.password:
        raise ValueError("HTTPS 웹 주소만 허용합니다.")
    if not re.fullmatch(r"[a-f0-9]{64}", secret):
        raise ValueError("웹에서 발급한 현장 연결키를 입력하십시오.")
    # Deliberate allowlist: no SSID, password, LAN IP, MAC or Device ID.
    safe = {"schema_version": 2, "phase": payload["phase"],
            "diagnostics": {k: payload["diagnostics"][k] for k in (
                "ap_candidates", "lan_candidates", "scan_state", "wifi_ap_joined")}}
    request = Request(
        server.rstrip("/") + "/api/m3/onboarding/observe",
        data=json.dumps(safe, ensure_ascii=False).encode(), method="POST",
        headers={"Content-Type": "application/json", "X-M330-Pairing-Key": secret})
    with urlopen(request, timeout=12) as response:
        return response.status == 200


def main(argv=None):
    p = argparse.ArgumentParser(description="Lefant M3 Max Wi-Fi 전용 로컬 연결 도우미 (Bluetooth 미사용)")
    p.add_argument("--scan", action="store_true", help="근처 로봇 Wi-Fi AP 및 공유기 LAN 기기 검색")
    p.add_argument("--join-ap", metavar="SSID", help="명시한 로봇 Wi-Fi AP에 이 PC/Mac을 연결 (사용자 지시 후)")
    p.add_argument("--push", action="store_true", help="비식별 Wi-Fi 상태를 Railway 웹에 전송")
    p.add_argument("--watch", type=int, default=0, help="지속 검색 간격(초; 최소 15초)")
    p.add_argument("--simulate", action="store_true", help="실제 기기·Wi-Fi에 접근하지 않고 형식 시험")
    p.add_argument("--server", default=WEB)
    a = p.parse_args(argv)
    if not (a.scan or a.join_ap or a.simulate):
        p.error("--scan 또는 --join-ap 또는 --simulate를 지정하십시오.")
    if a.simulate:
        sample = {"schema_version": 2, "phase": "not_detected",
                  "diagnostics": {"ap_candidates": 0, "lan_candidates": 0,
                                  "scan_state": "unavailable", "wifi_ap_joined": False}}
        print(json.dumps({**sample, "verified_hardware": False, "commands_enabled": False},
                         ensure_ascii=False))
        return 0
    if a.join_ap:
        try:
            # Wi-Fi only: user chooses AP. No BLE and NO remote robot credentials.
            join_ap(a.join_ap)
            print(json.dumps({"wifi_association": "confirmed", "device_auth": "not_verified",
                              "actual_robot_control": False}, ensure_ascii=False))
        except Exception as e:
            print(json.dumps({"wifi_association": "failed",
                              "reason": str(e)}, ensure_ascii=False), file=sys.stderr)
            return 1
    while True:
        data, names = wifi_report()
        print(json.dumps({**data, "local_wifi_ap_names": names,
                          "device_authenticated": False, "commands_enabled": False},
                         ensure_ascii=False), flush=True)
        if a.push:
            try:
                sent = push(a.server, os.environ.get("M330_BRIDGE_KEY", ""), data)
                print(json.dumps({"railway_report_accepted": sent}), flush=True)
            except Exception as e:
                # The Wi-Fi connection can lose internet when joining robot AP.
                print(json.dumps({"railway_report_accepted": False,
                                  "error_type": type(e).__name__,
                                  "hint": "로봇 AP 연결 중 인터넷이 끊겼다면 원래 Wi-Fi로 복귀해 다시 전송하십시오."},
                                 ensure_ascii=False), file=sys.stderr)
                if not a.watch:
                    return 1
        if not a.watch:
            return 0
        time.sleep(max(15, a.watch))


if __name__ == "__main__":
    raise SystemExit(main())
