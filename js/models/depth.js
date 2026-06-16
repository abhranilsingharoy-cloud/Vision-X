class DepthEngine {
    constructor() {
        this.estimator = null;
        this.isDetecting = false;
    }

    async loadModel() {
        try {
            if (typeof app !== 'undefined') app.setStatus('Loading Depth Model...', 'warning');
            
            // Wait for TFJS Depth Estimation to become available
            if (!window.depthEstimation) {
                console.warn("Depth estimation library not loaded.");
                return false;
            }

            const model = depthEstimation.SupportedModels.ARPortraitDepth;
            this.estimator = await depthEstimation.createEstimator(model);
            console.log("Depth Estimation model loaded.");
            return true;
        } catch (error) {
            console.error("Failed to load depth model. Will fallback to Monocular Size Calculation.", error);
            // Non-blocking error
            return false;
        }
    }

    async detectFrame(video) {
        if (!this.estimator || !this.isDetecting) return null;
        try {
            const depthMap = await this.estimator.estimateDepth(video);
            return depthMap;
        } catch (e) {
            console.error("Depth estimation error", e);
            return null;
        }
    }
}

const depthEngine = new DepthEngine();
