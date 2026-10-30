/* M330 Pro feature-level digital simulator.
 * Synthetic 2D environment. Physics/algorithms are representative, NOT Lefant firmware.
 * Geometry units: SVG px, 25px=1m. High-resolution coverage grid: 5px=0.2m.
 * M330 capabilities from official marketing/user guide; unverified speed/current/threshold are tunable assumptions.
 */
const PX_PER_M=25, CELL=5, COLS=200, ROWS=110, ROBOT_R=0.14*PX_PER_M, CLEAN_R=0.11*PX_PER_M, SAFE_R=ROBOT_R+0.8, DOCK={x:510,y:270};
const SPECS={
 model:'Lefant M330 Pro', diameter_m:0.28,height_m:0.095,
 sensing:['dToF navigation','PSD obstacle avoidance','cliff prevention'],
 lidar_range_m:15, psd_fov_degrees:190, dustbin_ml:450, water_tank_ml:200,
 battery_capacity_mah:2600,reference_runtime_s:9000, reference_charge_s:19800,
 official_coverage_m2_per_charge:155, assumed_cleaning_width_m:0.22,
 // 155m² / (150min * 0.22m) = 0.0783m/s under 100% effective-coverage assumption.
 physical_speed_mps:0.0783, travel_speed_mps:0.18, battery_return_threshold:20,
 floor_scale_m_per_px:1/PX_PER_M, floor_width_m:1000/PX_PER_M, floor_height_m:550/PX_PER_M,
 grid_resolution_m:CELL/PX_PER_M, reference_speed_calculation:'155 m² / (9000 s × assumed 0.22 m sweep width) = 0.0783 m/s',
 capability_modes:['vacuum','mop','vacuum_mop'], suction:['quiet','standard','max'],
 verified_speeds:false,verified_power_curve:false,verified_mapping_algorithm:false,
 notes:'M330 Pro published travel/cleaning velocity is not verified; 0.0783m/s derives from advertised 155m², 150min and an ASSUMED 0.22m effective sweep width, not a manufacturer speed measurement. All geometry is synthetic.'
};
const xy=(id)=>({x:(id%COLS)*CELL+CELL/2,y:Math.floor(id/COLS)*CELL+CELL/2});
const gid=(x,y)=>Math.floor(x/CELL)+Math.floor(y/CELL)*COLS;
const inside=(p,z)=>p.x>=z.x&&p.x<=z.x+z.w&&p.y>=z.y&&p.y<=z.y+z.h;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function emit(s,type,detail=''){s.events=(s.events||[]).slice(-24);s.events.unshift({type,detail,sim_time_s:Math.round(s.elapsed_s||0),at:new Date().toISOString()});}
function safePositions(map,config,mode){
 const zones=map.zones.filter(z=>z.robot_cleanable&&!config.no_go.includes(z.id));
 const d=SAFE_R/Math.sqrt(2);
 const points=[[0,0],[SAFE_R,0],[-SAFE_R,0],[0,SAFE_R],[0,-SAFE_R],[d,d],[-d,d],[d,-d],[-d,-d]];
 const allowed=(p)=>points.every(([a,b])=>{
  const q={x:p.x+a,y:p.y+b};
  if(!zones.some(z=>inside(q,z)))return false;
  if(config.obstacles.some(o=>dist(q,o)<=o.r))return false;
  if(mode==='mop'&&config.carpet.some(z=>inside(q,z)))return false;
  return true;
 });
 const cells=new Set();
 for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
  const id=y*COLS+x;if(allowed(xy(id)))cells.add(id);
 }
 return cells;
}
const nbr=id=>[id-1,id+1,id-COLS,id+COLS].filter(v=>v>=0&&v<COLS*ROWS&&((v===id-1||v===id+1)?Math.floor(v/COLS)===Math.floor(id/COLS):true));
function nearest(p,open){let id=null,best=Infinity;for(const v of open){let d=dist(p,xy(v));if(d<best){best=d;id=v}}return id;}
function astar(a,b,open){
 if(a==null||b==null||!open.has(a)||!open.has(b))return null;
 if(nbr(a).includes(b))return [a,b];
 if(a===b)return [a];
 const frontier=[a],g=new Map([[a,0]]),parent=new Map(),closed=new Set(),h=id=>Math.abs(id%COLS-b%COLS)+Math.abs(Math.floor(id/COLS)-Math.floor(b/COLS));
 while(frontier.length){
  let top=0,best=Infinity;
  for(let i=0;i<frontier.length;i++){const v=frontier[i],f=g.get(v)+h(v);if(f<best){best=f;top=i}}
  const u=frontier.splice(top,1)[0];if(u===b){const path=[b];while(path[0]!==a)path.unshift(parent.get(path[0]));return path}
  closed.add(u);for(const v of nbr(u)){if(!open.has(v)||closed.has(v))continue;
   const ng=g.get(u)+1;if(ng<(g.get(v)??Infinity)){g.set(v,ng);parent.set(v,u);if(!frontier.includes(v))frontier.push(v)}
  }
 }
 return null;
}
function plan(s,map,config,returnToDock=false){
 const open=safePositions(map,config,s.mode);
 const start=nearest(s.pose,open);
 const targetZones=map.zones.filter(z=>z.robot_cleanable&&!config.no_go.includes(z.id)&&(s.target==='all'||z.id===s.target));
 let targets=[];
 if(!returnToDock){
  targets=[...open].filter(id=>targetZones.some(z=>inside(xy(id),z)));
  const rowGroups=new Map();
  for(const id of targets){const row=Math.floor(id/COLS);if(!rowGroups.has(row))rowGroups.set(row,[]);rowGroups.get(row).push(id)}
  targets=[];let rowNum=0;
  for(const row of [...rowGroups.keys()].sort((a,b)=>a-b)){
   const entries=rowGroups.get(row).sort((a,b)=>(a%COLS)-(b%COLS));if(rowNum%2)entries.reverse();
   targets.push(...entries);rowNum++;
  }
  s.target_total=targets.length;
  // Do not treat elapsed time as cleaned area. Only cells traversed with suction/mop on are counted.
  const visited=new Set(s.visited||[]);
  targets=targets.filter(id=>!visited.has(id));
 }else{
  const target=nearest(DOCK,open);
  targets=target==null?[]:[target];
 }
 // Only cells connected to the current docking/robot component are robot-accessible.
 // Avoid asking A* to reach disconnected hall sections thousands of times.
 const reachable=new Set(start===null?[]:[start]),queue=start===null?[]:[start];
 for(let h=0;h<queue.length;h++){for(const n of nbr(queue[h])){
  if(open.has(n)&&!reachable.has(n)){reachable.add(n);queue.push(n)}
 }}
 const inaccessible=targets.length;
 targets=targets.filter(id=>reachable.has(id));
 let path=[],current=start,skipped=inaccessible-targets.length;
 for(const target of targets){
  if(current===target){if(!path.length)path.push(target);continue}
  const segment=astar(current,target,open);
  if(!segment){skipped++;continue}
  path.push(...segment.slice(path.length?1:0));current=target;
 }
 s.path=path;s.path_index=0;s.skipped=skipped;
 return {open_cells:open.size,targets:targets.length,skipped,path_length:path.length};
}
function configuration(db,sid,floor){
 const row=db.query('SELECT payload FROM sim_configs WHERE session_id=? AND floor_id=?').get(sid,floor);
 if(row){try{return JSON.parse(row.payload)}catch{}}
 return {obstacles:[],no_go:[],carpet:[]};
}
function saveConfig(db,sid,floor,c){
 db.query('INSERT INTO sim_configs(session_id,floor_id,payload) VALUES(?,?,?) ON CONFLICT(session_id,floor_id) DO UPDATE SET payload=excluded.payload').run(sid,floor,JSON.stringify(c));
}
function baseState(robot){
 return {robot_id:robot.id,session_id:robot.session_id,floor_id:robot.floor_id,
  pose:{x:DOCK.x,y:DOCK.y,heading:0},state:'idle',battery:robot.demo_battery??82,
  mode:'vacuum',suction:'standard',accel:20,model_version:2,dust_ml:0,water_ml:200,elapsed_s:0,distance_m:0,
  path:[],path_index:0,target:'all',target_total:0,visited:[],
  resume_after_charge:false,return_reason:null,events:[],last_ms:Date.now(),error:null};
}
export function initRobotSimulator(db,getFloor){
 db.exec("CREATE TABLE IF NOT EXISTS sim_states(robot_id INTEGER PRIMARY KEY,session_id TEXT NOT NULL,payload TEXT NOT NULL,updated_at TEXT NOT NULL)");
 db.exec("CREATE TABLE IF NOT EXISTS sim_configs(session_id TEXT NOT NULL,floor_id TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(session_id,floor_id))");
 function load(sid,robot){
  const row=db.query('SELECT payload FROM sim_states WHERE robot_id=? AND session_id=?').get(robot.id,sid);
  let s=row?JSON.parse(row.payload):baseState(robot);
  if(s.floor_id!==robot.floor_id||s.model_version!==2){
   s=baseState(robot);emit(s,'manual_floor_transfer','로봇이 관리화면에서 새 층으로 수동 재배치됨');
  }
  return s;
 }
 function persist(s){
  db.query('INSERT INTO sim_states(robot_id,session_id,payload,updated_at) VALUES(?,?,?,?) ON CONFLICT(robot_id) DO UPDATE SET session_id=excluded.session_id,payload=excluded.payload,updated_at=excluded.updated_at')
   .run(s.robot_id,s.session_id,JSON.stringify(s),new Date().toISOString());
 }
 function toDock(s,map,config,reason,autoResume){
  s.return_reason=reason;s.resume_after_charge=autoResume;
  const next=plan(s,map,config,true);
  if(!next.path_length){s.state='blocked';s.error='충전소로 이동할 경로가 없습니다.';emit(s,'navigation_blocked',s.error);return}
  s.state='returning';emit(s,'return_to_dock',reason);
 }
 function restore(s,map,config){
  plan(s,map,config,false);
  if(!s.path.length){s.state='completed';emit(s,'cleaning_completed','남은 도달 가능 청소 셀이 없습니다.');return}
  s.state='cleaning';emit(s,'cleaning_resumed','충전 후 남은 청소 영역을 계속합니다.');
 }
 function tick(s,map,config,at=Date.now()){
  const elapsedReal=Math.max(0,Math.min(60,(at-s.last_ms)/1000));
  s.last_ms=at;
  let dt=elapsedReal*s.accel;
  // Simulate from a deterministic state machine, not an animation-only percentage.
  let count=0,vis=new Set(s.visited||[]);
  const open=safePositions(map,config,s.mode);
  while(dt>0.000001&&count++<10000){
   if(s.state==='charging'){
    const gain=Math.min(dt, (100-s.battery)*SPECS.reference_charge_s/100);
    s.battery=Math.min(100,s.battery+gain*100/SPECS.reference_charge_s);
    s.elapsed_s+=gain;dt-=gain;
    if(s.battery>=95&&s.resume_after_charge){
     s.resume_after_charge=false;restore(s,map,config);continue;
    }
    if(s.battery>=100){s.state='idle';emit(s,'charged','완충 및 대기');}
    break;
   }
   if(!['cleaning','returning'].includes(s.state))break;
   if(s.path_index>=s.path.length){
    if(s.state==='returning'){s.state='charging';emit(s,'docked','충전 시작');continue}
    emit(s,'cleaning_completed','주행 가능한 경로 끝');toDock(s,map,config,'cleaning_completed',false);continue;
   }
   const next=xy(s.path[s.path_index]);
   if(!open.has(s.path[s.path_index])){
    const prev=s.state;
    if(prev==='returning')toDock(s,map,config,s.return_reason||'obstacle',s.resume_after_charge);
    else {plan(s,map,config,false);if(!s.path.length){s.state='blocked';s.error='동적 장애물로 이동 가능한 청소 경로 없음';emit(s,'navigation_blocked',s.error)}} 
    emit(s,'replanned','장애물 또는 금지구역 변경으로 경로 재계획');continue;
   }
   const length=dist(s.pose,next),speed=(s.state==='returning'?SPECS.travel_speed_mps:SPECS.physical_speed_mps)*PX_PER_M;
   const remainingTime=length/speed;
   if(length<0.0001){s.path_index++;continue}
   const moveTime=Math.min(dt,remainingTime);
   const fraction=Math.min(1,speed*moveTime/length);
   const moved=length*fraction;
   s.pose={x:+(s.pose.x+(next.x-s.pose.x)*fraction).toFixed(3),
    y:+(s.pose.y+(next.y-s.pose.y)*fraction).toFixed(3),
    heading:+(Math.atan2(next.y-s.pose.y,next.x-s.pose.x)*180/Math.PI).toFixed(2)};
   if(fraction>=0.9999){s.pose.x=next.x;s.pose.y=next.y;s.path_index++}
   s.elapsed_s+=moveTime;s.distance_m+=moved/PX_PER_M;
   const rate=100/SPECS.reference_runtime_s*(s.suction==='max'?1.4:s.suction==='quiet'?.8:1);
   s.battery=Math.max(0,s.battery-rate*moveTime*(s.state==='returning'?.65:1));
   if(s.state==='cleaning'){
    for(let y=Math.max(0,Math.floor((s.pose.y-ROBOT_R)/CELL));y<=Math.min(ROWS-1,Math.floor((s.pose.y+ROBOT_R)/CELL));y++){
     for(let x=Math.max(0,Math.floor((s.pose.x-ROBOT_R)/CELL));x<=Math.min(COLS-1,Math.floor((s.pose.x+ROBOT_R)/CELL));x++){
      const id=y*COLS+x;
      if(dist(s.pose,xy(id))<=CLEAN_R+Math.SQRT2*CELL/4&&open.has(id)&&map.zones.some(z=>z.robot_cleanable&&(s.target==='all'||z.id===s.target)&&inside(xy(id),z))){
       vis.add(id);
      }
     }
    }
    s.dust_ml=Math.min(SPECS.dustbin_ml,s.dust_ml+moveTime*.004);
    if(s.mode!=='vacuum')s.water_ml=Math.max(0,s.water_ml-moveTime*.008);
   }
   dt-=moveTime;
   if(s.battery<=SPECS.battery_return_threshold&&s.state==='cleaning'){
    s.visited=[...vis];toDock(s,map,config,'battery_low',true);emit(s,'battery_low','저전력 자동 복귀');continue;
   }
   if(s.battery<=0&&s.state==='returning'){s.state='blocked';s.error='배터리 고갈로 충전소 복귀 실패';emit(s,'power_failed',s.error);break}
  }
  s.visited=[...vis];
  return s;
 }
 function snapshot(s,map,conf){
  const open=safePositions(map,conf,s.mode);
  const eligible=[...open].filter(id=>map.zones.some(z=>z.robot_cleanable&&(s.target==='all'||z.id===s.target)&&inside(xy(id),z)));
  const all=new Set(eligible),done=s.visited.filter(id=>all.has(id));
  // Simulated dToF + PSD ray-casts against the synthetic geometry.
  const rays=[];
  for(let i=-5;i<=5;i++){
   const angle=(s.pose.heading+i*19)*Math.PI/180;
   let reached=SPECS.lidar_range_m;
   for(let d=0.2;d<=SPECS.lidar_range_m;d+=.2){
    const p={x:s.pose.x+Math.cos(angle)*d*PX_PER_M,y:s.pose.y+Math.sin(angle)*d*PX_PER_M};
    const cell=gid(p.x,p.y);
    if(cell<0||cell>=COLS*ROWS||!open.has(cell)){reached=d;break}
   }
   rays.push({relative_degrees:i*19,distance_m:+reached.toFixed(2)});
  }
  return {robot_id:s.robot_id,floor_id:s.floor_id,pose:s.pose,state:s.state,battery:+s.battery.toFixed(2),
   mode:s.mode,suction:s.suction,speed_factor:s.accel,water_ml:+s.water_ml.toFixed(1),dust_ml:+s.dust_ml.toFixed(1),
   path:s.path.slice(s.path_index,Math.min(s.path_index+220,s.path.length)).map(xy),total_path_cells:s.path.length,
   visited:s.visited,eligible_cells:eligible.length,cleaned_cells:done.length,
   coverage_percent:eligible.length?+(done.length/eligible.length*100).toFixed(1):0,
   cleaned_area_m2:+(done.length*(CELL/PX_PER_M)**2).toFixed(2),eligible_area_m2:+(eligible.length*(CELL/PX_PER_M)**2).toFixed(2),
   cell_px:CELL,grid_cols:COLS,grid_rows:ROWS,robot_radius_px:ROBOT_R,meters_per_pixel:1/PX_PER_M,
   cleaning_speed_mps:SPECS.physical_speed_mps,travel_speed_mps:SPECS.travel_speed_mps,
   floor_width_m:1000/PX_PER_M,floor_height_m:550/PX_PER_M,
   distance_m:+s.distance_m.toFixed(2),sim_elapsed_s:+s.elapsed_s.toFixed(1),events:s.events.slice(0,15),
   sensors:{virtual:true,dt_of_range_m:15,psd_fov_deg:190,rays,cliff_detected:map.zones.some(z=>z.kind==='stairs'&&inside({x:s.pose.x+30*Math.cos(s.pose.heading*Math.PI/180),y:s.pose.y+30*Math.sin(s.pose.heading*Math.PI/180)},z))},
   return_reason:s.return_reason,auto_resume:s.resume_after_charge,error:s.error,
   hardware_connected:false,simulation:true,calibration:'uncalibrated_reference_model'};
 }
 function findRobot(sid,id){
  const r=db.query('SELECT * FROM robots WHERE id=? AND session_id=? AND active=1').get(id,sid);
  if(!r)throw Object.assign(new Error('등록되지 않은 로봇'),{status:404});
  return r;
 }
 function getRobot(sid,id){
  const r=findRobot(sid,id),map=getFloor(r.floor_id);
  if(!map)throw Object.assign(new Error('유효하지 않은 지도'),{status:422});
  const cfg=configuration(db,sid,r.floor_id),s=load(sid,r);
  tick(s,map,cfg);persist(s);
  return {r,map,cfg,s};
 }
 function command(sid,id,action,args={}){
  const {r,map,cfg,s}=getRobot(sid,id);
  if(['start','clean_zone'].includes(action)){
   if(s.state==='cleaning')throw Object.assign(new Error('이미 청소 중입니다.'),{status:409});
   if(s.state==='returning')throw Object.assign(new Error('충전소 복귀 중입니다.'),{status:409});
   if(s.state==='charging')throw Object.assign(new Error('충전 중에는 청소를 시작할 수 없습니다.'),{status:409});
   const target=args.zone_id||'all';
   if(target!=='all'&&!map.zones.some(z=>z.id===target&&z.robot_cleanable&&!cfg.no_go.includes(z.id)))throw Object.assign(new Error('청소 불가 구역입니다. 계단은 로봇 주행 불가'),{status:422});
   if(s.battery<=20)throw Object.assign(new Error('배터리 부족: 충전 후 시작하십시오.'),{status:409});
   s.target=target;s.visited=[];s.error=null;s.resume_after_charge=false;
   const result=plan(s,map,cfg,false);
   if(!result.path_length)throw Object.assign(new Error('주행 가능한 청소 경로가 없습니다.'),{status:422});
   s.state='cleaning';emit(s,'cleaning_started','새 청소 경로 '+result.path_length+'개 셀');
  }else if(action==='pause'){
   if(s.state!=='cleaning')throw Object.assign(new Error('청소 중인 로봇만 일시정지할 수 있습니다.'),{status:409});
   s.state='paused';emit(s,'paused');
  }else if(action==='resume'){
   if(s.state!=='paused')throw Object.assign(new Error('정지 상태가 아닙니다.'),{status:409});
   s.state='cleaning';emit(s,'resumed');
  }else if(action==='stop'){
   s.state='idle';s.path=[];s.path_index=0;s.resume_after_charge=false;emit(s,'stopped');
  }else if(action==='dock'){
   if(s.state==='charging')throw Object.assign(new Error('이미 충전 중입니다.'),{status:409});
   toDock(s,map,cfg,'operator',false);
  }else if(action==='set_mode'){
   if(!SPECS.capability_modes.includes(args.value))throw Object.assign(new Error('지원하지 않는 청소모드'),{status:422});
   s.mode=args.value;emit(s,'mode_changed',s.mode);
   if(s.state==='cleaning')plan(s,map,cfg,false);
  }else if(action==='set_suction'){
   if(!SPECS.suction.includes(args.value))throw Object.assign(new Error('지원하지 않는 흡입 단계'),{status:422});
   s.suction=args.value;emit(s,'suction_changed',s.suction);
  }else if(action==='set_speed'){
   if(![1,5,20,100].includes(args.value))throw Object.assign(new Error('시뮬레이션 배속은 1·5·20·100만 가능합니다.'),{status:422});
   s.accel=args.value;emit(s,'speed_factor_changed',String(s.accel));
  }else if(action==='inject_battery'){
   if(!Number.isFinite(args.value)||args.value<1||args.value>100)throw Object.assign(new Error('시험용 배터리는 1~100%'),{status:422});
   s.battery=args.value;emit(s,'test_battery_injected','시험 입력 '+args.value+'%');
   if(s.state==='cleaning'&&s.battery<=20)toDock(s,map,cfg,'battery_low',true);
  }else if(action==='empty_dust'){
   s.dust_ml=0;emit(s,'dustbin_emptied');
  }else if(action==='refill_water'){
   s.water_ml=SPECS.water_tank_ml;emit(s,'water_refilled');
  }else throw Object.assign(new Error('지원하지 않는 명령'),{status:422});
  persist(s);
  return snapshot(s,map,cfg);
 }
 function modifyMap(sid,floor,action,args){
  const map=getFloor(floor);if(!map)throw Object.assign(new Error('유효하지 않은 층'),{status:422});
  const cfg=configuration(db,sid,floor);
  if(action==='add_obstacle'){
   const x=Number(args.x),y=Number(args.y),r=Number(args.r||25);
   if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1000||y<0||y>550||r<10||r>90)throw Object.assign(new Error('장애물 좌표·크기 오류'),{status:422});
   if(!map.zones.some(z=>z.robot_cleanable&&inside({x,y},z)))throw Object.assign(new Error('장애물은 공용부에만 배치 가능'),{status:422});
   cfg.obstacles.push({id:'ob-'+Date.now()+'-'+Math.floor(Math.random()*1e5),x,y,r});
  }else if(action==='clear_obstacles')cfg.obstacles=[];
  else if(action==='toggle_no_go'){
   const z=map.zones.find(z=>z.id===args.zone_id&&z.robot_cleanable);
   if(!z)throw Object.assign(new Error('로봇 청소 구역만 금지구역 설정 가능'),{status:422});
   cfg.no_go=cfg.no_go.includes(z.id)?cfg.no_go.filter(id=>id!==z.id):[...cfg.no_go,z.id];
  }else throw Object.assign(new Error('지도 변경 명령 오류'),{status:422});
  saveConfig(db,sid,floor,cfg);return cfg;
 }
 const body=async(req)=>{const x=await req.text();if(x.length>16000)throw Error('요청 크기 초과');return JSON.parse(x)};
 const response=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
 async function handle(req,p,sid,url){
  try{
   if(p==='/api/sim/spec'&&req.method==='GET')return response({spec:SPECS,source_type:'documented_capabilities_plus_explicit_assumptions'});
   if(p==='/api/sim/state'&&req.method==='GET'){
    const floor=url.searchParams.get('floor_id')||'myeonhak-5';
    const map=getFloor(floor);if(!map)return response({detail:'층 정보 오류'},404);
    const robots=db.query('SELECT * FROM robots WHERE session_id=? AND floor_id=? AND active=1 ORDER BY id').all(sid,floor);
    const cfg=configuration(db,sid,floor);
    const states=robots.map(r=>getRobot(sid,r.id)).map(x=>({...snapshot(x.s,map,cfg),name:x.r.name}));
    return response({floor_id:floor,map,config:cfg,robots:states,engine:'state_machine_grid_astar_sensor_raycasts_cell_coverage',hardware_connected:false});
   }
   if(p==='/api/sim/command'&&req.method==='POST'){
    const d=await body(req);return response({ok:true,robot:command(sid,d.robot_id,d.action,d),simulated:true});
   }
   if(p==='/api/sim/step'&&req.method==='POST'){
    const d=await body(req);
    if(!Number.isFinite(d.seconds)||d.seconds<=0||d.seconds>28800)return response({detail:'시험 시간은 1~28800초 이내로 설정하십시오.'},422);
    const {map,cfg,s}=getRobot(sid,d.robot_id);
    let remaining=d.seconds;
    while(remaining>0){
     const chunk=Math.min(remaining,50*s.accel);
     tick(s,map,cfg,s.last_ms+chunk/s.accel*1000);
     remaining-=chunk;
    }
    s.last_ms=Date.now();persist(s);
    return response({ok:true,advanced_sim_seconds:d.seconds,robot:snapshot(s,map,cfg),hardware_command:false});
   }
   if(p==='/api/sim/map'&&req.method==='POST'){
    const d=await body(req);return response({ok:true,config:modifyMap(sid,d.floor_id,d.action,d)});
   }
   return response({detail:'Unknown simulation API'},404);
  }catch(e){return response({detail:e.message||'시뮬레이션 오류'},e.status||400)}
 }
 return {handle,command,getRobot,snapshot,modifyMap,spec:SPECS};
}
