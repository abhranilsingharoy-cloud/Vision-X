<div align="center">
  <h1>VISION <span style="color: #ff003c;">X</span></h1>
  <p><b>An Enterprise-Grade, 8-Mode AI Vision System featuring J.A.R.V.I.S Voice Control.</b></p>
  
  <p>
    <img src="https://img.shields.io/badge/Version-2.0.0-blue?style=for-the-badge" alt="Version" />
    <img src="https://img.shields.io/badge/TensorFlow.js-WebGPU-orange?style=for-the-badge" alt="TFJS" />
    <img src="https://img.shields.io/badge/Vanilla_JS-ES6-yellow?style=for-the-badge" alt="JS" />
    <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" />
  </p>
</div>

<br/>

## 🚀 The V2.0 Sci-Fi Overhaul

Vision X transforms any standard webcam into a military-grade, heavily-stylized tactical heads-up display. Powered entirely in the browser by TensorFlow.js, this application runs **8 distinct AI Neural Network Modes** simultaneously. No backend servers required. 

## 🔥 The 8 Operational Modes

1. **GENERAL TRACKING:** Scans the room for 80+ objects with an adjustable sensitivity slider. Includes a precision **Sniper Target Lock** and AI **Depth Estimation** to calculate how far objects are from the camera.
2. **FUSION TRACKING (God Mode):** Runs both the Object Detection and Skeletal Tracking neural networks sequentially, overlaying both on the same screen.
3. **BIOMETRIC HUD:** Maps 468 facial landmarks to calculate 3D Head Pose Orientation (Yaw, Pitch, Roll). Automatically triggers alerts if attention is lost.
4. **SECURITY SENTRY:** Calculates dynamic threat levels based on intruder proximity. Enters a 5-second red Lockdown state upon breach, automatically triggering the **Auto-DVR System** to silently record and download a `.webm` video of the intruder.
5. **ANALYTICS TRIPWIRE:** Draws glowing purple motion-memory trails tracking the last 20 frames of an object's path. Automatically counts left/right boundary crossings.
6. **PRIVACY REDACTION:** Extracts bounding box image data and applies a high-performance, cinematic pixelated mosaic blur to hide identities in real-time.
7. **POSE ESTIMATION:** Tracks human biomechanics and dynamically calculates real-time trigonometric angles of elbows, knees, and shoulders.
8. **SMART FOCUS (Digital PTZ):** Acts as an autonomous robotic cameraman, digitally zooming in and panning the entire camera frame to keep the primary target perfectly dead-center.

## 🎙️ J.A.R.V.I.S Voice Control System

Turn on the **VOICE LINK** toggle and control the entire application without touching the mouse! Native integration with the browser's Speech Recognition and Speech Synthesis APIs allows the AI to respond to your commands out loud. 

* *"Initialize System"*
* *"Enable Security Mode"*
* *"Lock Target Cell Phone"*
* *"Take a Screenshot"*

## ⚡ Setup & Installation

Because Vision X relies on advanced WebRTC camera permissions, it must be run on a local server.

```bash
# 1. Clone the repository
git clone https://github.com/abhranilsingharoy-cloud/Vision-X.git
cd Vision-X

# 2. Run the server (Requires Node.js)
npx http-server -p 8080 -c-1

# 3. Open your browser to:
http://localhost:8080
```

## 🛠️ Technology Stack

* **Core AI:** `@tensorflow/tfjs` (WebGPU Accelerated)
* **Object Detection:** `coco-ssd` (MobileNet V2)
* **Skeletal Tracking:** `pose-detection` (MoveNet Multipose)
* **Biometrics:** `face-landmarks-detection` (MediaPipe FaceMesh)
* **Depth:** `depth-estimation` (AR Portrait Depth)
* **Design:** Vanilla HTML/CSS with Glassmorphism & Cyberpunk Aesthetics

## 📝 License

Released under the [MIT License](LICENSE).
