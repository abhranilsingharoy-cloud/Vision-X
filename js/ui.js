/**
 * UI module for rendering all 7 modes.
 */
class UI {
    constructor() {
        this.canvas = document.getElementById('output-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.video = document.getElementById('video');
        
        // Dashboard elements
        this.fpsCounter = document.getElementById('fps-counter');
        this.objectCounter = document.getElementById('object-counter');
        this.liveObjectsList = document.getElementById('live-objects-list');
        this.targetSelector = document.getElementById('target-selector');
        this.alertNotification = document.getElementById('target-alert-notification');
        this.alertText = document.getElementById('target-alert-text');
        this.audioAlertToggle = document.getElementById('audio-alert-toggle');
        this.alertSound = document.getElementById('alert-sound');
        
        this.colors = ['#00f3ff', '#ff003c', '#fcee0a', '#00ff66', '#a200ff'];
        this.classColorMap = new Map();
        
        this.lastAlertTime = 0;
        this.alertCooldown = 3000;
        this.populatedClasses = new Set();
        
        // Tripwire state
        this.tripwireCounts = { left: 0, right: 0 };
        this.lastCentroids = {};
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

    resetContext() {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.filter = 'none';
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // MODE 1: General Tracking
    drawDetections(predictions) {
        this.resetContext();
        const counts = {};

        predictions.forEach(pred => {
            const [x, y, width, height] = pred.bbox;
            const className = pred.class;
            const id = pred.id || Math.floor(Math.random()*1000);
            const color = this.getColor(className);

            counts[className] = (counts[className] || 0) + 1;

            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x, y, width, height);
            
            const cornerSize = 15;
            this.ctx.lineWidth = 4;
            this.ctx.beginPath();
            this.ctx.moveTo(x, y + cornerSize); this.ctx.lineTo(x, y); this.ctx.lineTo(x + cornerSize, y);
            this.ctx.moveTo(x + width - cornerSize, y); this.ctx.lineTo(x + width, y); this.ctx.lineTo(x + width, y + cornerSize);
            this.ctx.moveTo(x, y + height - cornerSize); this.ctx.lineTo(x, y + height); this.ctx.lineTo(x + cornerSize, y + height);
            this.ctx.moveTo(x + width - cornerSize, y + height); this.ctx.lineTo(x + width, y + height); this.ctx.lineTo(x + width, y + height - cornerSize);
            this.ctx.stroke();

            const label = `[${className.toUpperCase()} : ${id}]`;
            this.ctx.font = '700 12px JetBrains Mono, monospace';
            this.ctx.textBaseline = 'top';
            this.ctx.fillStyle = '#000000';
            this.ctx.fillRect(x, y - 20, this.ctx.measureText(label).width + 8, 20);
            this.ctx.fillStyle = color;
            this.ctx.fillText(label, x + 4, y - 16);
            
            const cx = x + width/2;
            const cy = y + height/2;
            this.ctx.fillStyle = color;
            this.ctx.fillRect(cx - 2, cy - 2, 4, 4);
        });

        this.updateDashboard(counts, predictions.length);
        this.checkAlerts(counts);
    }

    // MODE 2: Security Sentry
    drawSecurityMode(predictions) {
        this.resetContext();
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        const people = predictions.filter(p => p.class === 'person');
        
        people.forEach(pred => {
            const [x, y, width, height] = pred.bbox;
            const id = pred.id || 'U';
            
            this.ctx.strokeStyle = '#ff003c';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(x, y, width, height);
            
            this.ctx.fillStyle = 'rgba(255, 0, 60, 0.2)';
            this.ctx.fillRect(x, y, width, height);

            const label = `THREAT : ${id}`;
            this.ctx.font = '700 14px JetBrains Mono';
            this.ctx.textBaseline = 'top';
            this.ctx.fillStyle = '#ff003c';
            this.ctx.fillText(label, x, y - 20);
        });

        if (people.length > 0) {
            this.triggerAlert("INTRUDER DETECTED");
            if(window.logger && Math.random() < 0.05) logger.addLog("INTRUDER DETECTED", 1.0);
        }

        this.updateDashboard({'THREATS': people.length}, people.length);
    }

    // MODE 3: Analytics Tripwire
    drawTripwireMode(predictions) {
        this.resetContext();
        
        const lineX = this.canvas.width / 2;
        
        this.ctx.strokeStyle = '#fcee0a';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.moveTo(lineX, 0);
        this.ctx.lineTo(lineX, this.canvas.height);
        this.ctx.stroke();

        let currentCentroids = {};
        let total = 0;

        predictions.forEach(pred => {
            if(!pred.id) return;
            total++;
            const [x, y, width, height] = pred.bbox;
            const cx = x + width/2;
            const cy = y + height/2;
            currentCentroids[pred.id] = cx;

            if (this.lastCentroids[pred.id] !== undefined) {
                const prevX = this.lastCentroids[pred.id];
                if (prevX < lineX && cx >= lineX) {
                    this.tripwireCounts.right++;
                    if(window.logger) logger.addLog(`ID ${pred.id} CROSSED RIGHT`, 1.0);
                } else if (prevX > lineX && cx <= lineX) {
                    this.tripwireCounts.left++;
                    if(window.logger) logger.addLog(`ID ${pred.id} CROSSED LEFT`, 1.0);
                }
            }

            this.ctx.fillStyle = '#00f3ff';
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, 5, 0, 2*Math.PI);
            this.ctx.fill();
        });

        this.lastCentroids = currentCentroids;

        this.ctx.font = '800 24px JetBrains Mono';
        this.ctx.fillStyle = '#00f3ff';
        this.ctx.fillText(`LEFT: ${this.tripwireCounts.left}`, 20, 40);
        this.ctx.fillText(`RIGHT: ${this.tripwireCounts.right}`, lineX + 20, 40);

        this.updateDashboard({
            'LEFT CROSSED': this.tripwireCounts.left,
            'RIGHT CROSSED': this.tripwireCounts.right
        }, total);
    }

    // MODE 4: Privacy Redaction
    drawPrivacyMode(predictions) {
        this.resetContext();
        
        const people = predictions.filter(p => p.class === 'person');
        
        people.forEach(pred => {
            const [x, y, width, height] = pred.bbox;
            
            this.ctx.fillStyle = '#000000';
            this.ctx.fillRect(x, y, width, height);
            
            this.ctx.strokeStyle = '#00ff66';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x, y, width, height);
            
            this.ctx.font = '700 12px JetBrains Mono';
            this.ctx.fillStyle = '#00ff66';
            this.ctx.fillText('[REDACTED]', x + 5, y + height / 2);
        });

        this.updateDashboard({'REDACTED': people.length}, people.length);
    }

