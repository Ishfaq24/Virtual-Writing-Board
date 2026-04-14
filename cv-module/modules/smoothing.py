class PointSmoother:
    def __init__(self, alpha=0.4):
        # alpha controls smoothness. 
        # 1.0 = no smoothing. 
        # 0.4 = very smooth, feels like a real heavy pen.
        self.alpha = alpha
        self.last_pt = None

    def update(self, pt):
        if self.last_pt is None:
            self.last_pt = pt
            return pt
        
        # Exponential Moving Average calculation for ultra-smooth lines
        smooth_x = int(self.alpha * pt[0] + (1 - self.alpha) * self.last_pt[0])
        smooth_y = int(self.alpha * pt[1] + (1 - self.alpha) * self.last_pt[1])
        
        self.last_pt = (smooth_x, smooth_y)
        return self.last_pt

    def reset(self):
        self.last_pt = None