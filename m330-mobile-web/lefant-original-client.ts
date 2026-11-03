/**
 * Read-only Lefant v3.3.25 app API adapter based on USER-SUPPLIED original XAPK.
 * SOURCE: Config$URL.<clinit>, LoginViewModel.commonLogin, ProductListViewModel.initData,
 * RestClientBuilder.getBaseParams (classes9/classes10.dex).
 *
 * NOT Tuya IoT OpenAPI. Requires the owner's ORIGINAL Lefant account (not developer keys).
 * Does NOT claim to replace Android ThingHomeSdk provisioning / publishDps.
 * No passwords or cloud user secrets are persisted. Session access_token kept in memory.
 */
import {createHash} from 'node:crypto';

export const ORIGINAL_LEFANT = Object.freeze({
  host: 'https://api.useerobot.com',
  login: '/v5/client/login-with-password',
  catalog: '/v1/device/category-model-tree',
  devices: '/v1/device/user-all-device-list-group-by-home',
} as const);
const ALLOWED = new Set<string>([ORIGINAL_LEFANT.login,ORIGINAL_LEFANT.catalog,ORIGINAL_LEFANT.devices]);

type Stored = { token:string;expiresAt:number;accountFingerprint:string };
const sessions = new Map<string,Stored>();
const attempts = new Map<string,{count:number,until:number}>();
type VendorResponse = Record<string,any>;
export class LefantOriginalError extends Error{
 constructor(public code:string){super(code)}
}
const isRecord=(v:any):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function cleanString(v:any,min:number,max:number):string{
 if(typeof v!=='string'||v.trim()!==v||v.length<min||v.length>max||/[\u0000-\u001f]/.test(v))
  throw new LefantOriginalError('INVALID_CREDENTIAL_FIELDS');
 return v;
}
function context(sid:string){
 if(!/^[0-9a-f-]{36}$/i.test(sid))throw new LefantOriginalError('SESSION_REQUIRED');
}
function throttle(sid:string){
 const now=Date.now();const x=attempts.get(sid)||{count:0,until:now+15*60*1000};
 if(now>x.until){x.count=0;x.until=now+15*60*1000;}
 if(x.count>=5)throw new LefantOriginalError('TOO_MANY_LOGIN_ATTEMPTS');
 x.count++;
 attempts.set(sid,x);
}
async function postOriginal(
 endpoint:string, fields:Record<string,string>, accessToken:string, doFetch:typeof fetch=fetch
):Promise<VendorResponse>{
 if(!ALLOWED.has(endpoint))throw new LefantOriginalError('UNAPPROVED_VENDOR_ENDPOINT');
 const url=new URL(ORIGINAL_LEFANT.host+endpoint);
 // These fields originate from the original APK's RestClientBuilder.getBaseParams.
 url.searchParams.set('language','ko-KR');
 url.searchParams.set('version_code','3.3.25');
 if(accessToken)url.searchParams.set('access_token',accessToken);
 // Original RestClient.post -> RestService.post with form-map params.
 // No request content or credential is logged on this service.
 const body=new URLSearchParams(fields);
 try{
  const response=await doFetch(url.toString(),{
    method:'POST',redirect:'error',
    headers:{'Content-Type':'application/x-www-form-urlencoded;charset=utf-8','Accept':'application/json'},
    body,signal:AbortSignal.timeout(9000),cache:'no-store'
  });
  if(!response.ok)throw new LefantOriginalError('LEFANT_HTTP_'+response.status);
  const raw=await response.text();
  if(raw.length>512_000)throw new LefantOriginalError('LEFANT_RESPONSE_TOO_LARGE');
  const parsed=JSON.parse(raw);
  if(!isRecord(parsed))throw new LefantOriginalError('LEFANT_BAD_RESPONSE');
  return parsed;
 }catch(err){
  if(err instanceof LefantOriginalError)throw err;
  throw new LefantOriginalError('LEFANT_NETWORK_OR_RESPONSE_ERROR');
 }
}
export function originalSessionState(sid:string){
 context(sid);
 const item=sessions.get(sid);
 if(!item||item.expiresAt<=Date.now()){
  sessions.delete(sid);
  return {signed_in:false,source:'lefant_original',verified_device:false,commands_enabled:false};
 }
 return {signed_in:true,source:'lefant_original',account_ref:item.accountFingerprint,
  expires_at:new Date(item.expiresAt).toISOString(),verified_device:false,commands_enabled:false};
}
export async function originalLogin(sid:string,form:any,doFetch:typeof fetch=fetch){
 context(sid);throttle(sid);
 if(!isRecord(form))throw new LefantOriginalError('INVALID_CREDENTIAL_FIELDS');
 const account=cleanString(form.account,3,150);
 const password=cleanString(form.password,1,200);
 // Credential transfer is approved explicitly by the owner via our login form.
 // Original LoginViewModel.commonLogin uses account/password on this v5 route.
 const payload=await postOriginal(ORIGINAL_LEFANT.login,{account,password},'',doFetch);
 const d=payload.data;
 const token=isRecord(d)&&typeof d.access_token==='string'?d.access_token:'';
 if(token.length<8||token.length>4096)throw new LefantOriginalError('LEFANT_LOGIN_NOT_CONFIRMED');
 const accountFingerprint=createHash('sha256').update(account).digest('hex').slice(0,12);
 sessions.set(sid,{token,expiresAt:Date.now()+60*60*1000,accountFingerprint});
 // This never returns the vendor access_token, third_password, third_reg_uuid, or Tuya secret.
 return {signed_in:true,source:'lefant_original',account_ref:accountFingerprint,
   expires_at:new Date(Date.now()+60*60*1000).toISOString(),commands_enabled:false};
}
export function originalLogout(sid:string){context(sid);sessions.delete(sid);return {signed_in:false};}
function sessionToken(sid:string){
 const session=sessions.get(sid);
 if(!session||session.expiresAt<=Date.now())throw new LefantOriginalError('LEFANT_LOGIN_REQUIRED');
 return session.token;
}
function scrubPrivate(data:any,depth=0):any{
 if(depth>8)return null;
 if(Array.isArray(data))return data.slice(0,400).map(x=>scrubPrivate(x,depth+1));
 if(isRecord(data)){
  const result:Record<string,any>={};
  for(const [k,v] of Object.entries(data).slice(0,200)){
   if(/password|secret|token|session|third_|auth|private|local_?key|access.?key|email|phone|account/i.test(k))continue;
   result[k]=scrubPrivate(v,depth+1);
  }
  return result;
 }
 if(typeof data==='string')return data.length>500?data.slice(0,500):data;
 return typeof data==='number'||typeof data==='boolean'||data===null?data:null;
}
export async function originalCatalog(sid:string,doFetch:typeof fetch=fetch){
 context(sid);
 const response=await postOriginal(ORIGINAL_LEFANT.catalog,{cmt_cache_md5:''},sessionToken(sid),doFetch);
 // No synthetic product list. Model-specific paired_type_list is returned unchanged
 // only when the original vendor endpoint actually provides it.
 return {source:'lefant_original',response:scrubPrivate(response),device_authenticated:false};
}
export async function originalDeviceList(sid:string,doFetch:typeof fetch=fetch){
 context(sid);
 const response=await postOriginal(ORIGINAL_LEFANT.devices,{},sessionToken(sid),doFetch);
 return {source:'lefant_original',response:scrubPrivate(response),commands_enabled:false};
}
