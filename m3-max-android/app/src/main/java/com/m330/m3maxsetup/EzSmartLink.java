package com.m330.m3maxsetup;

import java.io.ByteArrayOutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;

/**
 * Tuya-compatible legacy SmartLink UDP-length encoding (EZ mode).
 * Based on the MIT-licensed open-source @tuyapi/link manual SmartLink transport.
 * NO device credential is sent to Railway. Actual M3 Max compatibility is unverified.
 */
final class EzSmartLink {
    static int crcOne(int value) {
        int crc=0;
        for(int i=0;i<8;i++){
            if(((crc ^ value)&1)!=0){crc^=0x18;crc=(crc>>1)|0x80;}
            else crc>>=1;
            value>>=1;
        }
        return crc & 255;
    }
    static int crc8(int... bytes){
        int crc=0;
        for(int b:bytes)crc=crcOne(crc ^ (b&255));
        return crc;
    }
    static int[] encode(String ssid,String password,TuyaCloud.Token token) {
        if(!token.region.matches("AZ|CN|EU")||token.token.length()!=8||token.secret.length()!=4)
            throw new IllegalArgumentException("Tuya SmartLink EZ 토큰/지역 형식 불일치");
        byte[] pass=password.getBytes(StandardCharsets.UTF_8);
        byte[] name=ssid.getBytes(StandardCharsets.UTF_8);
        byte[] keys=(token.region+token.token+token.secret).getBytes(StandardCharsets.UTF_8);
        if(pass.length>64||name.length>32) throw new IllegalArgumentException("Wi-Fi SSID/비밀번호 길이 초과");
        ByteArrayOutputStream out=new ByteArrayOutputStream();
        out.write(pass.length);out.write(pass,0,pass.length);
        out.write(keys.length);out.write(keys,0,keys.length);
        out.write(name,0,name.length);
        byte[] raw=out.toByteArray();
        int length=raw.length;
        ArrayList<Integer> sizes=new ArrayList<>();
        int lengthCrc=crc8(length&255);
        sizes.add((length/16)|16);sizes.add((length%16)|32);
        sizes.add((lengthCrc/16)|48);sizes.add((lengthCrc%16)|64);
        int sequence=0;
        for(int i=0;i<length;i+=4){
            int p0=(i<length)?raw[i]&255:0;
            int p1=(i+1<length)?raw[i+1]&255:0;
            int p2=(i+2<length)?raw[i+2]&255:0;
            int p3=(i+3<length)?raw[i+3]&255:0;
            int crc=crc8(sequence,p0,p1,p2,p3);
            sizes.add((crc%128)|128);
            sizes.add((sequence%128)|128);
            sizes.add(p0|256);sizes.add(p1|256);sizes.add(p2|256);sizes.add(p3|256);
            sequence++;
        }
        int[] arr=new int[sizes.size()];
        for(int i=0;i<arr.length;i++)arr[i]=sizes.get(i);
        return arr;
    }
    static void emit(DatagramSocket socket,InetAddress broadcast,int length) throws Exception {
        byte[] payload=new byte[length];
        socket.send(new DatagramPacket(payload,payload.length,broadcast,30011));
    }
    static void sendUntilStopped(String ssid,String password,TuyaCloud.Token token) throws Exception {
        int[] encoded=encode(ssid,password,token);
        InetAddress address=InetAddress.getByName("255.255.255.255");
        try(DatagramSocket socket=new DatagramSocket()){
            socket.setBroadcast(true);
            while(!Thread.currentThread().isInterrupted()){
                for(int cycle=0;cycle<32&&!Thread.currentThread().isInterrupted();cycle++){
                    for(int j=0;j<2;j++){
                        for(int n:new int[]{1,3,6,10}){
                            emit(socket,address,n);Thread.sleep(2);
                        }
                    }
                    Thread.sleep(40);
                }
                for(int loop=0;loop<10&&!Thread.currentThread().isInterrupted();loop++){
                    Thread.sleep(160);
                    for(int n:encoded){
                        if(Thread.currentThread().isInterrupted())return;
                        emit(socket,address,n);
                        Thread.sleep(2);
                    }
                }
            }
        }
    }
    private EzSmartLink(){}
}
