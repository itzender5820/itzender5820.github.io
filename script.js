const { gsap } = window;
const { ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const spectrum = document.getElementById('spectrum');
const spectrumCtx = spectrum.getContext('2d');
const particleCanvas = document.getElementById('particle-field');
const particleCtx = particleCanvas.getContext('2d');
Object.assign(particleCanvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '0' });
const pointer = { x: 0, y: 0, active: false };
const particles = [];
let particleWidth = 0;
let particleHeight = 0;
let scrollVelocity = 0;

function resizeSpectrum() {
  const ratio = window.devicePixelRatio || 1;
  const bounds = spectrum.getBoundingClientRect();
  spectrum.width = bounds.width * ratio;
  spectrum.height = bounds.height * ratio;
  spectrumCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function resizeParticles() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  particleWidth = window.innerWidth;
  particleHeight = window.innerHeight;
  particleCanvas.width = particleWidth * ratio;
  particleCanvas.height = particleHeight * ratio;
  particleCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  particles.length = 0;
  const count = window.innerWidth < 700 ? 52 : 105;
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x: Math.random() * particleWidth,
      y: Math.random() * particleHeight,
      z: Math.random(),
      size: Math.random() * 1.8 + 0.4,
      drift: Math.random() * 0.45 + 0.1,
      phase: Math.random() * Math.PI * 2,
      color: i % 7 === 0 ? '200,255,85' : i % 11 === 0 ? '139,123,255' : '237,240,234',
    });
  }
}

function drawSpectrum(time = 0) {
  const width = spectrum.clientWidth;
  const height = spectrum.clientHeight;
  const cx = width / 2;
  const cy = height / 2;
  const base = Math.min(width, height) * 0.23;
  spectrumCtx.clearRect(0, 0, width, height);
  spectrumCtx.save();
  spectrumCtx.translate(cx, cy);
  spectrumCtx.rotate(time * 0.00005);
  for (let ring = 0; ring < 3; ring += 1) {
    const points = 130;
    const radius = base + ring * 18;
    spectrumCtx.beginPath();
    for (let i = 0; i <= points; i += 1) {
      const angle = (i / points) * Math.PI * 2;
      const pulse = Math.sin(i * 0.53 + time * 0.002 + ring) * (9 + ring * 3) + Math.sin(i * 1.91 - time * 0.0012) * 5;
      const r = radius + pulse + Math.sin(time * 0.001 + ring) * 3;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) spectrumCtx.moveTo(x, y); else spectrumCtx.lineTo(x, y);
    }
    spectrumCtx.closePath();
    spectrumCtx.strokeStyle = ring === 1 ? 'rgba(200,255,85,.8)' : ring === 2 ? 'rgba(139,123,255,.45)' : 'rgba(237,240,234,.3)';
    spectrumCtx.lineWidth = ring === 1 ? 1.5 : 1;
    spectrumCtx.stroke();
  }
  for (let i = 0; i < 56; i += 1) {
    const angle = (i / 56) * Math.PI * 2;
    const wave = Math.abs(Math.sin(i * 0.7 + time * 0.002)) * 22 + Math.abs(Math.sin(i * 1.79 - time * 0.001)) * 12;
    const start = base + 35;
    const end = start + wave;
    spectrumCtx.beginPath();
    spectrumCtx.moveTo(Math.cos(angle) * start, Math.sin(angle) * start);
    spectrumCtx.lineTo(Math.cos(angle) * end, Math.sin(angle) * end);
    spectrumCtx.strokeStyle = i % 5 === 0 ? 'rgba(255,114,77,.78)' : 'rgba(200,255,85,.58)';
    spectrumCtx.lineWidth = 2;
    spectrumCtx.stroke();
  }
  spectrumCtx.beginPath();
  spectrumCtx.arc(0, 0, base - 13, 0, Math.PI * 2);
  spectrumCtx.fillStyle = 'rgba(11,13,13,.72)';
  spectrumCtx.fill();
  spectrumCtx.strokeStyle = 'rgba(237,240,234,.2)';
  spectrumCtx.stroke();
  spectrumCtx.restore();
  if (!prefersReduced) requestAnimationFrame(drawSpectrum);
}

