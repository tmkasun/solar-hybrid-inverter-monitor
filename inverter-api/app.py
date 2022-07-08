#!/usr/bin/env python3
# encoding: utf-8

import json
from flask import Flask
from flask import request

from libs.set_interval import SetInterval
from libs.inverter import Inverter

# SetInterval(1, Inverter.getQPIG)
SetInterval(1, Inverter.getAll)

app = Flask(__name__)


@app.route('/stats/live')
def index():
    responseString = Inverter.QPIGS_RAW
    print(responseString)
    return json.dumps(responseString)


@app.route('/stats/mode')
def inverterMode():
    responseString = Inverter.QMOD_RAW
    print(responseString)
    return json.dumps(responseString)


@app.route('/stats/errors')
def inverterErrors():
    responseString = Inverter.getQPIWS()
    print(responseString)
    return json.dumps(responseString)


@app.route('/device/mode/charging', methods=['POST'])
def inverterSetCMode():
    payload = request.get_json()
    charge_mode = payload['mode']
    responseString= Inverter.setChargingMode(charge_mode)
    print(responseString)
    return json.dumps(responseString)

@app.route('/device/mode/output', methods=['POST'])
def inverterSetOutMode():
    payload = request.get_json()
    output_mode = payload['mode']
    responseString= Inverter.setOutputMode(output_mode)
    print(responseString)
    return json.dumps(responseString)

# app.run()
