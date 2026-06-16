/**
 * Camera module for handling WebRTC video streams.
 */
class Camera {
    constructor() {
        this.videoElement = document.getElementById('video');
        this.stream = null;
        this.facingMode = 'environment'; // Default to back camera
    }

    /**
     * Starts the camera stream
     * @returns {Promise<void>}
     */
    async start() {
        try {
            if (this.stream) {
                this.stop();
            }

            const constraints = {
                video: {
                    facingMode: this.facingMode,
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                },
                audio: false
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = this.stream;
            
            return new Promise((resolve) => {
                this.videoElement.onloadedmetadata = () => {
                    this.videoElement.play().catch(e => console.warn('Autoplay blocked:', e));
                    resolve();
                };
            });
        } catch (error) {
            console.error('Error accessing camera:', error);
            throw error;
        }
    }

    /**
     * Stops the camera stream
     */
    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.videoElement.srcObject = null;
            this.stream = null;
        }
    }

    /**
     * Toggles between front and back camera
     */
    async flip() {
        this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
        await this.start();
    }

    /**
     * Gets current video dimensions
     * @returns {Object} Width and height of video
     */
    getDimensions() {
        return {
            width: this.videoElement.videoWidth,
            height: this.videoElement.videoHeight
        };
    }
}

const camera = new Camera();
