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
                if(window.faceMeshDetector) faceMeshDetector.isDetecting = false;
                if(window.poseDetector) poseDetector.isDetecting = false;
                if(window.detector) detector.isDetecting = false;
                if(window.depthEngine) depthEngine.isDetecting = false;
                
                ui.resetContext();
                ui.updateDashboard({}, 0);
                
                if (this.currentMode === 'biometric') {
                    document.getElementById('target-selector').disabled = true;
                    try {
                        if (!faceMeshDetector.model) await faceMeshDetector.loadModel();
                        faceMeshDetector.isDetecting = true;
                        this.setStatus('BIOMETRIC ACTIVE', 'ready');
                    } catch(err) {
                        this.setStatus('FAILED TO LOAD BIOMETRIC MODEL', 'error');
                    }
                } else if (this.currentMode === 'pose') {
                    document.getElementById('target-selector').disabled = true;
                    try {
                        if (!poseDetector.model) await poseDetector.loadModel();
                        poseDetector.isDetecting = true;
                        this.setStatus('POSE ESTIMATION ACTIVE', 'ready');
                    } catch(err) {
                        this.setStatus('FAILED TO LOAD POSE MODEL', 'error');
                    }
                } else if (this.currentMode === 'fusion') {
                    document.getElementById('target-selector').disabled = true;
                    try {
                        if (!poseDetector.model) await poseDetector.loadModel();
                        poseDetector.isDetecting = true;
                        detector.isDetecting = true;
                        this.setStatus('FUSION MODE ACTIVE', 'ready');
                    } catch(err) {
                        this.setStatus('FAILED TO LOAD FUSION MODELS', 'error');
                    }
                } else {
                    document.getElementById('target-selector').disabled = false;
                    detector.isDetecting = true;
                    if (this.currentMode === 'object' && window.depthEngine) depthEngine.isDetecting = true;
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
        if(window.detector) detector.isDetecting = false;
        if(window.faceMeshDetector) faceMeshDetector.isDetecting = false;
        if(window.poseDetector) poseDetector.isDetecting = false;
        if(window.depthEngine) depthEngine.isDetecting = false;
        
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
            if (this.currentMode === 'biometric' && window.faceMeshDetector && faceMeshDetector.isDetecting) {
                const results = await faceMeshDetector.detectFrame(camera.videoElement);
                ui.drawFaceMesh(results);
            } else if (this.currentMode === 'pose' && window.poseDetector && poseDetector.isDetecting) {
                const results = await poseDetector.detectFrame(camera.videoElement);
                ui.drawPoseMode(results);
            } else if (this.currentMode === 'fusion' && window.poseDetector && poseDetector.isDetecting && detector.isDetecting) {
                const objectPreds = await detector.detectFrame(camera.videoElement);
                const posePreds = await poseDetector.detectFrame(camera.videoElement);
                ui.drawFusionMode(objectPreds, posePreds);
            } else if (window.detector && detector.isDetecting) {
                const predictions = await detector.detectFrame(camera.videoElement);
                
                let depthMap = null;
                if (this.currentMode === 'object' && window.depthEngine && depthEngine.isDetecting) {
                    depthMap = await depthEngine.detectFrame(camera.videoElement);
                }
                
                if (this.currentMode === 'object') ui.drawDetections(predictions, depthMap);
                else if (this.currentMode === 'security') ui.drawSecurityMode(predictions);
                else if (this.currentMode === 'tripwire') ui.drawTripwireMode(predictions);
                else if (this.currentMode === 'privacy') ui.drawPrivacyMode(predictions);
                else if (this.currentMode === 'focus') ui.drawFocusMode(predictions);
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
        if (window.voiceAssistant) window.voiceAssistant.speak("Screenshot captured and saved.");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
