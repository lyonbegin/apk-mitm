import {Database} from 'bun:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {initTwin,TWIN_VERSION} from './twin';
// LEFANT M330 PRO mobile web (demo-only). No Tuya credentials and no robot writes.
const PAGE = "<!doctype html>\n<html lang=\"ko\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\"><meta name=\"theme-color\" content=\"#103f39\"><title>M330 PRO · 청소관리</title>\n<style>\n:root{font-family:Pretendard,-apple-system,BlinkMacSystemFont,\"Noto Sans KR\",sans-serif;color:#16352f;background:#f6f8f7;font-size:15px}\n*{box-sizing:border-box}body{margin:0}.app{max-width:720px;margin:auto;min-height:100vh;padding-bottom:100px}header{display:flex;align-items:center;gap:11px;padding:20px 22px 16px;background:#fff;position:sticky;top:0;z-index:5;border-bottom:1px solid #e4e9e7}.mark{width:41px;height:41px;border-radius:12px;background:#103f39;color:white;display:grid;place-items:center;font-size:23px}.identity{flex:1}.eyebrow{font-size:10px;letter-spacing:2.5px;color:#74978d;font-weight:800}.identity strong{font-size:24px;line-height:1.1;color:#102e29}.identity strong span{color:#26907b;font-weight:400}button,select,input{font:inherit}button{cursor:pointer}button:focus-visible,select:focus-visible,input:focus-visible{outline:3px solid #42b59a;outline-offset:2px}.pill{background:#fff5e8;border:1px solid #f3dec7;color:#a55d20;border-radius:50px;padding:8px 11px;font-size:12px;font-weight:800}.refresh{height:36px;width:36px;border-radius:50%;border:1px solid #dce5e2;background:white;color:#274c44;font-size:20px}main{padding:26px 23px 0}.over{color:#598f81;font-weight:900;font-size:11px;letter-spacing:1.7px}.hero h1{font-size:29px;letter-spacing:-1.5px;margin:11px 0 8px}.muted{color:#84958f;line-height:1.6}.alert{font-size:12px;line-height:1.6;background:#fff9ed;color:#925c25;border:1px solid #edd5ab;padding:14px;border-radius:12px;margin:22px 0 20px}.robot{border-radius:25px;padding:24px 24px 0;background:linear-gradient(145deg,#16554d,#092e29);color:#fff;box-shadow:0 15px 30px #123c3020;overflow:hidden}.robothead{display:flex;justify-content:space-between;align-items:center;gap:10px}.state{background:#ffffff14;border:1px solid #ffffff28;border-radius:50px;padding:7px 12px;font-size:12px}.state:before{content:\"\";display:inline-block;height:7px;width:7px;border-radius:50%;background:#77e1c0;margin-right:7px}.robotname{font-size:10px;letter-spacing:2px;color:#b1d5c9;font-weight:900}.robotbody{display:flex;align-items:center;justify-content:space-between;min-height:190px;gap:10px}.vacuum{width:147px;height:147px;border-radius:50%;background:radial-gradient(circle at 36% 24%,#fff,#d4e4e0 72%,#a6beb8 100%);border:7px solid #cfe0dc;box-shadow:0 0 0 13px #ffffff08,0 0 0 27px #ffffff07,0 7px 12px #0003;position:relative;flex-shrink:0}.vacuum:before{content:\"\";position:absolute;left:38%;top:13%;width:33px;height:33px;border-radius:50%;background:radial-gradient(circle,#547c72 0 23%,#d7e5e1 29% 54%,#9ab7ae 60%);box-shadow:0 1px 5px #0004}.vacuum:after{content:\"\";position:absolute;right:25%;bottom:19%;height:4px;width:39px;border-radius:5px;background:#a6beb8;transform:rotate(-16deg)}.battery{text-align:right;min-width:115px}.battery .n{font-size:61px;letter-spacing:-3px;font-weight:900}.battery .n span{font-size:23px;color:#9bcbba}.batteryline{height:5px;border-radius:6px;background:#ffffff22;overflow:hidden;margin:9px 0 11px}.batteryline b{display:block;background:#b5e8d3;height:100%}.small{font-size:11px;color:#b1d5c9;line-height:1.6}.robotfoot{border-top:1px solid #ffffff1a;display:flex;justify-content:space-between;padding:15px 0;font-size:11px;color:#b5d8cd}.section{margin-top:32px}.section h2{font-size:19px;letter-spacing:-.6px;margin:7px 0 16px}.between{display:flex;justify-content:space-between;align-items:center}.buildings{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.building{padding:15px 12px;text-align:left;border:1px solid #e0e7e4;background:white;border-radius:14px;font-weight:800;color:#6a7e77}.building.active{border-color:#a6d8c7;background:#e5f5ed;color:#1a7661}.floors{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin-top:12px}.floor{border:1px solid #dce5e1;background:white;border-radius:12px;padding:12px 0;font-weight:800;color:#637c73}.floor.active{background:#10584d;color:#fff;border-color:#10584d}.controlgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.control{border:1px solid #e1e8e5;background:#fff;border-radius:18px;min-height:138px;text-align:left;padding:15px;display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;color:#183a32;font-size:13px;font-weight:900}.control.primary{background:#196d5e;color:#fff;border-color:#196d5e}.control .controlicon{width:40px;height:40px;border-radius:12px;background:#f0f5f2;display:grid;place-items:center;font-size:18px}.control.primary .controlicon{background:#ffffff24}.control small{font-size:10px;line-height:1.35;font-weight:500;color:#9aada6}.control.primary small{color:#c0e5d9}.panel{border:1px solid #e1e8e5;border-radius:18px;background:white;padding:16px}.tabs{position:fixed;bottom:0;left:0;right:0;z-index:7;background:#fff;border-top:1px solid #e4e9e7;display:flex;justify-content:space-around;max-width:720px;margin:auto;padding:10px 7px max(12px,env(safe-area-inset-bottom))}.nav{border:0;background:transparent;padding:6px 9px;color:#95a5a0;display:flex;flex-direction:column;gap:4px;align-items:center;font-size:11px}.nav .ico{font-size:21px}.nav.active{color:#17695b;font-weight:900}.hidden{display:none!important}.fields{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}input,select{width:100%;padding:12px;border:1px solid #dbe4df;border-radius:11px;background:#fff;color:#284c42}.save{background:#145e52;color:white;border:0;border-radius:11px;padding:13px 17px;font-weight:800}.empty{font-size:13px;color:#94a6a0;padding:24px 5px;text-align:center}.item{padding:13px 0;border-bottom:1px solid #eef2f0;font-size:13px}.item:last-child{border:0}.item strong{font-size:14px}.item small{display:block;color:#859b93;margin-top:5px}.delete{float:right;background:#fff1f1;border:0;padding:5px 9px;border-radius:8px;color:#b04a4a}.mapbox{height:250px;background:repeating-linear-gradient(0deg,#eaf0ed 0,#eaf0ed 1px,transparent 1px,transparent 29px),repeating-linear-gradient(90deg,#eaf0ed 0,#eaf0ed 1px,#f6f9f7 1px,#f6f9f7 29px);border:1px dashed #bacfc5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;border-radius:18px;text-align:center;color:#769286}.mapbox b{color:#2d5c4d}.toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#102d28;color:white;padding:13px 16px;border-radius:12px;z-index:20;font-size:12px;max-width:90vw;display:none;box-shadow:0 7px 20px #0003}.footnote{font-size:11px;color:#8ba198;line-height:1.65;margin-top:14px}@media(max-width:360px){main{padding:22px 14px 0}header{padding:16px 14px}.robot{padding:18px 17px 0}.vacuum{width:116px;height:116px}.battery .n{font-size:49px}.control{padding:12px;min-height:130px}} \n.fleetbar{margin:20px 0 16px;background:#fff;border:1px solid #dfebe5;border-radius:18px;padding:16px}\n.fleetbar-header{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}\n.fleetbar-header h2{font-size:18px;margin:0}.fleetcount{font-size:12px;color:#386b5e;font-weight:800}\n.fleetselect{display:flex;align-items:center;gap:8px}.fleetselect select{flex:1}\n.fleetcards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}\n.fleetcard{border:1px solid #e0eae5;border-radius:14px;background:#f7faf8;text-align:left;padding:13px;min-width:0}\n.fleetcard.active{background:#e2f4ec;border-color:#5ca58d}\n.fleetcard strong{font-size:13px;display:block;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}\n.fleetcard small{display:block;color:#577e71;font-size:11px;margin-top:7px;line-height:1.5}\n.fleetmanager{background:#f8fbf9;border:1px solid #dbe9e2;border-radius:14px;padding:12px;margin-top:14px}\n.fleetmanager summary{font-size:13px;font-weight:900;cursor:pointer;color:#1e6755}\n.fleetmanager h3{font-size:13px;margin:15px 0 9px}\n.fleetmanager .fields{margin:8px 0}\n.fleetmanager label{display:block;font-size:11px;color:#527467}\n.fleetmanager button{font-size:12px;border:1px solid #bcd7cb;background:#fff;color:#155c4c;border-radius:10px;padding:11px}\n.fleetmanager button.save{background:#145e52;color:#fff}\n.fleetmanager button.danger{background:#fff2f2;color:#a83333;border-color:#e9c7c7}\n.fleetmanager .rowactions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}\n@media(max-width:400px){.fleetcards{grid-template-columns:1fr 1fr}.fleetbar{padding:12px}}\n\n\n.fleetbatch{margin-top:14px;border-top:1px solid #e0ebe4;padding-top:13px}\n.fleetbatch h3{font-size:13px;margin:0 0 7px;color:#1c6551}\n.fleetchecks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0}\n.fleetchecks label{font-size:12px;display:flex;gap:6px;align-items:center;min-width:0;overflow-wrap:anywhere}\n.fleetchecks input{width:auto;flex-shrink:0}\n.fleetbatch .rowactions{display:flex;gap:7px;flex-wrap:wrap}\n.fleetbatch button{border-radius:9px;border:1px solid #bed8ce;padding:10px;font-size:12px;background:#fff;color:#135d49}\n.fleetbatch button.batchstart{background:#145e52;color:white}\n</style></head><body><div class=\"app\"><header><div class=\"mark\">◉</div><div class=\"identity\"><div class=\"eyebrow\">CLEAN OPERATIONS</div><strong>M330<span>PRO</span></strong></div><span class=\"pill\">데모 모드</span><button class=\"refresh\" onclick=\"load()\" aria-label=\"새로고침\">⟳</button></header>\n<main><section id=\"view-home\"><div class=\"hero\"><div class=\"over\">등촌고등학교 · 청소 운영</div><h1>오늘의 청소 현황.</h1><div class=\"muted\">2개 동의 청소 작업을 한 곳에서 관리합니다.</div></div>\n<div class=\"alert\">체험 화면입니다. 청소·충전 명령은 <b>시뮬레이션</b>으로만 실행하며 실제 M330 Pro에 전송하지 않습니다.</div>\n<section class=\"fleetbar\" aria-label=\"다중 로봇 관리\">\n <div class=\"fleetbar-header\"><h2>전체 로봇 관리</h2><span class=\"fleetcount\" id=\"fleet-count\">등록 로봇 조회 중</span></div>\n <div class=\"fleetselect\"><label for=\"robot-select\" style=\"font-size:12px;font-weight:800\">선택</label><select id=\"robot-select\" onchange=\"selectRobot(Number(this.value))\" aria-label=\"제어 대상 로봇\"></select></div>\n <div id=\"fleet-cards\" class=\"fleetcards\"></div>\n <p class=\"footnote\">로봇별 청소 일정·데모 상태·기록·현장 게이트웨이 연결을 개별 관리합니다. 배치 층은 수동 이동 위치의 기록이며 계단을 자동으로 오르지 않습니다.</p>\n <div class=\"fleetbatch\">\n <h3>여러 대 일괄 작업 (데모)</h3>\n <div style=\"display:flex;align-items:center;gap:8px\"><label style=\"font-size:12px\"><input type=\"checkbox\" id=\"fleet-checkall\" onchange=\"toggleAllRobots(this.checked)\" style=\"width:auto\"> 전체 선택</label><small id=\"batch-selected-count\" style=\"color:#628c80\"></small></div>\n <div class=\"fleetchecks\" id=\"fleet-checks\"></div>\n <div class=\"rowactions\">\n  <button class=\"batchstart\" onclick=\"batchCommand('start')\">선택 로봇 청소 시작</button>\n  <button onclick=\"batchCommand('pause')\">선택 로봇 일시정지</button>\n  <button onclick=\"batchCommand('dock')\">선택 로봇 충전 복귀</button>\n </div><p class=\"footnote\">각 로봇의 배치 층을 기준으로 별도 기록을 생성합니다. 실기기에 명령을 보내지 않습니다.</p></div>\n<details class=\"fleetmanager\" id=\"fleet-manager\"><summary>＋ 로봇 추가 · 이름/배치 변경 · 등록 해제</summary>\n <h3>새 로봇 등록</h3>\n <div class=\"fields\"><label>로봇 명칭<input id=\"new-robot-name\" maxlength=\"40\" placeholder=\"예: M330 Pro 2호기\"></label><label>배치 층<select id=\"new-robot-floor\"></select></label></div>\n <button class=\"save\" onclick=\"addRobot()\">＋ 로봇 추가</button>\n <h3>선택한 로봇 관리</h3>\n <div class=\"fields\"><label>로봇 명칭<input id=\"edit-robot-name\" maxlength=\"40\"></label><label>배치 층<select id=\"edit-robot-floor\"></select></label></div>\n <div class=\"rowactions\"><button class=\"save\" onclick=\"updateRobot()\">변경 사항 저장</button><button class=\"danger\" onclick=\"archiveRobot()\">선택 로봇 등록 해제</button></div>\n <p class=\"footnote\">등록 해제 시 해당 기기 연결키는 폐기되며, 과거 작업 이력은 DB에 보존됩니다. 최소 1대는 유지됩니다.</p></details>\n</section>\n<div class=\"robot\"><div class=\"robothead\"><span class=\"state\" id=\"status\">대기 · 예시</span><span class=\"robotname\" id=\"robot-label\">ROBOT 01 / M330 PRO</span></div><div class=\"robotbody\"><div class=\"vacuum\"></div><div class=\"battery\"><div class=\"small\">배터리 잔량</div><div class=\"n\"><span id=\"battery\">82</span><span>%</span></div><div class=\"batteryline\"><b id=\"batterybar\" style=\"width:82%\"></b></div><div class=\"small\">가상 배터리 · 실제 측정값 아님</div></div></div><div class=\"robotfoot\"><span>♧ 시뮬레이션 · 기기 미연결</span><span id=\"updated\">갱신 대기</span></div></div>\n<section class=\"section\"><div class=\"over\">WORKSPACE</div><div class=\"between\"><h2>청소구역 선택</h2><small style=\"color:#9aaba5\">10개 층 · 초기 구성</small></div><div class=\"buildings\"><button id=\"b-myeonhak\" class=\"building active\" onclick=\"pickBuilding('myeonhak')\">▤ &nbsp; 면학동</button><button id=\"b-gyeongae\" class=\"building\" onclick=\"pickBuilding('gyeongae')\">▤ &nbsp; 경애동</button></div><div class=\"floors\" id=\"floors\"></div></section>\n<section class=\"section\"><div class=\"over\">QUICK CONTROL</div><div class=\"between\"><h2>로봇 제어</h2><small style=\"color:#9aaba5\">명령 확인 후 전송</small></div><div class=\"controlgrid\"><button class=\"control primary\" onclick=\"command('start')\"><span class=\"controlicon\">▶</span><span>청소 시작</span><small>선택한 층</small></button><button class=\"control\" onclick=\"command('pause')\"><span class=\"controlicon\">Ⅱ</span><span>일시정지</span><small>진행 중 작업</small></button><button class=\"control\" onclick=\"command('dock')\"><span class=\"controlicon\">⌂</span><span>충전 복귀</span><small>등록된 충전기</small></button></div><p class=\"footnote\">※ 위 명령은 서버의 데모 상태만 변경합니다. 실제 로봇은 작동하지 않습니다.</p></section>\n<section class=\"section\"><div class=\"over\">RECENT ACTIVITY</div><div class=\"between\"><h2>최근 작업 기록</h2><button style=\"background:none;border:0;color:#197360;font-weight:800\" onclick=\"switchTab('log')\">전체 보기 →</button></div><div class=\"panel\" id=\"recent\"></div></section>\n</section>\n<section id=\"view-map\" class=\"hidden\"><div class=\"over\">FLOOR MAP</div><h1>층별 지도</h1><p class=\"muted\">현재 선택: <b id=\"map-floor\">면학동 5층</b></p><div class=\"mapbox\"><div style=\"font-size:34px\">▤</div><b>실제 지도 데이터 미연동</b><span style=\"font-size:12px\">M330 Pro 지도 프로토콜 확인 후 표시됩니다.</span></div><p class=\"footnote\">APK에서 지도 관련 SDK와 명령은 확인했지만 실제 기기의 지도 수신은 아직 검증되지 않았습니다.</p></section>\n<section id=\"view-tasks\" class=\"hidden\"><div class=\"over\">SCHEDULE</div><h1>청소 일정</h1><p class=\"muted\">층별 청소 계획을 저장합니다. 자동 실행은 하지 않습니다.</p><div class=\"panel\"><div class=\"fields\"><label>청소구역<select id=\"task-floor\"></select></label><label>시각<input type=\"time\" id=\"task-time\" value=\"07:00\"></label></div><label style=\"display:block;margin-bottom:10px\">요일<select id=\"task-days\"><option value=\"0,1,2,3,4\">월~금</option><option value=\"0,1,2,3,4,5\">월~토</option><option value=\"0,1,2,3,4,5,6\">매일</option><option value=\"5,6\">주말</option></select></label><button class=\"save\" onclick=\"addTask()\">＋ 일정 등록</button><p class=\"footnote\">일정은 서버에 저장되며 같은 브라우저에서 다시 열면 유지됩니다.</p></div><section class=\"section\"><h2>등록된 일정</h2><div class=\"panel\" id=\"task-list\"></div></section></section>\n<section id=\"view-log\" class=\"hidden\"><div class=\"over\">HISTORY</div><h1>작업 기록</h1><p class=\"muted\">실제 청소 이력이 아니라 데모 버튼 작동 기록입니다.</p><div class=\"panel\" id=\"history\"></div></section>\n<section id=\"view-settings\" class=\"hidden\"><div class=\"over\">SYSTEM</div><h1>연결 · 진단</h1><div class=\"panel\"><p><b>M330 Pro 모바일 웹 v0.3</b></p><p>운영 모드: <b>시뮬레이션 전용</b></p><p>로봇 통신: <b>미연결</b></p><p>지도 수신: <b>미구현</b></p><p>배포: <b>GitHub 자동 배포</b></p><p class=\"footnote\">실제 로봇 제어용 인증정보가 없으므로 원격 제어 명령 API는 존재하지 않습니다. 새로고침과 명령 상태는 데모 용도입니다.</p><button class=\"save\" onclick=\"checkHealth()\">서버 응답 확인</button><pre id=\"health\" style=\"white-space:pre-wrap;word-break:break-all;color:#52766a\"></pre></div></section>\n</main><nav class=\"tabs\"><button class=\"nav active\" data-nav=\"home\" onclick=\"switchTab('home')\"><span class=\"ico\">▦</span>홈</button><button class=\"nav\" data-nav=\"map\" onclick=\"switchTab('map')\"><span class=\"ico\">◫</span>지도</button><button class=\"nav\" data-nav=\"tasks\" onclick=\"switchTab('tasks')\"><span class=\"ico\">▤</span>일정</button><button class=\"nav\" data-nav=\"log\" onclick=\"switchTab('log')\"><span class=\"ico\">◷</span>기록</button><button class=\"nav\" data-nav=\"settings\" onclick=\"switchTab('settings')\"><span class=\"ico\">⚙</span>설정</button></nav><div class=\"toast\" id=\"toast\"></div></div>\n<script>\nvar currentBuilding='myeonhak',currentFloor='myeonhak-5',dashboard=null;\nvar selectedRobotId=Number(localStorage.getItem('m330-fleet-selected')||0);\nvar selectedBatchIds=new Set();\nvar bnames={myeonhak:'면학동',gyeongae:'경애동'};\nfunction el(id){return document.getElementById(id)}\nfunction show(msg){el('toast').textContent=msg;el('toast').style.display='block';setTimeout(function(){el('toast').style.display='none'},3300)}\nfunction escapeHtml(s){return String(s===null||s===undefined?'':s).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#039;'}[c]})}\nfunction pickBuilding(b){currentBuilding=b;currentFloor=b+'-5';renderFloors()}\nfunction pickFloor(i){currentFloor=currentBuilding+'-'+i;renderFloors()}\nfunction floorName(id){return (bnames[id.split('-')[0]]||'청소구역')+' '+(id.split('-')[1]||'?')+'층'}\nfunction selectFloor(id){if(!id||!id.includes('-'))return;currentBuilding=id.split('-')[0];currentFloor=id;renderFloors()}\nfunction renderFloors(){['myeonhak','gyeongae'].forEach(function(b){el('b-'+b).classList.toggle('active',b===currentBuilding)});el('floors').innerHTML=[5,4,3,2,1].map(function(i){return '<button class=\"floor '+(currentFloor===currentBuilding+'-'+i?'active':'')+'\" onclick=\"pickFloor('+i+')\">'+i+'층</button>'}).join('');el('map-floor').textContent=floorName(currentFloor)}\nfunction switchTab(tab){['home','map','tasks','log','settings'].forEach(function(t){el('view-'+t).classList.toggle('hidden',t!==tab)});document.querySelectorAll('[data-nav]').forEach(function(n){n.classList.toggle('active',n.dataset.nav===tab)});window.scrollTo(0,0);if(tab==='tasks'||tab==='log')load();if(tab==='settings'&&window.m330BridgeRefresh)m330BridgeRefresh()}\nasync function request(path,opts){var r=await fetch(path,opts);var j=await r.json();if(!r.ok)throw Error(j.detail||'요청 실패');return j}\nfunction currentRobot(){return dashboard&&dashboard.robots?dashboard.robots.find(function(r){return r.id===selectedRobotId}):null}\nfunction renderFleet(){\n var robots=dashboard.robots||[],r=currentRobot();\n el('fleet-count').textContent=robots.length+'대 등록 · 실제 제어 미연동';\n el('robot-select').innerHTML=robots.map(function(x){return '<option value=\"'+x.id+'\">'+escapeHtml(x.name)+' · '+escapeHtml(x.floor_name)+'</option>'}).join('');\n el('robot-select').value=String(selectedRobotId);\n el('fleet-cards').innerHTML=robots.map(function(x){return '<button class=\"fleetcard '+(x.id===selectedRobotId?'active':'')+'\" onclick=\"selectRobot('+x.id+')\"><strong>'+escapeHtml(x.name)+'</strong><small>'+escapeHtml(x.floor_name)+'</small><small>'+(x.gateway.online?'현장 상태 수신 중':'실기기 미연결')+' · '+escapeHtml(x.status)+' (데모)</small></button>'}).join('');\n selectedBatchIds.forEach(function(id){if(!robots.some(function(r){return r.id===id}))selectedBatchIds.delete(id)});\n el('fleet-checks').innerHTML=robots.map(function(x){return '<label><input type=\"checkbox\" '+(selectedBatchIds.has(x.id)?'checked':'')+' onchange=\"toggleRobot('+x.id+',this.checked)\">'+escapeHtml(x.name)+'</label>'}).join('');\n renderBatchCount();\n if(r){el('status').textContent=r.status+' · 가상 상태';el('robot-label').textContent=r.name+' / M330 Pro';el('battery').textContent=r.battery;el('batterybar').style.width=r.battery+'%';\n  el('edit-robot-name').value=r.name;el('edit-robot-floor').value=r.floor_id;}\n}\nfunction eventHtml(items){return items.map(function(x){return '<div class=\"item\"><strong>'+escapeHtml(x.robot_name)+' · '+escapeHtml(x.title)+'</strong><small>'+escapeHtml(x.detail)+' · '+escapeHtml(x.at)+'</small><small>시뮬레이션</small></div>'}).join('')}\nasync function load(){\n try{\n  dashboard=await request('/api/dashboard');\n  var list=dashboard.robots||[];\n  if(!list.some(function(r){return r.id===selectedRobotId})){selectedRobotId=list.length?list[0].id:0;localStorage.setItem('m330-fleet-selected',String(selectedRobotId))}\n  renderFleet();\n  var r=currentRobot();if(!r)return;\n  el('updated').textContent='갱신 '+new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});\n  var events=(dashboard.events||[]).filter(function(e){return e.robot_id===selectedRobotId});\n  el('recent').innerHTML=events.length?eventHtml(events.slice(0,3)):'<div class=\"empty\">선택한 로봇의 작업 기록이 없습니다.</div>';\n  el('history').innerHTML=events.length?eventHtml(events):'<div class=\"empty\">선택한 로봇의 작업 기록이 없습니다.</div>';\n  var tasks=(dashboard.tasks||[]).filter(function(t){return t.robot_id===selectedRobotId});\n  el('task-list').innerHTML=tasks.length?tasks.map(function(t){return '<div class=\"item\"><button class=\"delete\" onclick=\"removeTask('+t.id+')\">삭제</button><strong>'+escapeHtml(t.robot_name)+' · '+escapeHtml(t.building_name)+' '+escapeHtml(t.floor_name)+' · '+escapeHtml(t.time)+'</strong><small>요일 '+escapeHtml(t.weekdays)+' · 계획만 저장됨</small></div>'}).join(''):'<div class=\"empty\">선택한 로봇의 청소 일정이 없습니다.</div>';\n }catch(e){show('서버 연결 오류: '+e.message)}\n}\nasync function selectRobot(id){\n if(id===selectedRobotId)return;\n selectedRobotId=id;localStorage.setItem('m330-fleet-selected',String(id));\n var keyField=el('m330-bridge-key');if(keyField){keyField.hidden=true;keyField.textContent='';}\n var r=dashboard.robots.find(function(x){return x.id===id});\n if(r){selectFloor(r.floor_id);el('task-floor').value=r.floor_id;}\n renderFleet();await load();if(window.m330BridgeRefresh)m330BridgeRefresh();\n}\nasync function addRobot(){\n try{\n  var name=el('new-robot-name').value.trim(),floor_id=el('new-robot-floor').value;\n  var res=await request('/api/robots',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,floor_id:floor_id})});\n  selectedRobotId=res.robot.id;localStorage.setItem('m330-fleet-selected',String(selectedRobotId));\n  el('new-robot-name').value='';selectFloor(floor_id);el('task-floor').value=floor_id;\n  show('로봇이 추가되었습니다.');await load();\n }catch(e){show(e.message)}\n}\nasync function updateRobot(){\n if(!selectedRobotId)return;\n try{\n  var floor_id=el('edit-robot-floor').value,name=el('edit-robot-name').value.trim();\n  await request('/api/robots/'+selectedRobotId,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,floor_id:floor_id})});\n  selectFloor(floor_id);el('task-floor').value=floor_id;show('로봇 정보 수정 완료');await load();\n }catch(e){show(e.message)}\n}\nasync function archiveRobot(){\n if(!selectedRobotId||!confirm('이 로봇을 등록 해제하시겠습니까? 연결키는 폐기되고 과거 이력은 보존됩니다.'))return;\n try{\n  await request('/api/robots/'+selectedRobotId,{method:'DELETE'});\n  selectedRobotId=0;localStorage.removeItem('m330-fleet-selected');show('로봇 등록 해제 완료');await load();\n  if(currentRobot()){selectFloor(currentRobot().floor_id);el('task-floor').value=currentRobot().floor_id;}\n  if(window.m330BridgeRefresh)m330BridgeRefresh();\n }catch(e){show(e.message)}\n}\n\nfunction renderBatchCount(){\n var total=(dashboard&&dashboard.robots||[]).length;\n el('batch-selected-count').textContent=selectedBatchIds.size+'대 선택됨';\n el('fleet-checkall').checked=total>0&&selectedBatchIds.size===total;\n}\nfunction toggleRobot(id,checked){if(checked)selectedBatchIds.add(id);else selectedBatchIds.delete(id);renderBatchCount()}\nfunction toggleAllRobots(checked){\n selectedBatchIds.clear();if(checked)(dashboard.robots||[]).forEach(function(r){selectedBatchIds.add(r.id)});\n renderFleet();\n}\nasync function batchCommand(command){\n var ids=Array.from(selectedBatchIds);\n if(!ids.length){show('먼저 일괄 작업할 로봇을 선택해 주십시오.');return}\n if(!confirm(ids.length+'대에 일괄 데모 명령을 적용하시겠습니까? 실제 로봇은 움직이지 않습니다.'))return;\n try{\n  var d=await request('/api/commands/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({robot_ids:ids,command:command})});\n  show(d.message);await load();\n }catch(e){show(e.message)}\n}\nasync function command(c){\n if(!selectedRobotId){show('로봇을 선택해 주십시오.');return}\n try{\n  var d=await request('/api/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({robot_id:selectedRobotId,command:c,floor_id:currentFloor})});\n  show(d.message);await load();\n }catch(e){show(e.message)}\n}\nasync function addTask(){\n if(!selectedRobotId){show('로봇을 선택해 주십시오.');return}\n try{\n  var data={robot_id:selectedRobotId,floor_id:el('task-floor').value,time:el('task-time').value,weekdays:el('task-days').value};\n  await request('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});\n  show('선택한 로봇의 일정 계획 저장');await load();\n }catch(e){show(e.message)}\n}\nasync function removeTask(id){try{await request('/api/tasks/'+id,{method:'DELETE'});show('일정 삭제');await load()}catch(e){show(e.message)}}\nasync function checkHealth(){try{el('health').textContent=JSON.stringify(await request('/api/health'),null,2)}catch(e){show(e.message)}}\nvar floorOptions=['myeonhak','gyeongae'].map(function(b){return [5,4,3,2,1].map(function(i){return '<option value=\"'+b+'-'+i+'\">'+bnames[b]+' '+i+'층</option>'}).join('')}).join('');\n['task-floor','new-robot-floor','edit-robot-floor'].forEach(function(id){el(id).innerHTML=floorOptions});\nrenderFloors();load();setInterval(load,25000);\n</script></body></html>";

