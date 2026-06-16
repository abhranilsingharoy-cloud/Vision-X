<div align="center">
  <img src="https://raw.githubusercontent.com/abhranilsingharoy-cloud/Vision-X/main/favicon.ico" alt="Logo" width="80" height="80" onerror="this.style.display='none'">
  <h1>VISION <span style="color: #ff003c;">X</span></h1>
  <p><b>An Enterprise-Grade, 8-Mode AI Vision System featuring J.A.R.V.I.S Voice Control.</b></p>
  
  <p>
    <a href="https://github.com/abhranilsingharoy-cloud/Vision-X/releases">
      <img src="https://img.shields.io/badge/Version-2.0.0-blue?style=for-the-badge&logo=github" alt="Version" />
    </a>
    <img src="https://img.shields.io/badge/TensorFlow.js-WebGPU-orange?style=for-the-badge&logo=tensorflow" alt="TFJS" />
    <img src="https://img.shields.io/badge/Vanilla_JS-ES6-yellow?style=for-the-badge&logo=javascript" alt="JS" />
    <a href="LICENSE">
      <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" />
    </a>
  </p>
</div>

---

## 🚀 Overview

**Vision X** is a high-performance, completely client-side browser application that transforms any standard webcam into a military-grade, stylized tactical heads-up display. Powered entirely by **TensorFlow.js** (utilizing WebGPU acceleration), this application runs **8 distinct AI Neural Network Modes** simultaneously in the browser without relying on any backend servers.

It is designed for speed, privacy, and an ultra-premium cyberpunk aesthetic.

---

## 🔥 The 8 Operational Modes

| Mode | Description | Underlying Model |
| :--- | :--- | :--- |
| **1. GENERAL TRACKING** | Scans the room for 80+ objects with adjustable sensitivity. Includes a precision **Sniper Target Lock** and AI **Depth Estimation** to calculate distance (in meters) from the lens. | `COCO-SSD` + `DepthEstimation` |
| **2. FUSION TRACKING** | The ultimate "God Mode." Runs both Object Detection and Skeletal Tracking neural networks sequentially, overlaying both on the same screen. | `COCO-SSD` + `MoveNet` |
| **3. BIOMETRIC HUD** | Maps 468 facial landmarks to calculate real-time 3D Head Pose Orientation (Yaw, Pitch, Roll). Automatically triggers alerts if attention/gaze is lost. | `MediaPipe FaceMesh` |
| **4. SECURITY SENTRY** | Calculates dynamic threat levels based on intruder proximity. Enters a 5-second red Lockdown state upon breach, automatically triggering the **Auto-DVR** to record a `.webm` clip. | `COCO-SSD` + `MediaRecorder` |
| **5. ANALYTICS TRIPWIRE**| Draws glowing purple motion-memory trails tracking the last 20 frames of an object's path. Counts left/right boundary crossings. | `COCO-SSD` + Custom Centroid Tracker |
| **6. PRIVACY REDACTION** | Extracts bounding box image data and applies a high-performance, cinematic pixelated mosaic blur to securely redact identities in real-time. | `COCO-SSD` + Canvas Filters |
| **7. POSE ESTIMATION** | Tracks human biomechanics and dynamically calculates real-time trigonometric joint angles (elbows, knees, shoulders). | `MoveNet Multipose` |
| **8. SMART FOCUS** | Digital PTZ (Pan-Tilt-Zoom). Acts as an autonomous robotic cameraman, zooming and panning the entire frame to keep the primary target dead-center. | `COCO-SSD` + Canvas Translations |

---

## 🎙️ J.A.R.V.I.S Voice Control System

Turn on the **VOICE LINK** toggle and control the entire application hands-free. Native integration with the browser's Web Speech API allows the AI to respond to your commands out loud. 

**Available Commands:**
* *"Initialize System" / "Start Camera"*
* *"Enable Security Mode" / "Enable Fusion Mode"*
* *"Lock Target [Object Name]"* (e.g. "Lock target cell phone")
* *"Take a Screenshot"*
* *"Terminate Feed"*

---

## 📂 Repository Architecture

The codebase is engineered with strict modularity. The JavaScript logic is decoupled into `core` rendering, `models` definitions, and standalone feature `modules`.

```text
Vision-X/
├── 📁 css/
│   └── 🎨 style.css            # Glassmorphism, CSS Grid, and Cyberpunk UI themes
├── 📁 js/
│   ├── 📁 core/                # Core Application & Rendering Pipelines
│   │   ├── ⚙️ app.js           # Main Orchestrator (State machine, loop intervals)
│   │   ├── 📷 camera.js        # WebRTC Stream Management & Hardware interfaces
│   │   └── 🖼️ ui.js            # Canvas rendering engine, UI dashboard, and Mode Logic
│   ├── 📁 models/              # TensorFlow.js Neural Network Wrappers
│   │   ├── 🧠 depth.js         # AR Portrait Depth Estimation
│   │   ├── 🧠 detector.js      # COCO-SSD Object Detection
│   │   ├── 🧠 facemesh.js      # MediaPipe Face Landmarks
│   │   └── 🧠 pose.js          # MoveNet Pose Estimation
│   └── 📁 modules/             # Standalone System Features
│       ├── 📜 logger.js        # HUD Telemetry & Event Logging
│       ├── 🎯 tracker.js       # Frame-by-Frame ID persistence & Centroid tracking
│       └── 🎙️ voice.js         # J.A.R.V.I.S SpeechRecognition & SpeechSynthesis
├── 📄 .gitignore               # Git omission rules (ignores DVR recordings)
├── 📄 LICENSE                  # MIT License
├── 📄 package.json             # NPM configuration for local dev server
└── 🌐 index.html               # Main application entry point & DOM structure
```

---

## ⚡ Setup & Installation

Because Vision X utilizes highly advanced hardware acceleration and WebRTC permissions, it must be run on a local HTTP server (it cannot be opened via `file://`).

```bash
# 1. Clone the repository
git clone https://github.com/abhranilsingharoy-cloud/Vision-X.git
cd Vision-X

# 2. Run the server (Requires Node.js)
npm run dev

# 3. Open your browser to:
http://localhost:8080
```

---

## 🛠️ Technology Stack

* **Core AI:** `@tensorflow/tfjs` (WebGPU / WebGL Accelerated)
* **Object Detection:** `coco-ssd` (MobileNet V2)
* **Skeletal Tracking:** `pose-detection` (MoveNet Multipose)
* **Biometrics:** `face-landmarks-detection` (MediaPipe FaceMesh)
* **Depth Estimation:** `depth-estimation` (AR Portrait Depth)
* **Design & UI:** Vanilla HTML5 Canvas + Native CSS Custom Properties

## 📝 License

This project is licensed under the terms of the [MIT License](LICENSE).

---
<div align="center">
  <p><i>Designed and Developed by <b>Abhranil Singha Roy</b></i></p>
</div>
