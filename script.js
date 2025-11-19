class FidgetSpinner {
    constructor() {
        this.spinner = document.getElementById('fidget-spinner');
        this.spinBtn = document.getElementById('spinBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.speedDisplay = document.getElementById('speedDisplay');
        
        // Perfect physics properties
        this.isSpinning = false;
        this.angularVelocity = 0; // rad/s
        this.maxAngularVelocity = 60; // rad/s (about 570 RPM)
        this.friction = 0.015; // optimized friction coefficient
        this.momentum = 0;
        this.lastSpinTime = 0;
        this.rotationAngle = 0;
        this.targetRotation = 0;
        this.smoothingFactor = 0.92; // for smooth visual rotation
        this.minVelocity = 0.05; // minimum velocity before stopping
        
        // Animation properties
        this.animationId = null;
        this.lastFrameTime = 0;
        this.speedInterval = null;
        
        // Particle system
        this.particles = [];
        this.particleContainer = null;
        
        // Touch/click properties
        this.lastClickTime = 0;
        this.clickHistory = [];
        
        this.initElements();
        this.initEventListeners();
        this.initTouchSupport();
        this.initParticleSystem();
        this.startPhysicsLoop();
    }
    
    initElements() {
        // Create particle container
        this.particleContainer = document.createElement('div');
        this.particleContainer.className = 'particles';
        document.querySelector('#wrapper').appendChild(this.particleContainer);
    }
    
    initEventListeners() {
        // Button clicks
        this.spinBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleSpin();
        });
        
        this.stopBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.stopSpin();
        });
        
        // Enhanced spinner click with momentum detection
        this.spinner.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleSpinnerClick(e);
        });
        
        // Mouse wheel for spin control
        this.spinner.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -1 : 1;
            this.addWheelMomentum(delta);
        });
        
        // Enhanced keyboard support
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.handleSpin();
            } else if (e.code === 'Escape') {
                this.stopSpin();
            } else if (e.code === 'ArrowUp' || e.code === 'ArrowRight') {
                e.preventDefault();
                this.addKeyboardMomentum(1);
            } else if (e.code === 'ArrowDown' || e.code === 'ArrowLeft') {
                e.preventDefault();
                this.addKeyboardMomentum(-1);
            }
        });
    }
    
    handleSpin() {
        if (!this.isSpinning) {
            this.startSpin();
        } else {
            this.addClickMomentum();
        }
    }
    
    handleSpinnerClick(event) {
        const now = Date.now();
        const timeSinceLastClick = now - this.lastClickTime;
        
        // Throttle rapid clicks for performance
        if (timeSinceLastClick < 50) {
            return;
        }
        
        // Track click history for momentum calculation
        this.clickHistory.push(now);
        if (this.clickHistory.length > 5) {
            this.clickHistory.shift();
        }
        
        // Enhanced momentum calculation
        let momentumMultiplier = 1;
        if (timeSinceLastClick < 400 && this.clickHistory.length > 1) {
            const avgInterval = this.getAverageClickInterval();
            const rapidFactor = Math.max(0.5, Math.min(2.5, 800 / avgInterval));
            momentumMultiplier = rapidFactor;
        }
        
        this.lastClickTime = now;
        
        if (!this.isSpinning) {
            this.startSpin(momentumMultiplier);
        } else {
            this.addClickMomentum(momentumMultiplier);
        }
        
        // Create particles with performance check
        if (this.updateParticles(0)) {
            this.createClickParticles(event);
        }
    }
    
    getAverageClickInterval() {
        if (this.clickHistory.length < 2) return 1000;
        
        let totalInterval = 0;
        for (let i = 1; i < this.clickHistory.length; i++) {
            totalInterval += this.clickHistory[i] - this.clickHistory[i - 1];
        }
        
        return totalInterval / (this.clickHistory.length - 1);
    }
    
    initTouchSupport() {
        let touchStartTime = 0;
        let touchStartAngle = 0;
        let touchMoveAngle = 0;
        let lastTouchTime = 0;
        let touchVelocity = 0;
        
        const getTouchAngle = (touch, rect) => {
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            return Math.atan2(touch.clientY - centerY, touch.clientX - centerX);
        };
        
        this.spinner.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const rect = this.spinner.getBoundingClientRect();
            touchStartTime = Date.now();
            touchStartAngle = getTouchAngle(e.touches[0], rect);
            lastTouchTime = touchStartTime;
            touchVelocity = 0;
            
            // Haptic feedback
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        }, { passive: false });
        
        this.spinner.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const rect = this.spinner.getBoundingClientRect();
            const currentTime = Date.now();
            touchMoveAngle = getTouchAngle(e.touches[0], rect);
            
            // Calculate angular velocity from touch movement
            const deltaAngle = touchMoveAngle - touchStartAngle;
            const deltaTime = currentTime - lastTouchTime;
            
            if (deltaTime > 0) {
                touchVelocity = deltaAngle / deltaTime * 1000; // rad/s
            }
            
            lastTouchTime = currentTime;
        }, { passive: false });
        
        this.spinner.addEventListener('touchend', (e) => {
            e.preventDefault();
            const touchDuration = Date.now() - touchStartTime;
            const totalAngle = Math.abs(touchMoveAngle - touchStartAngle);
            
            // Determine if it was a spin gesture or tap
            if (totalAngle > 0.5 && touchDuration > 100) {
                // Spin gesture
                const spinForce = Math.min(Math.abs(touchVelocity) * 2, this.maxAngularVelocity);
                this.addTouchMomentum(spinForce);
            } else if (touchDuration < 200) {
                // Tap gesture
                this.handleSpin();
            }
            
            // Create particles at touch end position
            if (e.changedTouches[0]) {
                this.createClickParticles(e.changedTouches[0]);
            }
        }, { passive: false });
    }
    
    initParticleSystem() {
        // Pre-create particle pool for better performance
        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            this.particleContainer.appendChild(particle);
            this.particles.push({
                element: particle,
                active: false,
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                life: 0,
                maxLife: 2000
            });
        }
    }
    
    startSpin(momentumMultiplier = 1) {
        if (!this.isSpinning) {
            this.isSpinning = true;
            
            // Perfect initial velocity calculation
            const baseVelocity = 18 + Math.random() * 15; // rad/s
            const clampedMultiplier = Math.min(2.5, Math.max(0.5, momentumMultiplier));
            this.angularVelocity = baseVelocity * clampedMultiplier;
            this.momentum = this.angularVelocity;
            this.lastSpinTime = Date.now();
            
            // Sync target with current rotation for smooth start
            this.targetRotation = this.rotationAngle;
            
            this.updateSpinnerClasses();
            this.updateButtons();
            this.startSpeedDisplay();
            this.createSpinParticles();
        }
    }
    
    startPhysicsLoop() {
        let frameCount = 0;
        const targetFPS = 60;
        const frameTime = 1000 / targetFPS;
        let accumulator = 0;
        
        const update = (currentTime) => {
            if (this.lastFrameTime === 0) {
                this.lastFrameTime = currentTime;
            }
            
            let deltaTime = currentTime - this.lastFrameTime;
            deltaTime = Math.min(deltaTime, 32); // Cap at ~30fps minimum
            
            accumulator += deltaTime;
            
            // Fixed timestep physics for consistent behavior
            while (accumulator >= frameTime) {
                this.updatePhysics(frameTime / 1000);
                accumulator -= frameTime;
                frameCount++;
            }
            
            // Always update visuals for smooth rendering
            this.updateVisuals();
            
            this.lastFrameTime = currentTime;
            this.animationId = requestAnimationFrame(update);
        };
        
        this.animationId = requestAnimationFrame(update);
    }
    
    updatePhysics(deltaTime) {
        if (this.isSpinning && this.angularVelocity > this.minVelocity) {
            // Apply realistic friction with velocity-dependent dampening
            const velocityFactor = Math.min(1, this.angularVelocity / 10);
            const dynamicFriction = this.friction * (0.5 + velocityFactor * 0.5);
            const frictionForce = dynamicFriction * this.angularVelocity * this.angularVelocity;
            
            this.angularVelocity = Math.max(0, this.angularVelocity - frictionForce * deltaTime);
            
            // Update target rotation with perfect smoothing
            this.targetRotation += this.angularVelocity * deltaTime;
            
            // Smooth visual rotation interpolation
            const rotationDiff = this.targetRotation - this.rotationAngle;
            this.rotationAngle += rotationDiff * (1 - this.smoothingFactor);
            
            // Check if spinner should stop
            if (this.angularVelocity < this.minVelocity) {
                this.completeSpin();
            }
        } else if (this.isSpinning) {
            // Final smooth settle
            const rotationDiff = this.targetRotation - this.rotationAngle;
            if (Math.abs(rotationDiff) > 0.001) {
                this.rotationAngle += rotationDiff * 0.1;
            } else {
                this.completeSpin();
            }
        }
        
        // Update particles
        this.updateParticles(deltaTime);
    }
    
    updateVisuals() {
        if (this.isSpinning) {
            // Apply perfect smooth rotation
            const rotation = this.rotationAngle % (Math.PI * 2);
            this.spinner.style.transform = `rotate(${rotation}rad)`;
            
            // Update speed-based visual effects
            this.updateSpeedEffects();
            
            // Add micro-vibration effect at very high speeds
            const rpm = this.getRPM();
            if (rpm > 400) {
                const vibration = Math.sin(Date.now() * 0.1) * 0.5;
                this.spinner.style.transform += ` translate(${vibration}px, ${vibration * 0.5}px)`;
            }
        }
    }
    
    updateSpeedEffects() {
        const rpm = this.getRPM();
        
        // Remove existing speed classes
        this.spinner.classList.remove('high-speed', 'medium-speed', 'ultra-speed');
        
        if (rpm > 350) {
            this.spinner.classList.add('ultra-speed');
        } else if (rpm > 200) {
            this.spinner.classList.add('high-speed');
        } else if (rpm > 80) {
            this.spinner.classList.add('medium-speed');
        }
        
        // Dynamic filter intensity based on speed
        const blurIntensity = Math.min(1.5, rpm / 300);
        if (rpm > 150) {
            const glowIntensity = Math.min(40, rpm / 10);
            this.spinner.style.filter = `blur(${blurIntensity}px) drop-shadow(0 ${glowIntensity}px ${glowIntensity * 2}px rgba(255, 117, 117, 0.4))`;
        }
    }
    
    addClickMomentum(multiplier = 1) {
        if (!this.isSpinning) return;
        
        // Perfect momentum calculation based on current velocity
        const baseBoost = 8;
        const velocityFactor = 1 - (this.angularVelocity / this.maxAngularVelocity);
        const momentumBoost = (baseBoost + Math.random() * 5) * multiplier * (0.3 + velocityFactor * 0.7);
        
        this.angularVelocity = Math.min(this.maxAngularVelocity, this.angularVelocity + momentumBoost);
        
        // Enhanced visual feedback with perfect timing
        const currentTransform = this.spinner.style.transform || '';
        this.spinner.style.transform = currentTransform + ' scale(1.08)';
        
        requestAnimationFrame(() => {
            setTimeout(() => {
                this.spinner.style.transform = currentTransform;
            }, 150);
        });
        
        this.createMomentumParticles();
    }
    
    addTouchMomentum(force) {
        const clampedForce = Math.min(this.maxAngularVelocity * 0.3, Math.max(5, force));
        
        if (!this.isSpinning) {
            this.startSpin(clampedForce / 15);
        } else {
            this.angularVelocity = Math.min(this.maxAngularVelocity, this.angularVelocity + clampedForce);
        }
        
        this.createMomentumParticles();
    }
    
    addWheelMomentum(direction) {
        const momentumBoost = 4 * direction;
        
        if (!this.isSpinning && direction > 0) {
            this.startSpin(0.8);
        } else if (this.isSpinning) {
            const newVelocity = this.angularVelocity + momentumBoost;
            this.angularVelocity = Math.max(0, Math.min(this.maxAngularVelocity, newVelocity));
            
            if (this.angularVelocity <= this.minVelocity) {
                this.completeSpin();
            }
        }
    }
    
    addKeyboardMomentum(direction) {
        const momentumBoost = 8 * direction;
        
        if (!this.isSpinning && direction > 0) {
            this.startSpin();
        } else if (this.isSpinning) {
            this.angularVelocity = Math.max(0, Math.min(this.maxAngularVelocity, this.angularVelocity + momentumBoost));
            
            if (this.angularVelocity <= 0) {
                this.completeSpin();
            }
        }
    }
    
    stopSpin() {
        if (!this.isSpinning) return;
        
        // Rapid deceleration
        this.angularVelocity *= 0.1;
        
        if (this.angularVelocity < 0.1) {
            this.completeSpin();
        }
    }
    
    completeSpin() {
        this.isSpinning = false;
        this.angularVelocity = 0;
        this.momentum = 0;
        
        // Sync final positions perfectly
        this.rotationAngle = this.targetRotation;
        
        // Remove speed classes with smooth transition
        this.spinner.classList.remove('spinning', 'slowing', 'high-speed', 'medium-speed');
        
        // Apply final rotation with perfect precision
        const finalRotation = this.rotationAngle % (Math.PI * 2);
        this.spinner.style.transform = `rotate(${finalRotation}rad)`;
        this.rotationAngle = finalRotation;
        this.targetRotation = finalRotation;
        
        this.updateButtons();
        this.stopSpeedDisplay();
        this.clearActiveParticles();
    }
    
    updateSpinnerClasses() {
        this.spinner.classList.remove('slowing');
        this.spinner.classList.add('spinning');
    }
    
    getRPM() {
        return Math.round(this.angularVelocity * 60 / (2 * Math.PI));
    }
    
    // Particle system methods
    createClickParticles(event) {
        const rect = this.spinner.getBoundingClientRect();
        const containerRect = this.particleContainer.getBoundingClientRect();
        
        const x = (event.clientX || event.pageX) - containerRect.left;
        const y = (event.clientY || event.pageY) - containerRect.top;
        
        for (let i = 0; i < 5; i++) {
            this.createParticle(x, y, 'click');
        }
    }
    
    createSpinParticles() {
        const centerX = this.particleContainer.offsetWidth / 2;
        const centerY = this.particleContainer.offsetHeight / 2;
        
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const radius = 80 + Math.random() * 40;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            this.createParticle(x, y, 'spin');
        }
    }
    
    createMomentumParticles() {
        const centerX = this.particleContainer.offsetWidth / 2;
        const centerY = this.particleContainer.offsetHeight / 2;
        
        for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 60 + Math.random() * 30;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            this.createParticle(x, y, 'momentum');
        }
    }
    
    createParticle(x, y, type) {
        const particle = this.getInactiveParticle();
        if (!particle) return;
        
        particle.active = true;
        particle.x = x;
        particle.y = y;
        particle.life = 0;
        
        // Set velocity based on type
        switch (type) {
            case 'click':
                particle.vx = (Math.random() - 0.5) * 100;
                particle.vy = (Math.random() - 0.5) * 100;
                particle.maxLife = 1000;
                break;
            case 'spin':
                particle.vx = (Math.random() - 0.5) * 200;
                particle.vy = (Math.random() - 0.5) * 200;
                particle.maxLife = 1500;
                break;
            case 'momentum':
                particle.vx = (Math.random() - 0.5) * 150;
                particle.vy = -Math.random() * 100;
                particle.maxLife = 800;
                break;
        }
        
        particle.element.style.left = particle.x + 'px';
        particle.element.style.top = particle.y + 'px';
        particle.element.classList.add('active');
    }
    
    getInactiveParticle() {
        return this.particles.find(p => !p.active);
    }
    
    updateParticles(deltaTime) {
        const deltaMs = deltaTime * 1000;
        let activeCount = 0;
        
        this.particles.forEach(particle => {
            if (!particle.active) return;
            
            activeCount++;
            particle.life += deltaMs;
            
            if (particle.life >= particle.maxLife) {
                particle.active = false;
                particle.element.classList.remove('active');
                particle.element.style.transform = 'translate3d(0,0,0) scale(0)';
                return;
            }
            
            // Update position with better physics
            particle.x += particle.vx * deltaTime;
            particle.y += particle.vy * deltaTime;
            
            // Apply realistic gravity and air resistance
            particle.vy += 180 * deltaTime;
            particle.vx *= (1 - 0.8 * deltaTime);
            particle.vy *= (1 - 0.5 * deltaTime);
            
            // Optimized DOM updates using transform
            const scale = 1 - (particle.life / particle.maxLife) * 0.5;
            const alpha = Math.max(0, 1 - (particle.life / particle.maxLife));
            
            particle.element.style.transform = `translate3d(${particle.x}px, ${particle.y}px, 0) scale(${scale})`;
            particle.element.style.opacity = alpha;
        });
        
        // Dynamic particle creation based on performance
        if (activeCount > 15) {
            // Skip particle creation if too many active
            return false;
        }
        return true;
    }
    
    clearActiveParticles() {
        this.particles.forEach(particle => {
            if (particle.active) {
                particle.active = false;
                particle.element.classList.remove('active');
                particle.element.style.transform = 'translate3d(0,0,0) scale(0)';
                particle.element.style.opacity = '0';
            }
        });
    }
    
    // Performance monitoring method
    getPerformanceMetrics() {
        return {
            rpm: this.getRPM(),
            angularVelocity: this.angularVelocity.toFixed(2),
            isSpinning: this.isSpinning,
            activeParticles: this.particles.filter(p => p.active).length,
            rotationAngle: (this.rotationAngle * 180 / Math.PI).toFixed(1) + '°'
        };
    }
    
    startSpeedDisplay() {
        if (this.speedInterval) {
            clearInterval(this.speedInterval);
        }
        
        let lastDisplayRPM = 0;
        const smoothingFactor = 0.85;
        
        this.speedInterval = setInterval(() => {
            if (this.isSpinning) {
                const rpm = this.getRPM();
                // Smooth interpolation for display
                lastDisplayRPM = lastDisplayRPM * smoothingFactor + rpm * (1 - smoothingFactor);
                
                // Add realistic micro-variation
                const variation = Math.sin(Date.now() * 0.01) * 2;
                const displayRPM = Math.round(lastDisplayRPM + variation);
                
                this.speedDisplay.textContent = Math.max(0, displayRPM);
                
                // Update color based on speed
                const intensity = Math.min(1, rpm / 400);
                const red = Math.round(255 * intensity + 200 * (1 - intensity));
                const green = Math.round(117 * (1 - intensity) + 50 * intensity);
                this.speedDisplay.style.color = `rgb(${red}, ${green}, 117)`;
            }
        }, 33); // ~30fps for display updates
    }
    
    stopSpeedDisplay() {
        if (this.speedInterval) {
            clearInterval(this.speedInterval);
            this.speedInterval = null;
        }
        this.speedDisplay.textContent = '0';
    }
    
    updateButtons() {
        if (this.isSpinning) {
            this.spinBtn.textContent = 'Add Momentum';
            this.spinBtn.style.background = 'linear-gradient(45deg, #5f27cd, #00d2d3)';
            this.stopBtn.style.opacity = '1';
            this.stopBtn.style.pointerEvents = 'auto';
        } else {
            this.spinBtn.textContent = 'Spin';
            this.spinBtn.style.background = 'linear-gradient(45deg, #ff6b6b, #ee5a24)';
            this.stopBtn.style.opacity = '0.6';
            this.stopBtn.style.pointerEvents = 'none';
        }
    }
}

