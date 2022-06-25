#!/usr/bin/env python3
# encoding: utf-8

import json
from flask import Flask

import usb.core, usb.util, usb.control
import crc16
from libs.utils import sendCommand

vendorId = 0x0665
productId = 0x5161
interface = 0
dev = usb.core.find(idVendor=vendorId, idProduct=productId)
if dev.is_kernel_driver_active(interface):
    dev.detach_kernel_driver(interface)
dev.set_interface_altsetting(0,0)


app = Flask(__name__)

@app.route('/stats/live')
def index():
    responseString = sendCommand(dev, 'QPIGS')
    print(responseString)
    return json.dumps(responseString)

@app.route('/stats/mode')
def inverterMode():
    responseString = sendCommand(dev, 'QMOD')
    print(responseString)
    return json.dumps(responseString)

# app.run()