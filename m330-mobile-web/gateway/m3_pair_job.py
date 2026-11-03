#!/usr/bin/env python3
"""Local-only single-flight, authorized Tuya Wi-Fi EZ registration job.

The web server receives the owner's credentials on localhost only and forwards
them through the Node worker's stdin, never CLI argv, Railway, logs, or env.
The Node worker requests a genuine cloud token and sends EZ UDP broadcasts.
Only a Tuya cloud-confirmed result can mark registration as successful.
"""
from __future__ import annotations

import json
import re
from urllib.request import Request, urlopen
from pathlib import Path
import subprocess
import threading
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent
LOCK = threading.Lock()
STATE = {
    "phase": "idle", "registered": False,
    "hardware_control_verified": False, "message": "등록 전",
    "devices": [], "finished_at": None,
}
RUNNING = False

MESSAGES = {
    "CLOUD_PAIRED": "Tuya 클라우드가 기기 등록을 확인했습니다. 기기 키는 현장 컴퓨터에만 저장되었습니다.",
    "CLOUD_PAIRED_NO_LOCAL_KEY": "클라우드 등록 확인. Local Key가 없어 실제 상태 조회는 추가 확인이 필요합니다.",
    "DEPENDENCY_MISSING": "현장 PC에서 npm install --omit=dev를 실행해야 합니다.",
    "TUYA_PROJECT_AUTH_REJECTED": "Tuya 개발자 앱 권한·Client ID/Secret/Schema 또는 제조사 제품 연동 권한이 거부되었습니다.",
    "DEVICE_DID_NOT_ACTIVATE": "기기가 활성화되지 않았습니다. Wi-Fi EZ 지원 여부·네트워크 및 Lefant 제품 권한을 확인하십시오.",
    "NETWORK_OR_CLOUD_UNREACHABLE": "인터넷 또는 Tuya 클라우드 연결에 실패했습니다.",
    "TUYA_ACTIVATION_FAILED": "Tuya 등록에 실패했습니다. 이 제품이 별도 Lefant 인증을 요구할 수 있습니다.",
    "WORKER_FAILED": "등록 작업을 처리하지 못했습니다. Node.js 설치 및 연결 환경을 확인하십시오.",
    "WORKER_TIMEOUT": "등록 요청 제한시간을 초과했습니다. 기기 인증 성공은 확인되지 않았습니다.",
}
def status():
    with LOCK:
        return dict(STATE, devices=list(STATE["devices"]))

def validate(payload):
    if not isinstance(payload, dict):
        raise ValueError("등록 설정 형식 오류")
    fields = ("ssid", "wifi_password", "api_key", "api_secret", "schema")
    for field in fields:
        v = payload.get(field)
        if not isinstance(v, str) or not v.strip():
            raise ValueError("SSID·Wi-Fi 암호·Tuya Client ID·Secret·Schema가 모두 필요합니다.")
        if len(v) > 256:
            raise ValueError("설정 항목이 너무 깁니다.")
    if payload["region"] not in ("us", "eu", "cn"):
        raise ValueError("지원하지 않는 Tuya 클라우드 지역입니다.")
    if len(payload["ssid"].encode("utf-8")) > 32 or len(payload["wifi_password"]) > 128:
        raise ValueError("Wi-Fi SSID/암호 형식이 올바르지 않습니다.")
    return {field: payload[field] for field in fields} | {"region": payload["region"]}

def _safe_code(line):
    try:
        d = json.loads(line)
    except (ValueError, TypeError):
        return "WORKER_FAILED", []
    if not isinstance(d, dict):
        return "WORKER_FAILED", []
    code = d.get("code", "WORKER_FAILED")
    if code not in MESSAGES:
        return "WORKER_FAILED", []
    devs = d.get("devices", []) if code in ("CLOUD_PAIRED","CLOUD_PAIRED_NO_LOCAL_KEY") else []
    clean = []
    if isinstance(devs, list):
        for item in devs[:3]:
            if isinstance(item, dict) and isinstance(item.get("ref"), str) and len(item["ref"]) == 12:
                clean.append({
                    "ref": item["ref"],
                    "has_local_key": item.get("has_local_key") is True,
                    "has_ip": item.get("has_ip") is True
                })
    return code, clean

