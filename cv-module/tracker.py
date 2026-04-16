import cv2
import socketio
import os
import time
from modules.hand_tracking import HandTracker
from modules.gesture_classifier import GestureClassifier
from modules.smoothing import PointSmoother
from utils.fps_counter import FPSCounter

# Configuration via environment variables for flexibility
SOCKET_URL = os.getenv('BACKEND_URL', 'http://127.0.0.1:5000')
CAMERA_INDEX = int(os.getenv('CAMERA_INDEX', '0'))
SMOOTHING_ALPHA = float(os.getenv('SMOOTHING_ALPHA', '0.4'))
MIN_MOVE_PX = float(os.getenv('MIN_MOVE_PX', '3.0'))
ACTION_STABILITY_FRAMES = int(os.getenv('ACTION_STABILITY_FRAMES', '3'))

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
    # Retry a few times before giving up, to handle slow server startup
    max_retries = 5
    for attempt in range(1, max_retries + 1):
        try:
            sio.connect(SOCKET_URL, transports=['websocket', 'polling'])
            break
        except Exception as e:
            print(f"[WARN] Connection attempt {attempt}/{max_retries} failed: {e}")
            if attempt == max_retries:
                print("\n" + "!"*50)
                print("[FATAL ERROR] Could not connect to backend after several attempts.")
                print("Please ensure your Node.js server is running first!")
                print("Running in local-only mode (UI rendering disabled).")
                print("!"*50 + "\n")
            else:
                time.sleep(2)

    cap = cv2.VideoCapture(CAMERA_INDEX)
    tracker = HandTracker()
    classifier = GestureClassifier()
    smoother = PointSmoother(alpha=SMOOTHING_ALPHA)
    last_sent_pt = None

    # Gesture mode debouncing: require N consecutive frames
    # before switching between draw/erase/stop to avoid flicker.
    stable_action = "stop"
    stable_point = None
    pending_action = None
    pending_count = 0
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

                proposed_action, proposed_pt = classifier.classify(hand_landmarks.landmark, w, h)

                # Debounce rapid gesture changes to keep modes stable
                if proposed_action == stable_action:
                    pending_action = None
                    pending_count = 0
                    if proposed_action in ["draw", "erase"]:
                        stable_point = proposed_pt
                else:
                    if pending_action == proposed_action:
                        pending_count += 1
                    else:
                        pending_action = proposed_action
                        pending_count = 1

                    if pending_count >= ACTION_STABILITY_FRAMES:
                        stable_action = proposed_action
                        stable_point = proposed_pt
                        pending_action = None
                        pending_count = 0

                action = stable_action
                raw_pt = stable_point if stable_point is not None else proposed_pt

                if action in ["draw", "erase"]:
                    smooth_pt = smoother.update(raw_pt)

                    # Movement threshold to ignore tiny jitter
                    if last_sent_pt is not None:
                        dx = smooth_pt[0] - last_sent_pt[0]
                        dy = smooth_pt[1] - last_sent_pt[1]
                        dist_sq = dx * dx + dy * dy
                        if dist_sq < MIN_MOVE_PX * MIN_MOVE_PX:
                            # Skip sending this frame to keep strokes clean
                            continue

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
                        last_sent_pt = smooth_pt
                    
                    # Local visual feedback
                    color = (0, 255, 0) if action == "draw" else (0, 0, 255)
                    cv2.circle(frame, smooth_pt, 10, color, cv2.FILLED)
                else:
                    smoother.reset()
                    last_sent_pt = None
                    if sio.connected:
                        sio.emit('gesture_data', {'action': 'hover'})
        else:
            smoother.reset()
            last_sent_pt = None
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