// Enhanced sound effects with realistic spinner sounds
class SpinnerSounds {
    constructor() {
        this.audioContext = null;
        this.spinningOscillator = null;
        this.isPlayingSpinSound = false;
        this.initAudio();
    }
    
    async initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    }
    
    playSpinSound(rpm) {
        if (!this.audioContext || this.isPlayingSpinSound) return;
        
        this.isPlayingSpinSound = true;
        
        // Create realistic spinning sound
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Frequency based on RPM
        const baseFreq = 100 + (rpm * 0.5);
        oscillator.frequency.setValueAtTime(baseFreq, this.audioContext.currentTime);
        oscillator.type = 'sawtooth';
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000 + rpm * 2, this.audioContext.currentTime);
        
        const volume = Math.min(0.1, rpm / 1000);
        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        
        this.spinningOscillator = oscillator;
        oscillator.start(this.audioContext.currentTime);
        
        // Auto stop after 0.5 seconds
        setTimeout(() => {
            this.stopSpinSound();
        }, 500);
    }
    
    stopSpinSound() {
        if (this.spinningOscillator && this.audioContext) {
            this.spinningOscillator.stop(this.audioContext.currentTime + 0.1);
            this.spinningOscillator = null;
            this.isPlayingSpinSound = false;
        }
    }
    
    playClickSound() {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(1200, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.1);
        oscillator.type = 'square';
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, this.audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0.08, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.1);
    }
    
    playMomentumSound() {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
        oscillator.frequency.linearRampToValueAtTime(900, this.audioContext.currentTime + 0.2);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.05, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.2);
    }
}

