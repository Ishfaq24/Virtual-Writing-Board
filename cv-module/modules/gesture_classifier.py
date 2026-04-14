import math

class GestureClassifier:
    def __init__(self):
        pass

    def classify(self, landmarks, w, h):
        # Extract necessary landmark points
        # 8 = Index Tip, 6 = Index PIP (middle joint)
        # 12 = Middle Tip, 10 = Middle PIP
        # 16 = Ring Tip, 14 = Ring PIP
        
        pt8 = (int(landmarks[8].x * w), int(landmarks[8].y * h))
        pt6 = (int(landmarks[6].x * w), int(landmarks[6].y * h))
        
        pt12 = (int(landmarks[12].x * w), int(landmarks[12].y * h))
        pt10 = (int(landmarks[10].x * w), int(landmarks[10].y * h))
        
        pt16 = (int(landmarks[16].x * w), int(landmarks[16].y * h))
        pt14 = (int(landmarks[14].x * w), int(landmarks[14].y * h))

        # Check if specific fingers are extended (tip is higher than the middle joint)
        # Note: In OpenCV, y=0 is the TOP of the screen, so "higher" means < (less than)
        index_up = pt8[1] < pt6[1]
        middle_up = pt12[1] < pt10[1]
        ring_up = pt16[1] < pt14[1]

        # ✌️ ERASE: Index and Middle are up, Ring is down
        if index_up and middle_up and not ring_up:
            # Return the midpoint between the two fingers as the eraser center
            eraser_center = ( int((pt8[0] + pt12[0])/2), int((pt8[1] + pt12[1])/2) )
            return "erase", eraser_center
        
        # ☝️ DRAW: ONLY Index is up, Middle and Ring are down
        elif index_up and not middle_up and not ring_up:
            return "draw", pt8
            
        # ✊ STOP: Fist, Open Palm, or anything else
        else:
            return "stop", pt8