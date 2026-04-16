import math

class GestureClassifier:
    def __init__(self):
        pass

    def classify(self, landmarks, w, h):
        # Extract necessary landmark points
        # 8 = Index Tip, 6 = Index PIP (middle joint)
        # 12 = Middle Tip, 10 = Middle PIP
        # 16 = Ring Tip, 14 = Ring PIP
        # 20 = Pinky Tip, 18 = Pinky PIP
		
        pt8 = (int(landmarks[8].x * w), int(landmarks[8].y * h))
        pt6 = (int(landmarks[6].x * w), int(landmarks[6].y * h))
		
        pt12 = (int(landmarks[12].x * w), int(landmarks[12].y * h))
        pt10 = (int(landmarks[10].x * w), int(landmarks[10].y * h))
		
        pt16 = (int(landmarks[16].x * w), int(landmarks[16].y * h))
        pt14 = (int(landmarks[14].x * w), int(landmarks[14].y * h))
		
        pt20 = (int(landmarks[20].x * w), int(landmarks[20].y * h))
        pt18 = (int(landmarks[18].x * w), int(landmarks[18].y * h))

        # Check if specific fingers are extended (tip is higher than the middle joint)
        # Note: In OpenCV, y=0 is the TOP of the screen, so "higher" means < (less than)
        index_up = pt8[1] < pt6[1]
        middle_up = pt12[1] < pt10[1]
        ring_up = pt16[1] < pt14[1]
        pinky_up = pt20[1] < pt18[1]

        # ✋ ERASE: Open palm / full hand (all main fingers extended)
        if index_up and middle_up and ring_up and pinky_up:
            # Use the average of extended fingertips as the erase center
            eraser_center = (
                int((pt8[0] + pt12[0] + pt16[0] + pt20[0]) / 4),
                int((pt8[1] + pt12[1] + pt16[1] + pt20[1]) / 4),
            )
            return "erase", eraser_center
		
        # ☝️ DRAW: ONLY Index is up, others are down
        elif index_up and not middle_up and not ring_up and not pinky_up:
            return "draw", pt8
			
        # ✊ STOP: Fist, partial fingers, or anything else
        else:
            return "stop", pt8