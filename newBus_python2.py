import usb.core, usb.util, usb.control
import crc16
vendorId = 0x0665
productId = 0x5161
interface = 0
dev = usb.core.find(idVendor=vendorId, idProduct=productId)
if dev.is_kernel_driver_active(interface):
    dev.detach_kernel_driver(interface)
dev.set_interface_altsetting(0,0)



def to_bytes(n, length, endianess='big'):
    h = '%x' % n
    s = ('0'*(len(h) % 2) + h).zfill(length*2).decode('hex')
    return s if endianess == 'big' else s[::-1]

def getCommand(cmd):
    cmd = cmd.encode('utf-8')
    crc2 = crc16.crc16xmodem(cmd)
    crc = to_bytes(crc2,2)
    cmd = cmd+crc
    cmd = cmd+b'\r'
    while len(cmd)<8:
        cmd = cmd+b'\0'
    return cmd

def sendCommand(cmd):
    dev.ctrl_transfer(0x21, 0x9, 0x200, 0, cmd)

def getResult(timeout=600):
    res=""
    i=0
    try:
        res+="".join([chr(i) for i in dev.read(0x81, 500, timeout)])
    except usb.core.USBError as e:
        if e.errno == 110:
            pass
        else:
            print(e)
            raise
    return res

# sendCommand(getCommand('QPIWS'))
# sendCommand(getCommand('QPIRI'))
# sendCommand(getCommand('QPIGS'))
# sendCommand(getCommand('QDI'))
sendCommand(getCommand('QMOD'))

# String QPIGS = "\x51\x50\x49\x47\x53\xB7\xA9\x0D";
# String QPIWS = "\x51\x50\x49\x57\x53\xB4\xDA\x0D";  
# String QDI = "\x51\x44\x49\x71\x1B\x0D";
# String QMOD = "\x51\x4D\x4F\x44\x49\xC1\x0D"; 
# String QVFW =  "\x51\x56\x46\x57\x62\x99\x0D"; 
# String QVFW2 = "\x51\x56\x46\x57\x32\xC3\xF5\x0D"; 
responseString = getResult()
print(responseString)
print(len(responseString))
assert False
inverterParameters = responseString.split(' ')
print(len(inverterParameters))

parameterMappings = [
    'Grid Voltage',
    'Grid Frequency',
    'Output Voltage',
    'Output Frequency',
    'Output VA',
    'Output Power(W)',
    'Output Usage %',
    'Unknow',
    'Battery Voltage',
    'Battery Charging Current',
    'Unknow',
    'Unknow',
    'PV Charging current *',
    'PV Voltage',
    'Battery charging V **',
    'Battery discharge I **',
    'Unknow',
    'Unknow',
    'Unknow',
    'PV Power',
    'Unknow',
    'Unknow',
    ]
currentIndex = 0
for parameter in inverterParameters:
    if currentIndex == 0:
        parameter = parameter[1:]
    print("{} : {} => {}".format(currentIndex + 1 , parameterMappings[currentIndex], parameter))
    currentIndex +=1



"""
['(231.0', GV
'50.1', GF
'228.0', OV 
'50.2', OF
'0580', OVA
'0464', OPower
'018', OUsage
'364',
 '25.10', BV
'000', Charging Current*
'022', BCap
 '0444', '0000', '000.0', '26.22', '00022', '10010000', '00', '03', '00000', '000\xeeW\r\x00\x00']
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
"""
