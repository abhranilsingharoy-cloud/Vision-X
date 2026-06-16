/**
 * Main application orchestrator
 */
class App {
    constructor() {
        this.btnToggle = document.getElementById('btn-toggle-camera');
        this.btnFlip = document.getElementById('btn-flip-camera');
        this.btnScreenshot = document.getElementById('btn-screenshot');
        
        this.modeSelector = document.getElementById('mode-selector');
        this.statusDot = document.getElementById('system-status-dot');
        this.statusText = document.getElementById('system-status-text');

        this.isCameraActive = false;
        this.animationFrameId = null;
        this.currentMode = 'object'; 

        this.init();
    }

    async init() {
        this.bindEvents();

        try {
            await detector.loadModel();
            if (window.depthEngine) await depthEngine.loadModel();
            if (typeof handDetector !== 'undefined') await handDetector.loadModel();
            if (typeof ocrDetector !== 'undefined') await ocrDetector.loadModel();
            
            this.setStatus('SYSTEM READY', 'ready');
            this.btnToggle.disabled = false;
        } catch (error) {
            this.setStatus('CORE MODEL LOAD FAILED', 'error');
            console.error('App init error:', error);
        }
    }

    setStatus(text, state) {
        if(this.statusText) this.statusText.textContent = text;
        if(this.statusDot && this.statusDot.parentElement) this.statusDot.parentElement.className = `status-badge ${state}`;
    }

    bindEvents() {
        this.btnToggle.addEventListener('click', () => this.toggleCamera());
        this.btnFlip.addEventListener('click', () => this.flipCamera());
        this.btnScreenshot.addEventListener('click', () => this.takeScreenshot());
        
        this.modeSelector.addEventListener('change', async (e) => {
            const newMode = e.target.value;
            if (newMode !== this.currentMode) {
                this.currentMode = newMode;
                
                // Reset everything
                if(typeof faceMeshDetector !== 'undefined') faceMeshDetector.isDetecting = false;
                if(typeof poseDetector !== 'undefined') poseDetector.isDetecting = false;
                if(typeof detector !== 'undefined') detector.isDetecting = false;
                if(typeof depthEngine !== 'undefined') depthEngine.isDetecting = false;
                
                ui.resetContext();
                ui.updateDashboard({}, 0);
                
                if (this.currentMode === 'biometric' || this.currentMode === 'drowsiness') {
                    document.getElementById('target-selector').disabled = true;
                    try {
                        if (!faceMeshDetector.model) await faceMeshDetector.loadModel();
                        if (this.currentMode === 'biometric' || this.currentMode === 'drowsiness') {
                            faceMeshDetector.isDetecting = true;
                            this.setStatus(this.currentMode === 'biometric' ? 'BIOMETRIC ACTIVE' : 'DROWSINESS MONITOR ACTIVE', 'ready');
                        }
                    } catch(err) {
                        this.setStatus('FAILED TO LOAD BIOMETRIC MODEL', 'error');
                    }
                } else if (this.currentMode === 'ocr') {
                    document.getElementById('target-selector').disabled = true;
                    try {
                        if (!ocrDetector.worker) await ocrDetector.loadModel();
                        if (this.currentMode === 'ocr') {
                            ocrDetector.isDetecting = true;
                            this.setStatus('DATA SCANNER ACTIVE', 'ready');
                        }
                    } catch(err) {
                        this.setStatus('FAILED TO LOAD OCR', 'error');
                    }
                } else if (this.currentMode === 'pose') {
                    document.getElementById('target-selector').disabled = true;
                    try {
                        if (!poseDetector.model) await poseDetector.loadModel();
                        if (this.currentMode === 'pose') {
                            poseDetector.isDetecting = true;
                            this.setStatus('POSE ESTIMATION ACTIVE', 'ready');
                        }
                    } catch(err) {
                        this.setStatus('FAILED TO LOAD POSE MODEL', 'error');
                    }
                } else if (this.currentMode === 'fusion') {
                    document.getElementById('target-selector').disabled = true;
                    try {
                        if (!poseDetector.model) await poseDetector.loadModel();
                        if (this.currentMode === 'fusion') {
                            poseDetector.isDetecting = true;
                            detector.isDetecting = true;
                            this.setStatus('FUSION MODE ACTIVE', 'ready');
                        }
                    } catch(err) {
                        this.setStatus('FAILED TO LOAD FUSION MODELS', 'error');
                    }
                } else {
                    document.getElementById('target-selector').disabled = false;
                    detector.isDetecting = true;
                    if (this.currentMode === 'object' && typeof depthEngine !== 'undefined') depthEngine.isDetecting = true;
                    this.setStatus(`${this.currentMode.toUpperCase()} ACTIVE`, 'ready');
                }
            }
        });
    }

    async toggleCamera() {
        try {
            if (!this.isCameraActive) {
                this.setStatus('INITIALIZING...', 'warning');
                await camera.start();
                this.isCameraActive = true;
                this.btnToggle.innerHTML = '<i class="fas fa-power-off"></i> TERMINATE FEED';
                this.btnToggle.classList.replace('primary', 'secondary');
                this.btnFlip.disabled = false;
                this.btnScreenshot.disabled = false;
                
                const dims = camera.getDimensions();
                ui.setupCanvas(dims.width, dims.height);
                
                // Trigger the mode selector logic to set state
                const currentVal = this.modeSelector.value;
                this.currentMode = null; // Force trigger
                this.modeSelector.value = currentVal;
                this.modeSelector.dispatchEvent(new Event('change'));
                
                this.detectionLoop();
            } else {
                this.stopCamera();
            }
        } catch (error) {
            this.setStatus('CAMERA ERROR', 'warning');
            console.error(error);
        }
    }

