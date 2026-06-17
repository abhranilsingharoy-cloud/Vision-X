const cocoClasses = [
    'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
    'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog',
    'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella',
    'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball', 'kite',
    'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket', 'bottle',
    'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich',
    'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
    'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote',
    'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book',
    'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
];

class UI {
    constructor() {
        this.canvas = document.getElementById('output-canvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false, willReadFrequently: true });
        this.ctx.imageSmoothingEnabled = false; // Optimize rendering speed

        this.dashboard = document.getElementById('dashboard-content');
        this.objectCounter = document.getElementById('object-counter');
        
        // Predictive Heatmap Accumulation
        this.heatmapCanvas = document.createElement('canvas');
        this.heatmapCtx = this.heatmapCanvas.getContext('2d', { willReadFrequently: true });
        
        this.video = document.getElementById('video');
        
        this.video.style.opacity = '0';
        
        this.fpsCounter = document.getElementById('fps-counter');
        this.objectCounter = document.getElementById('object-counter');
        this.liveObjectsList = document.getElementById('live-objects-list');
        this.targetSelector = document.getElementById('target-selector');
        this.alertNotification = document.getElementById('target-alert-notification');
        this.alertText = document.getElementById('target-alert-text');
        this.audioAlertToggle = document.getElementById('audio-alert-toggle');
        this.alertSound = document.getElementById('alert-sound');
        
        this.sensitivitySlider = document.getElementById('sensitivity-slider');
        this.sensitivityVal = document.getElementById('sensitivity-val');
        if (this.sensitivitySlider) {
            this.sensitivitySlider.addEventListener('input', (e) => {
                if (this.sensitivityVal) this.sensitivityVal.textContent = e.target.value + '%';
            });
        }

        this.colors = ['#00f3ff', '#ff003c', '#fcee0a', '#00ff66', '#a200ff'];
        this.classColorMap = new Map();
        
        this.lastAlertTime = 0;
        this.alertCooldown = 3000;
        
        this.initTargetDropdown();
        
        this.tripwireCounts = { left: 0, right: 0 };
        this.lastCentroids = {};
        this.trails = {}; 
        
        this.securityLockdownEnd = 0;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        
        this.focusBox = { x: 0, y: 0, width: 0, height: 0, active: false };
    }

    initTargetDropdown() {
        if (!this.targetSelector) return;
        this.targetSelector.innerHTML = '<option value="none">DISABLED</option>';
        cocoClasses.forEach(c => {
            const option = document.createElement('option');
            option.value = c;
            option.textContent = c.toUpperCase();
            this.targetSelector.appendChild(option);
        });
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
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawVideoFeed() {
        if (this.video && this.video.videoWidth > 0 && 
            (this.canvas.width !== this.video.videoWidth || this.canvas.height !== this.video.videoHeight)) {
            this.setupCanvas(this.video.videoWidth, this.video.videoHeight);
        }

        const shader = document.getElementById('shader-selector')?.value || 'none';
        
        if (shader === 'nightvision') {
            this.ctx.filter = 'contrast(150%) brightness(150%) sepia(100%) hue-rotate(80deg) saturate(300%)';
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            this.ctx.filter = 'none';
            
            // Render scanlines
            this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
            for(let i=0; i<this.canvas.height; i+=4) {
                this.ctx.fillRect(0, i, this.canvas.width, 2);
            }
        } else if (shader === 'thermal') {
            // Simulated Thermal
            this.ctx.filter = 'invert(100%) sepia(100%) saturate(1000%) hue-rotate(290deg) contrast(200%)';
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            this.ctx.filter = 'none';
        } else {
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        }
    }

    // MODE 1: General Tracking + Depth
    drawDetections(predictions, depthMap) {
        this.resetContext();
        this.drawVideoFeed();
        
        const counts = {};
        const targetClass = this.targetSelector ? this.targetSelector.value : 'none';
        const sensitivity = this.sensitivitySlider ? parseInt(this.sensitivitySlider.value) / 100 : 0.6;
        let targetDetected = false;

        predictions.forEach(pred => {
            const [x, y, width, height] = pred.bbox;
            const className = pred.class;
            const id = pred.id || Math.floor(Math.random()*1000);
            const score = pred.score;
            
            counts[className] = (counts[className] || 0) + 1;
            
            const isTarget = (className === targetClass && score >= sensitivity);
            
            // Depth Calculation (Actual model or fallback proxy)
            let depthStr = "";
            if (className === 'person') {
                if (depthMap && typeof depthMap.getDepth === 'function') {
                    try { 
                        depthStr = " " + depthMap.getDepth(y + height/2, x + width/2).toFixed(2) + "m"; 
                    } catch(e){}
                } else {
                    const focalLength = 500;
                    const distance = (1.7 * focalLength) / height;
                    depthStr = " " + distance.toFixed(1) + "m";
                }
            }

            if (isTarget) {
                targetDetected = true;
                const color = '#ff003c'; 
                
                this.ctx.strokeStyle = color;
                this.ctx.lineWidth = 3;
                this.ctx.strokeRect(x, y, width, height);
                
                const cx = x + width/2;
                const cy = y + height/2;
                this.ctx.beginPath();
                this.ctx.moveTo(cx, y); this.ctx.lineTo(cx, y + 20); 
                this.ctx.moveTo(cx, y + height); this.ctx.lineTo(cx, y + height - 20); 
                this.ctx.moveTo(x, cy); this.ctx.lineTo(x + 20, cy); 
                this.ctx.moveTo(x + width, cy); this.ctx.lineTo(x + width - 20, cy); 
                this.ctx.stroke();
                
                const label = `LOCKED: ${className.toUpperCase()}${depthStr} [${(score*100).toFixed(0)}%]`;
                this.ctx.font = '800 14px JetBrains Mono';
                this.ctx.textBaseline = 'top';
                this.ctx.fillStyle = color;
                this.ctx.fillText(label, x, y - 20);
                
            } else {
                const color = this.getColor(className);
                this.ctx.strokeStyle = color;
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(x, y, width, height);
                
                // Advanced corner brackets
                const cornerSize = 15;
                this.ctx.lineWidth = 4;
                this.ctx.beginPath();
                this.ctx.moveTo(x, y + cornerSize); this.ctx.lineTo(x, y); this.ctx.lineTo(x + cornerSize, y);
                this.ctx.moveTo(x + width - cornerSize, y); this.ctx.lineTo(x + width, y); this.ctx.lineTo(x + width, y + cornerSize);
                this.ctx.moveTo(x, y + height - cornerSize); this.ctx.lineTo(x, y + height); this.ctx.lineTo(x + cornerSize, y + height);
                this.ctx.moveTo(x + width - cornerSize, y + height); this.ctx.lineTo(x + width, y + height); this.ctx.lineTo(x + width, y + height - cornerSize);
                this.ctx.stroke();

                // Dynamic scanning reticle
                const time = Date.now() / 1000;
                const dashOffset = (time * 50) % 20;
                this.ctx.setLineDash([5, 5]);
                this.ctx.lineDashOffset = dashOffset;
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(x + width/2, y); this.ctx.lineTo(x + width/2, y + height);
                this.ctx.moveTo(x, y + height/2); this.ctx.lineTo(x + width, y + height/2);
                this.ctx.stroke();
                this.ctx.setLineDash([]);

                const label = `[${className.toUpperCase()}${depthStr} : ${id}]`;
                this.ctx.font = '700 12px JetBrains Mono';
                this.ctx.textBaseline = 'top';
                this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
                this.ctx.fillRect(x, y - 20, this.ctx.measureText(label).width + 8, 20);
                this.ctx.fillStyle = color;
                this.ctx.fillText(label, x + 4, y - 16);
                
                const cx = x + width/2;
                const cy = y + height/2;
                this.ctx.fillStyle = color;
                this.ctx.fillRect(cx - 3, cy - 3, 6, 6);
            }
        });

        // Global Grid Overlay
        this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.1)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        for(let i=0; i<this.canvas.width; i+=50) { this.ctx.moveTo(i, 0); this.ctx.lineTo(i, this.canvas.height); }
        for(let j=0; j<this.canvas.height; j+=50) { this.ctx.moveTo(0, j); this.ctx.lineTo(this.canvas.width, j); }
        this.ctx.stroke();

        this.updateDashboard(counts, predictions.length);
        if (targetDetected) this.checkAlerts(targetClass);
    }

    // MODE 8: FUSION MODE
    drawFusionMode(predictions, poses) {
        this.resetContext();
        this.drawVideoFeed();
        
        const validPoses = poses || [];
        const validPreds = predictions || [];
        
        // Draw Skeletons FIRST
        if (validPoses.length > 0) {
            validPoses.forEach(pose => {
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
                    this.ctx.lineWidth = 3;
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
        }
        
        // Draw Object Boxes Over Top
        validPreds.forEach(pred => {
            const [x, y, width, height] = pred.bbox;
            const className = pred.class;
            if (className !== 'person') return; // In fusion, focus on person
            
            this.ctx.strokeStyle = '#ff003c';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x, y, width, height);
            
            // Advanced Fusion Lock Reticle
            const cx = x + width/2;
            const cy = y + height/2;
            const time = Date.now() / 500;
            this.ctx.save();
            this.ctx.translate(cx, cy);
            this.ctx.rotate(time);
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 40, 0, Math.PI * 1.5);
            this.ctx.strokeStyle = 'rgba(255, 0, 60, 0.8)';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
            this.ctx.restore();
            
            this.ctx.beginPath();
            this.ctx.moveTo(x, cy); this.ctx.lineTo(x + width, cy);
            this.ctx.moveTo(cx, y); this.ctx.lineTo(cx, y + height);
            this.ctx.strokeStyle = 'rgba(255, 0, 60, 0.3)';
            this.ctx.stroke();

            const label = `[FUSION LOCK]`;
            this.ctx.font = '700 12px JetBrains Mono';
            this.ctx.fillStyle = '#ff003c';
            this.ctx.fillText(label, x, y - 5);
        });

        this.updateDashboard({'FUSION SKELETONS': validPoses.length}, validPoses.length);
    }

    // MODE 2: Security Sentry + DVR
    drawSecurityMode(predictions) {
        this.resetContext();
        
        const now = Date.now();
        const people = predictions.filter(p => p.class === 'person');
        
        let inLockdown = false;
        if (people.length > 0) {
            this.securityLockdownEnd = now + 5000;
        }
        if (now < this.securityLockdownEnd) {
            inLockdown = true;
        }

        // DVR Logic
        if (inLockdown && !this.isRecording) {
            this.startRecording();
        } else if (!inLockdown && this.isRecording) {
            this.stopRecording();
        }

        if (inLockdown) {
            this.ctx.filter = 'grayscale(100%) brightness(40%)';
            this.drawVideoFeed();
            this.ctx.filter = 'none';
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            if (this.isRecording) {
                if (Math.floor(Date.now() / 500) % 2 === 0) { // Flashing REC
                    this.ctx.fillStyle = '#ff003c';
                    this.ctx.font = '800 16px JetBrains Mono';
                    this.ctx.fillText('🔴 REC', 20, 30);
                }
            }
        } else {
            this.ctx.filter = 'grayscale(100%) brightness(70%) contrast(120%)';
            this.drawVideoFeed();
            this.ctx.filter = 'none';
            this.ctx.fillStyle = 'rgba(0, 255, 100, 0.05)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Add Tactical Camera Metadata
        this.ctx.font = '700 12px JetBrains Mono';
        this.ctx.fillStyle = '#00f3ff';
        this.ctx.fillText(`CAM_01 | SEC_SYS_V2.0 | ${new Date().toISOString()}`, 20, this.canvas.height - 20);
        
        people.forEach(pred => {
            const [x, y, width, height] = pred.bbox;
            const id = pred.id || 'U';
            
            const screenArea = this.canvas.width * this.canvas.height;
            const targetArea = width * height;
            const sizeRatio = targetArea / screenArea;
            let threatLevel = "LOW";
            if (sizeRatio > 0.1) threatLevel = "MEDIUM";
            if (sizeRatio > 0.25) threatLevel = "HIGH (DEFCON 1)";
            
            this.ctx.strokeStyle = '#ff003c';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(x, y, width, height);
            
            this.ctx.fillStyle = 'rgba(255, 0, 60, 0.2)';
            this.ctx.fillRect(x, y, width, height);

            const label = `THREAT : ${id} | LVL: ${threatLevel}`;
            this.ctx.font = '700 14px JetBrains Mono';
            this.ctx.textBaseline = 'top';
            this.ctx.fillStyle = '#ff003c';
            this.ctx.shadowColor = 'rgba(0,0,0,1)';
            this.ctx.shadowBlur = 6;
            this.ctx.fillText(label, x, y - 20);
            this.ctx.shadowBlur = 0;
        });

        if (people.length > 0) {
            this.triggerAlert("INTRUDER DETECTED");
            if(typeof logger !== 'undefined' && Math.random() < 0.05) logger.addLog("INTRUDER DETECTED", 1.0);
        } else if (inLockdown) {
            this.triggerAlert("LOCKDOWN ACTIVE");
        }

        this.updateDashboard({'THREATS': people.length}, people.length);
    }

    startRecording() {
        const stream = this.canvas.captureStream(30);
        this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        this.recordedChunks = [];
        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.recordedChunks.push(e.data);
        };
        this.mediaRecorder.onstop = () => {
            const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `security-breach-${Date.now()}.webm`;
            a.click();
            URL.revokeObjectURL(url);
            if (typeof voiceAssistant !== 'undefined') voiceAssistant.speak("Security footage saved to local storage.");
        };
        this.mediaRecorder.start();
        this.isRecording = true;
        if (typeof logger !== 'undefined') logger.addLog("DVR RECORDING STARTED", 1.0);
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            if (typeof logger !== 'undefined') logger.addLog("DVR RECORDING SAVED", 1.0);
        }
    }