def _run(config, runner=subprocess.run):
    global RUNNING
    code, devices = "WORKER_FAILED", []
    try:
        # subprocess.run receives the password as stdin, never as a command argument.
        # Do not include SDK logs, tracebacks, or stderr in server/user output.
        process = runner(
            ["node", str(ROOT / "m3_pair_ez.cjs")],
            input=json.dumps(config, ensure_ascii=False),
            text=True, capture_output=True, cwd=str(ROOT), timeout=145,
            check=False,
        )
        line = (process.stdout or "").strip().splitlines()
        code, devices = _safe_code(line[-1] if line else "")
        if process.returncode != 0 and code in ("CLOUD_PAIRED", "CLOUD_PAIRED_NO_LOCAL_KEY"):
            code, devices = "WORKER_FAILED", []
    except subprocess.TimeoutExpired:
        code = "WORKER_TIMEOUT"
    except (OSError, ValueError, RuntimeError):
        code = "WORKER_FAILED"
    finally:
        # Never store input credentials or raw process output in global state.
        with LOCK:
            STATE.update({
                "phase": "registered" if code == "CLOUD_PAIRED" else "cloud_only" if code == "CLOUD_PAIRED_NO_LOCAL_KEY" else "failed",
                "registered": code == "CLOUD_PAIRED",
                "hardware_control_verified": False,
                "message": MESSAGES.get(code, MESSAGES["WORKER_FAILED"]),
                "result_code": code,
                "devices": devices,
                "finished_at": datetime.now(timezone.utc).isoformat()
            })
            RUNNING = False
    return code

def start(payload):
    global RUNNING
    config = validate(payload)
    with LOCK:
        if RUNNING:
            raise RuntimeError("기기 등록이 이미 진행 중입니다.")
        RUNNING = True
        STATE.update({"phase":"running","registered":False,
                      "hardware_control_verified":False,
                      "message":"Tuya 클라우드 토큰 요청 및 Wi-Fi EZ 등록 실행 중",
                      "devices":[],"result_code":None,"finished_at":None})
    task = threading.Thread(target=_run, args=(config,), daemon=True)
    task.start()
    return status()


def report_to_railway(bridge_key, server="https://m330-web-github-production.up.railway.app"):
    """Report only a cloud-confirmed device fingerprint to the selected robot slot.

    This is an ON-SITE AGENT assertion, not an independent Railway verification
    and never enables real hardware writes.
    """
    if not isinstance(bridge_key, str) or not re.fullmatch(r"[0-9a-f]{64}", bridge_key):
        raise ValueError("관리 웹에서 발급한 연결키가 필요합니다.")
    with LOCK:
        if not STATE.get("registered") or not STATE.get("devices"):
            raise ValueError("실제 클라우드 등록 성공 결과가 없습니다.")
        ref = STATE["devices"][0].get("ref", "")
        if not re.fullmatch(r"[0-9a-f]{12}", ref):
            raise ValueError("장치 지문이 유효하지 않습니다.")
    body = json.dumps({"source":"tuya_ez","cloud_confirmed":True,"device_ref":ref}).encode()
    req = Request(server.rstrip("/") + "/api/m3/activation/report",data=body,method="POST",
                  headers={"Content-Type":"application/json","X-M330-Pairing-Key":bridge_key})
    with urlopen(req,timeout=12) as response:
        if response.status != 200:
            raise RuntimeError("관리 웹 등록 결과 전송 실패")
        reply = json.loads(response.read(2048))
    return {
        "agent_report_received": reply.get("agent_report_received") is True,
        "hardware_control_verified": False,
    }
