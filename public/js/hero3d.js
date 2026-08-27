/* VG AUTO EXPORT — live 3D glass car for the home hero.
   A CC0 car model (Khronos glTF sample "ToyCar", geometry only) re-skinned
   as brand-orange glass and slowly turntabling, rendered with self-hosted
   three.js. Degrades gracefully: model load error -> glass torus knot;
   no WebGL -> static glow; reduced motion -> still frame. */
const host = document.querySelector('[data-hero-3d]');
if (host) {
  /* three.js and the car model are heavy; fetch them only once the page has
     finished loading and the main thread is idle, so first paint and
     interactivity never wait on the 3D scene. */
  const idle = window.requestIdleCallback ? (fn) => window.requestIdleCallback(fn, { timeout: 1500 }) : (fn) => setTimeout(fn, 250);
  const boot = () => idle(async () => {
    try {
      const [THREE, { GLTFLoader }] = await Promise.all([
        import('./three.module.min.js?v=160'),
        import('./GLTFLoader.js?v=160'),
      ]);
      init(host, THREE, GLTFLoader);
    } catch (e) {
      host.classList.add('no-webgl');
    }
  });
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot, { once: true });
}

function init(host, THREE, GLTFLoader) {
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

  /* ---------- Exploded view ----------
     The car arrives as one welded shell plus wheels, so the "parts" are
     found geometrically: union-find over the triangle graph splits the
     body into its ~118 connected pieces (bumpers, lights, grille, trim,
     seats…). Each vertex then carries the offset its own piece should
     travel, and a single uniform slides every piece out and back — one
     draw call, no per-part meshes. */
  const explodeU = { value: 1 };

  const buildExplodeOffsets = (geometry, localCenter) => {
    const pos = geometry.attributes.position;
    const count = pos.count;
    const offsets = new Float32Array(count * 3);
    const index = geometry.index;

    /* piece id per vertex */
    const parent = new Int32Array(count);
    for (let i = 0; i < count; i++) parent[i] = i;
    const find = (x) => {
      let r = x;
      while (parent[r] !== r) r = parent[r];
      while (parent[x] !== r) { const nx = parent[x]; parent[x] = r; x = nx; }
      return r;
    };
    const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
    if (index) {
      const arr = index.array;
      for (let t = 0; t < arr.length; t += 3) { union(arr[t], arr[t + 1]); union(arr[t + 1], arr[t + 2]); }
    }

    /* centroid of every piece */
    const sums = new Map();
    for (let i = 0; i < count; i++) {
      const r = find(i);
      let s = sums.get(r);
      if (!s) { s = { x: 0, y: 0, z: 0, n: 0 }; sums.set(r, s); }
      s.x += pos.getX(i); s.y += pos.getY(i); s.z += pos.getZ(i); s.n++;
    }

    /* direction + distance from the shared centre, so outer trim travels
       further than pieces near the core; the core itself stays put */
    let maxDist = 1e-6;
    sums.forEach((s) => {
      s.cx = s.x / s.n - localCenter.x;
      s.cy = s.y / s.n - localCenter.y;
      s.cz = s.z / s.n - localCenter.z;
      s.d = Math.hypot(s.cx, s.cy, s.cz);
      if (s.d > maxDist) maxDist = s.d;
    });
    sums.forEach((s, root) => {
      if (s.d < 1e-4 || s.n > count * 0.25) { s.ox = s.oy = s.oz = 0; return; } /* main shell = core */
      const mag = 0.16 + 0.40 * (s.d / maxDist);
      s.ox = (s.cx / s.d) * mag;
      s.oy = (s.cy / s.d) * mag;
      s.oz = (s.cz / s.d) * mag;
    });
    for (let i = 0; i < count; i++) {
      const s = sums.get(find(i));
      offsets[i * 3] = s.ox; offsets[i * 3 + 1] = s.oy; offsets[i * 3 + 2] = s.oz;
    }
    geometry.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 3));
  };

  const patchExplode = (material) => {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uExplode = explodeU;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 aOffset;\nuniform float uExplode;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += aOffset * uExplode;');
    };
    material.customProgramCacheKey = () => 'vg-explode';
    material.needsUpdate = true;
  };

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

      /* split the body into pieces and remember where each wheel rests */
      patchExplode(glassMat);
      patchExplode(wheelMat);
      car.updateMatrixWorld(true);
      const worldCentre = new THREE.Vector3();
      new THREE.Box3().setFromObject(car).getCenter(worldCentre);
      car.traverse((o) => {
        if (!o.isMesh) return;
        const isWheelPart = wheels.some((w) => w === o || o.parent === w);
        if (isWheelPart) {
          /* wheels travel as whole assemblies on their node, not per vertex */
          if (!o.geometry.getAttribute('aOffset')) {
            o.geometry.setAttribute('aOffset',
              new THREE.BufferAttribute(new Float32Array(o.geometry.attributes.position.count * 3), 3));
          }
          return;
        }
        const localCentre = o.worldToLocal(worldCentre.clone());
        buildExplodeOffsets(o.geometry, localCentre);
      });
      wheels.forEach((w) => {
        w.userData.restX = w.position.x;
        /* pull each wheel out along its own axle */
        w.userData.outX = (w.name.slice(-1) === 'l' ? 1 : -1) * 0.62;
      });

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
      carRig = { shell, car, wheels, lines: lines.children, lineMat };
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

  if (reduced) { explodeU.value = 0; return; } /* still frame: the assembled car */

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

  /* Apart → together → apart, on a loop. Phases are [seconds, from, to]. */
  const CYCLE = [
    [1.4, 1, 1],   /* hold in pieces  */
    [2.6, 1, 0],   /* assemble        */
    [4.6, 0, 0],   /* drive           */
    [2.2, 0, 1],   /* come apart      */
  ];
  const CYCLE_LEN = CYCLE.reduce((a, p) => a + p[0], 0);
  const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const explodeAt = (time) => {
    let u = time % CYCLE_LEN;
    for (const [dur, from, to] of CYCLE) {
      if (u < dur) return from + (to - from) * easeInOut(u / dur);
      u -= dur;
    }
    return 0;
  };

  /* Wall-clock driven: the same speed on a 60Hz laptop, a 120Hz phone and a
     slow GPU. Per-frame constants below stay tuned for 60fps via `step`. */
  const clock = new THREE.Clock();
  let t = 0;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!visible || document.hidden || (!spin && !carRig)) return;
    t += dt;
    const step = dt * 60;
    if (carRig) {
      const e = explodeAt(t);
      explodeU.value = e;
      const solid = 1 - e; /* 1 while the car is whole */

      /* rolling wheels, pulled out along their axles as the car comes apart */
      for (const w of carRig.wheels) {
        w.rotation.x += WHEEL_SPEED * step;
        w.position.x = w.userData.restX + w.userData.outX * e;
      }
      /* suspension: micro bob + faint pitch — only while it is a car */
      carRig.car.position.y = (Math.sin(t * 9.0) * 0.018 + Math.sin(t * 23.0) * 0.006) * solid;
      carRig.car.rotation.x = Math.sin(t * 3.1) * 0.006 * solid;
      carRig.shell.rotation.y = -0.7 + Math.sin(t * 0.35) * 0.12;
      /* air streaks only make sense around a car that is driving */
      carRig.lineMat.opacity = 0.35 * solid;
      for (const m of carRig.lines) {
        m.position.z -= m.userData.speed * solid * step;
        if (m.position.z < -4.5) m.position.z += 9;
      }
    } else if (spin) {
      spin.rotation.y += 0.004 * step; /* fallback knot turntable */
    }
    const lerp = Math.min(1, 0.06 * step);
    group.rotation.x += (targetX - group.rotation.x) * lerp;
    group.rotation.y += (targetY - group.rotation.y) * lerp;
    renderer.render(scene, camera);
  });
}
