class VoiceAssistant {
    constructor() {
        this.toggle = document.getElementById('voice-toggle');
        this.recognition = null;
        this.synth = window.speechSynthesis;
        this.isListening = false;
        
        this.init();
    }

    init() {
        if (!this.toggle) return;
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("Speech Recognition API not supported in this browser.");
            this.toggle.disabled = true;
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event) => {
            const last = event.results.length - 1;
            const command = event.results[last][0].transcript.trim().toLowerCase();
            console.log("Voice Command Received:", command);
            this.processCommand(command);
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
        };

        this.recognition.onend = () => {
            // Auto restart if toggle is still checked
            if (this.isListening && this.toggle.checked) {
                this.recognition.start();
            }
        };

        this.toggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.start();
            } else {
                this.stop();
            }
        });
    }

    start() {
        if (this.recognition && !this.isListening) {
            this.isListening = true;
            this.recognition.start();
            this.speak("J.A.R.V.I.S voice link established. Online.");
            if (window.logger) logger.addLog("VOICE LINK ONLINE", 1.0);
        }
    }

    stop() {
        if (this.recognition && this.isListening) {
            this.isListening = false;
            this.recognition.stop();
            this.speak("Voice link disconnected.");
            if (window.logger) logger.addLog("VOICE LINK OFFLINE", 1.0);
        }
    }

    speak(text) {
        if (this.synth.speaking) {
            this.synth.cancel(); // cancel current speech
        }
        const utterThis = new SpeechSynthesisUtterance(text);
        utterThis.pitch = 0.8; // Deep, robotic pitch
        utterThis.rate = 1.1; // Slightly fast
        
        // Find a robotic/english voice if possible
        const voices = this.synth.getVoices();
        const enVoice = voices.find(v => v.lang.includes('en') && (v.name.includes('Google') || v.name.includes('Microsoft Zira') || v.name.includes('Daniel')));
        if (enVoice) utterThis.voice = enVoice;
        
        this.synth.speak(utterThis);
    }

    processCommand(cmd) {
        if (!window.app) return;
        let matched = false;

        if (cmd.includes("initialize") || cmd.includes("power on") || cmd.includes("start camera")) {
            if (!window.app.isCameraActive) document.getElementById('btn-toggle-camera').click();
            this.speak("Initializing system.");
            matched = true;
        }
        else if (cmd.includes("terminate") || cmd.includes("power off") || cmd.includes("stop camera")) {
            if (window.app.isCameraActive) document.getElementById('btn-toggle-camera').click();
            this.speak("Terminating system.");
            matched = true;
        }
        else if (cmd.includes("fusion mode") || cmd.includes("god mode")) {
            document.getElementById('mode-selector').value = 'fusion';
            document.getElementById('mode-selector').dispatchEvent(new Event('change'));
            this.speak("Fusion mode activated.");
            matched = true;
        }
        else if (cmd.includes("security mode")) {
            document.getElementById('mode-selector').value = 'security';
            document.getElementById('mode-selector').dispatchEvent(new Event('change'));
            this.speak("Security sentry activated.");
            matched = true;
        }
        else if (cmd.includes("biometric mode")) {
            document.getElementById('mode-selector').value = 'biometric';
            document.getElementById('mode-selector').dispatchEvent(new Event('change'));
            this.speak("Biometric HUD activated.");
            matched = true;
        }
        else if (cmd.includes("tripwire") || cmd.includes("analytics")) {
            document.getElementById('mode-selector').value = 'tripwire';
            document.getElementById('mode-selector').dispatchEvent(new Event('change'));
            this.speak("Analytics tripwire active.");
            matched = true;
        }
        else if (cmd.includes("general tracking")) {
            document.getElementById('mode-selector').value = 'object';
            document.getElementById('mode-selector').dispatchEvent(new Event('change'));
            this.speak("General tracking activated.");
            matched = true;
        }
        else if (cmd.includes("lock target") || cmd.includes("target")) {
            const words = cmd.split(" ");
            const targetIdx = words.indexOf("target");
            if (targetIdx !== -1 && targetIdx < words.length - 1) {
                let obj = words.slice(targetIdx + 1).join(" "); // e.g. "cell phone"
                if (document.getElementById('target-selector')) {
                    const selector = document.getElementById('target-selector');
                    for (let i = 0; i < selector.options.length; i++) {
                        if (selector.options[i].value === obj || obj.includes(selector.options[i].value)) {
                            selector.value = selector.options[i].value;
                            this.speak(`Target locked: ${selector.options[i].value}`);
                            matched = true;
                            break;
                        }
                    }
                }
            }
        }
        
        if (matched && window.logger) {
            logger.addLog(`VOICE CMD: ${cmd}`, 1.0);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Voices take time to load async
    window.speechSynthesis.onvoiceschanged = () => {
        window.voiceAssistant = new VoiceAssistant();
    };
    // Fallback
    setTimeout(() => {
        if (!window.voiceAssistant) window.voiceAssistant = new VoiceAssistant();
    }, 1000);
});
