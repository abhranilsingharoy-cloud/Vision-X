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
        this.ctx = this.canvas.getContext('2d');
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
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
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
                
                const cornerSize = 15;
                this.ctx.lineWidth = 4;
                this.ctx.beginPath();
                this.ctx.moveTo(x, y + cornerSize); this.ctx.lineTo(x, y); this.ctx.lineTo(x + cornerSize, y);
                this.ctx.moveTo(x + width - cornerSize, y); this.ctx.lineTo(x + width, y); this.ctx.lineTo(x + width, y + cornerSize);
                this.ctx.moveTo(x, y + height - cornerSize); this.ctx.lineTo(x, y + height); this.ctx.lineTo(x + cornerSize, y + height);
                this.ctx.moveTo(x + width - cornerSize, y + height); this.ctx.lineTo(x + width, y + height); this.ctx.lineTo(x + width, y + height - cornerSize);
                this.ctx.stroke();

                const label = `[${className.toUpperCase()}${depthStr} : ${id}]`;
                this.ctx.font = '700 12px JetBrains Mono';
                this.ctx.textBaseline = 'top';
                this.ctx.fillStyle = '#000000';
                this.ctx.fillRect(x, y - 20, this.ctx.measureText(label).width + 8, 20);
                this.ctx.fillStyle = color;
                this.ctx.fillText(label, x + 4, y - 16);
                
                const cx = x + width/2;
                const cy = y + height/2;
                this.ctx.fillStyle = color;
                this.ctx.fillRect(cx - 2, cy - 2, 4, 4);
            }
        });

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
                this.ctx.fillStyle = '#ff003c';
                this.ctx.font = '800 16px JetBrains Mono';
                this.ctx.fillText('🔴 REC', 20, 30);
            }
        } else {
            this.ctx.filter = 'grayscale(100%) brightness(70%) contrast(120%)';
            this.drawVideoFeed();
            this.ctx.filter = 'none';
            this.ctx.fillStyle = 'rgba(0, 255, 100, 0.05)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
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
            this.ctx.fillText(label, x, y - 20);
        });

        if (people.length > 0) {
            this.triggerAlert("INTRUDER DETECTED");
            if(window.logger && Math.random() < 0.05) logger.addLog("INTRUDER DETECTED", 1.0);
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
            if (window.voiceAssistant) window.voiceAssistant.speak("Security footage saved to local storage.");
        };
        this.mediaRecorder.start();
        this.isRecording = true;
        if (window.logger) logger.addLog("DVR RECORDING STARTED", 1.0);
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            if (window.logger) logger.addLog("DVR RECORDING SAVED", 1.0);
        }
    }

    // MODE 3: Analytics Tripwire
    drawTripwireMode(predictions) {
        this.resetContext();
        this.drawVideoFeed();
        
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

        for (let id in this.trails) {
            if (!currentCentroids[id]) delete this.trails[id];
        }
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
            
            this.ctx.font = '700 12px JetBrains Mono';
            this.ctx.fillStyle = '#00ff66';
            this.ctx.fillText('[REDACTED]', x + 5, y + 15);
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

            if (kpDict['left_shoulder']?.score > 0.3 && kpDict['left_elbow']?.score > 0.3 && kpDict['left_wrist']?.score > 0.3) {
                const angle = this.getAngle(kpDict['left_shoulder'], kpDict['left_elbow'], kpDict['left_wrist']);
                this.ctx.fillText(`${angle.toFixed(0)}°`, kpDict['left_elbow'].x + 10, kpDict['left_elbow'].y);
            }
            if (kpDict['right_shoulder']?.score > 0.3 && kpDict['right_elbow']?.score > 0.3 && kpDict['right_wrist']?.score > 0.3) {
                const angle = this.getAngle(kpDict['right_shoulder'], kpDict['right_elbow'], kpDict['right_wrist']);
                this.ctx.fillText(`${angle.toFixed(0)}°`, kpDict['right_elbow'].x + 10, kpDict['right_elbow'].y);
            }
            if (kpDict['left_hip']?.score > 0.3 && kpDict['left_knee']?.score > 0.3 && kpDict['left_ankle']?.score > 0.3) {
                const angle = this.getAngle(kpDict['left_hip'], kpDict['left_knee'], kpDict['left_ankle']);
                this.ctx.fillText(`${angle.toFixed(0)}°`, kpDict['left_knee'].x + 10, kpDict['left_knee'].y);
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
            this.ctx.strokeRect(this.focusBox.x - size/2, this.focusBox.y - size/2, size, size);
            
            this.ctx.font = '700 12px JetBrains Mono';
            this.ctx.fillStyle = '#00ff66';
            this.ctx.fillText('PTZ LOCK ENGAGED', this.focusBox.x - size/2, this.focusBox.y - size/2 - 10);
            
            this.ctx.beginPath();
            this.ctx.moveTo(this.focusBox.x - 10, this.focusBox.y);
            this.ctx.lineTo(this.focusBox.x + 10, this.focusBox.y);
            this.ctx.moveTo(this.focusBox.x, this.focusBox.y - 10);
            this.ctx.lineTo(this.focusBox.x, this.focusBox.y + 10);
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
            if (window.logger) logger.addLog(`LOCK: ${targetName.toUpperCase()}`, 1.0);
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
