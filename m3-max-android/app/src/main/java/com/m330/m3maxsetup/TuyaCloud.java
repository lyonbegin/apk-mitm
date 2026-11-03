package com.m330.m3maxsetup;

import org.json.JSONObject;
import org.json.JSONArray;
import java.net.URL;
import java.net.HttpURLConnection;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** User-authorized Tuya OpenAPI operations for EZ Wi-Fi pairing; no credentials persist. */
final class TuyaCloud {
    interface Progress { void update(String text); }
    static final String BASE_US="https://openapi.tuyaus.com";
    static final String BASE_CN="https://openapi.tuyacn.com";
    static final String BASE_EU="https://openapi.tuyaeu.com";
    static final String BASE_IN="https://openapi.tuyain.com";
    final String base, id, secret, schema;
    final Progress progress;
    String accessToken;
    TuyaCloud(String region, String clientId, String clientSecret, String schema, Progress p) {
        if (!region.equals("us")&&!region.equals("cn")&&!region.equals("eu")&&!region.equals("in"))
            throw new IllegalArgumentException("허용되지 않는 클라우드 지역");
        if (!schema.matches("[A-Za-z0-9._-]{2,128}")) throw new IllegalArgumentException("Schema 형식 오류");
        base=region.equals("us")?BASE_US:region.equals("cn")?BASE_CN:region.equals("eu")?BASE_EU:BASE_IN;
        this.id=clientId;this.secret=clientSecret;this.schema=schema;this.progress=p;
    }
    static byte[] utf(String s) { return s.getBytes(StandardCharsets.UTF_8); }
    static String hex(byte[] data) {
        StringBuilder sb=new StringBuilder();
        for(byte b:data)sb.append(String.format(java.util.Locale.ROOT,"%02x",b&255));
        return sb.toString();
    }
    static String sha(byte[] d) throws Exception {
        return hex(MessageDigest.getInstance("SHA-256").digest(d));
    }
    static String fingerprint(String text) throws Exception {
        return sha(utf(text)).substring(0,12);
    }
    private String signature(String method,String path,byte[] body,String t,String nonce) throws Exception {
        String signText=method+"\n"+sha(body)+"\n\n"+path;
        String value=id+(accessToken==null?"":accessToken)+t+nonce+signText;
        Mac mac=Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(utf(secret),"HmacSHA256"));
        return hex(mac.doFinal(utf(value))).toUpperCase(java.util.Locale.ROOT);
    }
    private JSONObject request(String method,String path,JSONObject data) throws Exception {
        byte[] body=data==null?new byte[0]:utf(data.toString());
        String t=String.valueOf(System.currentTimeMillis());
        byte[] nonceBytes=new byte[16];new SecureRandom().nextBytes(nonceBytes);
        String nonce=hex(nonceBytes);
        HttpURLConnection conn=(HttpURLConnection)new URL(base+path).openConnection();
        conn.setRequestMethod(method);conn.setConnectTimeout(7500);conn.setReadTimeout(7500);
        conn.setRequestProperty("client_id",id);
        conn.setRequestProperty("sign_method","HMAC-SHA256");
        conn.setRequestProperty("sign",signature(method,path,body,t,nonce));
        conn.setRequestProperty("t",t);conn.setRequestProperty("nonce",nonce);
        if(accessToken!=null)conn.setRequestProperty("access_token",accessToken);
        conn.setRequestProperty("Accept","application/json");
        conn.setInstanceFollowRedirects(false);
        if(data!=null) {
            conn.setDoOutput(true);conn.setRequestProperty("Content-Type","application/json");
            try(OutputStream out=conn.getOutputStream()){out.write(body);}
        }
        try {
            int status=conn.getResponseCode();
            if(status!=200) throw new IllegalStateException("Tuya HTTP "+status+" (클라우드 인증·권한 확인)");
            try(InputStream in=conn.getInputStream()) {
                ByteArrayOutputStream out=new ByteArrayOutputStream();
                byte[] buf=new byte[4096];int n;
                while((n=in.read(buf))!=-1){out.write(buf,0,n);if(out.size()>65536)throw new IllegalStateException("서버 응답 초과");}
                JSONObject json=new JSONObject(out.toString("UTF-8"));
                if(!json.optBoolean("success")) {
                    // Never echo raw vendor messages, potentially containing supplied secrets.
                    throw new IllegalStateException("Tuya 요청 거부 (code "+json.optString("code","unknown")+")");
                }
                return json;
            }
        } finally { conn.disconnect(); }
    }
    static final class Token {
        final String token,secret,region;
        Token(String t,String s,String r){token=t;secret=s;region=r;}
    }
    Token prepareEz(String countryCode) throws Exception {
        progress.update("Tuya 클라우드 접근 토큰 요청");
        JSONObject access=request("GET","/v1.0/token?grant_type=1",null).getJSONObject("result");
        accessToken=access.getString("access_token");
        String username="m3-"+Long.toHexString(new SecureRandom().nextLong())+"@example.com";
        String userPass=Long.toHexString(new SecureRandom().nextLong())+Long.toHexString(new SecureRandom().nextLong());
        JSONObject body=new JSONObject()
           .put("schema",schema).put("country_code",countryCode)
           .put("username",username).put("password",userPass)
           .put("username_type",2).put("nick_name","M3 Max 등록");
        progress.update("Tuya 앱 사용자 등록·권한 확인");
        String uid=request("POST","/v1.0/apps/"+schema+"/user",body).getJSONObject("result").getString("uid");
        JSONObject tokenBody=new JSONObject().put("uid",uid).put("timeZoneId","Asia/Seoul").put("paring_type","EZ");
        progress.update("Tuya Wi-Fi EZ 등록용 토큰 요청");
        JSONObject result=request("POST","/v1.0/device/paring/token",tokenBody).getJSONObject("result");
        return new Token(result.getString("token"),result.getString("secret"),result.getString("region"));
    }
    String awaitDevice(Token token,long deadlineMillis) throws Exception {
        String path="/v1.0/device/paring/tokens/"+token.token;
        while(System.currentTimeMillis()<deadlineMillis && !Thread.currentThread().isInterrupted()) {
            JSONObject result=request("GET",path,null).getJSONObject("result");
            JSONArray items=result.optJSONArray("success");
            if(items!=null&&items.length()>0) {
                JSONObject item=items.getJSONObject(0);
                String deviceId=item.optString("device_id",item.optString("id",""));
                if(!deviceId.matches("[A-Za-z0-9_-]{6,80}"))throw new IllegalStateException("클라우드 기기 ID 형식 오류");
                progress.update("기기 등록 응답 확인, 장치 상태 재검사");
                JSONObject detail=request("GET","/v1.0/devices/"+deviceId,null).getJSONObject("result");
                if(!deviceId.equals(detail.optString("id")))throw new IllegalStateException("기기 ID 불일치");
                return deviceId;
            }
            Thread.sleep(1800);
        }
        throw new IllegalStateException("기기 등록시간 초과 — EZ 지원 여부 또는 제조사 권한 확인 필요");
    }
    static boolean reportToWeb(String pairKey,String deviceId,String dashboard) throws Exception {
        if(!pairKey.matches("[a-f0-9]{64}"))throw new IllegalArgumentException("관리 웹 연결키를 입력해 주십시오.");
        URL url=new URL(dashboard+"/api/m3/activation/report");
        JSONObject body=new JSONObject().put("source","tuya_ez").put("cloud_confirmed",true)
                .put("device_ref",fingerprint(deviceId));
        HttpURLConnection c=(HttpURLConnection)url.openConnection();
        c.setRequestMethod("POST");c.setConnectTimeout(7000);c.setReadTimeout(7000);
        c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");
        c.setRequestProperty("X-M330-Pairing-Key",pairKey);
        try(OutputStream out=c.getOutputStream()){out.write(utf(body.toString()));}
        try{ return c.getResponseCode()==200;}finally{c.disconnect();}
    }
}