    stopCamera() {
        camera.stop();
        if(typeof detector !== 'undefined') detector.isDetecting = false;
        if(typeof faceMeshDetector !== 'undefined') faceMeshDetector.isDetecting = false;
        if(typeof poseDetector !== 'undefined') poseDetector.isDetecting = false;
        if(typeof depthEngine !== 'undefined') depthEngine.isDetecting = false;
        
        this.isCameraActive = false;
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        
        ui.resetContext();
        ui.updateDashboard({}, 0);
        
        this.btnToggle.innerHTML = '<i class="fas fa-power-off"></i> INITIALIZE SYSTEM';
        this.btnToggle.classList.replace('secondary', 'primary');
        this.btnFlip.disabled = true;
        this.btnScreenshot.disabled = true;
        this.setStatus('OFFLINE', '');
    }

    async flipCamera() {
        if (this.isCameraActive) {
            await camera.flip();
            const dims = camera.getDimensions();
            ui.setupCanvas(dims.width, dims.height);
        }
    }

    async detectionLoop() {
        if (!this.isCameraActive) return;

        if (camera.videoElement.readyState >= 2) {
            let activeEngine = false;

            // Gesture Control Background Process
            const gestureToggle = document.getElementById('gesture-toggle');
            if (gestureToggle && gestureToggle.checked && typeof handDetector !== 'undefined') {
                handDetector.isDetecting = true;
                handDetector.detectFrame(camera.videoElement);
            } else if (typeof handDetector !== 'undefined') {
                handDetector.isDetecting = false;
            }

            if ((this.currentMode === 'biometric' || this.currentMode === 'drowsiness') && typeof faceMeshDetector !== 'undefined' && faceMeshDetector.isDetecting) {
                activeEngine = true;
                const results = await faceMeshDetector.detectFrame(camera.videoElement);
                if (this.currentMode === 'biometric') ui.drawFaceMesh(results);
                else ui.drawDrowsinessMode(results);
            } else if (this.currentMode === 'ocr' && typeof ocrDetector !== 'undefined' && ocrDetector.isDetecting) {
                activeEngine = true;
                const results = await ocrDetector.detectFrame(camera.videoElement);
                ui.drawOCRMode(results);
            } else if (this.currentMode === 'pose' && typeof poseDetector !== 'undefined' && poseDetector.isDetecting) {
                activeEngine = true;
                const results = await poseDetector.detectFrame(camera.videoElement);
                ui.drawPoseMode(results);
            } else if (this.currentMode === 'fusion' && typeof poseDetector !== 'undefined' && poseDetector.isDetecting && detector.isDetecting) {
                activeEngine = true;
                const objectPreds = await detector.detectFrame(camera.videoElement);
                const posePreds = await poseDetector.detectFrame(camera.videoElement);
                ui.drawFusionMode(objectPreds, posePreds);
            } else if (typeof detector !== 'undefined' && detector.isDetecting) {
                activeEngine = true;
                const predictions = await detector.detectFrame(camera.videoElement);
                
                if (typeof ui !== 'undefined') ui.updateHeatmap(predictions);
                
                let depthMap = null;
                if (this.currentMode === 'object' && typeof depthEngine !== 'undefined' && depthEngine.isDetecting) {
                    depthMap = await depthEngine.detectFrame(camera.videoElement);
                }
                
                if (this.currentMode === 'object') ui.drawDetections(predictions, depthMap);
                else if (this.currentMode === 'security') ui.drawSecurityMode(predictions);
                else if (this.currentMode === 'tripwire') ui.drawTripwireMode(predictions);
                else if (this.currentMode === 'privacy') ui.drawPrivacyMode(predictions);
                else if (this.currentMode === 'focus') ui.drawFocusMode(predictions);
                else if (this.currentMode === 'heatmap') ui.drawHeatmapMode(predictions);
            }

            // Draw clean video if waiting for AI to load during mode switch
            if (!activeEngine) {
                ui.resetContext();
                ui.drawVideoFeed();
                
                ui.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ui.ctx.fillRect(0, 0, ui.canvas.width, ui.canvas.height);
                
                ui.ctx.font = '700 24px JetBrains Mono';
                ui.ctx.fillStyle = '#00f3ff';
                ui.ctx.textAlign = 'center';
                ui.ctx.fillText('BOOTING AI ENGINE...', ui.canvas.width/2, ui.canvas.height/2);
                ui.ctx.textAlign = 'left';
            }
        }

        this.animationFrameId = requestAnimationFrame(() => this.detectionLoop());
    }

    takeScreenshot() {
        if (!this.isCameraActive) return;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = ui.canvas.width;
        tempCanvas.height = ui.canvas.height;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(camera.videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
        ctx.drawImage(ui.canvas, 0, 0);
        const link = document.createElement('a');
        link.download = `vision-x-capture-${Date.now()}.png`;
        link.href = tempCanvas.toDataURL('image/png');
        link.click();
        if (typeof voiceAssistant !== 'undefined') voiceAssistant.speak("Screenshot captured and saved.");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
