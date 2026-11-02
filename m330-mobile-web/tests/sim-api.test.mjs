import assert from 'node:assert/strict';
const BASE=(process.env.M330_BASE||'http://localhost:3000/').replace(/\/$/,'');
let cookie='';
async function call(path,body,expected=200){
 const response=await fetch(BASE+path,{method:body?'POST':'GET',headers:{...(cookie?{cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
 const out=await response.json();
 assert.equal(response.status,expected,path+': '+JSON.stringify(out));
 return out;
}
const before=await call('/api/dashboard');
const first=before.robots[0].id;
assert.ok(first>0);
const initial=await call('/api/sim/state?floor_id=myeonhak-5');
assert.equal(initial.robots.length,1);
assert.equal(initial.robots[0].state,'idle');
assert.equal(initial.robots[0].sensors.virtual,true);
assert.equal(initial.robots[0].sensors.rays.length,11);
assert.ok(initial.robots[0].eligible_cells>0);
assert.equal(initial.map.zones.filter(z=>z.kind==='stairs').length,2);
assert.ok(initial.map.zones.filter(z=>z.kind==='stairs').every(z=>z.robot_cleanable===false));
await call('/api/sim/command',{robot_id:first,action:'start',zone_id:'stairs-west'},422);
const started=await call('/api/sim/command',{robot_id:first,action:'start',zone_id:'corridor-center'});
assert.equal(started.robot.state,'cleaning');
assert.ok(started.robot.total_path_cells>10);
const moved=(await call('/api/sim/step',{robot_id:first,seconds:8})).robot;
assert.ok(moved.distance_m>0.5,JSON.stringify({pose:moved.pose,distance:moved.distance_m}));
assert.ok(moved.cleaned_cells>0,'cleaned cell count must increase as robot physically moves');
assert.ok(moved.battery<initial.robots[0].battery,'battery must reflect time spent moving');
await call('/api/sim/command',{robot_id:first,action:'pause'});
const pauseA=(await call('/api/sim/state?floor_id=myeonhak-5')).robots[0];
const pauseB=(await call('/api/sim/step',{robot_id:first,seconds:5})).robot;
assert.equal(pauseA.state,'paused');
assert.deepEqual(pauseB.pose,pauseA.pose,'paused robot cannot move');
await call('/api/sim/command',{robot_id:first,action:'resume'});
const resumed=(await call('/api/sim/step',{robot_id:first,seconds:5})).robot;
assert.ok(resumed.distance_m>pauseB.distance_m,'resumed robot must move');
const obstacle=await call('/api/sim/map',{floor_id:'myeonhak-5',action:'add_obstacle',x:780,y:268,r:23});
assert.equal(obstacle.config.obstacles.length,1);
const stepAfterObstacle=(await call('/api/sim/step',{robot_id:first,seconds:2})).robot;
assert.ok(Number.isFinite(stepAfterObstacle.pose.x));
await call('/api/sim/map',{floor_id:'myeonhak-5',action:'clear_obstacles'});
const nogo=await call('/api/sim/map',{floor_id:'myeonhak-5',action:'toggle_no_go',zone_id:'corridor-west'});
assert.ok(nogo.config.no_go.includes('corridor-west'));
await call('/api/sim/map',{floor_id:'myeonhak-5',action:'toggle_no_go',zone_id:'corridor-west'});
await call('/api/sim/command',{robot_id:first,action:'stop'});
await call('/api/sim/command',{robot_id:first,action:'set_mode',value:'vacuum_mop'});
await call('/api/sim/command',{robot_id:first,action:'set_suction',value:'max'});
await call('/api/sim/command',{robot_id:first,action:'start',zone_id:'corridor-center'});
const low=await call('/api/sim/command',{robot_id:first,action:'inject_battery',value:19});
assert.equal(low.robot.state,'returning','low battery must cause automatic docking route');
assert.equal(low.robot.auto_resume,true);
const afterDock=(await call('/api/sim/step',{robot_id:first,seconds:200})).robot;
assert.ok(['returning','charging'].includes(afterDock.state),JSON.stringify(afterDock));
assert.ok(afterDock.events.some(x=>x.type==='return_to_dock'));
const charged=(await call('/api/sim/step',{robot_id:first,seconds:15500})).robot;
assert.ok(charged.events.some(x=>x.type==='cleaning_resumed'),'charged robot must resume unfinished cleaning route');
const second=await call('/api/robots',{name:'로봇-2',floor_id:'gyeongae-3'},201);
assert.ok(second.robot.id!==first);
const m3=await call('/api/robots',{name:'실제 M3 Max 시험 등록',model:'M3 Max',floor_id:'gyeongae-2'},201);
assert.equal(m3.robot.model,'M3 Max');
assert.equal(m3.robot.simulation_profile,'M330_fallback_uncalibrated');
const patchResponse=await fetch(BASE+'/api/robots/'+m3.robot.id,{method:'PATCH',
 headers:{'Content-Type':'application/json',cookie},
 body:JSON.stringify({name:'실제 M3 Max 시험 등록',model:'M3 Max',floor_id:'gyeongae-2'})});
assert.equal(patchResponse.status,200);
const edited=await patchResponse.json();
assert.equal(edited.robot.model,'M3 Max');

const secondState=await call('/api/sim/state?floor_id=gyeongae-3');
assert.equal(secondState.robots.length,1);
assert.equal(secondState.robots[0].robot_id,second.robot.id);
assert.equal(secondState.robots[0].cleaned_cells,0);
console.log('PASS motion API: footprint, 11 virtual sensors, 28cm path, real cell coverage, pause/resume, obstacle, no-go, docking, charge-resume, robot isolation');


// M3 Max Wi-Fi-only discovery: protected AP/LAN status, never pretend to authenticate robot.
const pair=await call('/api/gateway/pair',{robot_id:first});
assert.match(pair.pair_key,/^[a-f0-9]{64}$/);
const emptyStatus=await call('/api/m3/onboarding/status?robot_id='+first);
assert.equal(emptyStatus.observation,null);
assert.equal(emptyStatus.connection_transport,'wifi_only');
assert.equal(emptyStatus.pairing_completed,false);
assert.equal(emptyStatus.commands_enabled,false);
const sample={schema_version:2,phase:'wifi_ap_found',diagnostics:{
 ap_candidates:1,lan_candidates:0,wifi_ap_joined:false,scan_state:'partial'}};
const withoutSecret=await fetch(BASE+'/api/m3/onboarding/observe',{method:'POST',
 headers:{'Content-Type':'application/json'},body:JSON.stringify(sample)});
assert.equal(withoutSecret.status,401,'Wi-Fi report must require local bridge key');
const withSecret=await fetch(BASE+'/api/m3/onboarding/observe',{method:'POST',
 headers:{'Content-Type':'application/json','X-M330-Pairing-Key':pair.pair_key},
 body:JSON.stringify(sample)});
assert.equal(withSecret.status,200);
const accepted=await withSecret.json();
assert.equal(accepted.verified_hardware,false);
assert.equal(accepted.commands_enabled,false);
const reported=await call('/api/m3/onboarding/status?robot_id='+first);
assert.equal(reported.observation.phase,'wifi_ap_found');
assert.equal(reported.observation.diagnostics.ap_candidates,1);
assert.equal(reported.commands_enabled,false);
const joinObservation={schema_version:2,phase:'wifi_ap_connected',diagnostics:{
 ap_candidates:0,lan_candidates:0,wifi_ap_joined:true,scan_state:'unavailable'}};
const joinedResponse=await fetch(BASE+'/api/m3/onboarding/observe',{method:'POST',
 headers:{'Content-Type':'application/json','X-M330-Pairing-Key':pair.pair_key},
 body:JSON.stringify(joinObservation)});
assert.equal(joinedResponse.status,200);
const afterJoin=await call('/api/m3/onboarding/status?robot_id='+first);
assert.equal(afterJoin.observation.phase,'wifi_ap_connected');
assert.equal(afterJoin.observation.diagnostics.wifi_ap_joined,true);
assert.equal(afterJoin.device_authenticated,false);
assert.equal(afterJoin.commands_enabled,false);
const unknownSensitive=await fetch(BASE+'/api/m3/onboarding/observe',{method:'POST',
 headers:{'Content-Type':'application/json','X-M330-Pairing-Key':pair.pair_key},
 body:JSON.stringify({...sample,diagnostics:{...sample.diagnostics,
 ssid:'secret-home-wifi',wifi_password:'secret-home-password',local_key:'secret-key',ip:'192.168.1.1'}})});
assert.equal(unknownSensitive.status,200,'extra sensitive fields must be discarded');
const noSecrets=await call('/api/m3/onboarding/status?robot_id='+first);
for(const secret of ['secret-home-wifi','secret-home-password','secret-key','192.168.1.1'])
 assert.equal(JSON.stringify(noSecrets).includes(secret),false,secret+' must never persist');
const rejectedBle=await fetch(BASE+'/api/m3/onboarding/observe',{method:'POST',
 headers:{'Content-Type':'application/json','X-M330-Pairing-Key':pair.pair_key},
 body:JSON.stringify({...sample,phase:'ble_candidate'})});
assert.equal(rejectedBle.status,422);
const invalidJoin=await fetch(BASE+'/api/m3/onboarding/observe',{method:'POST',
 headers:{'Content-Type':'application/json','X-M330-Pairing-Key':pair.pair_key},
 body:JSON.stringify({...sample,phase:'wifi_ap_connected'})});
assert.equal(invalidJoin.status,422,'cannot report AP joined unless local OS confirms association');
const notJoined=await fetch(BASE+'/api/m3/onboarding/observe',{method:'POST',
 headers:{'Content-Type':'application/json','X-M330-Pairing-Key':pair.pair_key},
 body:JSON.stringify({...sample,phase:'paired_and_controllable'})});
assert.equal(notJoined.status,422);
await call('/api/gateway/revoke',{robot_id:first});
const afterRevoke=await call('/api/m3/onboarding/status?robot_id='+first);
assert.equal(afterRevoke.observation,null);
console.log('PASS M3 Max Wi-Fi-only connection: secured AP/LAN observation, AP join proof, secrets discarded, BLE rejected, no unauthenticated device control, revoke');
