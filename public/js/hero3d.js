/* VG AUTO EXPORT — live 3D glass sculpture for the home hero.
   A slowly turning glass torus knot rendered with three.js (self-hosted),
   lit by a procedural studio environment in the brand palette.
   Degrades gracefully: no WebGL -> static glow; reduced motion -> still frame. */
import * as THREE from './three.module.min.js?v=160';

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
  camera.position.set(0, 0, 8.7);

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

  const group = new THREE.Group();
  scene.add(group);

  const knot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(1.45, 0.44, 280, 44, 2, 3),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 1,
      thickness: 1.7,
      roughness: 0.07,
      metalness: 0,
      ior: 1.45,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      attenuationColor: new THREE.Color(0xff8039),
      attenuationDistance: 1.6,
      iridescence: 0.6,
      iridescenceIOR: 1.3,
    })
  );
  knot.rotation.set(0.45, -0.35, 0.1);
  group.add(knot);

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

  if (reduced) {
    renderer.render(scene, camera);
    return;
  }

  /* Cursor parallax (lerped) */
  let targetX = 0, targetY = 0;
  const heroSection = host.closest('.hero-v2') || host;
  heroSection.addEventListener('pointermove', (e) => {
    const r = heroSection.getBoundingClientRect();
    targetY = ((e.clientX - r.left) / r.width - 0.5) * 0.5;
    targetX = ((e.clientY - r.top) / r.height - 0.5) * 0.35;
  });
  heroSection.addEventListener('pointerleave', () => { targetX = 0; targetY = 0; });

  /* Render only while visible */
  let visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((en) => { visible = en[0].isIntersecting; }, { threshold: 0.02 }).observe(host);
  }

  renderer.setAnimationLoop(() => {
    if (!visible || document.hidden) return;
    knot.rotation.y += 0.0035;
    knot.rotation.x += 0.0012;
    group.rotation.x += (targetX - group.rotation.x) * 0.06;
    group.rotation.y += (targetY - group.rotation.y) * 0.06;
    renderer.render(scene, camera);
  });
}
