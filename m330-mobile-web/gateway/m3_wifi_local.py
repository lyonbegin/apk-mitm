#!/usr/bin/env python3
"""Localhost-only Wi-Fi operator page for a user's M3 Max robot.

Run python3 m3_wifi_local.py then open http://127.0.0.1:8765/
This is a companion to Railway, not an official Lefant installation.
All Wi-Fi/AP changes happen on the user's machine via OS commands.
No Wi-Fi password, device MAC or Local Key is uploaded to Railway.
"""
from __future__ import annotations
from hmac import compare_digest
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import json
import os
import secrets
import sys
from urllib.parse import urlsplit

from m3_onboard import join_ap, wifi_report, active_wifi, push, WEB

PORT = 8765
SESSION_TOKEN = secrets.token_urlsafe(32)
ORIGINS = {"http://127.0.0.1:8765", "http://localhost:8765"}
PAGE = """<!doctype html><html lang="ko"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>M3 Max Wi-Fi 연결</title>
<style>
*{box-sizing:border-box}body{font:15px/1.65 system-ui,sans-serif;max-width:640px;margin:25px auto;padding:0 16px;color:#222}
button,input{font:inherit;padding:10px;border:1px solid #777;background:white;border-radius:5px}
button{cursor:pointer}button:focus,input:focus{outline:2px solid black}
section{border:1px solid #bbb;padding:18px;margin-top:14px;border-radius:9px}
pre{white-space:pre-wrap;overflow-wrap:anywhere}p{margin:.6em 0}small{color:#666}
</style></head><body><h1>M3 Max Wi-Fi 연결</h1>
<p>Bluetooth는 사용하지 않습니다. 이 페이지는 현재 Mac/PC에서만 작동하며
로봇의 Wi-Fi AP 연결과 같은 공유기 내 Tuya 장치 검색을 지원합니다.</p>
<section><h2>1. Wi-Fi 검색</h2>
<button type="button" id="scan">현재 Wi-Fi와 주변 로봇 AP 검색</button>
<pre id="state">검색 전</pre><div id="aps"></div></section>
<section><h2>2. 로봇 AP 접속</h2>
<p>위에서 발견한 로봇 AP를 선택하시거나 AP 이름을 직접 입력하십시오.
접속 시 컴퓨터의 기존 Wi-Fi가 끊길 수 있습니다.</p>
<label>로봇 AP 이름 <input id="ssid" type="text" maxlength="32" autocomplete="off" placeholder="실제 로봇의 AP 이름"/></label>
<button type="button" id="join">이 Wi-Fi AP에 연결</button>
<p><small>이 동작은 컴퓨터와 AP 간 Wi-Fi 접속만 수행합니다. Tuya 클라우드 활성화,
가정용 공유기 Wi-Fi 정보 전달, M3 Max 인증 및 주행 명령은 아직 구현되지 않았습니다.</small></p>
<pre id="join-result"></pre></section>
<section><h2>3. Railway 관리 웹과 연결</h2>
<p>관리 웹에서 발급한 현장 연결키를 실행 PC의 M330_BRIDGE_KEY 환경변수에 설정해
도우미를 실행하면 비식별 Wi-Fi 검색 결과를 전송할 수 있습니다.</p>
<button type="button" id="upload">관리 웹에 검색 상태 보고</button>
<pre id="upload-result"></pre>
<p><a href="https://m330-web-github-production.up.railway.app/" target="_blank" rel="noopener">기존 M3 Max 관리 웹 열기</a></p></section>
<script>
"use strict";
const CSRF=__CSRF__;
const text=(id,s)=>document.getElementById(id).textContent=s;
async function api(url,opts){
 const res=await fetch(url,{cache:"no-store",...opts});
 const data=await res.json();
 if(!res.ok)throw Error(data.error||"요청 실패");
 return data;
}
async function scan(){
 try{
  text("state","Wi-Fi 네트워크와 LAN 기기 검색 중");
  const d=await api("/api/scan");
  text("state","현재 Wi-Fi: "+(d.connected_wifi||"확인 불가")+
     "\n로봇 AP 연결: "+(d.result.diagnostics.wifi_ap_joined?"OS가 연결 확인":"미확인")+
     "\n로봇 계열 AP 후보: "+d.result.diagnostics.ap_candidates+
     "\nTuya LAN 후보: "+d.result.diagnostics.lan_candidates+
     "\n검색 상태: "+d.result.diagnostics.scan_state+
     "\n실기기 제어: 미검증");
  const container=document.getElementById("aps");container.replaceChildren();
  for(const name of d.ap_names){
   const button=document.createElement("button");
   button.type="button";button.textContent=name;
   button.onclick=()=>{document.getElementById("ssid").value=name;};
   container.appendChild(button);
  }
 }catch(e){text("state",e.message);}
}
async function post(url,data){
 return api(url,{method:"POST",headers:{"Content-Type":"application/json","X-M3-CSRF":CSRF},body:JSON.stringify(data)});
}
document.getElementById("scan").onclick=scan;
document.getElementById("join").onclick=async()=>{
 const ssid=document.getElementById("ssid").value.trim();
 if(!ssid){text("join-result","실제 AP 이름을 선택하십시오.");return;}
 if(!confirm(ssid+" Wi-Fi에 이 컴퓨터를 연결하시겠습니까? 인터넷이 끊길 수 있습니다."))return;
 try{
  text("join-result","현재 컴퓨터의 Wi-Fi 연결을 전환합니다.");
  const d=await post("/api/join",{ssid});
  text("join-result",d.message+" (M3 Max 인증·제어 완료가 아닙니다)");
  await scan();
 }catch(e){text("join-result",e.message);}
};
document.getElementById("upload").onclick=async()=>{
 try{
  const d=await post("/api/upload",{});
  text("upload-result",d.accepted?"Railway에 비식별 Wi-Fi 결과를 전송했습니다.":"전송 실패");
 }catch(e){text("upload-result",e.message);}
};
scan();
</script></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # No SSID, passwords, token or internal routes in access logs.
        return

    def _respond(self, status, value):
        body = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _allowed_host(self):
        return self.headers.get("Host", "") in {"127.0.0.1:8765", "localhost:8765"}

    def do_GET(self):
        if not self._allowed_host():
            return self._respond(403, {"error": "로컬호스트 접근만 허용됩니다."})
        path = urlsplit(self.path).path
        if path == "/":
            html = PAGE.replace("__CSRF__", json.dumps(SESSION_TOKEN)).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Security-Policy",
                             "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'")
            self.send_header("Content-Length", str(len(html)))
            self.end_headers()
            self.wfile.write(html)
            return
        if path == "/api/scan":
            result, aps = wifi_report()
            return self._respond(200, {"result": result, "ap_names": aps,
                                        "connected_wifi": active_wifi(),
                                        "device_authenticated": False,
                                        "commands_enabled": False})
        return self._respond(404, {"error": "요청 경로가 없습니다."})

    def do_POST(self):
        if not self._allowed_host() or self.headers.get("Origin") not in ORIGINS:
            return self._respond(403, {"error": "허용된 로컬 페이지에서만 요청할 수 있습니다."})
        token = self.headers.get("X-M3-CSRF", "")
        if not compare_digest(token, SESSION_TOKEN):
            return self._respond(403, {"error": "로컬 요청 인증 실패"})
        if self.headers.get("Content-Length", "").isdigit() is False:
            return self._respond(400, {"error": "요청 길이가 유효하지 않습니다."})
        length = int(self.headers["Content-Length"])
        if not 0 <= length <= 2048:
            return self._respond(413, {"error": "요청 크기가 초과됐습니다."})
        try:
            obj = json.loads(self.rfile.read(length))
        except Exception:
            return self._respond(400, {"error": "JSON 형식 오류"})
        if self.path == "/api/join":
            ssid = obj.get("ssid", "") if isinstance(obj, dict) else ""
            if not isinstance(ssid, str) or not 1 <= len(ssid) <= 32:
                return self._respond(422, {"error": "로봇 Wi-Fi AP 이름이 유효하지 않습니다."})
            try:
                join_ap(ssid)
                return self._respond(200, {"message": "현장 컴퓨터의 지정 Wi-Fi AP 접속 확인",
                                           "robot_authenticated": False})
            except Exception as e:
                return self._respond(409, {"error": str(e)})
        if self.path == "/api/upload":
            key = os.environ.get("M330_BRIDGE_KEY", "")
            if not key:
                return self._respond(400, {"error": "로컬 실행 환경에 M330_BRIDGE_KEY가 없습니다."})
            try:
                result, _ = wifi_report()
                return self._respond(200, {"accepted": push(WEB, key, result)})
            except Exception:
                return self._respond(502, {"error": "Railway 전송 불가. 인터넷 및 연결키를 확인하십시오."})
        return self._respond(404, {"error": "요청 경로가 없습니다."})


def main():
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("M3 Max Wi-Fi 로컬 도우미: http://127.0.0.1:8765/", flush=True)
    print("로봇 AP 접속과 M3 Max 인증은 다릅니다. 공식 앱 불필요; Bluetooth 미사용.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
