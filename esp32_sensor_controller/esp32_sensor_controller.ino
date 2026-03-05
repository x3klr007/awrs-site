#include <Arduino.h>

// ==== PIN CONFIG ====
const int TDSPIN = 33;   
const int MQ7PIN = 32;   

// ==== ADC CONFIG ====
const float VREF   = 3.3;      
const float ADCMAX = 4095.0;   
const int SAMPLES  = 10;

unsigned long previousMillis = 0;
const long UPDATE_INTERVAL_MS = 1000;

int readAveragedADC(int pin) {
  long sum = 0;
  for (int i = 0; i < SAMPLES; i++) {
    sum += analogRead(pin);
    delay(5);
  }
  return sum / SAMPLES;
}

void setup() {
  Serial.begin(115200);
  
  // WAIT 3 SECONDS BEFORE DRAWING POWER
  // This prevents the USB from browning out when the browser connects!
  delay(3000); 

  analogReadResolution(12);          
  analogSetAttenuation(ADC_11db);    
  pinMode(TDSPIN, INPUT);
  pinMode(MQ7PIN, INPUT);

  Serial.println("--- AWRS System Ready ---");
}

void loop() {
  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis >= UPDATE_INTERVAL_MS) {
    previousMillis = currentMillis;

    int tdsRaw = readAveragedADC(TDSPIN);
    int mq7Raw = readAveragedADC(MQ7PIN);

    float tdsVolt = (tdsRaw * VREF) / ADCMAX;
    float ec = (133.42 * tdsVolt * tdsVolt * tdsVolt - 255.86 * tdsVolt * tdsVolt + 857.39 * tdsVolt);
    float tdsValue = ec * 0.5;
    if (tdsValue < 0) tdsValue = 0;

    String json = "{";
    json += "\"temp\":24.5,";
    json += "\"humidity\":65.0,";
    json += "\"pressure\":1013.0,";
    json += "\"tds\":" + String(tdsValue, 1) + ",";
    json += "\"ph\":7.2,";
    json += "\"h2s\":0.1,";
    json += "\"co\":" + String((float)mq7Raw, 1) + ",";
    json += "\"o2\":20.9";
    json += "}";
    
    Serial.println(json); 
  }
}
