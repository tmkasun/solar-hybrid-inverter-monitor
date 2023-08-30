from .utils import sendCommand
import usb.core
import usb.util
import usb.control

from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi

uri = "mongodb+srv://username:password@solar2.qvpmbtn.mongodb.net/?retryWrites=true&w=majority"
# Create a new client and connect to the server
client = MongoClient(uri, server_api=ServerApi("1"))

db = client.solar2
dataCollection = db["data"]

vendorId = 0x0665
productId = 0x5161
interface = 0
dev = usb.core.find(idVendor=vendorId, idProduct=productId)
if dev.is_kernel_driver_active(interface):
    dev.detach_kernel_driver(interface)
dev.set_interface_altsetting(0, 0)


class Inverter(object):
    QPIGS_RAW = None
    QMOD_RAW = None

    @staticmethod
    def uploadData():
        try:
            dataCollection.insert_one({"QPIGS": Inverter.QPIGS_RAW})
        except:
            print("Error inserting data!")

    @staticmethod
    def getAll():
        Inverter.QPIGS_RAW = sendCommand(dev, "QPIGS")
        Inverter.QMOD_RAW = sendCommand(dev, "QMOD")

    """
     Device Warning Status inquiry
    """

    @staticmethod
    def getQPIWS():
        return sendCommand(dev, "QPIWS")

    @staticmethod
    def getQMOD():
        Inverter.QMOD_RAW = sendCommand(dev, "QMOD")

    @staticmethod
    def setChargingMode(mode):
        # sendCommand(getCommand('PCP01')) # Solar first => SF
        # sendCommand(getCommand('PCP02')) # Solar & Utility => SU
        # sendCommand(getCommand('PCP03')) # Solar only => SO
        if mode.lower() == "sf":
            return sendCommand(dev, "PCP01")
        elif mode.lower() == "su":
            return sendCommand(dev, "PCP02")
        elif mode.lower() == "so":
            return sendCommand(dev, "PCP03")
        else:
            return {"error": "Invalid charging mode"}

    @staticmethod
    def setOutputMode(mode):
        # sendCommand(getCommand('POP01')) # Solar first => SF
        # sendCommand(getCommand('POP02')) # SBU => SBU
        # sendCommand(getCommand('POP00')) # Utility first => UF

        if mode.lower() == "sf":
            return sendCommand(dev, "POP01")
        elif mode.lower() == "sbu":
            return sendCommand(dev, "POP02")
        elif mode.lower() == "uf":
            return sendCommand(dev, "POP00")
        else:
            return {"error": "Invalid output mode"}
