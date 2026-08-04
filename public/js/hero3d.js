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

  /* ---------- The sea ----------
     A wave-displaced plane under the car: layered sines with analytic
     normals so crests catch the studio light, and a radial alpha fade
     so the water dissolves into the page instead of ending at an edge. */
  const SEA_W = 240, SEA_D = 100;
  const seaGeo = new THREE.PlaneGeometry(SEA_W, SEA_D, 110, 60);
  seaGeo.rotateX(-Math.PI / 2);
  const seaBase = seaGeo.attributes.position.array.slice(); /* rest positions */
  /* Custom shader: deep water with warm spec glints and a radial alpha
     fade so the surface dissolves into the page instead of ending at an edge. */
  const seaMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uDeep: { value: new THREE.Color(0x1a4560) },
      uShallow: { value: new THREE.Color(0x4a8fb5) },
      uWarm: { value: new THREE.Color(0xff9a52) },
      uCool: { value: new THREE.Color(0x8d82ff) },
      uHaze: { value: new THREE.Color(0x2e211d) },
    },
    vertexShader: `
      varying vec3 vNormalW;
      varying vec3 vPosW;
      varying vec2 vLocal;
      void main() {
        vLocal = vec2(position.x, position.z);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vPosW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec3 vNormalW;
      varying vec3 vPosW;
      varying vec2 vLocal;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uWarm;
      uniform vec3 uCool;
      uniform vec3 uHaze;
      void main() {
        vec3 N = normalize(vNormalW);
        vec3 V = normalize(cameraPosition - vPosW);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 2.0);
        vec3 col = mix(uDeep, uShallow, fres);
        /* warm key glint + faint cool rim, like the studio lights */
        vec3 Lw = normalize(vec3(4.5, 3.5, 4.0));
        vec3 Lc = normalize(vec3(-4.5, 2.5, 3.0));
        col += uWarm * pow(max(dot(reflect(-Lw, N), V), 0.0), 70.0) * 0.9;
        col += uCool * pow(max(dot(reflect(-Lc, N), V), 0.0), 90.0) * 0.35;
        /* vLocal.y runs +50 (near) .. -50 (far): haze the distance, fade the
           far edge into the sky and the near edge into the shoreline */
        float haze = 1.0 - smoothstep(-42.0, 20.0, vLocal.y);
        col = mix(col, uHaze, haze * 0.8);
        float a = 0.94 * smoothstep(-50.0, -36.0, vLocal.y) * (1.0 - smoothstep(28.0, 37.0, vLocal.y));
        gl_FragColor = vec4(col, a);
      }
    `,
  });
  const WAVES = [
    /* ax, az, k (spatial freq), amp, speed */
    [0.84, 0.55, 1.9, 0.12, 1.15],
    [-0.42, 0.91, 3.1, 0.07, 1.7],
    [0.99, -0.14, 5.3, 0.024, 2.3],
    [0.26, -0.97, 8.0, 0.012, 3.1],
  ];
  const updateSea = (time) => {
    const posAttr = seaGeo.attributes.position;
    const nrmAttr = seaGeo.attributes.normal;
    const p = posAttr.array, nrm = nrmAttr.array;
    for (let i = 0; i < p.length; i += 3) {
      const x = seaBase[i], z = seaBase[i + 2];
      let h = 0, dhx = 0, dhz = 0;
      for (const [ax, az, k, amp, sp] of WAVES) {
        const ph = (x * ax + z * az) * k + time * sp;
        h += amp * Math.sin(ph);
        const d = amp * k * Math.cos(ph);
        dhx += d * ax;
        dhz += d * az;
      }
      p[i + 1] = h;
      /* analytic surface normal: normalize(-dh/dx, 1, -dh/dz) */
      const inv = 1 / Math.sqrt(dhx * dhx + 1 + dhz * dhz);
      nrm[i] = -dhx * inv; nrm[i + 1] = inv; nrm[i + 2] = -dhz * inv;
    }
    posAttr.needsUpdate = true;
    nrmAttr.needsUpdate = true;
  };
  const applySeaTheme = () => {
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    seaMat.uniforms.uDeep.value.set(light ? 0x35678a : 0x1a4560);
    seaMat.uniforms.uShallow.value.set(light ? 0x7fb2d4 : 0x4a8fb5);
    seaMat.uniforms.uHaze.value.set(light ? 0xd8cfc9 : 0x2e211d);
  };
  applySeaTheme();
  new MutationObserver(applySeaTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.position.set(0, -2.1, -50);
  group.add(sea);
  updateSea(0);
  renderer.render(scene, camera); /* sea shows immediately, car pops in when loaded */

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
    if (!visible || document.hidden) return;
    t += 1 / 60;
    updateSea(t);
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
