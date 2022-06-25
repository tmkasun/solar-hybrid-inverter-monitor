import serial
import time
ser = serial.Serial(port='/dev/hidraw0',
                    baudrate=2400,
                    timeout=10)
print("connected to: " + ser.portstr)
#ser.flushInput()
#ser.flushOutput()
START = '51 50 49 47 53 B7 A9 0D'
S2 = [0x51, 0x50, 0x49, 0x47, 0x53, 0xB7, 0xA9, 0x0D]
#ser.bytesize = serial.EIGHTBITS  #number of bits per bytes
#ser.parity = serial.PARITY_NONE  #set parity check: no parity
#ser.stopbits = serial.STOPBITS_ONE #number of stop bits

print(ser.isOpen())
print(ser.in_waiting)

ser.write(bytes.fromhex(START))

while ser.in_waiting:
    print("waiting")
    ser.write(bytes.fromhex(START))
    time.sleep(1)
print("Before timeout")
time.sleep(1)                    # delay of 1ms
print("reading")
val = ser.readline()                # read complete line from serial output
print(val.decode())
print(val)
ser.close()