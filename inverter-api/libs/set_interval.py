import time
import threading

from multiprocessing import Lock

lock = Lock()


class SetInterval:
    """
    Interval in seconds
    """

    def __init__(self, interval, action):
        self.interval = interval
        self.action = action
        self.stopEvent = threading.Event()
        thread = threading.Thread(target=self.__setInterval)
        thread.start()

    def __setInterval(self):
        nextTime = time.time() + self.interval
        while not self.stopEvent.wait(nextTime - time.time()):
            nextTime += self.interval
            lock.acquire()
            self.action()
            lock.release()

    def cancel(self):
        self.stopEvent.set()
