// M330 Pro school common-area digital twin (illustrative geometry, not surveyed).
// The twin never sends Tuya/hardware commands. Stairs belong to manual cleaning.
export const TWIN_VERSION='0.4.0';
const BUILDINGS={myeonhak:'면학동',gyeongae:'경애동'} as const;
const FLOOR_IDS=Object.keys(BUILDINGS).flatMap(b=>[5,4,3,2,1].map(n=>b+'-'+n));
type Zone={id:string;name:string;kind:'corridor'|'lobby'|'elevator_hall'|'entry'|'stairs';x:number;y:number;w:number;h:number;robot_cleanable:boolean;manual_cleanable:boolean};
export const getFloor=(floorId:string)=>{
 const match=/^(myeonhak|gyeongae)-([1-5])$/.exec(floorId);
 if(!match)return null;
 const b=match[1] as keyof typeof BUILDINGS,n=Number(match[2]),offset=(n-3)*7+(b==='gyeongae'?8:0);
 const isGround=n===1;
 const zones:Zone[]=[
  {id:'corridor-west',name:'서측 복도',kind:'corridor',x:180,y:214,w:255+offset,h:94,robot_cleanable:true,manual_cleanable:false},
  {id:'corridor-center',name:'중앙 복도',kind:'corridor',x:435+offset,y:214,w:240-offset,h:94,robot_cleanable:true,manual_cleanable:false},
  {id:'corridor-east',name:'동측 복도',kind:'corridor',x:675,y:214,w:155,h:94,robot_cleanable:true,manual_cleanable:false},
  {id:'common-hall',name:isGround?'1층 공용 로비':'층별 공용 홀',kind:'lobby',x:433+offset,y:308,w:185,h:128-(n%2)*16,robot_cleanable:true,manual_cleanable:false},
  {id:'elevator-hall',name:'승강기 앞 공용부',kind:'elevator_hall',x:462+offset,y:104,w:128,h:110,robot_cleanable:true,manual_cleanable:false},
  {id:'stairs-west',name:'서측 계단실 (계단 포함)',kind:'stairs',x:48,y:178,w:124,h:165,robot_cleanable:false,manual_cleanable:true},
  {id:'stairs-east',name:'동측 계단실 (계단 포함)',kind:'stairs',x:836,y:178,w:118,h:165,robot_cleanable:false,manual_cleanable:true}
 ];
 if(isGround)zones.push({id:'entrance',name:'정문 출입구 공용부',kind:'entry',x:478+offset,y:436,w:94,h:78,robot_cleanable:true,manual_cleanable:false});
 return {id:floorId,building_id:b,building_name:BUILDINGS[b],floor_number:n,name:BUILDINGS[b]+' '+n+'층',
  source:'illustrative_generated',is_surveyed:false,width:1000,height:550,zones,
  exclusions:['교실','행정실','교무실','개별 사무실','기타 실내 공간'],
  stairs_policy:'manual_only',interfloor_robot_navigation:false};
};
function route(z:Zone){
 const result:{x:number,y:number}[]=[];
 const left=z.x+Math.min(18,z.w/5),right=z.x+z.w-Math.min(18,z.w/5);
 const top=z.y+Math.min(15,z.h/4),bottom=z.y+z.h-Math.min(15,z.h/4);
 const rows=Math.max(3,Math.ceil((bottom-top)/22));
 for(let row=0;row<=rows;row++){
  const y=top+(bottom-top)*row/rows;
  result.push({x:row%2===0?left:right,y},{x:row%2===0?right:left,y});
 }
 return result;
}
const sample=(pts:{x:number;y:number}[],position:number)=>{
 const steps=pts.length-1;
 const at=Math.max(0,Math.min(steps,position*steps));
 const i=Math.min(steps-1,Math.floor(at));
 const p=pts[i],q=pts[i+1],t=at-i;
 return {x:+(p.x+(q.x-p.x)*t).toFixed(2),y:+(p.y+(q.y-p.y)*t).toFixed(2),heading:Math.atan2(q.y-p.y,q.x-p.x)*180/Math.PI};
};
function now(){return Date.now();}
export function initTwin(db:any){
 db.exec("CREATE TABLE IF NOT EXISTS twin_runs(robot_id INTEGER PRIMARY KEY,session_id TEXT NOT NULL,floor_id TEXT NOT NULL,zone_id TEXT NOT NULL,state TEXT NOT NULL,elapsed_seconds REAL NOT NULL DEFAULT 0,last_tick_ms REAL NOT NULL,total_seconds REAL NOT NULL,battery_start REAL NOT NULL,started_at TEXT NOT NULL)");
 db.exec("CREATE TABLE IF NOT EXISTS twin_manual(id INTEGER PRIMARY KEY AUTOINCREMENT,session_id TEXT NOT NULL,floor_id TEXT NOT NULL,zone_id TEXT NOT NULL,completed INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,UNIQUE(session_id,floor_id,zone_id))");
 db.exec("CREATE INDEX IF NOT EXISTS idx_twin_runs_session ON twin_runs(session_id,floor_id)");
 const robotById=(sid:string,id:any)=>{
  if(!Number.isSafeInteger(id)||id<1)return null;
  return db.query('SELECT * FROM robots WHERE session_id=? AND active=1 AND id=?').get(sid,id) as any;
 };
 const bad=(detail:string,status=400)=>Response.json({detail},{status,headers:{'Cache-Control':'no-store'}});
 const output=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
 const progress=(run:any,at=now())=>{
  const elapsed=run.elapsed_seconds+(run.state==='running'?Math.max(0,(at-run.last_tick_ms)/1000):0);
  return Math.max(0,Math.min(1,elapsed/run.total_seconds));
 };
 const readRun=(run:any,at=now())=>{
  const plan=getFloor(run.floor_id);
  const z=plan?.zones.find(x=>x.id===run.zone_id);
  if(!z)return null;
  let value=progress(run,at);
  let status=run.state;
  if(value>=1&&status==='running'){
   status='completed';
   db.query('UPDATE twin_runs SET state=?,elapsed_seconds=?,last_tick_ms=? WHERE robot_id=? AND session_id=?')
    .run('completed',run.total_seconds,at,run.robot_id,run.session_id);
  }
  return {robot_id:run.robot_id,floor_id:run.floor_id,zone_id:run.zone_id,zone_name:z.name,state:status,
   progress:Math.round(value*1000)/10,pose:sample(route(z),value),
   simulated_battery:Math.max(0,Math.round(run.battery_start-value*14)),started_at:run.started_at,
   elapsed_seconds:Math.round(value*run.total_seconds),duration_seconds:run.total_seconds,
   mode:'digital_twin_simulation',hardware_command:false};
 };
 const allRuns=(sid:string,floorId:string)=>{
  const rows=db.query('SELECT x.* FROM twin_runs x JOIN robots r ON r.id=x.robot_id WHERE x.session_id=? AND x.floor_id=? AND r.active=1 AND r.session_id=?').all(sid,floorId,sid) as any[];
  return rows.map(x=>readRun(x)).filter(Boolean);
 };
 const manualStates=(sid:string,floorId:string)=>{
  const plan=getFloor(floorId)!;
  const rows=db.query('SELECT zone_id,completed,updated_at FROM twin_manual WHERE session_id=? AND floor_id=?').all(sid,floorId) as any[];
  return plan.zones.filter(z=>z.kind==='stairs').map(z=>{
   const r=rows.find(x=>x.zone_id===z.id);
   return {zone_id:z.id,zone_name:z.name,completed:!!r?.completed,updated_at:r?.updated_at||null,mode:'manual_cleaning'};
  });
 };
 const jsonBody=async(req:Request)=>{const t=await req.text();if(t.length>8000)throw new Error('body_too_large');return JSON.parse(t)};
 return async function handleTwin(req:Request,p:string,sid:string,url:URL):Promise<Response>{
  const floorId=url.searchParams.get('floor_id')||'myeonhak-5',plan=getFloor(floorId);
  if(p==='/api/twin/floors'&&req.method==='GET')return output({floors:FLOOR_IDS.map(x=>({id:x,name:getFloor(x)!.name})),source:'illustrative_generated',is_surveyed:false});
  if(p==='/api/twin/map'&&req.method==='GET'){
   return plan?output({...plan,mode:'digital_twin',robot_cleanable_zone_ids:plan.zones.filter(z=>z.robot_cleanable).map(z=>z.id),
    manual_cleaning_zone_ids:plan.zones.filter(z=>z.manual_cleanable).map(z=>z.id)}):bad('존재하지 않는 층입니다.',404);
  }
  if(p==='/api/twin/state'&&req.method==='GET'){
   if(!plan)return bad('존재하지 않는 층입니다.',404);
   const robots=(db.query('SELECT id,name,floor_id FROM robots WHERE session_id=? AND active=1 ORDER BY id').all(sid) as any[])
    .filter(r=>r.floor_id===floorId);
   return output({floor_id:floorId,runs:allRuns(sid,floorId),robots,stairs:manualStates(sid,floorId),
    source:'simulator',hardware_connected:false,hardware_command:false});
  }
  if(p==='/api/twin/command'&&req.method==='POST'){
   let d:any;try{d=await jsonBody(req)}catch{return bad('명령 JSON 형식이 올바르지 않습니다.',400)}
   const r=robotById(sid,d?.robot_id);
   if(!r)return bad('등록되지 않은 로봇입니다.',404);
   const action=d?.action;
   if(!['start','pause','resume','stop','reset'].includes(action))return bad('지원하지 않는 시뮬레이션 명령입니다.',422);
   const current=db.query('SELECT * FROM twin_runs WHERE robot_id=? AND session_id=?').get(r.id,sid) as any;
   if(action==='start'){
    const selectedPlan=getFloor(d?.floor_id);
    if(!selectedPlan)return bad('존재하지 않는 층입니다.',422);
    if(r.floor_id!==d.floor_id)return bad('로봇이 이 층에 배치되어 있지 않습니다. 계단 이동은 수동으로만 가능합니다.',409);
    const zone=selectedPlan.zones.find(x=>x.id===d.zone_id);
    if(!zone)return bad('존재하지 않는 공용구역입니다.',422);
    if(!zone.robot_cleanable)return bad('계단은 지도·수동 청소 작업 대상이지만 M330 Pro 로봇 주행 구역이 아닙니다.',422);
    const other=allRuns(sid,d.floor_id).find((x:any)=>x.robot_id!==r.id&&x.zone_id===zone.id&&x.state==='running');
    if(other)return bad('해당 구역은 다른 로봇이 청소 중입니다.',409);
    const pts=route(zone);
    let length=0;for(let i=1;i<pts.length;i++)length+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);
    const total=Math.max(30,Math.round(length/17));
    const insert=db.query('INSERT INTO twin_runs(robot_id,session_id,floor_id,zone_id,state,elapsed_seconds,last_tick_ms,total_seconds,battery_start,started_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(robot_id) DO UPDATE SET floor_id=excluded.floor_id,zone_id=excluded.zone_id,state=excluded.state,elapsed_seconds=excluded.elapsed_seconds,last_tick_ms=excluded.last_tick_ms,total_seconds=excluded.total_seconds,battery_start=excluded.battery_start,started_at=excluded.started_at');
    insert.run(r.id,sid,d.floor_id,zone.id,'running',0,now(),total,Math.max(0,Math.min(100,r.demo_battery)),new Date().toISOString());
    return output({ok:true,robot_id:r.id,zone_id:zone.id,action:'start',simulated:true,hardware_command:false,duration_seconds:total});
   }
   if(!current)return bad('실행 중인 시뮬레이션이 없습니다.',404);
   const stamp=now(),elapsed=current.elapsed_seconds+(current.state==='running'?Math.max(0,(stamp-current.last_tick_ms)/1000):0);
   if(action==='pause'&&current.state!=='running')return bad('청소 중인 로봇만 일시정지할 수 있습니다.',409);
   if(action==='resume'&&current.state!=='paused')return bad('일시정지된 작업만 재개할 수 있습니다.',409);
   const state=action==='pause'?'paused':action==='resume'?'running':action==='stop'?'stopped':null;
   if(action==='reset'){
    db.query('DELETE FROM twin_runs WHERE robot_id=? AND session_id=?').run(r.id,sid);
   }else{
    db.query('UPDATE twin_runs SET state=?,elapsed_seconds=?,last_tick_ms=? WHERE robot_id=? AND session_id=?')
     .run(state,Math.min(elapsed,current.total_seconds),stamp,r.id,sid);
   }
   return output({ok:true,robot_id:r.id,action,simulated:true,hardware_command:false});
  }
  if(p==='/api/twin/manual'&&req.method==='POST'){
   let d:any;try{d=await jsonBody(req)}catch{return bad('요청 형식 오류',400)}
   const map=getFloor(d?.floor_id);
   if(!map)return bad('존재하지 않는 층입니다.',422);
   const zone=map.zones.find(x=>x.id===d.zone_id);
   if(!zone||!zone.manual_cleanable)return bad('수동 청소는 계단 구역만 지원합니다.',422);
   if(d.action!=='complete'&&d.action!=='reset')return bad('계단 작업 상태를 선택하십시오.',422);
   const completed=d.action==='complete'?1:0;
   db.query('INSERT INTO twin_manual(session_id,floor_id,zone_id,completed,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(session_id,floor_id,zone_id) DO UPDATE SET completed=excluded.completed,updated_at=excluded.updated_at')
    .run(sid,map.id,zone.id,completed,new Date().toISOString());
   return output({ok:true,manual:true,zone_id:zone.id,completed:!!completed,robot_cleaning:false});
  }
  return bad('지원하지 않는 경로입니다.',404);
 };
}
