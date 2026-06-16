/**
 * Logger module for managing detection logs.
 */
class Logger {
    constructor(maxLogs = 50) {
        this.maxLogs = maxLogs;
        this.logContainer = document.getElementById('activity-log');
    }

    /**
     * Add a new detection log
     * @param {string} className - Object class name
     * @param {number} confidence - Confidence score
     */
    addLog(className, confidence) {
        if (!this.logContainer) return;

        const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        const logEntry = document.createElement('div');
        logEntry.className = 'log-item';
        logEntry.innerHTML = `
            <span class="message">Detected <b>${className}</b> (${Math.round(confidence * 100)}%)</span>
            <span class="time">${time}</span>
        `;

        this.logContainer.prepend(logEntry);

        // Limit logs
        while (this.logContainer.children.length > this.maxLogs) {
            this.logContainer.removeChild(this.logContainer.lastChild);
        }
    }

    clear() {
        if (this.logContainer) {
            this.logContainer.innerHTML = '';
        }
    }
}

const logger = new Logger();
