#!/usr/bin/env python3
# encoding: utf-8

import json
from flask import Flask

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

# app.run()
