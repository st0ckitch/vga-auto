/* VG AUTO EXPORT — live 3D glass car for the home hero.
   A CC0 car model (Khronos glTF sample "ToyCar", geometry only) re-skinned
   as brand-orange glass and slowly turntabling, rendered with self-hosted
   three.js. Degrades gracefully: model load error -> glass torus knot;
   no WebGL -> static glow; reduced motion -> still frame. */
import * as THREE from './three.module.min.js?v=160';
import { GLTFLoader } from './GLTFLoader.js?v=160';

const host = document.querySelector('[data-hero-3d]');
if (host) {
  try {
    init(host);
  } catch (e) {
    host.classList.add('no-webgl');
  }
}

function init(host) {
  const canvas = host.querySelector('.hero-3d__canvas');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
  camera.position.set(0, 0.7, 8.7);
  camera.lookAt(0, -0.1, 0);

  /* Procedural "studio" environment: warm key, orange and indigo fills.
     Rendered once into a PMREM env map — this is what makes the glass read as glass. */
  const envScene = new THREE.Scene();
  const addPanel = (hex, boost, w, h, x, y, z, rx, ry) => {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(boost), side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, 0);
    envScene.add(mesh);
  };
  addPanel(0xfff1e6, 5.0, 14, 6, 0, 8, 0, Math.PI / 2, 0);      /* warm ceiling key   */
  addPanel(0xff8039, 3.2, 8, 10, -9, 0, 0, 0, Math.PI / 2);     /* orange left fill   */
  addPanel(0x7a6eff, 1.6, 8, 10, 9, 0, 0, 0, -Math.PI / 2);     /* indigo right fill  */
  addPanel(0x241f20, 1.0, 16, 10, 0, 0, -9, 0, 0);              /* charcoal backdrop  */
  addPanel(0xffb380, 1.4, 12, 6, 0, -8, 0, -Math.PI / 2, 0);    /* soft amber floor   */
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0.05).texture;
  pmrem.dispose();

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transmission: 1,
    thickness: 0.9,
    roughness: 0.07,
    metalness: 0,
    ior: 1.45,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    attenuationColor: new THREE.Color(0xff8039),
    attenuationDistance: 3.0,
    iridescence: 0.28,
    iridescenceIOR: 1.3,
  });

  /* parallax group > turntable group > model */
  const group = new THREE.Group();
  const turntable = new THREE.Group();
  group.add(turntable);
  scene.add(group);


  /* Motion state, populated once the subject is ready.
     Scene-space axes after the model's baked rotation: car length = Z
     (front = +Z), up = +Y, axles = X. Wheels spin about their local X. */
  let spin = null;          /* fallback knot only */
  let carRig = null;        /* { shell, wheels, lines } */
  const WHEEL_SPEED = 0.26; /* rad/frame */

  const loader = new GLTFLoader();
  const modelUrl = new URL('../models/car.glb?v=3', import.meta.url).href;
  loader.load(
    modelUrl,
    (gltf) => {
      const car = gltf.scene;
      /* wheels are thin volumes — deepen their tint so they match the body */
      const wheelMat = glassMat.clone();
      wheelMat.attenuationDistance = 1.1;
      wheelMat.iridescence = 0.15;
      const wheels = [];
      car.traverse((o) => { if (o.name && o.name.indexOf('wheel_') === 0) wheels.push(o); });
      car.traverse((o) => {
        if (!o.isMesh) return;
        const inWheel = wheels.some((w) => w === o || w.children.indexOf(o) >= 0 || o.parent === w);
        o.material = inWheel ? wheelMat : glassMat;
      });
      /* normalize: center at origin, longest side ~5.4 world units */
      let box = new THREE.Box3().setFromObject(car);
      const size = box.getSize(new THREE.Vector3());
      const s = 5.4 / Math.max(size.x, size.y, size.z);
      car.scale.setScalar(s);
      box = new THREE.Box3().setFromObject(car);
      const center = box.getCenter(new THREE.Vector3());
      car.position.sub(center);

      const shell = new THREE.Group();
      shell.add(car);

      /* speed-line streaks flowing past the car (in shell space, -Z = backward) */
      const lines = new THREE.Group();
      const lineMat = new THREE.MeshBasicMaterial({
        color: 0xffc9a3, transparent: true, opacity: 0.35,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      for (let i = 0; i < 14; i++) {
        const len = 0.7 + Math.random() * 1.6;
        const geo = new THREE.PlaneGeometry(len, 0.016 + Math.random() * 0.02);
        const m = new THREE.Mesh(geo, lineMat);
        m.rotation.y = Math.PI / 2;                       /* lie along Z */
        const ang = Math.random() * Math.PI * 2;
        const rad = 1.35 + Math.random() * 1.1;           /* tube around the car */
        m.position.set(Math.cos(ang) * rad, Math.sin(ang) * rad * 0.55 + 0.2, Math.random() * 9 - 4.5);
        m.userData.speed = 0.09 + Math.random() * 0.05;
        lines.add(m);
      }
      shell.add(lines);

      shell.rotation.x = 0.26;          /* slight top-down view */
      shell.rotation.y = -0.7;          /* three-quarter start pose */
      turntable.add(shell);
      carRig = { shell, car, wheels, lines: lines.children };
      renderer.render(scene, camera);   /* first frame + reduced-motion frame */
    },
    undefined,
    () => {
      /* model failed to load — fall back to the glass knot so the hero never looks empty */
      const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.45, 0.44, 280, 44, 2, 3), glassMat);
      knot.rotation.set(0.45, -0.35, 0.1);
      turntable.add(knot);
      spin = knot;
      renderer.render(scene, camera);
    }
  );

  const warm = new THREE.PointLight(0xff8039, 40, 30);
  warm.position.set(4.5, 3.5, 4);
  const cool = new THREE.PointLight(0x7a6eff, 22, 30);
  cool.position.set(-4.5, -2.5, 3);
  scene.add(warm, cool);

  /* Sizing */
  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (reduced) renderer.render(scene, camera);
  };
  resize();
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(host);
  else window.addEventListener('resize', resize);

  if (reduced) return; /* still frame is rendered when the model arrives */

  /* Cursor parallax (lerped) */
  let targetX = 0, targetY = 0;
  const heroSection = host.closest('.hero-v2') || host;
  heroSection.addEventListener('pointermove', (e) => {
    const r = heroSection.getBoundingClientRect();
    targetY = ((e.clientX - r.left) / r.width - 0.5) * 0.5;
    targetX = ((e.clientY - r.top) / r.height - 0.5) * 0.3;
  });
  heroSection.addEventListener('pointerleave', () => { targetX = 0; targetY = 0; });

  /* Render only while visible */
  let visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((en) => { visible = en[0].isIntersecting; }, { threshold: 0.02 }).observe(host);
  }

  let t = 0;
  renderer.setAnimationLoop(() => {
    if (!visible || document.hidden || (!spin && !carRig)) return;
    t += 1 / 60;
    if (carRig) {
      /* rolling wheels */
      for (const w of carRig.wheels) w.rotation.x += WHEEL_SPEED;
      /* suspension: micro bob + faint pitch, plus a slow pose sway */
      carRig.car.position.y = Math.sin(t * 9.0) * 0.018 + Math.sin(t * 23.0) * 0.006;
      carRig.car.rotation.x = Math.sin(t * 3.1) * 0.006;
      carRig.shell.rotation.y = -0.7 + Math.sin(t * 0.35) * 0.12;
      /* air streaking backwards past the body */
      for (const m of carRig.lines) {
        m.position.z -= m.userData.speed;
        if (m.position.z < -4.5) m.position.z += 9;
      }
    } else if (spin) {
      spin.rotation.y += 0.004; /* fallback knot turntable */
    }
    group.rotation.x += (targetX - group.rotation.x) * 0.06;
    group.rotation.y += (targetY - group.rotation.y) * 0.06;
    renderer.render(scene, camera);
  });
}
