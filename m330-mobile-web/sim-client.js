/* M330 Pro simulated robot operations console.
 * Mobile controls send real commands to the simulated state machine, not to a dummy status label.
 */
(() => {
 'use strict';
 const root=document.getElementById('view-map');if(!root)return;
 let floorId='myeonhak-5',robotId=0,data=null,loading=false,selectedZone='all',placeObstacle=false,layout=null,followRobot=false;
 const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const api=async(url,body)=>{const r=await fetch(url,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'}:{cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.detail||'명령 오류');return j};
 const STATUS={idle:'대기',cleaning:'청소 중',paused:'일시정지',returning:'충전소 복귀',charging:'충전 중',completed:'청소 완료',blocked:'장애물/이동 불가'};
 root.innerHTML='<div class="over">M330 PRO / ROBOT DIGITAL TWIN</div><h1>실동작 기반 가상 청소</h1>'
 +'<p class="muted">관리 명령 → 가상 센서/경로계산 → 로봇 이동 → 실제 통과한 바닥 셀 청소 처리. 실기기 연결 없이 동작하며, 속도·소모량은 보정 전 시뮬레이션 가정값입니다.</p>'
 +'<p class="twin-help">현재 선택: <b id="map-floor">면학동 5층</b></p>'
 +'<div class="twin-filter"><label>건물<select id="sim-building"><option value="myeonhak">면학동</option><option value="gyeongae">경애동</option></select></label>'
 +'<label>층<select id="sim-floor"><option value="5">5층</option><option value="4">4층</option><option value="3">3층</option><option value="2">2층</option><option value="1">1층</option></select></label></div>'
 +'<div class="twin-actions" style="margin:10px 0"><button id="sim-follow" class="primary">로봇 따라가기: 꺼짐</button><button id="sim-full-map">전체지도</button><span id="sim-floor-size" class="twin-stat">가상 공간 크기 계산 중</span></div>'
 +'<div class="twin-map-wrap" style="position:relative"><svg id="sim-svg" role="img" aria-label="공용부 가상 로봇 실동작 시뮬레이션" viewBox="0 0 1000 550" style="width:100%;display:block"></svg>'
 +'<div class="twin-legend"><span><i class="twin-dot" style="background:#c6e7d8"></i>이동 가능한 공용부</span><span><i class="twin-dot" style="background:#f0ca96"></i>계단: 로봇 불가</span>'
 +'<span><i class="twin-dot" style="background:#3093da"></i>가상 로봇</span><span><i class="twin-dot" style="background:#20a475"></i>실제 통과 셀</span><span><i class="twin-dot" style="background:#dd6b48"></i>장애물·금지구역</span></div></div>'
 +'<div id="sim-warning" class="twin-status" style="margin-top:12px">시뮬레이터 불러오는 중</div>'
 +'<div class="twin-panel"><b>로봇 선택 및 작동 명령</b>'
 +'<div class="twin-filter"><label>로봇<select id="sim-robot"></select></label><label>청소 범위<select id="sim-zone"></select></label></div>'
 +'<div class="twin-actions"><button id="sim-start" class="primary">▶ 청소 시작</button><button id="sim-pause">Ⅱ 일시정지</button><button id="sim-resume">재개</button><button id="sim-stop">■ 중지</button><button id="sim-dock">⌂ 충전 복귀</button></div>'
 +'<div class="twin-filter" style="margin-top:15px"><label>청소 방식<select id="sim-mode"><option value="vacuum">흡입</option><option value="mop">물걸레</option><option value="vacuum_mop">흡입 + 물걸레</option></select></label>'
 +'<label>흡입 단계<select id="sim-suction"><option value="quiet">저소음</option><option value="standard">표준</option><option value="max">강력</option></select></label>'
 +'<label>시뮬레이션 배속<select id="sim-speed"><option value="1">1배 (실시간)</option><option value="5">5배</option><option value="20">20배</option><option value="100">100배 (배터리 테스트)</option></select></label></div>'
 +'<div id="sim-stats" class="twin-overview"></div><div style="margin-top:10px" class="twin-progress"><div id="sim-progress-bar" style="width:0%"></div></div><p id="sim-progress-label" class="twin-help"></p>'
 +'<div class="twin-actions"><button id="sim-empty">먼지통 비움</button><button id="sim-refill">물통 보충</button></div></div>'
 +'<div class="twin-panel"><b>시험 환경 조작</b><p>지도에서 임의의 장애물을 추가하면 가상 로봇이 감지하고 경로를 다시 계산합니다.</p>'
 +'<div class="twin-actions"><button id="sim-addobstacle">지도 클릭: 장애물 설치</button><button id="sim-clearobstacles">장애물 초기화</button><button id="sim-nogo">선택 구역 금지/해제</button></div>'
 +'<div class="twin-filter"><label>충전 복귀 시험용 배터리 (%)<input id="sim-battery" inputmode="numeric" type="number" value="19" min="1" max="100" /></label><button id="sim-set-battery" style="padding:12px" class="primary">시험 배터리 적용</button></div>'
 +'<p class="twin-help">M330 Pro 제원: 직경 28cm·높이 9.5cm, dToF / PSD, 먼지통 450mL·물통 200mL, 자동 복귀·충전 후 재개. 가상 센서 및 청소 이동속도 약 0.078m/s는 제조사의 155㎡/충전 및 설명서의 150분과 가정한 청소폭 22cm로 역산한 시험값이며 실측 주행속도가 아닙니다. 배터리·충전 모델은 검증 전 가정입니다.</p></div>'
 +'<div class="twin-panel"><b>가상 로봇 발생 이벤트</b><div id="sim-events" class="twin-help"></div></div>'
 +'<p class="footnote">교실·행정실 등 내부 제외. 복도·홀·출입구는 로봇 청소. 계단·계단참은 지도에 포함하되 추락 방지로 주행 금지. M330 Pro 펌웨어의 복제본이나 실기기 제어 기능이 아닙니다.</p>';
 const el=id=>document.getElementById(id);
 const clearMsg=txt=>{el('sim-warning').textContent=txt};
 const refreshFloor=()=>{floorId=el('sim-building').value+'-'+el('sim-floor').value;selectedZone='all';load(true)};
 function floorSelection(v){
  let [b,n]=v.split('-');el('sim-building').value=b;el('sim-floor').value=n;
  floorId=v;
 }
 function svg(){
  if(!data)return;
  const m=data.map,config=data.config;
  const code=['<rect width="1000" height="550" fill="#f2f8f4"/>','<rect x="20" y="20" width="960" height="510" rx="16" fill="none" stroke="#a8c2b6" stroke-width="3" stroke-dasharray="10 7"/>',
  '<text x="35" y="64" font-size="23" font-weight="bold" fill="#205645">'+escapeHtml(m.name)+'</text>','<text x="35" y="94" font-size="14" fill="#678678">합성 공간 40×22m · 25px=1m · 청소 면적은 실제 거리·폭에 따라 계산</text>'];
  m.zones.forEach(z=>{
   const stair=z.kind==='stairs',ng=config.no_go.includes(z.id),selected=selectedZone===z.id;
   const fill=stair?'#f0cfaa':ng?'#efab9b':selected?'#a4dabb':'#d2ebe0';
   code.push('<g data-zone="'+escapeHtml(z.id)+'" style="cursor:pointer"><rect x="'+z.x+'" y="'+z.y+'" width="'+z.w+'" height="'+z.h+'" rx="5" fill="'+fill+'" stroke="'+(selected?'#14583b':'#7ab196')+'" stroke-width="'+(selected?4:2)+'"/>');
   if(stair){for(let y=z.y+12;y<z.y+z.h-8;y+=16)code.push('<line x1="'+(z.x+9)+'" y1="'+y+'" x2="'+(z.x+z.w-9)+'" y2="'+y+'" stroke="#bd8247" stroke-width="5"/>');}
   code.push('<text pointer-events="none" x="'+(z.x+z.w/2)+'" y="'+(z.y+z.h/2-2)+'" text-anchor="middle" font-size="'+(stair?12:13)+'" font-weight="800" fill="'+(stair?'#71471f':'#1b5847')+'">'+escapeHtml(z.kind==='stairs'?(z.id.endsWith('west')?'서측 계단':'동측 계단'):z.name)+'</text>');
   code.push('<text pointer-events="none" x="'+(z.x+z.w/2)+'" y="'+(z.y+z.h/2+16)+'" text-anchor="middle" font-size="11" fill="#285e4e">'+Number(z.length_m).toFixed(1)+'m × '+Number(z.width_m).toFixed(1)+'m</text></g>');
  });
  for(const r of data.robots){
   const highlighted=r.robot_id===robotId;
   if(highlighted){
    const cell=r.cell_px||5,cols=r.grid_cols||200;
    // Merge consecutive cleaned raster cells per row. The tinted area represents traversed 0.2m cells.
    const sorted=[...r.visited].sort((a,b)=>a-b);
    let p=0;
    while(p<sorted.length){
     let first=sorted[p],last=first;
     while(p+1<sorted.length&&sorted[p+1]===last+1&&Math.floor(sorted[p+1]/cols)===Math.floor(first/cols)){last=sorted[++p]}
     code.push('<rect x="'+(first%cols*cell)+'" y="'+(Math.floor(first/cols)*cell)+'" width="'+((last-first+1)*cell)+'" height="'+cell+'" fill="#21ba83" opacity=".63" pointer-events="none"/>');
     p++;
    }
    if(r.path.length)code.push('<polyline points="'+r.path.map(p=>p.x+','+p.y).join(' ')+'" fill="none" stroke="#317fbd" stroke-width="3" stroke-dasharray="9 7" opacity=".8" pointer-events="none"/>');
    if(r.sensors?.rays)for(const ray of r.sensors.rays){
     const heading=(r.pose.heading+ray.relative_degrees)*Math.PI/180;
     const ex=r.pose.x+Math.cos(heading)*ray.distance_m*25,ey=r.pose.y+Math.sin(heading)*ray.distance_m*100;
     code.push('<line x1="'+r.pose.x+'" y1="'+r.pose.y+'" x2="'+ex.toFixed(1)+'" y2="'+ey.toFixed(1)+'" stroke="#2e9cc9" stroke-width="1.5" opacity=".26" pointer-events="none"/>');
    }
   }
  }
  for(const o of config.obstacles)code.push('<circle cx="'+o.x+'" cy="'+o.y+'" r="'+o.r+'" fill="#e76e52" fill-opacity=".7" stroke="#b42b28" stroke-width="4" pointer-events="none"/>');
  code.push('<g transform="translate(510 270)" pointer-events="none"><circle r="8" fill="none" stroke="#f0a340" stroke-width="3"/><text x="-34" y="-24" font-size="14" fill="#96631e">충전</text></g>');
  for(const r of data.robots){
   const selected=r.robot_id===robotId;
   code.push('<g data-robot-pose="'+r.robot_id+'" transform="translate('+r.pose.x+' '+r.pose.y+') rotate('+r.pose.heading+')" pointer-events="none">'
     +'<circle r="'+(r.robot_radius_px||3.5)+'" fill="'+(selected?'#266cbe':'#8297a3')+'" stroke="#fff" stroke-width="1.2"/>'
     +'<circle r="12" fill="none" stroke="'+(selected?'#175ea9':'#8c9ca5')+'" stroke-width="2" opacity=".85"/>'
     +'<path d="M4 -4L14 0L4 4" fill="#266cbe"/></g>');
   code.push('<text x="'+r.pose.x+'" y="'+(r.pose.y-19)+'" font-size="15" text-anchor="middle" font-weight="bold" fill="#15463d" pointer-events="none">'+escapeHtml(r.name)+'</text>');
  }
  // 5m ruler: 25 pixels represent one metre in this synthetic geometry.
  code.push('<path d="M45 515h125 M45 510v10 M170 510v10" stroke="#184d42" stroke-width="4" pointer-events="none"/>');
  code.push('<text x="107" y="503" font-size="14" text-anchor="middle" fill="#184d42" pointer-events="none">5m 기준척도</text>');
  const svgEl=el('sim-svg'), focus=data.robots.find(r=>r.robot_id===robotId);
  if(followRobot&&focus&&['cleaning','returning','charging','paused'].includes(focus.state)){
    const vw=350,vh=220,x=Math.max(0,Math.min(1000-vw,focus.pose.x-vw/2)),y=Math.max(0,Math.min(550-vh,focus.pose.y-vh/2));
    svgEl.setAttribute('viewBox',x+' '+y+' '+vw+' '+vh);
  }else svgEl.setAttribute('viewBox','0 0 1000 550');
  el('sim-floor-size').textContent='가상 학교 공용부: 전체 좌표 공간 '+(m.width_m||40)+' × '+(m.height_m||22)+'m';
  el('sim-svg').innerHTML=code.join('');
  el('sim-svg').querySelectorAll('[data-zone]').forEach(node=>node.addEventListener('click',()=>{
   selectedZone=node.dataset.zone;
   if(selectedZone!=='all')el('sim-zone').value=selectedZone;
   render();
  }));
 }
 function updateSelections(){
  const rb=el('sim-robot'),old=robotId;
  if(!data.robots.some(r=>r.robot_id===robotId))robotId=data.robots[0]?.robot_id||0;
  rb.innerHTML=data.robots.length?data.robots.map(r=>'<option value="'+r.robot_id+'">'+escapeHtml(r.name)+'</option>').join(''):'<option value="">현재 층에 로봇 없음</option>';
  rb.value=String(robotId||'');
  const chosenZone=selectedZone;
  el('sim-zone').innerHTML='<option value="all">전체 공용부 (계단 제외)</option>'+data.map.zones.map(z=>'<option value="'+z.id+'" '+(!z.robot_cleanable?'disabled':'')+'>'+escapeHtml(z.name)+(z.robot_cleanable?'':' · 로봇 금지')+'</option>').join('');
  if(data.map.zones.some(z=>z.id===chosenZone&&z.robot_cleanable))el('sim-zone').value=chosenZone;else selectedZone='all';
 }
 function render(){
  if(!data)return;
  updateSelections();
  const r=data.robots.find(r=>r.robot_id===robotId);
  clearMsg(r?('가상 상태: '+(STATUS[r.state]||r.state)+' · 물리모델 미보정 · 실기기와 미연결'):'이 층에 로봇이 없습니다. 홈에서 해당 층에 로봇을 등록하십시오.');
  if(r){
   el('sim-mode').value=r.mode;el('sim-suction').value=r.suction;el('sim-speed').value=String(r.speed_factor);
   const activeZone=data.map.zones.find(z=>z.id===selectedZone);
   const t=[['상태',STATUS[r.state]||r.state],['배터리',r.battery+'%'],['청소 면적',r.cleaned_area_m2+' / '+r.eligible_area_m2+'㎡'],
    ['실제 경로 커버리지',r.coverage_percent+'%'],['주행거리',r.distance_m+'m'],['청소 시간',(r.sim_elapsed_s/60).toFixed(1)+'분 (가상)'],
    ['청소속도',Number(r.cleaning_speed_mps).toFixed(3)+'m/s (보정 전)'],['청소폭','22cm (가정)'],['시뮬레이션',r.speed_factor+'배속'],
    ['선택구역 치수',activeZone?(activeZone.length_m+'×'+activeZone.width_m+'m'):'공용부 전체'],
    ['먼지통',r.dust_ml+' / 450mL'],['물통',r.water_ml+' / 200mL'],['센서','가상 dToF·PSD']];
   el('sim-stats').innerHTML=t.map(([k,v])=>'<div class="twin-stat"><b>'+escapeHtml(k)+'</b><div>'+escapeHtml(v)+'</div></div>').join('');
   el('sim-progress-bar').style.width=Math.max(0,Math.min(100,r.coverage_percent))+'%';
   el('sim-progress-label').textContent='시간이 아니라 로봇이 실제 통과한 이동 가능한 바닥 셀을 기준으로 계산합니다. 전체 '+r.eligible_cells+'셀 중 '+r.cleaned_cells+'셀. '+(r.return_reason||'');
   el('sim-events').innerHTML=(r.events||[]).slice(0,8).map(e=>'<div style="padding:6px 0;border-bottom:1px solid #e9f1ed"><b>'+escapeHtml(e.type)+'</b> · '+escapeHtml(e.detail)+' · '+e.sim_time_s+'s</div>').join('')||'아직 이벤트가 없습니다.';
   for(const action of ['start','pause','resume','stop','dock'])el('sim-'+action).disabled=!robotId||
     (action==='start'&&!['idle','completed','blocked'].includes(r.state))||
     (action==='pause'&&r.state!=='cleaning')||
     (action==='resume'&&r.state!=='paused')||
     (action==='dock'&&['returning','charging'].includes(r.state));
  }else{
   el('sim-stats').innerHTML='';el('sim-events').innerHTML='';el('sim-progress-bar').style.width='0%';
   for(const action of ['start','pause','resume','stop','dock'])el('sim-'+action).disabled=true;
  }
  svg();
 }
 async function load(force=false){
  if(loading)return;
  if(root.classList.contains('hidden')&&!force)return;
  loading=true;
  try{
   const result=await api('/api/sim/state?floor_id='+encodeURIComponent(floorId));
   if(result.floor_id!==floorId)return;
   data=result;render();
  }catch(e){clearMsg('시뮬레이터 오류: '+e.message)}
  finally{loading=false}
 }
 async function command(action,payload={}){
  if(!robotId){clearMsg('로봇을 선택하십시오.');return}
  if(action==='start')followRobot=true;
  try{
   await api('/api/sim/command',{robot_id:robotId,action,...payload});
   await load(true);
  }catch(e){clearMsg('명령 거부: '+e.message)}
 }
 async function mapCommand(action,payload={}){
  try{await api('/api/sim/map',{floor_id:floorId,action,...payload});await load(true)}
  catch(e){clearMsg(e.message)}
 }
 for(const action of ['start','pause','resume','stop','dock']){
  el('sim-'+action).addEventListener('click',()=>command(action,action==='start'?{zone_id:el('sim-zone').value}:{}));
 }
 el('sim-mode').addEventListener('change',e=>command('set_mode',{value:e.target.value}));
 el('sim-suction').addEventListener('change',e=>command('set_suction',{value:e.target.value}));
 el('sim-speed').addEventListener('change',e=>command('set_speed',{value:Number(e.target.value)}));
 el('sim-robot').addEventListener('change',e=>{robotId=Number(e.target.value);render()});
 el('sim-zone').addEventListener('change',e=>{selectedZone=e.target.value;svg()});
 el('sim-empty').addEventListener('click',()=>command('empty_dust'));
 el('sim-refill').addEventListener('click',()=>command('refill_water'));
 el('sim-set-battery').addEventListener('click',()=>command('inject_battery',{value:Number(el('sim-battery').value)}));
 el('sim-nogo').addEventListener('click',()=>selectedZone==='all'?clearMsg('지도에서 개별 청소구역을 선택한 뒤 금지구역을 변경하십시오.'):mapCommand('toggle_no_go',{zone_id:selectedZone}));
 el('sim-clearobstacles').addEventListener('click',()=>mapCommand('clear_obstacles'));
 el('sim-addobstacle').addEventListener('click',()=>{placeObstacle=!placeObstacle;el('sim-addobstacle').textContent=placeObstacle?'지도에서 장애물 설치 위치를 누르세요':'지도 클릭: 장애물 설치'});
 el('sim-svg').addEventListener('click',e=>{
  if(!placeObstacle||!data)return;
  const svg=el('sim-svg'),pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;
  const local=pt.matrixTransform(svg.getScreenCTM().inverse());
  const x=Math.round(local.x),y=Math.round(local.y);
  placeObstacle=false;el('sim-addobstacle').textContent='지도 클릭: 장애물 설치';
  mapCommand('add_obstacle',{x,y,r:24});
 });
 el('sim-follow').addEventListener('click',()=>{followRobot=!followRobot;el('sim-follow').textContent='로봇 따라가기: '+(followRobot?'켜짐':'꺼짐');svg()});
 el('sim-full-map').addEventListener('click',()=>{followRobot=false;el('sim-follow').textContent='로봇 따라가기: 꺼짐';svg()});
 el('sim-building').addEventListener('change',refreshFloor);
 el('sim-floor').addEventListener('change',refreshFloor);
 const oldSwitch=window.switchTab;
 window.switchTab=function(t){oldSwitch(t);if(t==='map'){const next=window.currentFloor||floorId;floorSelection(next);load(true)}};
 window.simRobotRefresh=()=>load(true);
 floorSelection(window.currentFloor||floorId);
 setInterval(()=>load(false),500);
})();