    // MODE 3: Analytics Tripwire
    drawTripwireMode(predictions) {
        this.resetContext();
        this.drawVideoFeed();
        
        const lineX = this.canvas.width / 2;
        
        // Glowing Tripwire Beam
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = '#fcee0a';
        this.ctx.strokeStyle = '#fcee0a';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.moveTo(lineX, 0);
        this.ctx.lineTo(lineX, this.canvas.height);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0; // Reset
        
        // Animated Energy Particle
        const time = Date.now() / 1000;
        const particleY = (time * 150) % this.canvas.height;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(lineX, particleY, 8, 0, Math.PI * 2);
        this.ctx.fill();

        let currentCentroids = {};
        let total = 0;

        predictions.forEach(pred => {
            if(!pred.id) return;
            total++;
            const [x, y, width, height] = pred.bbox;
            const cx = x + width/2;
            const cy = y + height/2;
            currentCentroids[pred.id] = cx;

            if (!this.trails[pred.id]) this.trails[pred.id] = [];
            this.trails[pred.id].push({x: cx, y: cy});
            if (this.trails[pred.id].length > 20) this.trails[pred.id].shift();

            if (this.trails[pred.id].length > 1) {
                this.ctx.beginPath();
                this.ctx.strokeStyle = '#a200ff';
                this.ctx.lineWidth = 3;
                this.ctx.moveTo(this.trails[pred.id][0].x, this.trails[pred.id][0].y);
                for(let i=1; i<this.trails[pred.id].length; i++) {
                    this.ctx.lineTo(this.trails[pred.id][i].x, this.trails[pred.id][i].y);
                }
                this.ctx.stroke();
            }

            if (this.lastCentroids[pred.id] !== undefined) {
                const prevX = this.lastCentroids[pred.id];
                if (prevX < lineX && cx >= lineX) {
                    this.tripwireCounts.right++;
                    if(typeof logger !== 'undefined') logger.addLog(`ID ${pred.id} CROSSED RIGHT`, 1.0);
                } else if (prevX > lineX && cx <= lineX) {
                    this.tripwireCounts.left++;
                    if(typeof logger !== 'undefined') logger.addLog(`ID ${pred.id} CROSSED LEFT`, 1.0);
                }
            }

            this.ctx.fillStyle = '#00f3ff';
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, 5, 0, 2*Math.PI);
            this.ctx.fill();
        });

