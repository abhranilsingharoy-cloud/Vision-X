/**
 * UI module for handling canvas drawing and DOM updates.
 */
class UI {
    constructor() {
        this.canvas = document.getElementById('output-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.video = document.getElementById('video');
        this.fpsCounter = document.getElementById('fps-counter');
        this.objectCounter = document.getElementById('object-counter');
        this.liveObjectsList = document.getElementById('live-objects-list');
        this.targetSelector = document.getElementById('target-selector');
        this.alertNotification = document.getElementById('target-alert-notification');
        this.alertText = document.getElementById('target-alert-text');
        this.audioAlertToggle = document.getElementById('audio-alert-toggle');
        this.alertSound = document.getElementById('alert-sound');
        
        // Colors for different classes
        this.colors = [
            '#00f3ff', '#ff003c', '#fcee0a', '#00ff66', '#a200ff'
        ];
        this.classColorMap = new Map();
        
        this.lastAlertTime = 0;
        this.alertCooldown = 3000; // 3 seconds between alerts
        this.populatedClasses = new Set();
    }

    getColor(className) {
        if (!this.classColorMap.has(className)) {
            const colorIndex = this.classColorMap.size % this.colors.length;
            this.classColorMap.set(className, this.colors[colorIndex]);
        }
        return this.classColorMap.get(className);
    }

    setupCanvas(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    drawDetections(predictions) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const counts = {};

        predictions.forEach(pred => {
            const [x, y, width, height] = pred.bbox;
            const className = pred.class;
            const id = pred.id;
            const color = this.getColor(className);

            counts[className] = (counts[className] || 0) + 1;

            // Draw bounding box
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x, y, width, height);
            
            // Draw corners for tactical look
            const cornerSize = 15;
            this.ctx.lineWidth = 4;
            this.ctx.beginPath();
            // TL
            this.ctx.moveTo(x, y + cornerSize); this.ctx.lineTo(x, y); this.ctx.lineTo(x + cornerSize, y);
            // TR
            this.ctx.moveTo(x + width - cornerSize, y); this.ctx.lineTo(x + width, y); this.ctx.lineTo(x + width, y + cornerSize);
            // BL
            this.ctx.moveTo(x, y + height - cornerSize); this.ctx.lineTo(x, y + height); this.ctx.lineTo(x + cornerSize, y + height);
            // BR
            this.ctx.moveTo(x + width - cornerSize, y + height); this.ctx.lineTo(x + width, y + height); this.ctx.lineTo(x + width, y + height - cornerSize);
            this.ctx.stroke();

            // Label
            const label = `[${className.toUpperCase()} : ${id}]`;
            this.ctx.font = '700 12px JetBrains Mono, monospace';
            this.ctx.textBaseline = 'top';
            
            this.ctx.fillStyle = '#000000';
            this.ctx.fillRect(x, y - 20, this.ctx.measureText(label).width + 8, 20);

            this.ctx.fillStyle = color;
            this.ctx.fillText(label, x + 4, y - 16);
            
            // Centroid
            const cx = x + width/2;
            const cy = y + height/2;
            this.ctx.fillStyle = color;
            this.ctx.fillRect(cx - 2, cy - 2, 4, 4);
        });

        this.updateDashboard(counts, predictions.length);
        this.checkAlerts(counts);
    }

    drawFaceMesh(results) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (!results || !results.faces || results.faces.length === 0) {
            this.updateDashboard({ 'NO SIGNAL': 0 }, 0);
            return;
        }

        const faces = results.faces;
        const state = results.eyesState;
        
        // Color based on state
        const color = state === 'CLOSED' ? '#ff003c' : '#00f3ff';

        faces.forEach(face => {
            // Draw mesh points
            this.ctx.fillStyle = color;
            face.keypoints.forEach(point => {
                this.ctx.fillRect(point.x, point.y, 2, 2);
            });

            // Draw bounding box
            if (face.box) {
                const { xMin, yMin, width, height } = face.box;
                this.ctx.strokeStyle = color;
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(xMin, yMin, width, height);
                
                // Draw label
                const label = `EAR: ${results.ear.toFixed(2)} | STATE: ${state}`;
                this.ctx.font = '700 12px JetBrains Mono, monospace';
                this.ctx.textBaseline = 'top';
                this.ctx.fillStyle = '#000';
                this.ctx.fillRect(xMin, yMin - 20, this.ctx.measureText(label).width + 8, 20);
                this.ctx.fillStyle = color;
                this.ctx.fillText(label, xMin + 4, yMin - 16);
            }
        });

        // Dashboard text
        this.updateDashboard({ [`EYES ${state}`]: faces.length }, faces.length);
    }

    updateDashboard(counts, total) {
        this.objectCounter.textContent = total;

        if (total === 0) {
            this.liveObjectsList.innerHTML = '<div class="placeholder">AWAITING TARGETS...</div>';
            return;
        }

        this.liveObjectsList.innerHTML = '';
        for (const [className, count] of Object.entries(counts)) {
            const color = this.getColor(className);
            const badge = document.createElement('div');
            badge.className = 'data-badge';
            badge.style.borderColor = color;
            badge.innerHTML = `
                <span style="color: ${color};"><i class="fas fa-crosshairs"></i> ${className.toUpperCase()}</span>
                <span class="val">[${count}]</span>
            `;
            this.liveObjectsList.appendChild(badge);
            
            if (className !== 'EYES OPEN' && className !== 'EYES CLOSED' && className !== 'EYES CLOSING' && className !== 'NO SIGNAL') {
                if (!this.populatedClasses.has(className)) {
                    this.populatedClasses.add(className);
                    const option = document.createElement('option');
                    option.value = className;
                    option.textContent = className.toUpperCase();
                    this.targetSelector.appendChild(option);
                }
            }
        }
    }

    updateFPS(fps) {
        this.fpsCounter.textContent = Math.round(fps);
    }

    checkAlerts(counts) {
        const target = this.targetSelector.value;
        if (target === 'none') return;

        const now = Date.now();
        if (counts[target] > 0 && (now - this.lastAlertTime > this.alertCooldown)) {
            this.triggerAlert(`TARGET [${target.toUpperCase()}] LOCKED`);
            this.lastAlertTime = now;
        }
    }

    triggerAlert(text) {
        this.alertText.textContent = text;
        this.alertNotification.classList.remove('hidden');
        
        setTimeout(() => {
            this.alertNotification.classList.add('hidden');
        }, 2000);

        if (this.audioAlertToggle.checked) {
            this.alertSound.currentTime = 0;
            this.alertSound.play().catch(e => console.log('Audio blocked', e));
        }
    }
}

const ui = new UI();
