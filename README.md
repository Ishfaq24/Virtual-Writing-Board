<div align="center">
  
# 🚀 AI-Powered Virtual Whiteboard

**A scalable, low-latency, gesture-controlled collaborative whiteboard.**

[![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-yellow.svg)](https://www.python.org/)
[![OpenCV](https://img.shields.io/badge/OpenCV-4.8+-red.svg)](https://opencv.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](https://opensource.org/licenses/MIT)

</div>

---

## 📌 Overview

The **Virtual Writing Board** is a production-ready, distributed system that allows users to draw in the air using hand gestures captured by a standard webcam. It utilizes **MediaPipe** for skeletal tracking, **Socket.IO** for sub-50ms bidirectional synchronization, and **React (HTML5 Canvas)** for resolution-agnostic vector rendering.

## ✨ Enterprise-Grade Features

- **✋ AI Gesture Recognition:** Real-time skeletal tracking (30+ FPS) via MediaPipe and OpenCV.
- **⚡ Low-Latency Sync:** Sub-50ms stroke replication across multiple global clients via WebSockets.
- **📐 Resolution Agnostic:** Tracking points are normalized, ensuring perfect rendering across 4K monitors and mobile devices alike.
- **🌊 Stroke Smoothing:** Implements Moving Average filtering to eliminate hardware jitter and produce natural ink flows.
- **🔄 Eventual Consistency:** Canvas state history is maintained for late-joining clients.

---

## 🏗️ System Architecture

The system is decoupled into three distinct tiers. **Note for production:** The CV Module runs on the *Edge* (the user's physical machine with the webcam), while the React Frontend and Node Backend are deployed to the *Cloud*.

```
┌──────────────────────────────┐
│        EDGE DEVICE           │
│                              │
│  [ Webcam ]                  │
│      │                       │
│      ▼ (Video Frames)        │
│  [ Python CV Module ]        │
│  (MediaPipe + OpenCV)        │
└──────────────┬───────────────┘
               │
               │ (Socket.IO / WebSockets)
               │ {x, y, action}
               ▼
┌──────────────────────────────┐
│        CLOUD BACKEND         │
│                              │
│  [ Node.js + Express ]       │
│  [ Socket.IO Server  ]       │
└──────────────┬───────────────┘
               │
               │ (Broadcasts events)
               │
      ┌────────┴────────┐
      ▼                 ▼
┌────────────┐   ┌────────────┐
│ Browser 1  │   │ Browser 2  │
│ (React UI) │   │ (React UI) │
└────────────┘   └────────────┘
```

### 🛠️ Tech Stack
| Tier | Technology | Purpose |
|------|------------|---------|
| **Frontend** | React 19, Vite, TailwindCSS | High-performance HTML5 Canvas rendering & UI. |
| **Backend** | Node.js, Express, Socket.IO 4 | WebSocket hub, room management, and state sync. |
| **AI Edge** | Python 3.10+, OpenCV, MediaPipe | Frame extraction, landmark detection, heuristics. |

---

## 📁 Project Directory Structure

The project is structured as a monorepo, strictly separating the frontend, backend, and computer vision engine into their own distinct domains.

```text
ai-virtual-whiteboard/
│
├── client/                              # 🌐 REACT FRONTEND
│   ├── public/
│   ├── src/
│   │   ├── components/                  # Reusable UI components
│   │   │   └── Whiteboard.jsx           # Core canvas rendering & socket connection
│   │   ├── hooks/
│   │   │   └── useCanvas.js             # Custom hook handling HTML5 Canvas API logic
│   │   ├── App.jsx                      # Main application view
│   │   └── index.css                    # Tailwind CSS global styles
│   ├── package.json
│   └── vite.config.js                   # Vite frontend bundler configuration
│
├── server/                              # ⚙️ NODE.JS + EXPRESS BACKEND
│   ├── sockets/
│   │   └── socketHandler.js             # Modular Socket.io logic ('draw', 'erase', 'clear')
│   ├── index.js                         # Main Express server entry point
│   └── package.json
│
├── cv-module/                           # 🧠 PYTHON COMPUTER VISION ENGINE
│   ├── modules/
│   │   ├── hand_tracking.py             # MediaPipe initialization and landmark extraction
│   │   ├── gesture_classifier.py        # Logic to convert landmarks into 'draw', 'erase', 'stop'
│   │   └── smoothing.py                 # Moving average filter math classes
│   ├── utils/
│   │   └── fps_counter.py               # Utility to measure processing speed
│   ├── tracker.py                       # Main execution script (captures webcam, emits sockets)
│   └── requirements.txt                 # Python dependencies
│
└── README.md                            # Comprehensive setup and architecture docs
```

---

## ⚙️ Environment Configuration

Define the following environment variables in `.env` files for each respective module before deployment.

### Backend (`server/.env`)
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Port for the Node.js server. |
| `CORS_ORIGIN` | `*` | Allowed origins (e.g., `https://my-app.com`). |
| `REDIS_URL` | `null` | Redis connection string for multi-instance scaling. |

### Edge AI (`cv-module/.env`)
| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_URL` | `http://127.0.0.1:5000` | Target WebSocket server. **Must be 127.0.0.1 on Windows.** |
| `CAMERA_INDEX`| `0` | Default hardware index for the webcam. |

### Frontend (`client/.env`)
| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_SOCKET_URL` | `http://localhost:5000` | Target WebSocket server for the browser client. |

---

## 🚀 Quick Start (Local Development)

### 1. Requirements
* **Node.js** ≥ 18.x
* **Python** ≥ 3.10
* A physical webcam

### 2. Bootstrapping the System
Open three separate terminal instances:

**Terminal 1: Backend**
```bash
cd server
npm install
node index.js
```

**Terminal 2: Frontend**
```bash
cd client
npm install
npm run dev
```
*(Navigate to `http://localhost:5173` in your browser)*

**Terminal 3: CV Edge Tracker**
```bash
cd cv-module
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python tracker.py
```

---

## 🖐️ Gesture Control Reference

The CV module uses heuristic math based on the knuckles (MCP) and fingertips to classify intent:

| Gesture | Pose Details | Action |
|---------|-------------|--------|
| **☝️ Draw** | Index finger extended above MCP baseline; middle finger folded. | Renders blue stroke. |
| **✌️ Erase** | Index and middle fingers extended; distance < 40px apart. | Acts as destination-out eraser. |
| **✊ Stop** | Closed fist or open palm. | Stops stroke path; enters hover mode. |
| **⌨️ Clear** | Press `C` on the active OpenCV window. | Clears the global canvas. |

---

## 🌩️ Production Deployment

To run this system at scale (10,000+ concurrent users), follow these architectural guidelines:

### 1. Frontend (Static Hosting)
Build the React app using Vite and deploy to a CDN (AWS S3 + CloudFront, Vercel, or Netlify).
```bash
npm run build
```

### 2. Backend (Horizontal Scaling)
WebSocket servers are stateful. To scale the Node.js backend across multiple instances or Kubernetes pods, you **must** use the `@socket.io/redis-adapter`.
* Deploy using **PM2** or **Docker/K8s**.
* Set up a **Load Balancer (Nginx/HAProxy)** with `ip_hash` (sticky sessions) enabled.
* Terminate SSL/TLS at the Load Balancer.

### 3. Edge AI (Client-Side)
The Python CV module requires access to `/dev/video0` (hardware webcam).
* It **cannot** be deployed to a cloud server unless you are piping video streams via WebRTC.
* For enterprise rollouts, package the Python script as a standalone executable using `PyInstaller` for end-users to download, or migrate the MediaPipe logic directly into the React frontend using `@mediapipe/hands` (WebAssembly).

---

## 🛡️ Security & Performance

* **Rate Limiting:** Implement Socket.IO rate limiting to prevent malicious clients from flooding the server with coordinate data.
* **Payload Validation:** Validate `x`, `y`, and `action` enums before broadcasting to prevent XSS/injection attacks on the canvas.
* **Canvas Memory Leaks:** The backend currently holds a `canvasState` array. In production, flush this to a Redis cache or MongoDB document periodically to prevent Node.js heap exhaustion.

---

## 📝 License

This project is licensed under the [MIT License](LICENSE).

---
*Built with ❤️ for real-time collaboration.*