        for (let id in this.trails) {
            if (!currentCentroids[id]) delete this.trails[id];
        }
        this.lastCentroids = currentCentroids;

        this.ctx.font = '800 24px JetBrains Mono';
        this.ctx.fillStyle = '#00f3ff';
        this.ctx.shadowColor = 'rgba(0,0,0,0.9)';
        this.ctx.shadowBlur = 8;
        this.ctx.fillText(`LEFT: ${this.tripwireCounts.left}`, 20, 40);
        this.ctx.fillText(`RIGHT: ${this.tripwireCounts.right}`, lineX + 20, 40);
        this.ctx.shadowBlur = 0;

        this.updateDashboard({
            'LEFT CROSSED': this.tripwireCounts.left,
            'RIGHT CROSSED': this.tripwireCounts.right
        }, total);
    }

    // MODE 4: Privacy Redaction
    drawPrivacyMode(predictions) {
        this.resetContext();
        this.drawVideoFeed();
        
        const people = predictions.filter(p => p.class === 'person');
        
        people.forEach(pred => {
            let [x, y, width, height] = pred.bbox;
            const pad = 20;
            x -= pad; y -= pad; width += pad*2; height += pad*2;
            if(x < 0) x = 0;
            if(y < 0) y = 0;
            if(x+width > this.canvas.width) width = this.canvas.width - x;
            if(y+height > this.canvas.height) height = this.canvas.height - y;
            
            const pxSize = 25; 
            this.ctx.imageSmoothingEnabled = false;
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width / pxSize;
            tempCanvas.height = height / pxSize;
            const tctx = tempCanvas.getContext('2d');
            tctx.drawImage(this.video, x, y, width, height, 0, 0, tempCanvas.width, tempCanvas.height);
            this.ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, x, y, width, height);
            this.ctx.imageSmoothingEnabled = true;
            
            this.ctx.strokeStyle = '#00ff66';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x, y, width, height);
            
            // Add Digital Static/Glitch overlay lines on redacted area
            this.ctx.strokeStyle = 'rgba(0, 255, 102, 0.3)';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            for(let i = y; i < y + height; i += 10) {
                this.ctx.moveTo(x, i);
                this.ctx.lineTo(x + width, i);
            }
            this.ctx.stroke();
            
            this.ctx.font = '900 16px JetBrains Mono';
            this.ctx.fillStyle = '#000000';
            this.ctx.fillRect(x, y + height/2 - 15, width, 30);
            this.ctx.fillStyle = '#00ff66';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('CLASSIFIED', x + width/2, y + height/2 + 5);
            this.ctx.textAlign = 'left';
        });

        this.updateDashboard({'REDACTED': people.length}, people.length);
    }

    // MODE 5: Pose Estimation
    getAngle(a, b, c) {
        const ang1 = Math.atan2(a.y - b.y, a.x - b.x);
        const ang2 = Math.atan2(c.y - b.y, c.x - b.x);
        let deg = (ang1 - ang2) * (180 / Math.PI);
        if (deg < 0) deg += 360;
        if (deg > 180) deg = 360 - deg;
        return deg;
    }

    drawPoseMode(poses) {
        this.resetContext();
        this.drawVideoFeed();

        if (!poses || poses.length === 0) {
            this.updateDashboard({'POSES': 0}, 0);
            return;
        }

        poses.forEach(pose => {
            if(pose.score < 0.3) return;

            const kpDict = {};
            pose.keypoints.forEach(kp => {
                kpDict[kp.name] = kp;
                if (kp.score > 0.3) {
                    this.ctx.fillStyle = '#fcee0a';
                    this.ctx.beginPath();
                    this.ctx.arc(kp.x, kp.y, 5, 0, 2*Math.PI);
                    this.ctx.fill();
                }
            });

            this.ctx.font = '700 12px JetBrains Mono';
            this.ctx.fillStyle = '#00ff66';

            // Draw Angle Arcs Helper
            const drawAngleArc = (p1, p2, p3, angle) => {
                this.ctx.beginPath();
                this.ctx.arc(p2.x, p2.y, 25, 0, (angle * Math.PI) / 180);
                this.ctx.strokeStyle = 'rgba(0, 255, 102, 0.4)';
                this.ctx.lineWidth = 15;
                this.ctx.stroke();
            };

            if (kpDict['left_shoulder']?.score > 0.3 && kpDict['left_elbow']?.score > 0.3 && kpDict['left_wrist']?.score > 0.3) {
                const angle = this.getAngle(kpDict['left_shoulder'], kpDict['left_elbow'], kpDict['left_wrist']);
                this.ctx.fillText(`${angle.toFixed(0)}°`, kpDict['left_elbow'].x + 15, kpDict['left_elbow'].y);
                drawAngleArc(kpDict['left_shoulder'], kpDict['left_elbow'], kpDict['left_wrist'], angle);
            }
            if (kpDict['right_shoulder']?.score > 0.3 && kpDict['right_elbow']?.score > 0.3 && kpDict['right_wrist']?.score > 0.3) {
                const angle = this.getAngle(kpDict['right_shoulder'], kpDict['right_elbow'], kpDict['right_wrist']);
                this.ctx.fillText(`${angle.toFixed(0)}°`, kpDict['right_elbow'].x + 15, kpDict['right_elbow'].y);
                drawAngleArc(kpDict['right_shoulder'], kpDict['right_elbow'], kpDict['right_wrist'], angle);
            }
            if (kpDict['left_hip']?.score > 0.3 && kpDict['left_knee']?.score > 0.3 && kpDict['left_ankle']?.score > 0.3) {
                const angle = this.getAngle(kpDict['left_hip'], kpDict['left_knee'], kpDict['left_ankle']);
                this.ctx.fillText(`${angle.toFixed(0)}°`, kpDict['left_knee'].x + 15, kpDict['left_knee'].y);
                drawAngleArc(kpDict['left_hip'], kpDict['left_knee'], kpDict['left_ankle'], angle);
            }

            if(poseDetection.util.getAdjacentPairs) {
                const adjacentKeyPoints = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet);
                this.ctx.strokeStyle = '#00f3ff';
                this.ctx.lineWidth = 3;
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
        
        let targetCx = this.canvas.width / 2;
        let targetCy = this.canvas.height / 2;

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
            targetCx = x + width/2;
            targetCy = y + height/2;
            
            if (!this.focusBox.active) {
                this.focusBox.x = targetCx;
                this.focusBox.y = targetCy;
                this.focusBox.active = true;
            }
        } else {
            this.focusBox.active = false;
        }

        this.focusBox.x += (targetCx - this.focusBox.x) * 0.1;
        this.focusBox.y += (targetCy - this.focusBox.y) * 0.1;

        this.ctx.save();
        if (this.focusBox.active) {
            const scale = 1.5; 
            const tx = this.canvas.width/2 - this.focusBox.x * scale;
            const ty = this.canvas.height/2 - this.focusBox.y * scale;
            this.ctx.translate(tx, ty);
            this.ctx.scale(scale, scale);
        }

        this.drawVideoFeed();

        if (this.focusBox.active) {
            this.ctx.strokeStyle = '#00ff66';
            this.ctx.lineWidth = 2;
            const size = 150;
            
            // Spinning outer rings
            const time = Date.now() / 1000;
            this.ctx.save();
            this.ctx.translate(this.focusBox.x, this.focusBox.y);
            this.ctx.rotate(time * 1.5);
            this.ctx.beginPath();
            this.ctx.arc(0, 0, size/2 + 20, 0, Math.PI);
            this.ctx.stroke();
            this.ctx.rotate(-time * 3);
            this.ctx.beginPath();
            this.ctx.arc(0, 0, size/2 + 10, Math.PI/2, Math.PI * 1.5);
            this.ctx.stroke();
            this.ctx.restore();

            // Inner target box
            this.ctx.strokeRect(this.focusBox.x - size/2, this.focusBox.y - size/2, size, size);
            
            this.ctx.font = '700 12px JetBrains Mono';
            this.ctx.fillStyle = '#00ff66';
            this.ctx.fillText('PTZ LOCK ENGAGED', this.focusBox.x - size/2, this.focusBox.y - size/2 - 30);
            
            // Center crosshair
            this.ctx.beginPath();
            this.ctx.moveTo(this.focusBox.x - 15, this.focusBox.y);
            this.ctx.lineTo(this.focusBox.x + 15, this.focusBox.y);
            this.ctx.moveTo(this.focusBox.x, this.focusBox.y - 15);
            this.ctx.lineTo(this.focusBox.x, this.focusBox.y + 15);
            this.ctx.stroke();
        }

        this.ctx.restore();

        if (this.focusBox.active) {
            this.updateDashboard({'TRACKED TARGETS': 1}, 1);
        } else {
            this.updateDashboard({'TRACKED TARGETS': 0}, 0);
        }
    }

    // MODE 7: Biometric
    drawFaceMesh(results) {
        this.resetContext();
        this.drawVideoFeed();
        
        if (!results || !results.faces || results.faces.length === 0) {
            this.updateDashboard({ 'NO SIGNAL': 0 }, 0);
            return;
        }

        const faces = results.faces;
        const state = results.eyesState;
        let headPose = "CENTERED";
        
        const color = state === 'CLOSED' ? '#ff003c' : '#00f3ff';

        faces.forEach(face => {
            this.ctx.fillStyle = color;
            face.keypoints.forEach(point => {
                this.ctx.fillRect(point.x, point.y, 2, 2);
            });

            const nose = face.keypoints[1];
            const leftEye = face.keypoints[33];
            const rightEye = face.keypoints[263];
            const top = face.keypoints[10];
            const bottom = face.keypoints[152];

            if (nose && leftEye && rightEye && top && bottom) {
                const yaw = (nose.x - leftEye.x) / (rightEye.x - leftEye.x);
                const pitch = (nose.y - top.y) / (bottom.y - top.y);

                if (yaw < 0.35) headPose = "LOOKING RIGHT";
                else if (yaw > 0.65) headPose = "LOOKING LEFT";
                else if (pitch < 0.4) headPose = "LOOKING UP";
                else if (pitch > 0.65) headPose = "LOOKING DOWN";

                this.ctx.strokeStyle = '#fcee0a';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.moveTo(nose.x, nose.y);
                this.ctx.lineTo(nose.x + (yaw - 0.5) * 200, nose.y + (pitch - 0.5) * 200);
                this.ctx.stroke();
            }

            if (face.box) {
                const { xMin, yMin, width, height } = face.box;
                this.ctx.strokeStyle = color;
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(xMin, yMin, width, height);
                
                const label = `EAR:${results.ear.toFixed(2)} | POSE:${headPose}`;
                this.ctx.font = '700 12px JetBrains Mono';
                this.ctx.fillStyle = '#000';
                this.ctx.fillRect(xMin, yMin - 20, this.ctx.measureText(label).width + 8, 20);
                this.ctx.fillStyle = color;
                this.ctx.fillText(label, xMin + 4, yMin - 16);
            }
        });

        if (headPose !== "CENTERED" && Math.random() < 0.1) {
            this.triggerAlert("ATTENTION LOST");
        }

        this.updateDashboard({ [`EYES ${state}`]: faces.length, 'HEAD POSE': headPose }, faces.length);
    }

    // MODE 9: Drowsiness Monitor
    drawDrowsinessMode(results) {
        this.resetContext();
        this.drawVideoFeed();
        
        if (!results || !results.faces || results.faces.length === 0) {
            this.updateDashboard({ 'NO SUBJECT': 0 }, 0);
            return;
        }

        const faces = results.faces;
        const state = results.eyesState;
        const ear = results.ear;
        
        // Vignette effect for dramatic feel
        this.ctx.fillStyle = 'rgba(0,0,0,0.6)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const color = state === 'CLOSED' ? '#ff003c' : '#00ff66';

        faces.forEach(face => {
            const leftEyeIndices = [33, 160, 158, 133, 153, 144];
            const rightEyeIndices = [362, 385, 387, 263, 373, 380];
            
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 3;
            
            // Draw polygon around eyes
            [leftEyeIndices, rightEyeIndices].forEach(indices => {
                this.ctx.beginPath();
                indices.forEach((idx, i) => {
                    const pt = face.keypoints[idx];
                    if(i===0) this.ctx.moveTo(pt.x, pt.y);
                    else this.ctx.lineTo(pt.x, pt.y);
                });
                this.ctx.closePath();
                this.ctx.stroke();
                
                // Draw crosshair over eye center
                const centerIdx = indices[0];
                const cx = face.keypoints[centerIdx].x;
                const cy = face.keypoints[centerIdx].y;
                this.ctx.beginPath();
                this.ctx.moveTo(cx - 10, cy); this.ctx.lineTo(cx + 10, cy);
                this.ctx.moveTo(cx, cy - 10); this.ctx.lineTo(cx, cy + 10);
                this.ctx.stroke();
            });

            // Draw large status text
            this.ctx.font = '900 40px JetBrains Mono';
            this.ctx.fillStyle = color;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.shadowColor = 'rgba(0,0,0,0.9)';
            this.ctx.shadowBlur = 10;
            this.ctx.fillText(state === 'CLOSED' ? 'DROWSY / SLEEPING WARNING' : 'AWAKE & ALERT', this.canvas.width/2, 80);
            this.ctx.shadowBlur = 0;
            this.ctx.textAlign = 'left';
            
            // EAR bar
            const barWidth = 300;
            const fill = Math.min(1, Math.max(0, ear / 0.4)) * barWidth;
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(this.canvas.width/2 - 150, 120, barWidth, 20);
            this.ctx.fillStyle = color;
            this.ctx.fillRect(this.canvas.width/2 - 150, 120, fill, 20);
            
            this.ctx.font = '700 14px JetBrains Mono';
            this.ctx.fillStyle = '#ffffff';
            this.ctx.textAlign = 'center';
            this.ctx.shadowColor = 'rgba(0,0,0,0.9)';
            this.ctx.shadowBlur = 5;
            this.ctx.fillText(`EYE ASPECT RATIO (EAR): ${ear.toFixed(3)}`, this.canvas.width/2, 160);
            this.ctx.shadowBlur = 0;
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'alphabetic';
        });

        if (state === 'CLOSED' && Math.random() < 0.2) {
            this.triggerAlert("WAKE UP ALARM");
            if (typeof voiceAssistant !== 'undefined') voiceAssistant.speak("Warning. Drowsiness detected. Please wake up.");
        }

        this.updateDashboard({ 'STATE': state, 'EAR VALUE': ear.toFixed(3) }, 1);
    }

    // MODE 10: Data Scanner (OCR)
    drawOCRMode(data) {
        this.resetContext();
        this.drawVideoFeed();
        
        if (!data || !data.words) {
            this.updateDashboard({'STATUS': 'SCANNING...'}, 0);
            return;
        }

        this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        let wordCount = 0;
        data.words.forEach(w => {
            if (w.confidence > 50) {
                wordCount++;
                const box = w.bbox;
                this.ctx.strokeStyle = '#00f3ff';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
                
                this.ctx.font = '14px JetBrains Mono';
                this.ctx.fillStyle = '#00f3ff';
                this.ctx.shadowColor = 'rgba(0,0,0,1)';
                this.ctx.shadowBlur = 4;
                this.ctx.fillText(w.text, box.x0, box.y0 - 5);
                this.ctx.shadowBlur = 0;
            }
        });

        if (data.text && data.text.length > 0) {
            // Draw text block on the right side
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            this.ctx.fillRect(this.canvas.width - 320, 50, 300, this.canvas.height - 100);
            this.ctx.strokeStyle = '#00f3ff';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(this.canvas.width - 320, 50, 300, this.canvas.height - 100);
            
            this.ctx.fillStyle = '#00f3ff';
            this.ctx.font = '700 12px JetBrains Mono';
            this.ctx.fillText('EXTRACTED DATA STREAM:', this.canvas.width - 310, 70);
            
            const lines = data.text.split('\n');
            let y = 100;
            lines.slice(0, 25).forEach(line => {
                if (line.trim().length > 0) {
                    this.ctx.fillText(line.substring(0, 35), this.canvas.width - 310, y);
                    y += 20;
                }
            });
        }

        this.updateDashboard({'WORDS EXTRACTED': wordCount, 'CONFIDENCE': Math.round(data.confidence) + '%'}, wordCount);
    }

    // MODE 11: Predictive Heatmap
    updateHeatmap(predictions) {
        if (!this.heatmapCanvas) return;
        if (this.heatmapCanvas.width !== this.canvas.width) {
            this.heatmapCanvas.width = this.canvas.width;
            this.heatmapCanvas.height = this.canvas.height;
        }

        // Fade out heatmap slowly over time
        this.heatmapCtx.fillStyle = 'rgba(0, 0, 0, 0.03)';
        this.heatmapCtx.globalCompositeOperation = 'destination-out';
        this.heatmapCtx.fillRect(0, 0, this.heatmapCanvas.width, this.heatmapCanvas.height);
        this.heatmapCtx.globalCompositeOperation = 'source-over';
        
        predictions.forEach(p => {
            if (p.class === 'person') {
                const [x, y, w, h] = p.bbox;
                const cx = x + w/2;
                const cy = y + h/2; // Center of the person
                
                const r = Math.min(Math.max(50, w / 1.5), 200);
                const grad = this.heatmapCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
                grad.addColorStop(0, 'rgba(255, 0, 60, 0.05)');
                grad.addColorStop(1, 'rgba(255, 0, 60, 0)');
                
                this.heatmapCtx.fillStyle = grad;
                this.heatmapCtx.beginPath();
                this.heatmapCtx.arc(cx, cy, r, 0, Math.PI*2);
                this.heatmapCtx.fill();
            }
        });
    }

    drawHeatmapMode(predictions) {
        this.resetContext();
        this.drawVideoFeed();
        
        // Darken video for heatmap pop
        this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw the accumulated heatmap over the video
        this.ctx.globalCompositeOperation = 'screen';
        this.ctx.drawImage(this.heatmapCanvas, 0, 0);
        this.ctx.globalCompositeOperation = 'source-over';
        
        // Faint boxes for current entities
        predictions.forEach(p => {
            const [x, y, width, height] = p.bbox;
            this.ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x, y, width, height);
            
            if (p.class === 'person') {
                // Draw a bright red dot at the center
                this.ctx.fillStyle = '#ff003c';
                this.ctx.beginPath();
                this.ctx.arc(x + width/2, y + height/2, 5, 0, Math.PI*2);
                this.ctx.fill();
            }
        });
        
        this.ctx.font = '900 24px JetBrains Mono';
        this.ctx.fillStyle = '#ff003c';
        this.ctx.fillText('PREDICTIVE ANALYTICS HEATMAP', 20, 50);
        
        this.updateDashboard({'LIVE SUBJECTS': predictions.filter(p=>p.class==='person').length}, predictions.length);
    }

    // HAND GESTURE OVERLAY
    drawHandOverlay(hands) {
        // Draw over the existing context without resetting
        hands.forEach(hand => {
            hand.keypoints.forEach(kp => {
                this.ctx.fillStyle = '#00f3ff';
                this.ctx.beginPath();
                this.ctx.arc(kp.x, kp.y, 4, 0, Math.PI*2);
                this.ctx.fill();
            });
            // highlight index tip
            const indexTip = hand.keypoints.find(k => k.name === 'index_finger_tip');
            if (indexTip) {
                this.ctx.fillStyle = '#fcee0a';
                this.ctx.beginPath();
                this.ctx.arc(indexTip.x, indexTip.y, 8, 0, Math.PI*2);
                this.ctx.fill();
            }
        });
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
            let color = '#00f3ff';
            if (typeof count === 'number') {
                color = this.getColor(className);
            } else {
                color = '#fcee0a';
            }
            
            const badge = document.createElement('div');
            badge.className = 'data-badge';
            badge.style.borderColor = color;
            badge.innerHTML = `
                <span style="color: ${color};"><i class="fas fa-crosshairs"></i> ${className.toUpperCase()}</span>
                <span class="val">[${count}]</span>
            `;
            this.liveObjectsList.appendChild(badge);
        }
    }

    updateFPS(fps) {
        if(this.fpsCounter) this.fpsCounter.textContent = Math.round(fps);
    }

    checkAlerts(targetName) {
        const now = Date.now();
        if (now - this.lastAlertTime > this.alertCooldown) {
            this.triggerAlert(`TARGET [${targetName.toUpperCase()}] LOCKED`);
            if (typeof logger !== 'undefined') logger.addLog(`LOCK: ${targetName.toUpperCase()}`, 1.0);
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
