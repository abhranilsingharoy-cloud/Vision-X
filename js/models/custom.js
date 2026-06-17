/**
 * Custom AI Training Engine (Transfer Learning)
 * Uses MobileNet as a feature extractor and KNN to classify custom objects.
 */
class CustomTrainer {
    constructor() {
        this.classifier = null;
        this.mobilenetModel = null;
        this.isDetecting = false;
        this.isTraining = false;
        this.trainingProgress = 0;
        this.classes = new Map(); // map integer ID to string name
        this.nextClassId = 0;
    }

    async loadModel() {
        try {
            if (typeof app !== 'undefined') app.setStatus('Loading MobileNet & KNN...', 'warning');
            
            this.classifier = knnClassifier.create();
            this.mobilenetModel = await mobilenet.load({ version: 2, alpha: 1.0 });
            
            return true;
        } catch (error) {
            console.error('Failed to load Custom AI models:', error);
            if (typeof app !== 'undefined') app.setStatus('CUSTOM AI LOAD FAILED', 'error');
            throw error;
        }
    }

    clearModel() {
        if (this.classifier) {
            this.classifier.clearAllClasses();
            this.classes.clear();
            this.nextClassId = 0;
            if (typeof logger !== 'undefined') logger.addLog('CUSTOM AI MEMORY WIPED', 0);
        }
    }

    async trainClass(className, video, samples = 30) {
        if (!this.classifier || !this.mobilenetModel) await this.loadModel();
        
        this.isTraining = true;
        this.trainingProgress = 0;

        // Assign a new numeric ID for the class
        const classId = this.nextClassId++;
        this.classes.set(classId, className);

        if (typeof logger !== 'undefined') logger.addLog(`TRAINING: ${className.toUpperCase()}`, 0);
        if (typeof voiceAssistant !== 'undefined') voiceAssistant.speak(`Learning object: ${className}. Please hold it in view.`);

        for (let i = 0; i < samples; i++) {
            // Wait for next animation frame to capture a fresh frame from video
            await new Promise(resolve => requestAnimationFrame(resolve));
            
            const activation = this.mobilenetModel.infer(video, 'conv_preds');
            this.classifier.addExample(activation, classId);
            
            this.trainingProgress = Math.round(((i + 1) / samples) * 100);
        }

        this.isTraining = false;
        this.trainingProgress = 0;
        
        if (typeof logger !== 'undefined') logger.addLog(`TRAINING COMPLETE: ${className.toUpperCase()}`, 1.0);
        if (typeof voiceAssistant !== 'undefined') voiceAssistant.speak(`Training complete for ${className}.`);
    }

    async detectFrame(video) {
        if (!this.classifier || !this.mobilenetModel || !this.isDetecting || this.isTraining) return null;
        if (this.classifier.getNumClasses() === 0) return { label: 'NO DATA', confidence: 0 };

        try {
            const activation = this.mobilenetModel.infer(video, 'conv_preds');
            const result = await this.classifier.predictClass(activation);
            
            const className = this.classes.get(Number(result.label)) || 'UNKNOWN';
            
            return {
                label: className,
                confidence: result.confidences[result.label]
            };
        } catch (error) {
            console.error('Custom prediction error:', error);
            return null;
        }
    }
}

const customAI = new CustomTrainer();
