#!/usr/bin/env python3
"""Read-only multi-device bridge for M330 Pro robots in the same LAN.

Each robot uses a separate on-premises key and HTTPS bridge token.
There are no robot control/write operations here.
"""
from __future__ import annotations
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os
from pathlib import Path
import sys
import time
from urllib.parse import urlparse

from m330_lan_probe import probe, validate_host
from m330_bridge import push, make_payload

def load_robots(path: Path) -> tuple[str, list[dict]]:
    content = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(content, dict):
        raise ValueError("설정 파일은 객체여야 합니다.")
    server = str(content.get("server", "https://m330-web-github-production.up.railway.app"))
    parsed = urlparse(server)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("서버 주소는 HTTPS여야 합니다.")
    raw = content.get("robots")
    if not isinstance(raw, list) or not 1 <= len(raw) <= 100:
        raise ValueError("로봇 1~100대의 설정이 필요합니다.")
    robots = []
    seen_tokens, seen_ids = set(), set()
    for idx, item in enumerate(raw, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"{idx}번 로봇 설정이 올바르지 않습니다.")
        name = str(item.get("name", f"로봇 {idx}"))[:40]
        host = validate_host(str(item.get("host", "")))
        device_id = str(item.get("device_id", ""))
        local_key = str(item.get("local_key", ""))
        protocol = str(item.get("protocol", ""))
        bridge_key = str(item.get("bridge_key", ""))
        if not device_id or len(local_key) != 16 or protocol not in {"3.1", "3.2", "3.3", "3.4", "3.5"}:
            raise ValueError(f"{idx}번 로봇의 Device ID / Local Key / 프로토콜을 확인하십시오.")
        if len(bridge_key) != 64 or any(c not in "0123456789abcdef" for c in bridge_key):
            raise ValueError(f"{idx}번 로봇의 웹 연결키를 확인하십시오.")
        if bridge_key in seen_tokens or device_id in seen_ids:
            raise ValueError("중복된 Device ID 또는 웹 연결키가 있습니다.")
        seen_tokens.add(bridge_key)
        seen_ids.add(device_id)
        robots.append({"name": name, "config": {
            "host": host, "device_id": device_id, "local_key": local_key,
            "protocol": protocol,
        }, "bridge_key": bridge_key})
    return server, robots

def run_one(server: str, robot: dict) -> dict:
    name = robot["name"]
    try:
        observation = probe(robot["config"])  # READ-ONLY status()
        payload = make_payload(observation)
        push(server, robot["bridge_key"], payload)
        return {"name": name, "status": "received", "dps": len(payload["raw_dps"])}
    except Exception as exc:
        # No traceback or exception detail: device libraries may include credentials.
        return {"name": name, "status": "failed", "reason": type(exc).__name__}

def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="M330 Pro 여러 대를 한 번에 상태 조회하는 읽기 전용 도구")
    parser.add_argument("--config", type=Path, default=Path("robots.json"))
    parser.add_argument("--once", action="store_true", help="각 기기당 한 번 조회")
    parser.add_argument("--interval", type=int, default=30, help="다음 조회까지 간격(초)")
    parser.add_argument("--dry-run", action="store_true", help="실제 기기/서버 접근 없이 로컬 설정 구조만 점검")
    args = parser.parse_args(argv)
    if args.dry_run:
        print(json.dumps({"mode": "simulation", "devices_contacted": 0, "uploads": 0}))
        return 0
    try:
        server, robots = load_robots(args.config)
    except Exception:
        print("설정 파일 오류: 파일 경로 또는 로봇별 값의 형식을 확인하십시오. 민감정보는 출력하지 않습니다.", file=sys.stderr)
        return 2
    interval = max(10, args.interval)
    while True:
        with ThreadPoolExecutor(max_workers=min(len(robots), 8)) as pool:
            futures=[pool.submit(run_one, server, robot) for robot in robots]
            results=[task.result() for task in as_completed(futures)]
        print(json.dumps({"checked": len(robots), "results": results}, ensure_ascii=False), flush=True)
        if args.once:
            return 0 if all(x["status"]=="received" for x in results) else 1
        time.sleep(interval)

if __name__=="__main__":
    raise SystemExit(main())
