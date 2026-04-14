import time

class FPSCounter:
    def __init__(self):
        self.pTime = 0

    def update(self):
        cTime = time.time()
        fps = 1 / (cTime - self.pTime) if (cTime - self.pTime) > 0 else 0
        self.pTime = cTime
        return int(fps)