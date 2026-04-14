import math

class GestureClassifier:
    def __init__(self):
        # MediaPipe landmark indices
        self.INDEX_TIP = 8
        self.MIDDLE_TIP = 12
        self.INDEX_MCP = 5 # Base of index finger

    def _calculate_distance(self, p1, p2):
        return math.hypot(p2[0] - p1[0], p2[1] - p1[1])

    def classify(self, landmarks, w, h):
        """Determine action based on finger positions."""
        index_tip = landmarks[self.INDEX_TIP]
        middle_tip = landmarks[self.MIDDLE_TIP]
        index_base = landmarks[self.INDEX_MCP]
        
        # Convert normalized coordinates to pixel coordinates
        ix, iy = int(index_tip.x * w), int(index_tip.y * h)
        mx, my = int(middle_tip.x * w), int(middle_tip.y * h)
        base_y = int(index_base.y * h)
        
        # Distance between index and middle finger
        dist = self._calculate_distance((ix, iy), (mx, my))
        
        # Heuristics
        # 1. Two fingers close together -> ERASE
        if dist < 40 and iy < base_y and my < base_y:
            return "erase", (ix, iy)
        # 2. Only Index finger up -> DRAW
        elif iy < base_y and my > base_y:
            return "draw", (ix, iy)
        # 3. Fist or other gestures -> HOVER/STOP
        else:
            return "hover", (ix, iy)