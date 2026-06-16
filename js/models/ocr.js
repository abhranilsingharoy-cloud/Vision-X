/**
 * AI Engine: Tesseract Optical Character Recognition
 */
class OCRDetector {
    constructor() {
        this.worker = null;
        this.isDetecting = false;
        this.isProcessing = false;
        this.lastResults = null;
    }

    async loadModel() {
        try {
            if (typeof app !== 'undefined') app.setStatus('Loading Tesseract OCR...', 'warning');
            
            this.worker = await Tesseract.createWorker('eng');
            
            if (typeof app !== 'undefined') app.setStatus('SYSTEM READY', 'ready');
            return true;
        } catch (error) {
            console.error('Failed to load OCR model:', error);
            if (typeof app !== 'undefined') app.setStatus('OCR LOAD FAILED', 'error');
            throw error;
        }
    }

    async detectFrame(video) {
        if (!this.worker || !this.isDetecting) return this.lastResults;
        
        // OCR is slow. We only process 1 frame at a time and hold results
        if (this.isProcessing) return this.lastResults;
        
        this.isProcessing = true;
        
        try {
            // Draw video to a temporary canvas for Tesseract extraction
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = video.videoWidth;
            tempCanvas.height = video.videoHeight;
            const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(video, 0, 0);
            
            const result = await this.worker.recognize(tempCanvas);
            this.lastResults = result.data;
            this.isProcessing = false;
            return this.lastResults;
        } catch (error) {
            console.error('OCR error:', error);
            this.isProcessing = false;
            return this.lastResults;
        }
    }
}

const ocrDetector = new OCRDetector();
