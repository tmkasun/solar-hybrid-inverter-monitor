# Solar Inverter USB Driver + Monitoring Dashboard

> No need to cut cables or connect to adaptors, Just plug the USB cable and play with your inverter

This is an Solar inverter monitoring and controlling system for hybrid inverters, Following are the main components in the system.
- Solar Inverter driver program to communicate with USB serial port (Python)
- Python Flask based REST API to expose the data
- ReactJS based web portal (PWA) for monitoring and controlling the inverter
## Tested Solar inverters

Currently we have tested this on

- Sako Isun 3KW

## Supported compute devices

- Raspberry pi
- Orange pi
- Any Unix device

## Hardware setup

- Use the USB cable provided with the inverter or any appropriate USB cable
- Connect the USB cable to any of the supported device
- Install the pre-requisite mentioned in the following `install` steps
- Run the `tools/check-inverter.py` script to connection between inverter and the compute device 
- For any issues check the `Troubleshoot` section

## How it works

Most of the Hybrid(Chinees) inverters comes with the following Serial interface
```
Bus 001 Device 002: ID 0665:5161 Cypress Semiconductor USB to Serial
```
For this `VendorID` and `ProductID` there are several UPS and inverter devices using this serial com device. But this device had no drivers for Raspberry pi, So when the inverter is connected to a Raspberry pi(or similar) compute device , it detects as a USB block storage device
```
/dev/usb/hiddev0
```

not as a USB serial communication device.

i:e 

```
/dev/ttyS0 or /dev/USB0
```

To establish communication between the inverter and the compute device we had to use `pyUSB` approach described in [here](http://allican.be/blog/2017/01/28/reverse-engineering-cypress-serial-usb.html). For the basic working principles of Inverter - Compute device (Raspberry pi) communication check the [above](http://allican.be/blog/2017/01/28/reverse-engineering-cypress-serial-usb.html) article.

Another important piece of the puzzle was to find out the communication protocol.
[This document](https://www.fve-mp.cz/data/blob/product-application_pdf-20190724092401-8519-pip-gk-mk-protocol.pdf) from a random generous Czech inverter site.

Without this, Decoding the values sent from inverter was a challenge

and the meanings of 
- **QPIGS**<cr>: Device general status parameters inquiry

and 

- **QMOD**<cr>: Device Mode inquiry

were like greek!

Once the communication is established it's was just a matter of routing the data to client application (React app) to present the data.

We use `Flask` to implement REST API and ReactJS, MUI , React Query in the UIs.

## Install
Most of the Raspberry pi & Orange Pi variations doesn't come with `pip` pre-installed, Hence we have to run this 
- > sudo apt-get install python3-pip

Install the Python USB communication library
- > python3 -m pip install pyusb

This is required for the following [`crc16`](https://pypi.org/project/crc16/) library

- > sudo apt-get install python3-dev

CRC16 is used to generate the 2 byte CRC, CRC is a way of detecting accidental changes in data storage or transmission

| Note: This only works upto python 3.9 versions, If you have a latest version of Python 3.10+, This will not work

- > python3 -m pip install crc16 

Add a `Udev` rule as shown below, This is required to allow communicating with the USB device for none-sudoers users. Example file is given in 
```
references/99-knnect.rules
```
in this repo
- > sudo vim /etc/udev/rules.d/99-<any-name>.rules

Restart the Udev admin to apply the changes
- > sudo udevadm control --reload-rules && sudo udevadm trigger

## Accessing from anyway

Currently this only support monitoring through the local network, If you want to monitor or control the device through internet, Then you need to expose the APIs through [Choreo](https://console.choreo.dev/) (It's free) like API proxy service or  Buy a [Blynk](https://blynk.io/) subscription and publish data to blynk.
## Troubleshoot

- Use
```
sudo lsusb
```
to check whether the Serial Communication device has been detected by the operating system
if so it show show as
```
Bus 001 Device 002: ID 0665:5161 Cypress Semiconductor USB to Serial
```
in the output of `lsusb` command 

## Similar projects

- [jblance/mpp-solar](https://github.com/jblance/mpp-solar)
- [ned-kelly/docker-voltronic-homeassistant](https://github.com/ned-kelly/docker-voltronic-homeassistant)


## TODO

- Improve UI
- Currently you need to set battery discharge current rate (i:e 240Ah set to 240A)
- Max PV power and voltage values
  
## Protocol Docs
  - https://github.com/softwarecrash/Solar2MQTT/tree/master/Protocol
  - https://www.fve-mp.cz/data/blob/product-application_pdf-20190724092401-8519-pip-gk-mk-protocol.pdf

## Web UI

![image](https://user-images.githubusercontent.com/3313885/175807616-ec4f8009-abb0-4b6c-b4dd-acd381cafef1.png)

![image](https://user-images.githubusercontent.com/3313885/175807635-b5fb3409-b65b-48ea-9fd4-d46559e25883.png)

TODO:

- Need to implement a websocket API to communicate with the backend server
  - [Flask SocketIO](https://flask-socketio.readthedocs.io/en/latest/getting_started.html)
  - [Examples](https://blog.miguelgrinberg.com/post/add-a-websocket-route-to-your-flask-2-x-application)