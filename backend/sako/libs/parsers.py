def parseQMOD(responseString):
    if responseString[1].lower() == 'b':
        return {'mode': 'battery'}
    if responseString[1].lower() == 'u':
        return {'mode': 'utility'}
    if responseString[1].lower() == 'l':
        return {'mode': 'live'}
    else:
        return {'mode': '{}'.format(responseString)}

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
    data = {}
    for parameter in inverterParameters:
        if currentIndex == 0:
            parameter = parameter[1:]
        print("{} : {} => {}".format(currentIndex + 1 , parameterMappings[currentIndex], parameter))
        data[parameterMappings[currentIndex]] = parameter
        currentIndex +=1
    return data

