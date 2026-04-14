import numpy as np

class PointSmoother:
    """Moving average filter to reduce jitter in landmark coordinates."""
    def __init__(self, window_size=5):
        self.points = []
        self.window_size = window_size

    def update(self, pt):
        self.points.append(pt)
        if len(self.points) > self.window_size:
            self.points.pop(0)
        
        avg_x = int(np.mean([p[0] for p in self.points]))
        avg_y = int(np.mean([p[1] for p in self.points]))
        return (avg_x, avg_y)

    def reset(self):
        self.points.clear()