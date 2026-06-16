/**
 * Main application orchestrator
 */
class App {
    constructor() {
        // UI Elements
        this.btnToggle = document.getElementById('btn-toggle-camera');
        this.btnFlip = document.getElementById('btn-flip-camera');
        this.btnScreenshot = document.getElementById('btn-screenshot');
        
        this.modeSelector = document.getElementById('mode-selector');
        this.statusDot = document.getElementById('system-status-dot');
        this.statusText = document.getElementById('system-status-text');

        this.isCameraActive = false;
        this.animationFrameId = null;
        this.currentMode = 'object'; // 'object' or 'biometric'

        this.init();
    }

    async init() {
        this.bindEvents();

        try {
            // Load initial object model
            await detector.loadModel();
            this.setStatus('SYSTEM READY', 'ready');
            this.btnToggle.disabled = false;
        } catch (error) {
            this.setStatus('MODEL LOAD FAILED', 'warning');
            console.error(error);
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
                if (this.currentMode === 'biometric' && !faceMeshDetector.model) {
                    await faceMeshDetector.loadModel();
                }
                
                if (this.currentMode === 'biometric') {
                    document.getElementById('target-selector').disabled = true;
                    detector.isDetecting = false;
                    faceMeshDetector.isDetecting = true;
                    this.setStatus('BIOMETRIC ACTIVE', 'ready');
                } else {
                    document.getElementById('target-selector').disabled = false;
                    faceMeshDetector.isDetecting = false;
                    detector.isDetecting = true;
                    this.setStatus('TRACKING ACTIVE', 'ready');
                }
                
                ui.ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
                ui.updateDashboard({}, 0);
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
                
                if (this.currentMode === 'object') {
                    detector.isDetecting = true;
                    faceMeshDetector.isDetecting = false;
                    this.setStatus('TRACKING ACTIVE', 'ready');
                } else {
                    detector.isDetecting = false;
                    faceMeshDetector.isDetecting = true;
                    if (!faceMeshDetector.model) await faceMeshDetector.loadModel();
                    this.setStatus('BIOMETRIC ACTIVE', 'ready');
                }
                this.detectionLoop();
            } else {
                this.stopCamera();
            }
        } catch (error) {
            this.setStatus('CAMERA ERROR', 'warning');
            alert('Failed to access camera.');
        }
    }

    stopCamera() {
        camera.stop();
        detector.isDetecting = false;
        faceMeshDetector.isDetecting = false;
        this.isCameraActive = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        
        ui.ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
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
            if (this.currentMode === 'object' && detector.isDetecting) {
                const predictions = await detector.detectFrame(camera.videoElement);
                ui.drawDetections(predictions);
            } else if (this.currentMode === 'biometric' && faceMeshDetector.isDetecting) {
                const results = await faceMeshDetector.detectFrame(camera.videoElement);
                ui.drawFaceMesh(results);
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
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