    // MODE 5: Pose Estimation
    drawPoseMode(poses) {
        this.resetContext();
        if (!poses || poses.length === 0) {
            this.updateDashboard({'POSES': 0}, 0);
            return;
        }

        poses.forEach(pose => {
            if(pose.score < 0.3) return;

            pose.keypoints.forEach(kp => {
                if (kp.score > 0.3) {
                    this.ctx.fillStyle = '#fcee0a';
                    this.ctx.beginPath();
                    this.ctx.arc(kp.x, kp.y, 4, 0, 2*Math.PI);
                    this.ctx.fill();
                }
            });

            if(poseDetection.util.getAdjacentPairs) {
                const adjacentKeyPoints = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet);
                this.ctx.strokeStyle = '#00f3ff';
                this.ctx.lineWidth = 2;
                adjacentKeyPoints.forEach(([i, j]) => {
                    const kp1 = pose.keypoints[i];
                    const kp2 = pose.keypoints[j];
                    if (kp1.score > 0.3 && kp2.score > 0.3) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(kp1.x, kp1.y);
                        this.ctx.lineTo(kp2.x, kp2.y);
                        this.ctx.stroke();
                    }
                });
            }
        });

        this.updateDashboard({'POSES': poses.length}, poses.length);
    }

    // MODE 6: Smart Focus
    drawFocusMode(predictions) {
        this.resetContext();
        const people = predictions.filter(p => p.class === 'person');
        
        if (people.length > 0) {
            let target = people[0];
            let maxArea = 0;
            people.forEach(p => {
                const area = p.bbox[2] * p.bbox[3];
                if (area > maxArea) {
                    maxArea = area;
                    target = p;
                }
            });

            const [x, y, width, height] = target.bbox;
            
            this.ctx.fillStyle = 'rgba(0,0,0,0.85)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.fillStyle = 'white';
            this.ctx.fillRect(x - 20, y - 20, width + 40, height + 40);
            
            this.ctx.globalCompositeOperation = 'source-over';
            
            this.ctx.strokeStyle = '#00ff66';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(x - 20, y - 20, width + 40, height + 40);
            
            this.ctx.font = '700 16px JetBrains Mono';
            this.ctx.fillStyle = '#00ff66';
            this.ctx.fillText('TARGET ACQUIRED', x - 20, y - 30);
            
            this.updateDashboard({'TRACKED TARGETS': 1}, 1);
        } else {
            this.updateDashboard({'TRACKED TARGETS': 0}, 0);
        }
    }

    // MODE 7: Biometric
    drawFaceMesh(results) {
        this.resetContext();
        if (!results || !results.faces || results.faces.length === 0) {
            this.updateDashboard({ 'NO SIGNAL': 0 }, 0);
            return;
        }

        const faces = results.faces;
        const state = results.eyesState;
        const color = state === 'CLOSED' ? '#ff003c' : '#00f3ff';

        faces.forEach(face => {
            this.ctx.fillStyle = color;
            face.keypoints.forEach(point => {
                this.ctx.fillRect(point.x, point.y, 2, 2);
            });

            if (face.box) {
                const { xMin, yMin, width, height } = face.box;
                this.ctx.strokeStyle = color;
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(xMin, yMin, width, height);
                
                const label = `EAR: ${results.ear.toFixed(2)} | STATE: ${state}`;
                this.ctx.font = '700 12px JetBrains Mono';
                this.ctx.fillStyle = '#000';
                this.ctx.fillRect(xMin, yMin - 20, this.ctx.measureText(label).width + 8, 20);
                this.ctx.fillStyle = color;
                this.ctx.fillText(label, xMin + 4, yMin - 16);
            }
        });

        this.updateDashboard({ [`EYES ${state}`]: faces.length }, faces.length);
    }

    // Common Helpers
    updateDashboard(counts, total) {
        if(!this.objectCounter) return;
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
            
            if (!this.populatedClasses.has(className) && !className.includes('EYES') && className !== 'THREATS' && !className.includes('CROSSED') && className !== 'REDACTED' && className !== 'POSES' && className !== 'TRACKED TARGETS') {
                this.populatedClasses.add(className);
                const option = document.createElement('option');
                option.value = className;
                option.textContent = className.toUpperCase();
                if(this.targetSelector) this.targetSelector.appendChild(option);
            }
        }
    }

    updateFPS(fps) {
        if(this.fpsCounter) this.fpsCounter.textContent = Math.round(fps);
    }

    checkAlerts(counts) {
        if(!this.targetSelector) return;
        const target = this.targetSelector.value;
        if (target === 'none') return;

        const now = Date.now();
        if (counts[target] > 0 && (now - this.lastAlertTime > this.alertCooldown)) {
            this.triggerAlert(`TARGET [${target.toUpperCase()}] LOCKED`);
            this.lastAlertTime = now;
        }
    }

    triggerAlert(text) {
        if(!this.alertText) return;
        this.alertText.textContent = text;
        this.alertNotification.classList.remove('hidden');
        
        setTimeout(() => {
            this.alertNotification.classList.add('hidden');
        }, 2000);

        if (this.audioAlertToggle && this.audioAlertToggle.checked && this.alertSound) {
            this.alertSound.currentTime = 0;
            this.alertSound.play().catch(e => console.log('Audio blocked', e));
        }
    }
}

const ui = new UI();
