/**
 * Biometric Engine: Face Landmarks & Eye Tracking
 */
class FaceMeshDetector {
    constructor() {
        this.model = null;
        this.isDetecting = false;
        
        // Eye tracking state
        this.EAR_THRESHOLD = 0.25; // Below this = eyes closed
        this.CLOSED_FRAMES_THRESHOLD = 5; // How many frames to trigger "drowsy/closed"
        this.closedFrames = 0;
        this.eyesClosed = false;

        // FPS
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.currentFPS = 0;
    }

    async loadModel() {
        try {
            if (window.app) window.app.setStatus('Loading MediaPipe WebAssembly...', 'warning');
            
            const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
            const detectorConfig = {
                runtime: 'mediapipe', // Use MediaPipe WebAssembly instead of TFJS
                solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
                refineLandmarks: true
            };
            
            this.model = await faceLandmarksDetection.createDetector(model, detectorConfig);
            return true;
        } catch (error) {
            console.error('Failed to load FaceMesh model:', error);
            if (window.app) window.app.setStatus('BIOMETRIC LOAD FAILED', 'error');
            throw error;
        }
    }

    getDistance(p1, p2) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    }

    calculateEAR(eyeKeypoints) {
        const p1 = eyeKeypoints[0];
        const p4 = eyeKeypoints[3];
        const p2 = eyeKeypoints[1];
        const p6 = eyeKeypoints[5];
        const p3 = eyeKeypoints[2];
        const p5 = eyeKeypoints[4];

        const vertical1 = this.getDistance(p2, p6);
        const vertical2 = this.getDistance(p3, p5);
        const horizontal = this.getDistance(p1, p4);

        if (horizontal === 0) return 0;
        return (vertical1 + vertical2) / (2.0 * horizontal);
    }

    async detectFrame(video) {
        if (!this.model || !this.isDetecting) return null;

        try {
            const faces = await this.model.estimateFaces(video);
            
            let result = { faces, eyesState: 'OPEN', ear: 0 };

            if (faces.length > 0) {
                const keypoints = faces[0].keypoints;

                const leftEyeIndices = [33, 160, 158, 133, 153, 144];
                const leftEye = leftEyeIndices.map(idx => keypoints[idx]);
                
                const rightEyeIndices = [362, 385, 387, 263, 373, 380];
                const rightEye = rightEyeIndices.map(idx => keypoints[idx]);

                const leftEAR = this.calculateEAR(leftEye);
                const rightEAR = this.calculateEAR(rightEye);
                
                const avgEAR = (leftEAR + rightEAR) / 2;
                result.ear = avgEAR;

                if (avgEAR < this.EAR_THRESHOLD) {
                    this.closedFrames++;
                    if (this.closedFrames >= this.CLOSED_FRAMES_THRESHOLD) {
                        if (!this.eyesClosed) {
                            logger.addLog("EYES CLOSED DETECTED", avgEAR);
                        }
                        this.eyesClosed = true;
                        result.eyesState = 'CLOSED';
                    } else {
                        result.eyesState = 'CLOSING';
                    }
                } else {
                    this.closedFrames = 0;
                    if (this.eyesClosed) {
                        logger.addLog("EYES OPENED", avgEAR);
                    }
                    this.eyesClosed = false;
                    result.eyesState = 'OPEN';
                }

                if (this.eyesClosed && this.closedFrames % 15 === 0) {
                    if (window.ui) window.ui.triggerAlert("EYES CLOSED");
                }
            }

            this.updateFPS();
            return result;
        } catch (error) {
            console.error('FaceMesh error:', error);
            return null;
        }
    }

    updateFPS() {
        this.frameCount++;
        const now = performance.now();
        const elapsed = now - this.lastTime;
        
        if (elapsed >= 1000) {
            this.currentFPS = (this.frameCount * 1000) / elapsed;
            this.frameCount = 0;
            this.lastTime = now;
            if (window.ui) window.ui.updateFPS(this.currentFPS);
        }
    }
}

const faceMeshDetector = new FaceMeshDetector();
