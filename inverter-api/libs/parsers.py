def parseQMOD(responseString):
    if responseString[1].lower() == 'b':
        return {'mode': 'Battery'}
    if responseString[1].lower() == 'l':
        return {'mode': 'Line'}
    if responseString[1].lower() == 's':
        return {'mode': 'Standby'}
    if responseString[1].lower() == 'f':
        return {'mode': 'Fault'}
    if responseString[1].lower() == 'y':
        return {'mode': 'Bypass'}
    else:
        return {'mode': '{}'.format(responseString)}

"""
Device general status parameters inquiry
"""
def parseQPIGS(responseString):
    print(responseString)
    print(len(responseString))
    # assert False
    inverterParameters = responseString.split(' ')
    print(len(inverterParameters))

    parameterMappings = [
        'Grid Voltage',
        'Grid Frequency',
        'Output Voltage',
        'Output Frequency',
        'Output VA',
        'Output Power(W)',
        'Output load %',
        'BUS Voltage',
        'Battery Voltage',
        'Battery Charging Current',
        'Battery capacity',
        'Inverter heat sink temperature',
        'PV Input current for battery',
        'PV Voltage',
        'Battery V from SCC',
        'Battery discharge I',
        'Device status',
        'Fans voltage offset(mV)',
        'EEPROM version',
        'PV Power',
        'Device status',
        'Unknow',
        ]
    currentIndex = 0
    data = {}
    for parameter in inverterParameters:
        if currentIndex == 0:
            parameter = parameter[1:]
        print("{} : {} => {}".format(currentIndex + 1 , parameterMappings[currentIndex], parameter))
        data[parameterMappings[currentIndex]] = parameter
        currentIndex +=1
    return data

