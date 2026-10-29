/* Public-area school digital twin UI. All geometry is illustrative. */
(() => {
 'use strict';
 const ID='twin-floor', VIEW='view-map';
 const ROOT=document.getElementById(VIEW);
 if(!ROOT)return;
 const originalSwitch=window.switchTab;
 const state={map:null,live:null,zoneId:null,fetching:false,selectedRobot:0,notice:''};
 const esc=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;':'&quot;',"'":'&#39;'}[c]));
 const api=async(path,options)=>{
  const r=await fetch(path,{cache:'no-store',...options});
  const d=await r.json();
  if(!r.ok)throw new Error(d.detail||'요청에 실패했습니다.');
  return d;
 };
 const buildOptions=[['myeonhak','면학동'],['gyeongae','경애동']].map(([id,name])=>'<option value="'+id+'">'+name+'</option>').join('');
 ROOT.innerHTML='<div class="over">SCHOOL DIGITAL TWIN / COMMON AREAS</div>'
  +'<h1 class="twin-title">공용부 청소 디지털 트윈</h1>'
  +'<p class="muted">실측 도면이 아닌 층별 가상 평면도입니다. 교실·행정실 등 내부 공간은 제외하며, 복도·공용 홀·출입구·계단을 포함합니다.</p>'
  +'<div class="twin-filter"><label>건물<select id="twin-building">'+buildOptions+'</select></label>'
  +'<label>층<select id="'+ID+'"><option value="5">5층</option><option value="4">4층</option><option value="3">3층</option><option value="2">2층</option><option value="1">1층</option></select></label></div>'
  +'<div id="twin-overview" class="twin-overview"></div>'
  +'<div class="twin-map-wrap"><svg id="twin-svg" viewBox="0 0 1000 550" role="img" aria-label="가상 학교 공용부 층별 평면도"></svg>'
  +'<div class="twin-legend"><span><i class="twin-dot" style="background:#b7dacc"></i>로봇 청소 가능</span>'
  +'<span><i class="twin-dot" style="background:#f1d0a5"></i>계단 · 수동 청소</span>'
  +'<span><i class="twin-dot" style="background:#206eac"></i>가상 로봇/이동경로</span>'
  +'<span><i class="twin-dot" style="background:#37a982"></i>청소 진행</span></div></div>'
  +'<p class="twin-help">가상 지도에서 청소 구역을 선택하실 수 있습니다. 계단은 청소 대상이지만 로봇이 주행할 수 없어 별도의 수동 완료 처리로 관리합니다.</p>'
  +'<div class="section"><div class="over">PUBLIC CLEANING ZONES</div><h2>층별 공용부 구역</h2><div id="twin-zone-list" class="twin-zones"></div></div>'
  +'<div id="twin-work" class="twin-panel"></div>'
  +'<p class="footnote">가상 시뮬레이션 전용 · 실기기 명령 전송 없음 · 실제 학교 공간·배치와 다를 수 있음</p>';
 const el=id=>document.getElementById(id);
 const updateSelectors=floorId=>{
  const [building,number]=floorId.split('-');
  el('twin-building').value=building;
  el('twin-floor').value=number;
  if(el('map-floor'))el('map-floor').textContent=(building==='myeonhak'?'면학동':'경애동')+' '+number+'층';
 };
 const currentFloorId=()=>el('twin-building').value+'-'+el('twin-floor').value;
 const zoneTypeLabel=z=>z.kind==='stairs'?'계단 · 인력 청소':(z.kind==='corridor'?'복도 · 로봇 청소':z.kind==='entry'?'출입구 · 로봇 청소':'공용부 · 로봇 청소');
 const trail=(zone,progress)=>{
  if(!zone||!progress)return '';
  const padX=Math.min(18,zone.w/5),padY=Math.min(15,zone.h/4),
   left=zone.x+padX,right=zone.x+zone.w-padX,top=zone.y+padY,bottom=zone.y+zone.h-padY,
   rows=Math.max(3,Math.ceil((bottom-top)/22)),points=[];
  for(let row=0;row<=rows;row++){
   const y=top+(bottom-top)*row/rows;
   points.push({x:row%2===0?left:right,y},{x:row%2===0?right:left,y});
  }
  const size=points.length-1,at=Math.max(0,Math.min(size,progress/100*size));
  const last=Math.floor(at),result=points.slice(0,last+1);
  if(last<size){
   const a=points[last],b=points[last+1],f=at-last;
   result.push({x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f});
  }
  return result.map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
 };
 const zoneSelected=(id)=>{state.zoneId=id;render();};
 window.twinSelectZone=zoneSelected;
 function renderSvg(){
  const m=state.map,l=state.live;
  if(!m||!l)return;
  const lines=['<defs><pattern id="twin-stair-hatch" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V12" stroke="#c99665" stroke-width="5"/></pattern></defs>',
   '<rect width="1000" height="550" fill="#f6faf7"/>',
   '<rect x="20" y="20" width="960" height="510" rx="20" fill="none" stroke="#b5cfc1" stroke-width="3" stroke-dasharray="10 9"/>',
   '<text x="46" y="70" font-size="25" fill="#1c5845" font-weight="900">'+esc(m.name)+'</text>',
   '<text x="46" y="100" font-size="14" fill="#789282">가상 공용부 평면 · 도면 실측 아님</text>',
   '<text x="950" y="70" font-size="14" fill="#678a78" text-anchor="end">계단·복도·공용 홀만 표시</text>'];
  const runByZone=new Map(l.runs.map(x=>[x.zone_id,x]));
  m.zones.forEach(z=>{
   const stairs=z.kind==='stairs',selected=z.id===state.zoneId,run=runByZone.get(z.id);
   const fill=stairs?'#f6e1c5':(run?.state==='completed'?'#a1e4c4':run?.state==='running'?'#c5e8d8':'#dbece2');
   lines.push('<g data-zone="'+z.id+'" class="twin-zone'+(selected?' is-selected':'')+'">'
   +'<rect x="'+z.x+'" y="'+z.y+'" width="'+z.w+'" height="'+z.h+'" rx="8" fill="'+fill+'" stroke="'+(stairs?'#bc884f':'#75ac94')+'" stroke-width="3"/>'
   +(stairs?'<rect x="'+(z.x+6)+'" y="'+(z.y+8)+'" width="'+(z.w-12)+'" height="'+(z.h-16)+'" rx="4" fill="url(#twin-stair-hatch)" opacity=".48"/>':'')
   +'</g>');
   if(stairs){
    const done=l.stairs.find(x=>x.zone_id===z.id)?.completed;
    lines.push('<text x="'+(z.x+z.w/2)+'" y="'+(z.y+z.h/2-14)+'" class="twin-stairs-label" text-anchor="middle">'+(z.id==='stairs-west'?'서측':'동측')+' 계단</text>');
    lines.push('<text x="'+(z.x+z.w/2)+'" y="'+(z.y+z.h/2+13)+'" class="twin-label-small" text-anchor="middle">'+(done?'수동 청소 완료':'인력 청소')+'</text>');
    lines.push('<text x="'+(z.x+z.w/2)+'" y="'+(z.y+z.h/2+36)+'" class="twin-label-small" text-anchor="middle">층간 이동 금지</text>');
   } else{
    const center=z.x+z.w/2, y=z.y+z.h/2;
    lines.push('<text x="'+center+'" y="'+(y-4)+'" text-anchor="middle" class="twin-label">'+esc(z.name)+'</text>');
    if(run)lines.push('<text x="'+center+'" y="'+(y+19)+'" class="twin-label-small" text-anchor="middle">'+run.progress.toFixed(0)+'% / '+esc(run.state)+'</text>');
   }
  });
  // Stair transitions are non-traversable by the robot; only planar walks are shown.
  for(const run of l.runs){
   const z=m.zones.find(x=>x.id===run.zone_id);
   if(!z)continue;
   const points=trail(z,run.progress);
   if(points)lines.push('<polyline points="'+points+'" fill="none" stroke="#35a784" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>');
   lines.push('<g class="twin-robot" transform="translate('+run.pose.x+' '+run.pose.y+')"><circle r="16" fill="#206eac" stroke="#fff" stroke-width="4"/><circle r="4" fill="#fff"/></g>');
  }
  const runIds=new Set(l.runs.map(x=>x.robot_id));
  let idleIndex=0;
  for(const r of l.robots.filter(x=>!runIds.has(x.id))){
   const x=454+idleIndex*34,y=265;
   lines.push('<g transform="translate('+x+' '+y+')"><circle r="15" fill="#4d83bf" stroke="white" stroke-width="3"/><text text-anchor="middle" dominant-baseline="middle" fill="white" font-size="12" font-weight="800">R</text></g>');
   idleIndex++;
  }
  el('twin-svg').innerHTML=lines.join('');
  el('twin-svg').querySelectorAll('[data-zone]').forEach(g=>g.addEventListener('click',()=>zoneSelected(g.dataset.zone)));
 }
 function render(){
  const m=state.map,l=state.live;if(!m||!l)return;
  const selected=m.zones.find(z=>z.id===state.zoneId)||m.zones[0];
  state.zoneId=selected.id;
  const running=l.runs.filter(x=>x.state==='running').length;
  const complete=l.stairs.filter(x=>x.completed).length;
  el('twin-overview').innerHTML='<span class="twin-stat">공용부 '+m.zones.length+'개</span><span class="twin-stat">계단 '+l.stairs.length+'개</span>'
   +'<span class="twin-stat">현재 층 로봇 '+l.robots.length+'대</span><span class="twin-stat">가상 청소 중 '+running+'대</span>'
   +'<span class="twin-stat">수동 계단 청소 완료 '+complete+'/'+l.stairs.length+'</span>';
  el('twin-zone-list').innerHTML=m.zones.map(z=>'<button class="twin-zone-btn'+(z.kind==='stairs'?' stairs':'')+(z.id===state.zoneId?' selected':'')+'" data-zone="'+z.id+'">'
   +esc(z.name)+'<small>'+zoneTypeLabel(z)+'</small></button>').join('');
  el('twin-zone-list').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>zoneSelected(b.dataset.zone)));
  renderSvg();
  if(selected.kind==='stairs'){
   const manual=l.stairs.find(x=>x.zone_id===selected.id),complete=!!manual?.completed;
   el('twin-work').innerHTML='<b>선택 구역: '+esc(selected.name)+'</b>'
    +'<div class="twin-stair-note">계단실을 디지털 트윈의 청소 대상에 포함했습니다. 계단의 단차는 M330 Pro 주행 경로에 넣지 않으며, 수동 청소 작업으로 구분합니다.</div>'
    +'<div class="twin-status">수동 작업: '+(complete?'완료':'미완료')+'</div>'
    +'<div class="twin-actions"><button class="primary" id="twin-manual-toggle">'+(complete?'완료 취소':'계단 수동 청소 완료 처리')+'</button></div>';
   el('twin-manual-toggle').addEventListener('click',()=>doManual(complete?'reset':'complete'));
   return;
  }
  const options=l.robots.map(r=>'<option value="'+r.id+'">'+esc(r.name)+'</option>').join('');
  if(!l.robots.some(r=>r.id===state.selectedRobot))state.selectedRobot=l.robots[0]?.id||0;
  const run=l.runs.find(r=>r.robot_id===state.selectedRobot),isRunning=run?.state==='running',isPaused=run?.state==='paused';
  const progress=run?.progress||0;
  el('twin-work').innerHTML='<b>선택 구역: '+esc(selected.name)+'</b><p>이 구역에 로봇을 배정하여 지그재그 청소 경로를 실제 시간에 맞춰 가상 실행합니다.</p>'
   +'<label style="font-size:12px;font-weight:800">현재 층 로봇 선택<select id="twin-robot-select" style="margin-top:7px" '+(!l.robots.length?'disabled':'')+'>'+options+'</select></label>'
   +'<div class="twin-status">'+(run?('작업: '+esc(run.zone_name)+' · '+esc(run.state)+' · 가상 배터리 '+run.simulated_battery+'%'):'대기 · 수행 중인 가상 청소 없음')+'</div>'
   +'<div class="twin-progress"><div style="width:'+progress+'%"></div></div><p>가상 청소 진행률 '+progress.toFixed(1)+'%</p>'
   +'<div class="twin-actions"><button class="primary" id="twin-start" '+(!l.robots.length||isRunning?'disabled':'')+'>청소 시작</button>'
   +'<button id="twin-pause" '+(!isRunning?'disabled':'')+'>일시정지</button>'
   +'<button id="twin-resume" '+(!isPaused?'disabled':'')+'>재개</button>'
   +'<button id="twin-stop" '+(!run||run.state==='stopped'||run.state==='completed'?'disabled':'')+'>중지</button>'
   +'<button id="twin-reset" '+(!run?'disabled':'')+'>경로 초기화</button></div>'
   +(!l.robots.length?'<p>이 층에 배치된 로봇이 없습니다. 홈의 전체 로봇 관리에서 해당 층에 로봇을 배치해 주십시오.</p>':'')
   +'<p class="twin-help">로봇청소기 가상 주행은 복도·공용 홀·출입구에만 적용됩니다. 실기기에는 명령하지 않습니다.</p>';
  el('twin-robot-select')?.addEventListener('change',e=>{state.selectedRobot=Number(e.target.value);render();});
  for(const action of ['start','pause','resume','stop','reset']){
   el('twin-'+action)?.addEventListener('click',()=>doCommand(action));
  }
 }
 async function doManual(action){
  try{await api('/api/twin/manual',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({floor_id:state.map.id,zone_id:state.zoneId,action})});await refresh(true);}
  catch(e){alert(e.message);}
 }
 async function doCommand(action){
  if(!state.selectedRobot)return;
  try{await api('/api/twin/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({robot_id:state.selectedRobot,floor_id:state.map.id,zone_id:state.zoneId,action})});await refresh(true);}
  catch(e){alert(e.message);}
 }
 async function refresh(force=false){
  if(state.fetching)return;
  state.fetching=true;
  try{
   const floorId=currentFloorId();
   if(!state.map||state.map.id!==floorId){
    state.map=await api('/api/twin/map?floor_id='+encodeURIComponent(floorId));
    state.zoneId='corridor-center';
    updateSelectors(floorId);
   }
   state.live=await api('/api/twin/state?floor_id='+encodeURIComponent(floorId));
   render();
  }catch(e){if(force)alert('가상 지도 갱신 오류: '+e.message);}
  finally{state.fetching=false;}
 }
 function floorChanged(){
  const id=currentFloorId();
  if(window.currentBuilding!==undefined){window.currentBuilding=el('twin-building').value;window.currentFloor=id;window.renderFloors?.();}
  state.map=null;refresh(true);
 }
 el('twin-building').addEventListener('change',floorChanged);
 el('twin-floor').addEventListener('change',floorChanged);
 window.switchTab=function(tab){originalSwitch(tab);if(tab==='map'){const selected=window.currentFloor||'myeonhak-5';updateSelectors(selected);refresh(true);}};
 window.addEventListener('resize',()=>{if(!ROOT.classList.contains('hidden'))renderSvg()});
 setInterval(()=>{if(!ROOT.classList.contains('hidden'))refresh(false)},1000);
 updateSelectors(window.currentFloor||'myeonhak-5');
})();