const BRIDGE_PANEL = `
<style>
.m330-bridge-card{margin:14px 0;border:1px solid #beded3;border-radius:18px;background:#f1faf6;padding:16px}
.m330-bridge-card h2{font-size:17px;margin:2px 0 10px;color:#13594d}
.m330-bridge-card p{font-size:12px;color:#4f786c;line-height:1.6}
.m330-bridge-card pre{font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere;background:#fff;border-radius:10px;padding:12px}
.m330-bridge-card button{padding:10px 12px;border:1px solid #91bfb0;border-radius:9px;background:#fff;color:#13594d;font-size:12px;font-weight:800}
.m330-bridge-actions{display:flex;gap:8px;flex-wrap:wrap}
</style>
<div class="m330-bridge-card">
<h2>실기기 LAN 진단 연결</h2>
<p><b>읽기 전용 연결입니다.</b> 현장 PC에서 로봇 상태를 조회하여 웹에 표시합니다. 로봇 청소 시작·일시정지·충전 명령은 전송하지 않습니다.</p>
<p id="m330-bridge-summary">연결상태 확인 중</p>
<div class="m330-bridge-actions">
<button onclick="m330BridgeRefresh()">상태 새로고침</button>
<button onclick="m330BridgePair()">연결키 새로 발급</button>
<button onclick="m330BridgeRevoke()">연결 해제</button>
</div>
<p>발급된 연결키는 한 번만 보입니다. 현장 PC의 <b>M330_BRIDGE_KEY</b> 환경변수에 입력해 주십시오. 기존 키는 재발급 시 폐기됩니다.</p>
<pre id="m330-bridge-key" hidden></pre>
<pre id="m330-bridge-observation">실제 장치 관측 정보 없음</pre>
<p>현장 도구: <code>gateway/m330_lan_probe.py</code> · <code>gateway/m330_bridge.py</code>. 웹에서 로봇이 자동 발견되는 방식은 아닙니다.</p>
</div>`;
const BRIDGE_SCRIPT = `<script>
async function m330BridgeRefresh(){
 const id=window.selectedRobotId;
 if(!id)return;
 const sum=document.getElementById('m330-bridge-summary');
 const out=document.getElementById('m330-bridge-observation');
 try{
  const r=await fetch('/api/gateway/status?robot_id='+encodeURIComponent(id),{cache:'no-store'});const d=await r.json();
  if(!r.ok)throw Error(d.detail||'조회 실패');
  const robot=window.currentRobot&&currentRobot();
  sum.textContent=(robot?robot.name+': ':'')+(d.online?'● 현장 LAN 읽기 전용 응답 수신 중':(d.last_seen?'● 최근 응답 없음 · 마지막 수신 '+d.last_seen:'● 현장 게이트웨이 연결 전'))+(d.paired?' · 키 등록':'');
  out.textContent=d.last_seen?JSON.stringify({로봇:robot?.name,상태:d.online?'수신 중':'오프라인',마지막수신:d.last_seen,프로토콜:d.protocol,기기참조:d.device_ref,원시_DP_검증전:d.raw_dps},null,2):'선택한 로봇의 실제 기기 관측 정보가 없습니다.';
 }catch(e){sum.textContent='브리지 조회 실패: '+e.message}
}
async function m330BridgePair(){
 const id=window.selectedRobotId;if(!id)return;
 if(!confirm('선택한 로봇의 기존 연결키가 있다면 무효화됩니다. 새 키를 발급하시겠습니까?'))return;
 try{
  const r=await fetch('/api/gateway/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({robot_id:id})});
  const d=await r.json();if(!r.ok)throw Error(d.detail||'발급 실패');
  const e=document.getElementById('m330-bridge-key');e.hidden=false;
  e.textContent='로봇 ID: '+id+'\\nM330_BRIDGE_KEY='+d.pair_key+'\\n현장 PC에서 환경변수를 설정하고 gateway/m330_bridge.py 실행';
  m330BridgeRefresh();
 }catch(e){alert('연결키 발급 실패: '+e.message)}
}
async function m330BridgeRevoke(){
 const id=window.selectedRobotId;if(!id)return;
 if(!confirm('선택한 로봇의 연결키와 관측값을 삭제하시겠습니까?'))return;
 try{
  const r=await fetch('/api/gateway/revoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({robot_id:id})});
  if(!r.ok)throw Error('해제 실패');
  document.getElementById('m330-bridge-key').hidden=true;m330BridgeRefresh();
 }catch(e){alert(e.message)}
}
setInterval(m330BridgeRefresh,25000);
<\/script>`;
const buildings=[
 {id:'myeonhak',name:'면학동',floors:[5,4,3,2,1].map(n=>({id:'myeonhak-'+n,label:n+'층',building_id:'myeonhak'}))},
 {id:'gyeongae',name:'경애동',floors:[5,4,3,2,1].map(n=>({id:'gyeongae-'+n,label:n+'층',building_id:'gyeongae'}))}
];
const DATABASE_PATH=Bun.env.M330_DB_PATH||'/data/m330.sqlite';
mkdirSync(dirname(DATABASE_PATH),{recursive:true});
const db=new Database(DATABASE_PATH,{create:true});
db.exec('PRAGMA journal_mode=WAL');
db.exec('PRAGMA busy_timeout=5000');
db.exec("CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,status TEXT NOT NULL DEFAULT '대기',battery INTEGER NOT NULL DEFAULT 82,floor_id TEXT,created_at TEXT NOT NULL)");
db.exec("CREATE TABLE IF NOT EXISTS tasks(id INTEGER PRIMARY KEY AUTOINCREMENT,session_id TEXT NOT NULL,floor_id TEXT NOT NULL,time TEXT NOT NULL,weekdays TEXT NOT NULL,building_name TEXT NOT NULL,floor_name TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1)");
db.exec("CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,session_id TEXT NOT NULL,at TEXT NOT NULL,title TEXT NOT NULL,detail TEXT NOT NULL,simulated INTEGER NOT NULL DEFAULT 1)");
db.exec("CREATE TABLE IF NOT EXISTS gateway_pairs(session_id TEXT PRIMARY KEY,token_hash TEXT UNIQUE NOT NULL,created_at TEXT NOT NULL)");
db.exec("CREATE TABLE IF NOT EXISTS gateway_observations(session_id TEXT PRIMARY KEY,last_seen TEXT NOT NULL,connected INTEGER NOT NULL,device_ref TEXT NOT NULL,protocol TEXT NOT NULL,raw_dps TEXT NOT NULL)");
db.exec("CREATE TABLE IF NOT EXISTS robots(id INTEGER PRIMARY KEY AUTOINCREMENT,session_id TEXT NOT NULL,name TEXT NOT NULL,floor_id TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,demo_status TEXT NOT NULL DEFAULT '대기',demo_battery INTEGER NOT NULL DEFAULT 82,created_at TEXT NOT NULL)");
db.exec("CREATE INDEX IF NOT EXISTS idx_robots_session ON robots(session_id,active,id)");
db.exec("CREATE TABLE IF NOT EXISTS robot_pairs(robot_id INTEGER PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL)");
db.exec("CREATE TABLE IF NOT EXISTS robot_observations(robot_id INTEGER PRIMARY KEY,last_seen TEXT NOT NULL,connected INTEGER NOT NULL,device_ref TEXT NOT NULL,protocol TEXT NOT NULL,raw_dps TEXT NOT NULL)");
function ensureColumn(table:string,column:string){
 const names=db.query('PRAGMA table_info('+table+')').all() as Array<{name:string}>;
 if(!names.some(x=>x.name===column)) db.exec('ALTER TABLE '+table+' ADD COLUMN '+column+' INTEGER');
}
ensureColumn('tasks','robot_id');
ensureColumn('events','robot_id');
db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_robot ON tasks(session_id,robot_id,id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_events_robot ON events(session_id,robot_id,id)");
const handleTwin=initTwin(db);
const validFloors=new Set(buildings.flatMap(b=>b.floors.map(f=>f.id)));
const tokenHash=(v:string)=>createHash('sha256').update(v).digest('hex');
const floorLabel=(floorId:string)=>{const b=buildings.find(x=>floorId.startsWith(x.id+'-'));return b?b.name+' '+floorId.split('-')[1]+'층':'미배치';};
const robotsOf=(sid:string)=>db.query('SELECT * FROM robots WHERE session_id=? AND active=1 ORDER BY id ASC').all(sid) as any[];
const lookupRobot=(sid:string,id:any)=>{
 if(id===undefined||id===null||id===''){
  return db.query('SELECT * FROM robots WHERE session_id=? AND active=1 ORDER BY id ASC LIMIT 1').get(sid) as any;
 }
 if(!Number.isSafeInteger(Number(id))||Number(id)<1)return null;
 return db.query('SELECT * FROM robots WHERE session_id=? AND active=1 AND id=?').get(sid,Number(id)) as any;
};
function ensureSession(sid:string){
 let row=db.query('SELECT * FROM sessions WHERE id=?').get(sid) as any;
 if(!row){
  db.query('INSERT OR IGNORE INTO sessions(id,created_at) VALUES(?,?)').run(sid,new Date().toISOString());
  row=db.query('SELECT * FROM sessions WHERE id=?').get(sid) as any;
 }
 if(!robotsOf(sid).length){
  // One initial demo entry. Legacy tasks and simulated status are preserved.
  const old=db.query('SELECT COUNT(*) AS n FROM robots WHERE session_id=?').get(sid) as any;
  if(old.n===0) {
   const floor=validFloors.has(row.floor_id)?row.floor_id:'myeonhak-5';
   const add=db.query('INSERT INTO robots(session_id,name,floor_id,demo_status,demo_battery,created_at) VALUES(?,?,?,?,?,?)').run(sid,'로봇 01',floor,row.status,Number(row.battery),new Date().toISOString());
   const id=Number(add.lastInsertRowid);
   db.query('UPDATE tasks SET robot_id=? WHERE session_id=? AND robot_id IS NULL').run(id,sid);
   db.query('UPDATE events SET robot_id=? WHERE session_id=? AND robot_id IS NULL').run(id,sid);
   db.query('INSERT OR IGNORE INTO robot_pairs(robot_id,token_hash,created_at) SELECT ?,token_hash,created_at FROM gateway_pairs WHERE session_id=?').run(id,sid);
   db.query('INSERT OR IGNORE INTO robot_observations(robot_id,last_seen,connected,device_ref,protocol,raw_dps) SELECT ?,last_seen,connected,device_ref,protocol,raw_dps FROM gateway_observations WHERE session_id=?').run(id,sid);
  }
 }
}
function cookieSession(req:Request){
 const m=(req.headers.get('cookie')||'').match(/(?:^|;\s*)m330_session=([0-9a-f-]{36})(?:;|$)/i);
 return {sid:m?m[1]:crypto.randomUUID(),fresh:!m};
}
function getGateway(id:number){
 const pair=db.query('SELECT robot_id FROM robot_pairs WHERE robot_id=?').get(id);
 const obs=db.query('SELECT last_seen,connected,device_ref,protocol,raw_dps FROM robot_observations WHERE robot_id=?').get(id) as any;
 const age=obs?Math.max(0,Math.round((Date.now()-Date.parse(obs.last_seen))/1000)):null;
 return {paired:!!pair,online:!!obs&&obs.connected===1&&age!==null&&age<=90,
  last_seen:obs?.last_seen||null,age_seconds:age,device_ref:obs?.device_ref||null,
  protocol:obs?.protocol||null,raw_dps:obs?JSON.parse(obs.raw_dps):null,
  verification:'read_only_unmapped',commands_enabled:false};
}
function exposeRobot(r:any){
 return {id:r.id,name:r.name,floor_id:r.floor_id,floor_name:floorLabel(r.floor_id),status:r.demo_status,battery:r.demo_battery,
  connected:false,is_simulated:true,is_hardware_verified:false,gateway:getGateway(r.id)};
}
const readJson=async(req:Request)=>{
 const text=await req.text();
 if(text.length>32768)throw Error('요청 크기 초과');
 return JSON.parse(text);
};
function messageError(e:unknown){return e instanceof Error&&e.message==='요청 크기 초과'?'요청 크기 초과':'JSON 형식 오류';}
Bun.serve({port:Number(Bun.env.PORT||3000),hostname:'0.0.0.0',async fetch(req){
 const u=new URL(req.url),p=u.pathname;
 const {sid,fresh}=cookieSession(req);
 const cookie=fresh&&p!=='/api/gateway/observations'?{'Set-Cookie':'m330_session='+sid+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000'}:{};
 const json=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...cookie}});
 const bad=(detail:string,status=400)=>json({detail},status);
 if(p==='/api/health'&&req.method==='GET')return json({ok:true,service:'m330-pro-mobile-web',version:TWIN_VERSION,mode:'digital_twin_simulation',fleet:true,common_areas_only:true,stairs_included:true,stairs_robot_cleanable:false,gateway_bridge:'read_only',storage:'sqlite',at:new Date().toISOString()});
 // Ingest observation with a per-robot secret, never an operator cookie.
 if(p==='/api/gateway/observations'&&req.method==='POST'){
  const token=req.headers.get('X-M330-Pairing-Key')||'';
  if(!/^[a-f0-9]{64}$/.test(token))return bad('유효하지 않은 브리지 키',401);
  const match=db.query('SELECT p.robot_id FROM robot_pairs p JOIN robots r ON r.id=p.robot_id WHERE p.token_hash=? AND r.active=1').get(tokenHash(token)) as any;
  if(!match)return bad('연결되지 않은 브리지 키',401);
  let d:any;try{d=await readJson(req)}catch(e){return bad(messageError(e),400)}
  if(!d||d.mode!=='read_only'||typeof d.connected!=='boolean'||!d.raw_dps||typeof d.raw_dps!=='object'||Array.isArray(d.raw_dps))return bad('읽기 전용 관측 데이터만 수신합니다.',422);
  const dps:Record<string,unknown>={};
  for(const [k,v] of Object.entries(d.raw_dps).slice(0,80)){
   if(!/^\d{1,4}$/.test(k))continue;
   if(v===null||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))dps[k]=v;
   else if(typeof v==='string')dps[k]=v.slice(0,160);
  }
  const ref=typeof d.device_ref==='string'&&/^[a-f0-9]{12}$/.test(d.device_ref)?d.device_ref:'';
  const protocol=typeof d.protocol==='string'&&/^(3\.[1-5])$/.test(d.protocol)?d.protocol:'';
  // Never accept a second hardware identity for an already paired robot.
  const old=db.query('SELECT device_ref FROM robot_observations WHERE robot_id=?').get(match.robot_id) as any;
  if(old?.device_ref&&ref&&old.device_ref!==ref)return bad('등록된 로봇과 장치 지문이 일치하지 않습니다. 연결을 재설정하십시오.',409);
  db.query('INSERT INTO robot_observations(robot_id,last_seen,connected,device_ref,protocol,raw_dps) VALUES(?,?,?,?,?,?) ON CONFLICT(robot_id) DO UPDATE SET last_seen=excluded.last_seen,connected=excluded.connected,device_ref=excluded.device_ref,protocol=excluded.protocol,raw_dps=excluded.raw_dps')
   .run(match.robot_id,new Date().toISOString(),d.connected?1:0,ref,protocol,JSON.stringify(dps));
  return json({ok:true,received:true,robot_id:match.robot_id,read_only:true,interpreted:false});
 }
 if(req.method==='GET'&&p==='/twin-client.js')return new Response(await Bun.file(new URL('./twin-client.js',import.meta.url)).text(),{headers:{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'}});
 if(req.method==='GET'&&p==='/twin.css')return new Response(await Bun.file(new URL('./twin.css',import.meta.url)).text(),{headers:{'Content-Type':'text/css; charset=utf-8','Cache-Control':'no-store'}});
 if(req.method==='GET'&&p==='/')return new Response(
  PAGE.replace('<div class="panel"><p><b>M330 Pro 모바일 웹 v0.3',BRIDGE_PANEL+'<div class="panel"><p><b>M330 Pro 모바일 웹 v0.3')
    .replace('</head>','<link rel="stylesheet" href="/twin.css"></head>')
    .replace('</body>',BRIDGE_SCRIPT+'<script defer src="/twin-client.js"></script></body>'),
  {headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...cookie}});
 if(!p.startsWith('/api/'))return bad('경로를 찾을 수 없습니다.',404);
 ensureSession(sid);
 if(p.startsWith('/api/twin/'))return handleTwin(req,p,sid,u);
 if(req.method==='GET'&&p==='/api/robots')return json({robots:robotsOf(sid).map(exposeRobot),real_control_enabled:false});
 if(req.method==='POST'&&p==='/api/robots'){
  let d:any;try{d=await readJson(req)}catch(e){return bad(messageError(e))}
  if(robotsOf(sid).length>=100)return bad('로봇은 최대 100대까지 등록할 수 있습니다.',429);
  if(typeof d?.name!=='string'||!d.name.trim()||d.name.trim().length>40)return bad('로봇 이름은 1~40자여야 합니다.',422);
  if(!validFloors.has(d.floor_id))return bad('배치 층을 선택하십시오.',422);
  const name=d.name.trim(),existing=robotsOf(sid);
  if(existing.some(x=>x.name===name))return bad('같은 이름의 로봇이 이미 있습니다.',409);
  const r=db.query('INSERT INTO robots(session_id,name,floor_id,created_at) VALUES(?,?,?,?)').run(sid,name,d.floor_id,new Date().toISOString());
  return json({ok:true,robot:exposeRobot(lookupRobot(sid,Number(r.lastInsertRowid)))},201);
 }
 const rm=p.match(/^\/api\/robots\/(\d+)$/);
 if(rm&&req.method==='PATCH'){
  const r=lookupRobot(sid,Number(rm[1]));if(!r)return bad('로봇을 찾을 수 없습니다.',404);
  let d:any;try{d=await readJson(req)}catch(e){return bad(messageError(e))}
  const name=d.name===undefined?r.name:d.name, floor=d.floor_id===undefined?r.floor_id:d.floor_id;
  if(typeof name!=='string'||!name.trim()||name.trim().length>40)return bad('로봇 이름은 1~40자여야 합니다.',422);
  if(!validFloors.has(floor))return bad('배치 층이 올바르지 않습니다.',422);
  if(robotsOf(sid).some(x=>x.id!==r.id&&x.name===name.trim()))return bad('같은 이름의 로봇이 이미 있습니다.',409);
  db.query('UPDATE robots SET name=?,floor_id=? WHERE id=? AND session_id=?').run(name.trim(),floor,r.id,sid);
  return json({ok:true,robot:exposeRobot(lookupRobot(sid,r.id))});
 }
 if(rm&&req.method==='DELETE'){
  const r=lookupRobot(sid,Number(rm[1]));if(!r)return bad('로봇을 찾을 수 없습니다.',404);
  if(robotsOf(sid).length<=1)return bad('마지막 로봇은 해제할 수 없습니다.',409);
  db.query('UPDATE robots SET active=0 WHERE id=? AND session_id=?').run(r.id,sid);
  db.query('DELETE FROM robot_pairs WHERE robot_id=?').run(r.id);
  db.query('DELETE FROM robot_observations WHERE robot_id=?').run(r.id);
  return json({ok:true,archived:true,note:'이전 작업 기록은 보존됩니다.'});
 }
 if(p==='/api/gateway/status'&&req.method==='GET'){
  const r=lookupRobot(sid,u.searchParams.get('robot_id'));return r?json({robot_id:r.id,...getGateway(r.id)}):bad('로봇을 찾을 수 없습니다.',404);
 }
 if(p==='/api/gateway/pair'&&req.method==='POST'){
  let d:any={};try{d=await readJson(req)}catch{ /* Legacy empty POST body */ }
  const r=lookupRobot(sid,d?.robot_id);if(!r)return bad('로봇을 찾을 수 없습니다.',404);
  const key=randomBytes(32).toString('hex');
  db.query('INSERT INTO robot_pairs(robot_id,token_hash,created_at) VALUES(?,?,?) ON CONFLICT(robot_id) DO UPDATE SET token_hash=excluded.token_hash,created_at=excluded.created_at').run(r.id,tokenHash(key),new Date().toISOString());
  db.query('DELETE FROM robot_observations WHERE robot_id=?').run(r.id);
  return json({ok:true,robot_id:r.id,pair_key:key,mode:'read_only',note:'연결키는 1회만 표시되며 해당 로봇에서만 사용할 수 있습니다.'});
 }
 if(p==='/api/gateway/revoke'&&req.method==='POST'){
  let d:any={};try{d=await readJson(req)}catch{}
  const r=lookupRobot(sid,d?.robot_id);if(!r)return bad('로봇을 찾을 수 없습니다.',404);
  db.query('DELETE FROM robot_pairs WHERE robot_id=?').run(r.id);
  db.query('DELETE FROM robot_observations WHERE robot_id=?').run(r.id);
  return json({ok:true,robot_id:r.id});
 }
 if(p==='/api/dashboard'&&req.method==='GET'){
  const list=robotsOf(sid), selected=lookupRobot(sid,u.searchParams.get('robot_id'));
  const robot=selected?exposeRobot(selected):null;
  const tasks=db.query('SELECT t.*,r.name AS robot_name FROM tasks t JOIN robots r ON r.id=t.robot_id WHERE t.session_id=? AND r.active=1 ORDER BY t.id DESC LIMIT 300').all(sid);
  const events=db.query('SELECT e.*,r.name AS robot_name FROM events e JOIN robots r ON r.id=e.robot_id WHERE e.session_id=? ORDER BY e.id DESC LIMIT 300').all(sid);
  return json({mode:'demo',fleet:true,robot,robots:list.map(exposeRobot),buildings,tasks,events,
   demo_controls_enabled:true,real_control_enabled:false,gateway:robot?.gateway||null,
   features:{map:'not_integrated',schedules:'planning_only',real_write_verified:false,storage:'persistent_sqlite'},updated_at:new Date().toISOString()});
 }
 if(p==='/api/diagnostics'&&req.method==='GET'){
  const r=lookupRobot(sid,u.searchParams.get('robot_id'));
  return r?json({robot_id:r.id,mode:'demo',robot_connected:false,map_connected:false,real_command_available:false,storage:'persistent_sqlite',gateway:getGateway(r.id),note:'Read-only LAN status only; no verified robot commands.'}):bad('로봇을 찾을 수 없습니다.',404);
 }

 if(p==='/api/commands/batch'&&req.method==='POST'){
  let d:any;try{d=await readJson(req)}catch(e){return bad(messageError(e))}
  const labels:any={start:'청소 시작',pause:'일시정지',dock:'충전 복귀'};
  if(!d||!Object.hasOwn(labels,d.command))return bad('일괄 명령이 올바르지 않습니다.',422);
  const ids=d.robot_ids;
  if(!Array.isArray(ids)||ids.length<1||ids.length>100||!ids.every((v:any)=>Number.isSafeInteger(v)&&v>0)||new Set(ids).size!==ids.length)return bad('서로 다른 로봇 ID를 1~100개 선택하십시오.',422);
  const chosen=ids.map((id:number)=>lookupRobot(sid,id));
  if(chosen.some(r=>!r))return bad('다른 세션의 로봇 또는 등록 해제된 로봇이 포함되었습니다.',404);
  const run=db.transaction(()=>{
   for(const r of chosen){
    let status=r.demo_status,battery=r.demo_battery;
    if(d.command==='start'){status='청소 중';battery=Math.max(0,battery-1);}
    if(d.command==='pause')status='일시정지';
    if(d.command==='dock')status='충전 복귀 중';
    db.query('UPDATE robots SET demo_status=?,demo_battery=? WHERE session_id=? AND id=?').run(status,battery,sid,r.id);
    db.query('INSERT INTO events(session_id,robot_id,at,title,detail,simulated) VALUES(?,?,?,?,?,1)')
     .run(sid,r.id,new Date().toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}),labels[d.command],r.name+' / '+floorLabel(r.floor_id)+' · 일괄 데모');
   }
  });
  run();
  return json({ok:true,simulated:true,robot_ids:ids,affected:ids.length,message:ids.length+'대 '+labels[d.command]+' — 실기기 명령 없이 시뮬레이션만 실행했습니다.'});
 }
 if(p==='/api/command'&&req.method==='POST'){
  let d:any;try{d=await readJson(req)}catch(e){return bad(messageError(e))}
  const r=lookupRobot(sid,d?.robot_id);if(!r)return bad('로봇을 찾을 수 없습니다.',404);
  const labels:any={start:'청소 시작',pause:'일시정지',dock:'충전 복귀'};
  if(!Object.hasOwn(labels,d.command))return bad('지원하지 않는 명령');
  const floor=d.floor_id||r.floor_id;
  if(d.command==='start'&&!validFloors.has(floor))return bad('청소할 층을 선택해 주세요.',422);
  let status=r.demo_status,battery=r.demo_battery;
  if(d.command==='start'){status='청소 중';battery=Math.max(0,battery-1);}
  if(d.command==='pause')status='일시정지';
  if(d.command==='dock')status='충전 복귀 중';
  db.query('UPDATE robots SET demo_status=?,demo_battery=? WHERE id=? AND session_id=?').run(status,battery,r.id,sid);
  db.query('INSERT INTO events(session_id,robot_id,at,title,detail,simulated) VALUES(?,?,?,?,?,1)')
   .run(sid,r.id,new Date().toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}),labels[d.command],r.name+' / '+floorLabel(floor)+' · 가상 명령');
  return json({ok:true,robot_id:r.id,simulated:true,message:r.name+': '+labels[d.command]+' — 시뮬레이션만 실행했습니다.'});
 }
 if(p==='/api/tasks'&&req.method==='POST'){
  let d:any;try{d=await readJson(req)}catch(e){return bad(messageError(e))}
  const r=lookupRobot(sid,d?.robot_id);if(!r)return bad('로봇을 찾을 수 없습니다.',404);
  if(!validFloors.has(d.floor_id))return bad('청소구역이 올바르지 않습니다.',422);
  if(typeof d.time!=='string'||!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(d.time))return bad('시간 형식 오류',422);
  const days=String(d.weekdays||'');
  if(!/^[0-6](?:,[0-6]){0,6}$/.test(days))return bad('요일 형식 오류',422);
  if((db.query('SELECT COUNT(*) AS count FROM tasks WHERE session_id=?').get(sid) as any).count>=500)return bad('일정 등록 한도에 도달했습니다.',429);
  const b=buildings.find(x=>d.floor_id.startsWith(x.id+'-'))!;
  const obj={robot_id:r.id,robot_name:r.name,floor_id:d.floor_id,time:d.time,weekdays:days,building_name:b.name,floor_name:d.floor_id.split('-')[1]+'층',enabled:1};
  const result=db.query('INSERT INTO tasks(session_id,robot_id,floor_id,time,weekdays,building_name,floor_name,enabled) VALUES(?,?,?,?,?,?,?,1)')
   .run(sid,r.id,obj.floor_id,obj.time,obj.weekdays,obj.building_name,obj.floor_name);
  return json({id:Number(result.lastInsertRowid),...obj},201);
 }
 if(/^\/api\/tasks\/\d+$/.test(p)&&req.method==='DELETE'){
  const id=Number(p.split('/')[3]),r=db.query('DELETE FROM tasks WHERE id=? AND session_id=?').run(id,sid);
  return r.changes?json({ok:true}):bad('없는 일정입니다.',404);
 }
 return bad('경로를 찾을 수 없습니다.',404);
}});
