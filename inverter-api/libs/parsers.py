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
        'Device status 2',
        'Unknow',
    ]
    currentIndex = 0
    data = {}
    for parameter in inverterParameters:
        if currentIndex == 0:
            parameter = parameter[1:]
        print("{} : {} => {}".format(currentIndex + 1,
                                     parameterMappings[currentIndex], parameter))
        if currentIndex == 16:
            # 8 bit status flags
            deviceStatus = {
                'pvoac': {
                    "name": "PV or AC feed the load",
                    "value": parameter[0]
                },
                'confs': {
                    "name": "Configuration status",
                    "value": parameter[1]
                },
                'sccfwv': {
                    "name": "SCC firmware version",
                    "value": parameter[2]
                },
                'ls': {
                    "name": "Load status",
                    "value": parameter[3]
                },
                'res': {
                    "name": "reserved",
                    "value": parameter[4]
                },
                'conof': {
                    "name": "Charging on/off",
                    "value": parameter[5]
                },
                'sccconof': {
                    "name": "SCC charging on/off",
                    "value": parameter[6]
                },
                'acconof': {
                    "name": "AC charging on/off",
                    "value": parameter[7]
                }
            }
            parameter = deviceStatus
        elif currentIndex == 20:
            deviceStatus = {
                'fmode': {
                    'name': 'charging to floating mode',
                    "value": parameter[0]
                },
                'sw': {
                    'name': 'Switch On',
                    "value": parameter[1]
                },
                'dustp': {
                    'name': 'dustproof installed',
                    "value": parameter[2]
                }
            }
            parameter = deviceStatus
        data[parameterMappings[currentIndex]] = parameter
        currentIndex += 1
    return data
