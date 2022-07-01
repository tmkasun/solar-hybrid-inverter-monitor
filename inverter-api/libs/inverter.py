from .utils import sendCommand
import usb.core
import usb.util
import usb.control


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
    def getAll():
        Inverter.QPIGS_RAW = sendCommand(dev, 'QPIGS')
        Inverter.QMOD_RAW = sendCommand(dev, 'QMOD')
    
    @staticmethod
    def getQMOD():
        Inverter.QMOD_RAW = sendCommand(dev, 'QMOD')
    