// Initialize the enhanced fidget spinner application
document.addEventListener('DOMContentLoaded', () => {
    const spinner = new FidgetSpinner();
    const sounds = new SpinnerSounds();
    
    // Perfect sound integration with throttling
    let lastSoundTime = 0;
    
    const originalStartSpin = spinner.startSpin;
    spinner.startSpin = function(momentumMultiplier) {
        originalStartSpin.call(this, momentumMultiplier);
        const now = Date.now();
        if (now - lastSoundTime > 200) {
            sounds.playSpinSound(this.getRPM());
            lastSoundTime = now;
        }
    };
    
    const originalAddClickMomentum = spinner.addClickMomentum;
    spinner.addClickMomentum = function(multiplier) {
        originalAddClickMomentum.call(this, multiplier);
        const now = Date.now();
        if (now - lastSoundTime > 100) {
            sounds.playMomentumSound();
            lastSoundTime = now;
        }
    };
    
    // Performance monitoring (optional debug)
    if (window.location.search.includes('debug')) {
        setInterval(() => {
            const metrics = spinner.getPerformanceMetrics();
            console.log('Spinner Metrics:', metrics);
        }, 1000);
    }
    
    // Click sound for all interactions
    document.getElementById('fidget-spinner').addEventListener('click', () => {
        sounds.playClickSound();
    });
    
    // Enhanced instructions
    const instructions = document.querySelector('.instructions');
    instructions.innerHTML = `
        Click, drag, or use mouse wheel to spin!<br>
        <small>SPACEBAR to spin • Arrow keys for control • ESC to stop</small>
    `;
    
    // Update physics display
    const physicsDisplay = document.getElementById('physicsDisplay');
    if (physicsDisplay) {
        physicsDisplay.textContent = 'SVG Physics Engine';
    }
    
    // Performance monitoring
    let fps = 0;
    let frameCount = 0;
    let lastTime = performance.now();
    
    function updateFPS() {
        frameCount++;
        const now = performance.now();
        
        if (now - lastTime >= 1000) {
            fps = Math.round((frameCount * 1000) / (now - lastTime));
            frameCount = 0;
            lastTime = now;
            
            // Optional: Display FPS for debugging
            // console.log('FPS:', fps);
        }
        
        requestAnimationFrame(updateFPS);
    }
    
    updateFPS();
    
    // Smooth loading animation
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.5s ease-in-out';
    
    setTimeout(() => {
        document.body.style.opacity = '1';
    }, 100);
    
    // Prevent text selection during interaction
    document.addEventListener('selectstart', (e) => {
        if (e.target.closest('#wrapper')) {
            e.preventDefault();
        }
    });
    
    // Enhanced error handling
    window.addEventListener('error', (e) => {
        console.error('Spinner error:', e.error);
    });
});

// Prevent context menu and improve mobile experience
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// Prevent zoom on double tap (mobile)
document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - (window.lastTouchEnd || 0) <= 300) {
        e.preventDefault();
    }
    window.lastTouchEnd = now;
}, { passive: false });

// Performance optimizations
if ('requestIdleCallback' in window) {
    // Use idle time for non-critical updates
    requestIdleCallback(() => {
        // Pre-warm audio context on user interaction
        document.addEventListener('click', function initAudio() {
            if (window.AudioContext || window.webkitAudioContext) {
                const tempContext = new (window.AudioContext || window.webkitAudioContext)();
                if (tempContext.state === 'suspended') {
                    tempContext.resume();
                }
                tempContext.close();
            }
            document.removeEventListener('click', initAudio);
        }, { once: true });
    });
}

// Service worker for offline capability (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Uncomment to enable service worker
        // navigator.serviceWorker.register('/sw.js');
    });
}