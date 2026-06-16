/**
 * AI Engine: MoveNet Pose Estimation
 */
class PoseDetector {
    constructor() {
        this.model = null;
        this.isDetecting = false;
        
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.currentFPS = 0;
    }

    async loadModel() {
        try {
            if (typeof app !== 'undefined') app.setStatus('Loading MoveNet Model...', 'warning');
            
            const model = poseDetection.SupportedModels.MoveNet;
            const detectorConfig = {
              modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
              enableSmoothing: true
            };
            
            this.model = await poseDetection.createDetector(model, detectorConfig);
            return true;
        } catch (error) {
            console.error('Failed to load Pose model:', error);
            if (typeof app !== 'undefined') app.setStatus('POSE LOAD FAILED', 'error');
            throw error;
        }
    }

    async detectFrame(video) {
        if (!this.model || !this.isDetecting) return null;

        try {
            const poses = await this.model.estimatePoses(video);
            this.updateFPS();
            return poses;
        } catch (error) {
            console.error('Pose error:', error);
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
            if (typeof ui !== 'undefined') ui.updateFPS(this.currentFPS);
        }
    }
}

const poseDetector = new PoseDetector();
