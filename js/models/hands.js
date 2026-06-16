/**
 * AI Engine: Hand Gesture Detection
 */
class HandDetector {
    constructor() {
        this.model = null;
        this.isDetecting = false;
        
        this.lastX = null;
        this.cooldown = 0;
    }

    async loadModel() {
        try {
            if (typeof app !== 'undefined') app.setStatus('Loading HandPose...', 'warning');
            
            const model = handPoseDetection.SupportedModels.MediaPipeHands;
            const detectorConfig = {
              runtime: 'mediapipe',
              solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands',
              modelType: 'lite'
            };
            
            this.model = await handPoseDetection.createDetector(model, detectorConfig);
            if (typeof app !== 'undefined') app.setStatus('SYSTEM READY', 'ready');
            return true;
        } catch (error) {
            console.error('Failed to load HandPose model:', error);
            if (typeof app !== 'undefined') app.setStatus('HANDPOSE LOAD FAILED', 'error');
            throw error;
        }
    }

    async detectFrame(video) {
        if (!this.model || !this.isDetecting) return null;
        try {
            const hands = await this.model.estimateHands(video);
            
            if (this.cooldown > 0) this.cooldown--;

            if (hands.length > 0 && this.cooldown === 0) {
                const hand = hands[0];
                const indexTip = hand.keypoints.find(k => k.name === 'index_finger_tip');
                
                if (indexTip) {
                    if (this.lastX !== null) {
                        const deltaX = indexTip.x - this.lastX;
                        
                        // Swipe threshold
                        if (Math.abs(deltaX) > 120) {
                            if (deltaX > 0) {
                                // Swipe Right -> Previous Mode
                                this.triggerSwipe(-1);
                            } else {
                                // Swipe Left -> Next Mode
                                this.triggerSwipe(1);
                            }
                            this.cooldown = 40; // Cooldown frames
                        }
                    }
                    this.lastX = indexTip.x;
                }
                
                // Draw hand skeleton overlay if desired
                if (typeof ui !== 'undefined' && hands.length > 0) {
                    ui.drawHandOverlay(hands);
                }
            } else {
                this.lastX = null;
            }

            return hands;
        } catch (error) {
            console.error('HandPose error:', error);
            return null;
        }
    }

    triggerSwipe(direction) {
        if (typeof app !== 'undefined' && app.modeSelector) {
            const select = app.modeSelector;
            let idx = select.selectedIndex + direction;
            if (idx < 0) idx = select.options.length - 1;
            if (idx >= select.options.length) idx = 0;
            
            select.selectedIndex = idx;
            select.dispatchEvent(new Event('change'));
            
            if (typeof ui !== 'undefined') ui.triggerAlert("GESTURE: SWIPE DETECTED");
            if (typeof voiceAssistant !== 'undefined') voiceAssistant.speak("Gesture accepted.");
        }
    }
}

const handDetector = new HandDetector();