function renderParticles(time = 0) {
  particleCtx.clearRect(0, 0, particleWidth, particleHeight);
  const speed = 0.16 + Math.min(Math.abs(scrollVelocity) * 0.025, 1.6);
  particles.forEach((particle, index) => {
    particle.y -= particle.drift * speed;
    particle.x += Math.sin(time * 0.0005 + particle.phase) * 0.08;
    if (particle.y < -10) particle.y = particleHeight + 10;
    if (particle.x < -10) particle.x = particleWidth + 10;
    if (particle.x > particleWidth + 10) particle.x = -10;
    const dx = pointer.x - particle.x;
    const dy = pointer.y - particle.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const influence = pointer.active ? Math.max(0, 1 - distance / 190) : 0;
    const x = particle.x - dx * influence * 0.08;
    const y = particle.y - dy * influence * 0.08;
    const alpha = 0.15 + particle.z * 0.45 + influence * 0.35;
    particleCtx.fillStyle = `rgba(${particle.color},${alpha})`;
    particleCtx.beginPath();
    particleCtx.arc(x, y, particle.size + influence * 1.5, 0, Math.PI * 2);
    particleCtx.fill();
    if (influence > 0.18 && index % 2 === 0) {
      particleCtx.strokeStyle = `rgba(200,255,85,${influence * 0.18})`;
      particleCtx.lineWidth = 0.6;
      particleCtx.beginPath();
      particleCtx.moveTo(x, y);
      particleCtx.lineTo(pointer.x, pointer.y);
      particleCtx.stroke();
    }
  });
  if (!prefersReduced) requestAnimationFrame(renderParticles);
}

function setupScrollScenes() {
  if (prefersReduced) {
    gsap.set('.reveal', { opacity: 1, y: 0 });
    return;
  }

  gsap.utils.toArray('.reveal').forEach((element) => {
    gsap.fromTo(element, { autoAlpha: 0, y: 34 }, {
      autoAlpha: 1,
      y: 0,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: { trigger: element, start: 'top 86%', once: true },
    });
  });

  gsap.to('.hero-art', {
    yPercent: 14,
    rotate: 5,
    scale: 0.86,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1.4 },
  });
  gsap.to('.hero-copy', {
    yPercent: -12,
    opacity: 0.24,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 },
  });
  gsap.to('.hero:before', {
    rotation: 35,
    scale: 1.18,
    xPercent: -10,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1.8 },
  });
  gsap.to('.ticker-track', {
    xPercent: -18,
    ease: 'none',
    scrollTrigger: { trigger: '.ticker', start: 'top bottom', end: 'bottom top', scrub: 1 },
  });
  gsap.fromTo('.manifesto h2', { xPercent: 7, skewX: 3 }, {
    xPercent: -8,
    skewX: -3,
    ease: 'none',
    scrollTrigger: { trigger: '.manifesto', start: 'top bottom', end: 'bottom top', scrub: 1.5 },
  });
  gsap.to('.manifesto-note', {
    yPercent: -28,
    ease: 'none',
    scrollTrigger: { trigger: '.manifesto', start: 'top bottom', end: 'bottom top', scrub: 1.2 },
  });
  gsap.from('.player-frame', {
    rotateX: 12,
    y: 80,
    transformOrigin: 'center bottom',
    scrollTrigger: { trigger: '.player-stage', start: 'top 78%', end: 'top 20%', scrub: 1 },
  });
  gsap.utils.toArray('.feature-card').forEach((card, index) => {
    gsap.fromTo(card, { y: 70 + index * 12, rotate: index % 2 ? 1.5 : -1.5 }, { y: 0, rotate: 0, ease: 'power2.out', scrollTrigger: { trigger: card, start: 'top 90%', end: 'top 55%', scrub: 1 } });
  });
  gsap.to('.command-glow', {
    rotation: 115,
    scale: 1.12,
    ease: 'none',
    scrollTrigger: { trigger: '.command-section', start: 'top bottom', end: 'bottom top', scrub: 1.5 },
  });
  gsap.from('.key-row', {
    x: 45,
    stagger: 0.12,
    ease: 'power2.out',
    scrollTrigger: { trigger: '.key-stack', start: 'top 80%', end: 'top 42%', scrub: 1 },
  });
  gsap.from('.install-card', {
    clipPath: 'inset(0 100% 0 0)',
    ease: 'power3.inOut',
    scrollTrigger: { trigger: '.install', start: 'top 80%', end: 'top 28%', scrub: 1 },
  });
}

ScrollTrigger.create({
  start: 0,
  end: 'max',
  onUpdate: (self) => { scrollVelocity = self.getVelocity() / 100; },
});

window.addEventListener('pointermove', (event) => {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.active = true;
});
window.addEventListener('pointerleave', () => { pointer.active = false; });
window.addEventListener('resize', () => { resizeSpectrum(); resizeParticles(); ScrollTrigger.refresh(); });

resizeSpectrum();
resizeParticles();
setupScrollScenes();
drawSpectrum();
renderParticles();
