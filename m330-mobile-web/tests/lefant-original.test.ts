import {test,expect} from 'bun:test';
import {originalLogin,originalLogout,originalCatalog,originalDeviceList,originalSessionState,ORIGINAL_LEFANT,LefantOriginalError}
  from '../lefant-original-client.ts';

const sid='12345678-abcd-1234-abcd-123456789abc';
test('original Lefant XAPK endpoints, not Tuya developer API',()=>{
 expect(ORIGINAL_LEFANT.host).toBe('https://api.useerobot.com');
 expect(ORIGINAL_LEFANT.login).toBe('/v5/client/login-with-password');
 expect(ORIGINAL_LEFANT.catalog).toBe('/v1/device/category-model-tree');
 expect(ORIGINAL_LEFANT.devices).toBe('/v1/device/user-all-device-list-group-by-home');
 expect(JSON.stringify(ORIGINAL_LEFANT)).not.toContain('openapi.tuya');
});
test('original account login uses vendor form fields and keeps token server-side',async()=>{
 originalLogout(sid);
 const requests:Array<{url:URL,body:string}>=[];
 const fake=async(input:any,opt:any)=>{
   requests.push({url:new URL(input),body:opt.body.toString()});
   if(new URL(input).pathname===ORIGINAL_LEFANT.login){
     return Response.json({data:{access_token:'original-lefant-token-at-least-8',third_password:'secret-do-not-expose'}});
   }
   if(new URL(input).pathname===ORIGINAL_LEFANT.catalog)
     return Response.json({data:[{name_for_show:'M3 Max',paired_type_list:'3',hardware_sdk_source:'tuya',third_password:'not-browser'}]});
   if(new URL(input).pathname===ORIGINAL_LEFANT.devices)
     return Response.json({data:{robots:[{name:'M3 Max',device_id:'random',local_key:'never-expose'}]}});
   return Response.json({}, {status:404});
 };
 const logged=await originalLogin(sid,{account:'owner@example.com',password:'USER_PRIVATE_PASSWORD'},fake as typeof fetch);
 expect(logged.signed_in).toBe(true);
 expect(JSON.stringify(logged)).not.toContain('original-lefant-token');
 expect(JSON.stringify(logged)).not.toContain('USER_PRIVATE_PASSWORD');
 expect(requests[0].url.host).toBe('api.useerobot.com');
 expect(requests[0].url.pathname).toBe('/v5/client/login-with-password');
 expect(new URLSearchParams(requests[0].body).get('account')).toBe('owner@example.com');
 expect(new URLSearchParams(requests[0].body).get('password')).toBe('USER_PRIVATE_PASSWORD');
 const models=await originalCatalog(sid,fake as typeof fetch);
 expect(JSON.stringify(models)).toContain('M3 Max');
 expect(JSON.stringify(models)).toContain('paired_type_list');
 expect(JSON.stringify(models)).not.toContain('not-browser');
 expect(requests[1].url.searchParams.get('access_token')).toBe('original-lefant-token-at-least-8');
 expect(new URLSearchParams(requests[1].body).get('cmt_cache_md5')).toBe('');
 const devices=await originalDeviceList(sid,fake as typeof fetch);
 expect(JSON.stringify(devices)).toContain('M3 Max');
 expect(JSON.stringify(devices)).not.toContain('never-expose');
 expect(devices.commands_enabled).toBe(false);
 originalLogout(sid);
 expect(originalSessionState(sid).signed_in).toBe(false);
});
test('vendor refusal never counts as signed in',async()=>{
 const id='00000000-0000-0000-0000-000000000010';
 try{
  await originalLogin(id,{account:'owner@example.com',password:'wrong-password'},
    (async()=>Response.json({code:1001,message:'invalid'}, {status:200})) as typeof fetch);
  throw Error('must reject bad login');
 }catch(e){
  expect(e instanceof LefantOriginalError).toBe(true);
  expect((e as LefantOriginalError).code).toBe('LEFANT_LOGIN_NOT_CONFIRMED');
  expect(originalSessionState(id).signed_in).toBe(false);
 }
});
