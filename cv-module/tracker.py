import cv2
import socketio
import os
from modules.hand_tracking import HandTracker
from modules.gesture_classifier import GestureClassifier
from modules.smoothing import PointSmoother
from utils.fps_counter import FPSCounter

# CRITICAL FIX FOR WINDOWS: Use 127.0.0.1 instead of localhost
SOCKET_URL = os.getenv('BACKEND_URL', 'http://127.0.0.1:5000')

# Initialize Socket.io Client
sio = socketio.Client()

@sio.event
def connect():
    print("\n" + "="*40)
    print("[SUCCESS] CONNECTED TO NODE.JS BACKEND!")
    print("="*40 + "\n")

@sio.event
def connect_error(data):
    print(f"\n[ERROR] Connection failed: {data}\n")

@sio.event
def disconnect():
    print("[INFO] Disconnected from Backend")

def main():
    print(f"[INFO] Attempting to connect to backend at {SOCKET_URL}...")
    try:
        # CRITICAL FIX: Explicitly define transports
        sio.connect(SOCKET_URL, transports=['websocket', 'polling'])
    except Exception as e:
        print("\n" + "!"*50)
        print(f"[FATAL ERROR] Could not connect to backend: {e}")
        print("Please ensure your Node.js server is running first!")
        print("!"*50 + "\n")
        print("Starting in local-only mode (UI rendering disabled).")

    cap = cv2.VideoCapture(0)
    tracker = HandTracker()
    classifier = GestureClassifier()
    smoother = PointSmoother(alpha=0.4)
    fps_counter = FPSCounter()

    print("[INFO] Starting Webcam feed...")

    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            continue
            
        # Mirror image for intuitive drawing
        frame = cv2.flip(frame, 1)
        h, w, c = frame.shape
        
        results = tracker.process_frame(frame)
        
        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                tracker.draw_landmarks(frame, hand_landmarks)
                
                action, raw_pt = classifier.classify(hand_landmarks.landmark, w, h)
                
                if action in ["draw", "erase"]:
                    smooth_pt = smoother.update(raw_pt)
                    
                    # Normalize coordinates for the React frontend (resolution independence)
                    norm_x = smooth_pt[0] / w
                    norm_y = smooth_pt[1] / h
                    
                    if sio.connected:
                        sio.emit('gesture_data', {
                            'x': smooth_pt[0],
                            'y': smooth_pt[1],
                            'normalizedX': norm_x,
                            'normalizedY': norm_y,
                            'action': action
                        })
                    
                    # Local visual feedback
                    color = (0, 255, 0) if action == "draw" else (0, 0, 255)
                    cv2.circle(frame, smooth_pt, 10, color, cv2.FILLED)
                else:
                    smoother.reset()
                    if sio.connected:
                        sio.emit('gesture_data', {'action': 'hover'})
        else:
            smoother.reset()
            if sio.connected:
                sio.emit('gesture_data', {'action': 'stop'})

        # Display FPS
        fps = fps_counter.update()
        cv2.putText(frame, f"FPS: {fps}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 0, 0), 2)

        cv2.imshow('CV Processing Feed', frame)
        
        # Press 'q' to quit, 'c' to clear canvas
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('c') and sio.connected:
            sio.emit('clear_canvas')

        # CRITICAL FIX: Yield execution to the background socket thread
        # This prevents the socket heartbeat from timing out and disconnecting
        sio.sleep(0.01)

    cap.release()
    cv2.destroyAllWindows()
    if sio.connected:
        sio.disconnect()

if __name__ == "__main__":
    main()