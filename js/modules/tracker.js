/**
 * Simple Centroid Object Tracker
 * Assigns persistent IDs to detected objects across frames.
 */
class Tracker {
    constructor(maxDistance = 150, maxLostFrames = 15) {
        this.nextId = 1;
        this.objects = []; // { id, x, y, className, lostFrames, bbox, score, history: [{x, y}], velocity: {dx, dy} }
        this.maxDistance = maxDistance;
        this.maxLostFrames = maxLostFrames;
        this.maxHistory = 20; // Number of frames to remember for trajectory
    }

    /**
     * Calculate Euclidean distance between two points
     */
    getDistance(p1, p2) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    }

    /**
     * Get center of a bounding box
     */
    getCentroid(bbox) {
        const [x, y, width, height] = bbox;
        return {
            x: x + width / 2,
            y: y + height / 2
        };
    }

    /**
     * Update tracker with new predictions
     * @param {Array} predictions - Array from TF.js [{bbox, class, score}]
     * @returns {Array} - Array of predictions with added `id` field
     */
    update(predictions) {
        // If no existing objects, register all new ones
        if (this.objects.length === 0) {
            return predictions.map(pred => {
                const centroid = this.getCentroid(pred.bbox);
                const newObj = {
                    id: this.nextId++,
                    x: centroid.x,
                    y: centroid.y,
                    className: pred.class,
                    lostFrames: 0,
                    bbox: pred.bbox,
                    score: pred.score,
                    history: [{x: centroid.x, y: centroid.y}],
                    velocity: {dx: 0, dy: 0}
                };
                this.objects.push(newObj);
                return { ...pred, id: newObj.id, history: newObj.history, velocity: newObj.velocity };
            });
        }

        // Format new detections
        const newDetections = predictions.map(pred => ({
            ...pred,
            centroid: this.getCentroid(pred.bbox)
        }));

        const matchedDetectionIndices = new Set();
        const matchedObjectIndices = new Set();

        // 1. Try to match new detections to existing objects (must be same class)
        for (let i = 0; i < this.objects.length; i++) {
            const obj = this.objects[i];
            
            let bestDist = this.maxDistance;
            let bestIndex = -1;

            for (let j = 0; j < newDetections.length; j++) {
                if (matchedDetectionIndices.has(j)) continue;
                
                const det = newDetections[j];
                
                // Only match if classes are the same
                if (obj.className !== det.class) continue;

                const dist = this.getDistance(obj, det.centroid);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestIndex = j;
                }
            }

            if (bestIndex !== -1) {
                // Match found
                const det = newDetections[bestIndex];
                
                // Calculate velocity based on last position
                obj.velocity = {
                    dx: det.centroid.x - obj.x,
                    dy: det.centroid.y - obj.y
                };
                
                obj.x = det.centroid.x;
                obj.y = det.centroid.y;
                obj.bbox = det.bbox;
                obj.score = det.score;
                obj.lostFrames = 0;
                
                // Update history
                obj.history.push({x: obj.x, y: obj.y});
                if (obj.history.length > this.maxHistory) obj.history.shift();
                
                det.id = obj.id; // Assign ID to the output
                det.history = [...obj.history];
                det.velocity = {...obj.velocity};
                
                matchedDetectionIndices.add(bestIndex);
                matchedObjectIndices.add(i);
            }
        }

        // 2. Register any unmatched detections as new objects
        for (let j = 0; j < newDetections.length; j++) {
            if (!matchedDetectionIndices.has(j)) {
                const det = newDetections[j];
                const newObj = {
                    id: this.nextId++,
                    x: det.centroid.x,
                    y: det.centroid.y,
                    className: det.class,
                    lostFrames: 0,
                    bbox: det.bbox,
                    score: det.score,
                    history: [{x: det.centroid.x, y: det.centroid.y}],
                    velocity: {dx: 0, dy: 0}
                };
                this.objects.push(newObj);
                det.id = newObj.id;
                det.history = [...newObj.history];
                det.velocity = {...newObj.velocity};
            }
        }

        // 3. Mark unmatched objects as lost, remove if lost too long
        this.objects = this.objects.filter((obj, index) => {
            if (!matchedObjectIndices.has(index)) {
                obj.lostFrames++;
            }
            return obj.lostFrames <= this.maxLostFrames;
        });

        // Return the input predictions, now augmented with IDs
        return newDetections.map(det => {
            // Remove the temporary centroid we added for processing, keep original fields + id
            const { centroid, ...rest } = det;
            return rest;
        });
    }
}

const tracker = new Tracker();
