/**
 * @type {HTMLCanvasElement}
 */
const canvas = document.getElementById('canvas1');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let particles = [];
let textCoordinates = [];

const textInput = document.getElementById('textInput');
const stormBtn = document.getElementById('stormBtn');

// Configuration
const config = {
    particleSize: 20, // Larger individual letters
    particleColor: ['#a7dff9', '#d0efff', '#82c4e0', '#5ea8c9', '#e0f7ff'],
    text: 'KAOS',
    gap: 2, // Slight gap increase for larger particles
    mouseRadius: 20000,
    stormRadius: 200
};

// State Machine
let currentState = 'CHAOS';
let holdTimer = 0;
const HOLD_DURATION = 3000;
let lastTime = 0;
let loopTimeout = null;

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// Mouse interaction (optional, for extra chaos)
const mouse = {
    x: null,
    y: null,
    radius: 150
}

window.addEventListener('mousemove', function (event) {
    mouse.x = event.x;
    mouse.y = event.y;
});

class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.originX = x; // Target position (for text)
        this.originY = y;
        this.color = config.particleColor[Math.floor(Math.random() * config.particleColor.length)];
        this.size = config.particleSize;
        this.char = alphabet[Math.floor(Math.random() * alphabet.length)];

        // Physics
        this.ease = Math.random() * 0.1 + 0.05; // Ease factor for alignment
        this.friction = 0.95;

        // Chaos properties (Relaxed Omnidirectional flow)
        this.vx = (Math.random() - 0.5) * 1;   // Very slow horizontal drift
        this.vy = (Math.random() - 0.5) * 1;   // Very slow vertical movement

        // Ensure minimum speed so they don't just hover
        if (Math.abs(this.vx) < 0.1) this.vx = this.vx < 0 ? -0.1 : 0.1;
        if (Math.abs(this.vy) < 0.1) this.vy = this.vy < 0 ? -0.1 : 0.1;

        // Start randomly off-screen or on-screen? 
        // Let's start on screen but move fast.
    }

    setTarget(x, y) {
        this.originX = x;
        this.originY = y;
    }

    update() {
        if (currentState === 'CHAOS' || currentState === 'DISPERSING') {
            this.x += this.vx;
            this.y += this.vy;

            // Wrap around effects for continuous flow
            if (this.y < -50) this.y = canvas.height + 50;
            if (this.y > canvas.height + 50) this.y = -50;
            if (this.x < -50) this.x = canvas.width + 50;
            if (this.x > canvas.width + 50) this.x = -50;

            // If dispersing, maybe accelerate away from center?
            // For now, simple vertical flow is what's requested ("upper and lower parts").

        } else if (currentState === 'ALIGNING' || currentState === 'HOLDING') {
            // Seek target behavior
            let dx = this.originX - this.x;
            let dy = this.originY - this.y;
            this.x += dx * this.ease;
            this.y += dy * this.ease;
        }
    }

    draw() {
        ctx.fillStyle = this.color;

        // Glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;

        ctx.font = `${this.size}px 'Outfit'`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.char, this.x, this.y);

        // Reset shadow for performance if needed, but global glow is fine here
        ctx.shadowBlur = 0;
    }
}

class Effect {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.particles = [];
        this.init();
    }

    init() {
        // Fixed relaxed count - increased again
        this.createParticles(1500);
    }

    createParticles(count) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(Math.random() * this.width, Math.random() * this.height));
        }
    }

    sampleText(text) {
        // Draw text to offscreen to sample
        // We can just use the main canvas, clear it after
        ctx.clearRect(0, 0, this.width, this.height);

        // Font settings
        let fontSize = 220; // Increased size
        if (this.width < 600) fontSize = 120; // Responsive font size

        ctx.font = `bold ${fontSize}px Outfit`;
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Wrap text logic if needed, but we'll assume short words for now or scale down
        ctx.fillText(text, this.width / 2, this.height / 2);

        // Scanning
        const pixels = ctx.getImageData(0, 0, this.width, this.height).data;
        const coordinates = [];

        for (let y = 0; y < this.height; y += config.gap) {
            for (let x = 0; x < this.width; x += config.gap) {
                const index = (y * this.width + x) * 4;
                const alpha = pixels[index + 3];
                if (alpha > 0) {
                    coordinates.push({ x, y });
                }
            }
        }

        return coordinates;
    }

    morph(text) {
        let textCoords = this.sampleText(text);

        // Map particles to coordinates evenly to preserve shape
        // If we have more coords than particles, we skip some evenly (downsample)
        // If we have fewer coords, we loop.

        const ratio = textCoords.length / this.particles.length;

        for (let i = 0; i < this.particles.length; i++) {
            let index;
            if (textCoords.length > this.particles.length) {
                // Pick points evenly distributed through the array
                index = Math.floor(i * ratio);
                // Clamp to length just in case
                if (index >= textCoords.length) index = textCoords.length - 1;
            } else {
                // Not enough partials? Wrap around
                index = i % textCoords.length;
            }

            if (textCoords[index]) {
                this.particles[i].setTarget(textCoords[index].x, textCoords[index].y);
                this.particles[i].inText = true;
            }
        }
    }

    explode() {
        this.particles.forEach(p => {
            // Randomize velocities for chaotic dispersal in all directions (Smoother)
            p.vx = (Math.random() - 0.5) * 3;
            p.vy = (Math.random() - 0.5) * 3;
        });
    }

    update() {
        this.particles.forEach(p => p.update());
    }

    draw() {
        this.particles.forEach(p => p.draw());
    }
}

const effect = new Effect(canvas.width, canvas.height);

function animate(timeStamp) {
    const deltaTime = timeStamp - lastTime;
    lastTime = timeStamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // State machine logic
    if (currentState === 'ALIGNING') {
        // Check if mostly aligned? Or just wait? 
        // Easing is continuous, so we don't really 'finish'.
        // We can just switch to HOLDING immediatley, the visual is the same.
        // But let's use a timer to switch back to chaos
        holdTimer += deltaTime;
        if (holdTimer > 2000) { // Wait 2 seconds for alignment to settle
            currentState = 'HOLDING';
            holdTimer = 0;
        }
    } else if (currentState === 'HOLDING') {
        holdTimer += deltaTime;
        if (holdTimer > HOLD_DURATION) {
            currentState = 'DISPERSING';
            holdTimer = 0;
            effect.explode();
        }
    } else if (currentState === 'DISPERSING') {
        holdTimer += deltaTime;
        if (holdTimer > 4000) { // Adjusted to 4 seconds as requested
            currentState = 'CHAOS';
            holdTimer = 0;

            if (loopTimeout) clearTimeout(loopTimeout);
            loopTimeout = setTimeout(() => {
                currentState = 'ALIGNING';
            }, 2000); // Also wait a bit longer in chaos before realigning
        }
    }

    effect.update();
    effect.draw();
    requestAnimationFrame(animate);
}

// Controls
stormBtn.addEventListener('click', () => {
    const text = textInput.value;
    if (text.trim() === '') return;

    // Stop any pending loop transition
    if (loopTimeout) clearTimeout(loopTimeout);

    currentState = 'CHAOS';

    // Sample text
    effect.morph(text);

    // Start timing
    loopTimeout = setTimeout(() => {
        currentState = 'ALIGNING';
        holdTimer = 0;
    }, 1000);
});

// Window resize
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    effect.width = canvas.width;
    effect.height = canvas.height;
    // Re-morph if needed, or just let it consist
});

// Ensure font is loaded before starting
document.fonts.ready.then(function () {
    animate(0);
});
