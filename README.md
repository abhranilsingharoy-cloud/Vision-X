# Vision X

Vision X is an advanced, real-time object detection web application that uses TensorFlow.js and COCO-SSD to detect, track, and label objects directly in the browser. It features a modern, glassmorphism-inspired dark mode UI.

## Features

* **Real-Time Detection:** Run object detection at > 15 FPS entirely in the browser.
* **Dashboard:** Monitor FPS, real-time object counters, and view an activity log.
* **Alert System:** Select a target object (e.g., "person") to trigger an audio-visual alert when detected.
* **Camera Controls:** Start/stop stream, switch between front/back cameras, and save annotated screenshots.
* **Confidence Filter:** Adjust detection sensitivity in real-time via the confidence slider.
* **Zero Backend:** Everything runs locally on the client using WebGL via TensorFlow.js.

## Setup & Running Locally

Since this app uses the WebRTC `getUserMedia` API, it must be served over `http://localhost` or `https://`. You cannot just open the `index.html` file via `file://`.

### Using Python
1. Open a terminal in the project directory (`VisionX`).
2. Run: `python -m http.server 8000`
3. Open your browser and navigate to `http://localhost:8000`.

### Using Node.js (http-server)
1. Install http-server: `npm install -g http-server`
2. Run: `http-server`
3. Open the provided local URL in your browser.

### Using VS Code
1. Install the "Live Server" extension.
2. Right-click `index.html` and select "Open with Live Server".

## Extending the Project

* **Custom Models:** You can replace the COCO-SSD model in `detector.js` with a custom YOLOv8 model trained on custom data and converted to TF.js format.
* **Backend Logging:** Hook into the `Logger` class in `logger.js` to send high-confidence detections to a Firebase or SQLite database via a REST API.
* **Multi-Object Tracking:** Implement a tracking algorithm (like SORT) to give each object a unique ID across frames.
