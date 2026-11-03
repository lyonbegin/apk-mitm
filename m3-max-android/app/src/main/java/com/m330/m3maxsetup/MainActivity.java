package com.m330.m3maxsetup;

import android.Manifest;
import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.net.wifi.WifiManager;
import android.net.wifi.WifiInfo;
import android.net.wifi.ScanResult;
import android.provider.Settings;
import android.view.View;
import android.widget.*;
import android.text.InputType;
import java.security.SecureRandom;
import java.util.List;

/**
 * Native Android Wi-Fi-only M3 Max onboarding companion.
 * Performs Tuya EZ registration if the device accepts the user's Tuya project.
 * Never includes Lefant APK SDK, no BLE. Post-pair operations live on Railway.
 */
public final class MainActivity extends Activity {
    static final String WEB="https://m330-web-github-production.up.railway.app";
    private LinearLayout root;
    private TextView state;
    private EditText ssid,password,clientId,clientSecret,schema,pairKey,country;
    private Spinner region;
    private Button startButton;
    private volatile boolean busy=false;

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        ScrollView scroll=new ScrollView(this);
        root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18),dp(18),dp(18),dp(24));
        scroll.addView(root);setContentView(scroll);
        heading("M3 Max Wi-Fi 등록");
        note("Lefant 앱·Bluetooth 없이 기기를 최초 등록하고, 이후 기존 Railway 웹 관리화면으로 돌아갑니다.");
        heading("1. Android Wi-Fi 확인");
        note("휴대전화와 M3 Max를 동일한 2.4GHz 공유기에 연결하는 Wi-Fi EZ 방식입니다. M3 Max가 EZ를 지원해야 실제 등록됩니다.");
        addButton("현재 Wi-Fi 확인",v->showWifi());
        addButton("Android Wi-Fi 설정 열기",v->startActivity(new Intent(Settings.ACTION_WIFI_SETTINGS)));
        addButton("주변 로봇 Wi-Fi AP 검색 (진단)",v->scanAccessPoints());
        heading("2. 공유기 및 Tuya 인증");
        ssid=field("공유기 Wi-Fi 이름 (SSID)",false,"");
        password=field("공유기 Wi-Fi 비밀번호",true,"");
        clientId=field("Tuya 개발자 Client ID",false,"");
        clientSecret=field("Tuya 개발자 Client Secret",true,"");
        schema=field("Tuya 앱 Schema / Channel ID",false,"");
        country=field("국가번호",false,"82");
        note("해당 M3 Max 제조사 제품을 등록할 권한이 있는 Tuya 개발자 프로젝트가 필요합니다. 자격증명은 휴대전화 내부에서만 일시 사용됩니다.");
        region=new Spinner(this);
        String[] regions={"us","eu","cn","in"};
        ArrayAdapter<String> adapter=new ArrayAdapter<>(this,android.R.layout.simple_spinner_item,regions);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        region.setAdapter(adapter);root.addView(region);
        heading("3. Railway 웹 연결");
        pairKey=field("관리 웹에서 발급한 M3 Max 연결키 (64자리)",true,"");
        addButton("웹에서 M3 Max 선택·연결키 발급",v->openWeb());
        heading("4. 실제 기기 등록");
        note("로봇을 Wi-Fi EZ 등록모드로 전환한 다음 아래 버튼을 누르십시오. Tuya 클라우드에서 등록 토큰을 받아 Wi-Fi EZ 신호를 전송합니다. 성공은 클라우드의 기기 반환으로 확인합니다.");
        startButton=addButton("실제 Wi-Fi EZ 등록 시작",v->pair());
        state=new TextView(this);state.setText("등록 대기 · 기기 미연결");
        state.setTextSize(15f);state.setTextIsSelectable(true);
        state.setPadding(dp(10),dp(14),dp(10),dp(14));root.addView(state);
        note("M3 Max가 Wi-Fi AP 전용이거나 Lefant 제조사 인증을 요구한다면 이 방식으로는 등록되지 않습니다. 실제 제어 API도 별도로 검증해야 합니다.");
        showWifi();
    }
    int dp(int px){return Math.round(px*getResources().getDisplayMetrics().density);}
    void heading(String t){
        TextView v=new TextView(this);v.setText(t);v.setTextSize(20);v.setTypeface(null,1);
        v.setPadding(0,dp(16),0,dp(6));root.addView(v);
    }
    void note(String t){
        TextView v=new TextView(this);v.setText(t);v.setTextSize(14);
        v.setPadding(0,dp(4),0,dp(8));root.addView(v);
    }
    EditText field(String label,boolean secret,String value){
        TextView title=new TextView(this);title.setText(label);title.setPadding(0,dp(10),0,dp(2));root.addView(title);
        EditText e=new EditText(this);e.setSingleLine(true);
        e.setText(value);
        e.setInputType(secret?
           (InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD):
           InputType.TYPE_CLASS_TEXT);
        root.addView(e,new LinearLayout.LayoutParams(-1,dp(48)));
        return e;
    }
    Button addButton(String text,View.OnClickListener fn){
        Button b=new Button(this);b.setAllCaps(false);b.setText(text);b.setOnClickListener(fn);
        root.addView(b,new LinearLayout.LayoutParams(-1,dp(52)));return b;
    }
    void status(String message){
        runOnUiThread(()->{if(state!=null)state.setText(message);});
    }
    void openWeb(){
        startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(WEB+"/")));
    }
    void showWifi(){
        try{
            WifiManager wifi=(WifiManager)getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            WifiInfo info=wifi.getConnectionInfo();
            int freq=info.getFrequency();
            String name=info.getSSID();
            String mode=freq>0&&freq<2500?"2.4GHz":freq>4800?"5/6GHz":"주파수 확인 불가";
            status("현재 연결 Wi-Fi: "+mode+" ("+name+")\n"+
                 (freq>4800?"2.4GHz 공유기로 전환하셔야 등록 성공률을 높일 수 있습니다.":"등록 전 Wi-Fi 상태 확인"));
            if(ssid!=null&&ssid.getText().length()==0&&!name.equals("<unknown ssid>"))
                ssid.setText(name.replace("\"",""));
        }catch(Exception e){status("Wi-Fi 정보 조회 불가. Android 위치 권한과 Wi-Fi 설정을 확인하십시오.");}
    }
    void scanAccessPoints(){
        if(Build.VERSION.SDK_INT>=23&&checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED){
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION},2);
            status("위치 권한 허용 후 다시 검색하십시오. Android의 Wi-Fi 주변 목록 접근에 필요한 권한입니다.");
            return;
        }
        try{
            WifiManager wifi=(WifiManager)getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            wifi.startScan();List<ScanResult> scans=wifi.getScanResults();
            StringBuilder b=new StringBuilder("현재 감지된 Wi-Fi 후보\n");
            int count=0;
            for(ScanResult item:scans){
                if(item.SSID!=null&&item.SSID.toLowerCase(java.util.Locale.ROOT)
                    .matches(".*(lefant|tuya|smartlife|robot|m3.max).*")){
                    b.append("• ").append(item.SSID).append("\n");count++;
                }
            }
            b.append("후보 ").append(count).append("건. AP 발견은 등록 성공이 아닙니다.");
            status(b.toString());
        }catch(Exception e){status("Wi-Fi 목록 접근 실패: Android 권한/설정을 확인하십시오.");}
    }
    void pair(){
        if(busy)return;
        final String wifiName=ssid.getText().toString().trim();
        final String wifiPassword=password.getText().toString();
        final String cid=clientId.getText().toString().trim();
        final String cs=clientSecret.getText().toString();
        final String sch=schema.getText().toString().trim();
        final String key=pairKey.getText().toString().trim();
        final String ccode=country.getText().toString().trim();
        final String reg=region.getSelectedItem().toString();
        if(wifiName.length()==0||wifiName.getBytes(java.nio.charset.StandardCharsets.UTF_8).length>32||
           wifiPassword.length()==0||cid.length()<8||cs.length()<8||
           sch.length()==0||!key.matches("[a-f0-9]{64}")||!ccode.matches("[0-9]{1,3}")){
            status("SSID·비밀번호·Tuya 개발자 정보 및 웹 연결키를 입력해 주십시오.");
            return;
        }
        // This is a user-initiated write to the robot's current Wi-Fi, not a read-only diagnostic.
        new android.app.AlertDialog.Builder(this)
         .setTitle("실제 기기 등록 요청")
         .setMessage("Tuya Cloud와 Wi-Fi EZ UDP로 실제 등록을 시도합니다. M3 Max가 지원하지 않으면 실패하며, 로봇 제어는 별도입니다. 실행하시겠습니까?")
         .setNegativeButton("취소",null)
         .setPositiveButton("실제 등록 시작",(dialog,which)->{
             busy=true;startButton.setEnabled(false);
             password.setText("");clientSecret.setText("");pairKey.setText("");
             new Thread(()->runPair(wifiName,wifiPassword,cid,cs,sch,reg,key,ccode),"m3-ez-pair").start();
         }).show();
    }
    void runPair(String wifiName,String wifiPassword,String cid,String cs,String sch,String reg,String key,String ccode){
        Thread sender=null;
        try{
            TuyaCloud cloud=new TuyaCloud(reg,cid,cs,sch,this::status);
            TuyaCloud.Token token=cloud.prepareEz(ccode);
            status("Tuya 토큰 확보 · Wi-Fi EZ 신호 전송 및 등록 결과 대기");
            sender=new Thread(()->{
                try{EzSmartLink.sendUntilStopped(wifiName,wifiPassword,token);}
                catch(InterruptedException ignored){Thread.currentThread().interrupt();}
                catch(Exception e){status("EZ UDP 송신 오류 (Wi-Fi 전환·방송 제한 가능).");}
            },"m3-udp-smartlink");
            sender.setDaemon(true);sender.start();
            String deviceId=cloud.awaitDevice(token,System.currentTimeMillis()+100_000);
            status("Tuya 클라우드 등록 확인 · 웹 관리 페이지에 전송 중");
            boolean pushed=TuyaCloud.reportToWeb(key,deviceId,WEB);
            status(pushed?
                "Tuya 클라우드에 기기가 등록되었고 웹 관리 페이지에 결과가 전달되었습니다.\n실제 이동·청소 명령은 아직 미검증입니다.":
                "Tuya 클라우드 등록 확인. 웹으로 결과 전송 실패: 연결키 또는 네트워크 확인 필요.");
        }catch(Exception e){
            // Suppress raw exceptions: cloud SDK or server response may include secrets.
            status("기기 등록 실패 또는 미확인.\nTuya 제품 권한·EZ 지원·공유기 Wi-Fi·데이터센터를 확인하십시오.\n분류: "+e.getClass().getSimpleName());
        }finally{
            if(sender!=null)sender.interrupt();
            busy=false;runOnUiThread(()->startButton.setEnabled(true));
        }
    }
}
