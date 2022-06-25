#include <SoftwareSerial.h>
#include <ESP8266WiFi.h>
#include <WiFiClient.h>
#include <ESP8266WebServer.h>
#include <BlynkSimpleEsp8266.h>

// Template ID, Device Name and Auth Token are provided by the Blynk.Cloud
// See the Device Info tab, or Template settings
#define BLYNK_TEMPLATE_ID           "TMPL4BOPbgAk"
#define BLYNK_DEVICE_NAME           "Quickstart Device"
#define BLYNK_AUTH_TOKEN            "xxxxx Use your own xxxxx"

// Comment this out to disable prints and save space
#define BLYNK_PRINT Serial

SoftwareSerial Serial4(D5, D6); // RX, TX

ESP8266WebServer server(80);
String QPIGS = "\x51\x50\x49\x47\x53\xB7\xA9\x0D";

char auth[] = BLYNK_AUTH_TOKEN;

// Your WiFi credentials.
// Set password to "" for open networks.
char ssid[] = "xxx use your own xxxx";
char pass[] = "xxx use your own xxxx";

BlynkTimer timer;

String stringOne;
String GV; //Grid Voltage*
String GF; //Grid Frequency*
String OV; //Output Voltage*
String OF; //Output Frequency*
String OVA;//Output VA
String OP; //Output Power*
float OPFloat; //Output Power*
String OU; //Output Usage*
String BV; //Battery Voltage*
String CC; //Charging Current*
String BC; //Battery Capacity*
String IT; //Inverter Temp*
String ITD; //Inverter Temp*
String PA; //Pannel Input A*
String PV; //Pannel Voltage*
String BD; //Battery Discharge*

String PP; //PV Power*
float PPF; //PV Power* (float)
float corrected_power_1; //Corrected PV Power* (float)
float corrected_power_2; //Corrected PV Power* (float)
String CPP; //Calculated PV Power*
int TPP;
float VXAC;
int TUG;
int TIM;
int TUW;
//Widget values for blinking
void blinkLedWidget()
{
 Blynk.virtualWrite(V0, GV+"V"+" / "+GF+"Hz");
 Blynk.virtualWrite(V1, OV+"V"+" / "+OF+"Hz");
 Blynk.virtualWrite(V2, OP+"W"+" / "+OU+"%");
 Blynk.virtualWrite(V3, BV+"V");
 Blynk.virtualWrite(V4, PV+"V"+" / "+PA+"A"+" / "+TPP+"W");
 Blynk.virtualWrite(V5, CC+"A"+" / "+BD+"A");
 Blynk.virtualWrite(V6, BC+"%");
 Blynk.virtualWrite(V7, IT+"."+ITD+"°C");
 Blynk.virtualWrite(V8, BC);
 Blynk.virtualWrite(V9, PV+"V"); // PV Volts
 Blynk.virtualWrite(V10, PP); // PV Power
 Blynk.virtualWrite(V11, TPP); // Calculated PV power (float)
 Blynk.virtualWrite(V12, PV+"V"+" / "+TPP+"W"); // PV Volts and Calculated PV power (int)
 Blynk.virtualWrite(V13, PPF); // Panel power (float)
 Blynk.virtualWrite(V14, corrected_power_1); // corrected power float (PPF*1000/1120)
 Blynk.virtualWrite(V15, PV+"V"+" / "+PA+"A"+" / "+corrected_power_1+"W");
 Blynk.virtualWrite(V16, corrected_power_2); // corrected power float (PPF*1000/1095)
 Blynk.virtualWrite(V17, OPFloat); // output power float
 
}

void setup() {
TUW=0;
TUG=0;
TIM=0;
Serial.begin(115200);
Blynk.begin(auth, ssid, pass);
// You can also specify server:
//Blynk.begin(auth, ssid, pass, "blynk.cloud", 80);
//Blynk.begin(auth, ssid, pass, IPAddress(192,168,1,100), 8080);
Serial4.begin(2400);
Serial4.setTimeout(10);
timer.setInterval(500L, blinkLedWidget);
}

void loop() {
establishContact();
stringOne = Serial4.readString();
Serial.println (stringOne);
GV=stringOne.substring(1,6);
GF=stringOne.substring(7,11);
OV=stringOne.substring(12,17);
OF=stringOne.substring(18,22);
OVA=stringOne.substring(23,27);
OP=stringOne.substring(28,32);
OU=stringOne.substring(33,36);
BV=stringOne.substring(41,46);
CC=stringOne.substring(47,50);
BC=stringOne.substring(51,54);
IT=stringOne.substring(56,58);
ITD=stringOne.substring(58,59);
PA=stringOne.substring(61,64);
PV=stringOne.substring(66,70);
BD=stringOne.substring(79,82);

PP=stringOne.substring(97,103);
TPP=BV.toInt()*PA.toInt();
PPF=PP.toFloat();
OPFloat = OP.toFloat();
corrected_power_1 = PPF*1000/1120;
corrected_power_2 = PPF*1000/1095;
//CPP = BV.toFloat()*PA.toFloat();
/*
if(OP.toInt()>0){
  TUG=TUG+OP.toInt();
}
TIM=TIM+1; 
if(TIM>=60){
  TUW=TUW+TUG;
  TUG=0;
  TIM=0;
}
delay(900);*/
stringOne = "";

Blynk.run();
timer.run();
}

void establishContact() {
while (Serial4.available() <= 0) {

Serial4.print(QPIGS); // send an initial string RESQUEST

delay(100);

}

}
