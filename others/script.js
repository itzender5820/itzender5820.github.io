const canvas = document.querySelector('#cosmic-canvas');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const pointer = { x: 0, y: 0, active: false };
let gpuCleanup = null;

function makeParticles(count = 180) {
  return Array.from({ length: count }, (_, i) => ({
    x: Math.random(), y: Math.random(), z: Math.random(), size: Math.random() * 2.2 + .35,
    drift: Math.random() * .18 + .035, phase: Math.random() * Math.PI * 2,
    color: i % 9 === 0 ? [245,183,68] : i % 13 === 0 ? [220,102,131] : [255,244,218]
  }));
}

function startCanvasFallback() {
  const ctx = canvas.getContext('2d', { alpha: true });
  const particles = makeParticles(window.innerWidth < 700 ? 90 : 170);
  let width = 0; let height = 0; let dpr = 1;
  const resize = () => { dpr = Math.min(devicePixelRatio || 1, 2); width = innerWidth; height = innerHeight; canvas.width = width * dpr; canvas.height = height * dpr; canvas.style.width = `${width}px`; canvas.style.height = `${height}px`; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  const draw = (time = 0) => {
    ctx.clearRect(0, 0, width, height);
    particles.forEach((p, index) => {
      p.y -= p.drift * .0007 * (reduced ? 0 : 1);
      if (p.y < -.02) p.y = 1.02;
      const x = p.x * width + Math.sin(time * .0004 + p.phase) * 10;
      const y = p.y * height;
      const dx = pointer.x - x; const dy = pointer.y - y; const distance = Math.hypot(dx, dy);
      const influence = pointer.active ? Math.max(0, 1 - distance / 220) : 0;
      const alpha = .18 + p.z * .5 + influence * .3;
      ctx.fillStyle = `rgba(${p.color.join(',')},${alpha})`;
      ctx.beginPath(); ctx.arc(x - dx * influence * .05, y - dy * influence * .05, p.size + influence * 1.2, 0, Math.PI * 2); ctx.fill();
      if (influence > .2 && index % 4 === 0) { ctx.strokeStyle = `rgba(245,183,68,${influence * .16})`; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(pointer.x, pointer.y); ctx.stroke(); }
    });
    if (!reduced) requestAnimationFrame(draw);
  };
  addEventListener('resize', resize); resize(); draw();
  return () => removeEventListener('resize', resize);
}

async function startWebGPU() {
  if (!navigator.gpu || reduced) return false;
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return false;
  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  const count = innerWidth < 700 ? 140 : 260;
  const data = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) { data[i * 4] = Math.random(); data[i * 4 + 1] = Math.random(); data[i * 4 + 2] = Math.random(); data[i * 4 + 3] = Math.random() * 2.2 + .5; }
  const particleBuffer = device.createBuffer({ size: data.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(particleBuffer, 0, data);
  const uniformBuffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const shader = device.createShaderModule({ code: `struct Particle { x:f32, y:f32, z:f32, size:f32 }; struct U { time:f32, aspect:f32, pointerX:f32, pointerY:f32 }; @group(0) @binding(0) var<storage,read> particles:array<Particle>; @group(0) @binding(1) var<uniform> u:U; struct V { @builtin(position) pos:vec4<f32>, @location(0) color:vec4<f32> }; @vertex fn vs(@builtin(vertex_index) i:u32)->V { let p=particles[i]; let drift=fract(p.y-u.time*(.006+.012*p.z)); let x=p.x*2.0-1.0; let y=1.0-drift*2.0; let pos=vec2<f32>(x,y); var o:V; o.pos=vec4<f32>(pos,0.0,1.0); o.color=vec4<f32>(mix(vec3<f32>(1.0,.96,.85),vec3<f32>(.96,.43,.32),p.z),.25+.55*p.z); return o } @fragment fn fs(@location(0) c:vec4<f32>)->@location(0) vec4<f32>{ return c }` });
  const pipeline = device.createRenderPipeline({ layout: 'auto', vertex: { module: shader, entryPoint: 'vs' }, fragment: { module: shader, entryPoint: 'fs', targets: [{ format, blend: { color: { srcFactor:'src-alpha', dstFactor:'one-minus-src-alpha', operation:'add' }, alpha: { srcFactor:'one', dstFactor:'one-minus-src-alpha', operation:'add' } } }] }, primitive: { topology: 'point-list' } });
  const bindGroup = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: particleBuffer } }, { binding: 1, resource: { buffer: uniformBuffer } }] });
  const resize = () => { const dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; context.configure({ device, format, alphaMode:'premultiplied' }); };
  const frame = (time = 0) => { device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([time / 1000, innerWidth / innerHeight, pointer.x / innerWidth, pointer.y / innerHeight])); const encoder = device.createCommandEncoder(); const pass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: { r:.07,g:.04,b:.18,a:0 }, loadOp:'clear', storeOp:'store' }] }); pass.setPipeline(pipeline); pass.setBindGroup(0, bindGroup); pass.draw(count); pass.end(); device.queue.submit([encoder.finish()]); gpuCleanup = () => removeEventListener('resize', resize); if (!reduced) requestAnimationFrame(frame); };
  addEventListener('resize', resize); resize(); frame(); return true;
}

async function boot() { try { if (!(await startWebGPU())) startCanvasFallback(); } catch (error) { console.info('WebGPU fallback:', error); startCanvasFallback(); } }
addEventListener('pointermove', (event) => { pointer.x = event.clientX; pointer.y = event.clientY; pointer.active = true; });
addEventListener('pointerleave', () => { pointer.active = false; });
boot();

const reveal = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.animate([{ opacity: 0, transform: 'translateY(22px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 900, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }); reveal.unobserve(entry.target); } }), { threshold: .12 });
document.querySelectorAll('.letter-layout,.wish-grid article,.closing-copy,.lotus,.section-label').forEach((el) => reveal.observe(el));
