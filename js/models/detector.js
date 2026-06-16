/**
 * Detection engine module wrapping TensorFlow.js and COCO-SSD
 */
class Detector {
    constructor() {
        this.model = null;
        this.isDetecting = false;
        this.minConfidence = 0.6; // Default 60%
        
        // FPS tracking
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.currentFPS = 0;
    }

    /**
     * Load the COCO-SSD model
     */
    async loadModel() {
        try {
            if (window.app) window.app.setStatus('Initializing WebGPU/WebGL...', 'warning');
            
            // Try WebGPU first for advanced performance
            let backendUsed = 'webgl';
            try {
                const isWebGPUReady = await tf.setBackend('webgpu');
                if (isWebGPUReady) {
                    backendUsed = 'webgpu';
                    console.log("WebGPU backend enabled for advanced acceleration!");
                }
            } catch (e) {
                console.warn("WebGPU not supported on this device, falling back to WebGL.");
                await tf.setBackend('webgl');
            }
            
            await tf.ready();
            if (window.app) window.app.setStatus(`Loading Model (${backendUsed.toUpperCase()})`, 'warning');
            
            this.model = await cocoSsd.load({
                base: 'lite_mobilenet_v2' // Fast model
            });
            return true;
        } catch (error) {
            console.error('Failed to load model:', error);
            throw error;
        }
    }

    /**
     * Run inference on video element
     */
    async detectFrame(video) {
        if (!this.model || !this.isDetecting) return [];

        try {
            // Get predictions
            const rawPredictions = await this.model.detect(video);
            
            // Filter by confidence
            const filtered = rawPredictions.filter(p => p.score >= this.minConfidence);

            // PASS THROUGH TRACKER FOR ADVANCED PERSISTENCE
            const trackedPredictions = tracker.update(filtered);

            // Log new high-confidence objects
            trackedPredictions.forEach(pred => {
                if (Math.random() < 0.05) { // Throttle logging to prevent spam
                    logger.addLog(`${pred.class} #${pred.id}`, pred.score);
                }
            });

            // Calculate FPS
            this.updateFPS();

            return trackedPredictions;
        } catch (error) {
            console.error('Detection error:', error);
            return [];
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
            ui.updateFPS(this.currentFPS);
        }
    }
}

const detector = new Detector();
