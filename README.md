# Sako Inverter Driver

## Steps
- 
```
sudo apt-get install python3-pip
```

- 
```
python3 -m pip install pyusb
```

- 
```
python3 -m pip install crc16
```
-  
```
sudo apt-get install python3-dev
```

- 
```
sudo udevadm control --reload-rules && sudo udevadm trigger
```

-
```
sudo vim /etc/udev/rules.d/99-knnect.rules
```