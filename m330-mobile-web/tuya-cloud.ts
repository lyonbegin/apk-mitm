import {createHash,createHmac,randomBytes} from 'node:crypto';

/**
 * Web-only Tuya CLOUD device verification.
 * This does NOT perform Wi-Fi AP/EZ activation, which needs local UDP.
 * The caller submits cloud credentials per request; nothing is persisted.
 */
type CloudRegion='us'|'eu'|'cn'|'in';
export type CloudRequest={client_id:string,client_secret:string,device_id:string,region:CloudRegion};
type Fetcher=typeof fetch;
const ENDPOINTS:Record<CloudRegion,string>={
 us:'https://openapi.tuyaus.com',
 eu:'https://openapi.tuyaeu.com',
 cn:'https://openapi.tuyacn.com',
 in:'https://openapi.tuyain.com',
};
export type CloudResult={
 cloud_authorized:true, device_ref:string, device_name:string,
 online:boolean|null,status_codes:string[],cloud_checked_at:string,
 registration_method:'existing_tuya_cloud_device',hardware_commands_enabled:false
};
export class CloudAccessError extends Error{
 constructor(public code:string){super(code)}
}
export function parseCloudRequest(obj:any):CloudRequest{
 if(!obj||typeof obj!=='object'||Array.isArray(obj))throw new CloudAccessError('INVALID_FIELDS');
 const clean=(k:string,min:number,max:number)=>{
  const v=obj[k];
  if(typeof v!=='string'||v.length<min||v.length>max||v.trim()!==v)throw new CloudAccessError('INVALID_FIELDS');
  return v;
 };
 const client_id=clean('client_id',8,128),client_secret=clean('client_secret',8,256);
 const device_id=clean('device_id',6,80),region=obj.region;
 if(!/^[A-Za-z0-9_\-]+$/.test(client_id)||
    !/^[A-Za-z0-9_\-]+$/.test(device_id)||
    !Object.prototype.hasOwnProperty.call(ENDPOINTS,region))
  throw new CloudAccessError('INVALID_FIELDS');
 return {client_id,client_secret,device_id,region};
}
export function createTuyaHeaders(
 credentials:CloudRequest,path:string,accessToken:string='',now:number=Date.now(),nonce:string=randomBytes(16).toString('hex')
):Record<string,string>{
 if(!/^\/v1\.[0-9]+\/[A-Za-z0-9_\-/?=&%.]+$/.test(path))
  throw new CloudAccessError('INVALID_PATH');
 const t=String(now);
 const bodyHash=createHash('sha256').update('').digest('hex');
 const stringToSign='GET\n'+bodyHash+'\n\n'+path;
 const signInput=credentials.client_id+accessToken+t+nonce+stringToSign;
 const sign=createHmac('sha256',credentials.client_secret).update(signInput).digest('hex').toUpperCase();
 return {'client_id':credentials.client_id,'sign':sign,'sign_method':'HMAC-SHA256','t':t,'nonce':nonce,
  ...(accessToken?{'access_token':accessToken}:{})};
}
function checkedField(input:any,name:string){
 if(!input||input.success!==true||!input.result||typeof input.result!=='object')
  throw new CloudAccessError('TUYA_CLOUD_REJECTED');
 const result=input.result[name];
 if(typeof result!=='string'||!result)throw new CloudAccessError('TUYA_BAD_RESPONSE');
 return result;
}
async function getJson(credentials:CloudRequest,path:string,token:string,send:Fetcher,host:string){
 const headers=createTuyaHeaders(credentials,path,token);
 try{
  const response=await send(host+path,{method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(7500)});
  if(!response.ok)throw new CloudAccessError('TUYA_CLOUD_HTTP_ERROR');
  const raw=await response.text();
  if(raw.length>65536)throw new CloudAccessError('TUYA_BAD_RESPONSE');
  const body=JSON.parse(raw);
  if(!body||body.success!==true)throw new CloudAccessError('TUYA_CLOUD_REJECTED');
  return body.result;
 }catch(e){
  if(e instanceof CloudAccessError)throw e;
  throw new CloudAccessError('TUYA_NETWORK_ERROR');
 }
}
export async function verifyExistingTuyaDevice(obj:any,send:Fetcher=fetch):Promise<CloudResult>{
 const cfg=parseCloudRequest(obj);
 const host=ENDPOINTS[cfg.region]; // fixed allowlist prevents SSRF
 const tokenResult=await getJson(cfg,'/v1.0/token?grant_type=1','',send,host);
 const accessToken=tokenResult?.access_token;
 if(typeof accessToken!=='string'||!accessToken)throw new CloudAccessError('TUYA_BAD_RESPONSE');
 const id=encodeURIComponent(cfg.device_id);
 const detail=await getJson(cfg,'/v1.0/devices/'+id,accessToken,send,host);
 if(!detail||detail.id!==cfg.device_id)throw new CloudAccessError('DEVICE_NOT_AUTHORIZED');
 const state=await getJson(cfg,'/v1.0/iot-03/devices/'+id+'/status',accessToken,send,host);
 if(!Array.isArray(state))throw new CloudAccessError('TUYA_BAD_RESPONSE');
 const status_codes=state.filter(x=>x&&typeof x.code==='string').map(x=>x.code.slice(0,50)).slice(0,60);
 const device_ref=createHash('sha256').update(cfg.device_id).digest('hex').slice(0,12);
 return {cloud_authorized:true,device_ref,device_name:typeof detail.name==='string'?detail.name.slice(0,50):'',
  online:typeof detail.online==='boolean'?detail.online:null,
  status_codes,cloud_checked_at:new Date().toISOString(),
  registration_method:'existing_tuya_cloud_device',hardware_commands_enabled:false};
}
