ACK = "ACK"
NACK = "NAK"

def parseQPIWS(responseString):
    paddingRemoved = responseString[1:]
    if len(paddingRemoved) >= 28:
        return {
            "PV loss": paddingRemoved[0],
            "Inverter fault": paddingRemoved[1],
            "Bus Over": paddingRemoved[2],
            "Bus Under": paddingRemoved[3],
            "Bus Soft Fail": paddingRemoved[4],
            "LINE_FAIL": paddingRemoved[5],
            "OPVShort": paddingRemoved[6],
            "Inverter voltage too low": paddingRemoved[7],
            "Inverter voltage too high": paddingRemoved[8],
            "Over temperature": paddingRemoved[9],
            "Fan locked": paddingRemoved[10],
            "Battery voltage high": paddingRemoved[11],
            "Battery low alarm": paddingRemoved[12],
            "Reserved": paddingRemoved[13],
            "Battery under shutdown": paddingRemoved[14],
            "Battery derating": paddingRemoved[15],
            "Over load": paddingRemoved[16],
            "EEPROM Fault": paddingRemoved[17],
            "Inverter Over Current": paddingRemoved[18],
            "Inverter Soft Fail": paddingRemoved[19],
            "Self Test Fail": paddingRemoved[20],
            "OP DC Voltage Over": paddingRemoved[21],
            "Battery Open": paddingRemoved[22],
            "Current Sensor Fail": paddingRemoved[23],
            "Battery Short": paddingRemoved[24],
            "Power limit": paddingRemoved[25],
            "PV voltage high": paddingRemoved[26],
            "MPPT overload fault": paddingRemoved[28],
        }
    else:
        return {}

# Setting device output source priority


def parsePOP(responseString):
    return parsePCP(responseString)


"""
Setting device charge priority
"""


def parsePCP(responseString):
    # print(responseString)
    paddingRemoved = responseString[1:]
    if paddingRemoved.startswith(ACK):
        return {"accept": True}
    if paddingRemoved.startswith(NACK):
        return {"accept": False}
    return {"raw": '{}'.format(responseString)}


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
        return {'raw': '{}'.format(responseString)}


"""
Device general status parameters inquiry
"""


def parseQPIGS(responseString):
    # print(responseString)
    # print(len(responseString))
    # assert False
    inverterParameters = responseString.split(' ')
    # print(len(inverterParameters))

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
        # print("{} : {} => {}".format(currentIndex + 1,
        #                              parameterMappings[currentIndex], parameter))
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
