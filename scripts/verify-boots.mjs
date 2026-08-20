/**
 * Does the boot actually read on screen?
 *
 * Boots the same DOM stubs the simulator uses, builds a real Runner, toggles
 * the power-up, and measures the visible result: what turns on, how big it is
 * in pixels from the live camera framing, and whether the take-off ring is
 * driven and cleaned up.
 */
const NOOP = () => {};
const grad = { addColorStop: NOOP };
const ctx = new Proxy({}, {
  get(_, k) {
    if (k === 'measureText') return () => ({ width: 40 });
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
    if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
    if (k === 'canvas') return { width: 1, height: 1 };
    return NOOP;
  },
  set() { return true; },
});
const el = (tag = 'div') => ({
  tagName: tag.toUpperCase(), width: 1, height: 1, style: {}, dataset: {}, children: [],
  classList: { add: NOOP, remove: NOOP, toggle: NOOP, contains: () => false },
  getContext: () => ctx, appendChild(c) { this.children.push(c); return c; },
  removeChild: NOOP, remove: NOOP, addEventListener: NOOP, setAttribute: NOOP,
  querySelector: () => el(), querySelectorAll: () => [], toDataURL: () => 'data:,',
});
globalThis.window = { addEventListener: NOOP, devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720,
  localStorage: { getItem: () => null, setItem: NOOP } };
globalThis.document = { createElement: (t) => el(t), createElementNS: (_, t) => el(t),
  getElementById: () => el(), querySelector: () => el(), addEventListener: NOOP, hidden: false };
globalThis.localStorage = window.localStorage;
globalThis.self = globalThis;
globalThis.Image = class { set src(v) { queueMicrotask(() => this.onerror?.(new Error('headless'))); } };

const THREE = await import('three');
const { Runner } = await import('../src/entities/Runner.js');
const { CONFIG } = await import('../src/config.js');

const scene = new THREE.Scene();
const r = new Runner(scene);

/* ---- what is on the model ---- */
const boots = r.legs.map((l) => l.boot);
const parts = boots[0].children.length;
console.log('boots built            :', boots.length, `(${parts} parts each: shell + 3 sole plates + halo)`);
console.log('hidden before pickup   :', boots.every((b) => !b.visible), '| shoe shown:', r.legs.every((l) => l.foot.visible));

r.setSneakers(true);
console.log('after setSneakers(true):', 'boot', boots.every((b) => b.visible), '| plain shoe hidden', r.legs.every((l) => !l.foot.visible));

/* ---- how big is it on screen, from the real camera framing ---- */
// Feet sit at the ballast; the camera is behind and above by the calm framing.
const d = Math.hypot(CONFIG.CAM_BACK_CALM, CONFIG.CAM_HEIGHT_CALM - 0.2);
const worldPerScreen = 2 * d * Math.tan((CONFIG.FOV_CALM / 2) * Math.PI / 180);
const pxPerM = 720 / worldPerScreen;
const shoe = { w: 0.19, h: 0.11 };
const solid = new THREE.Group();
boots[0].children.filter((c) => c.isMesh).forEach((c) => solid.add(c.clone()));
const bootBox = new THREE.Box3().setFromObject(solid);
const bw = bootBox.max.x - bootBox.min.x;
const bh = bootBox.max.y - bootBox.min.y;
console.log(`\nat the calm framing (${d.toFixed(1)} m away, ${pxPerM.toFixed(1)} px/m on a 720p viewport):`);
console.log(`  plain shoe : ${(shoe.w * pxPerM).toFixed(1)} x ${(shoe.h * pxPerM).toFixed(1)} px, colour #e8e4dc (unlit grey-white)`);
console.log(`  boot       : ${(bw * pxPerM).toFixed(1)} x ${(bh * pxPerM).toFixed(1)} px, colour #9ae06a + emissive`);
console.log(`  boot halo  : ${(1.15 * pxPerM).toFixed(1)} px of additive glow per foot`);
console.log(`  area gain  : x${((bw * bh) / (shoe.w * shoe.h)).toFixed(1)}`);

/* ---- take-off ring ---- */
r.dead = false;
const jumped = r.jump();
console.log('\njump() while booted    :', jumped, '| vy', r.vy.toFixed(2), `(x${CONFIG.SNEAKER_JUMP_MULT} of ${CONFIG.JUMP_VELOCITY})`);
console.log('ring armed             :', r.ring.visible, '| life', r.ringLife.toFixed(2));
let peakScale = 0;
for (let i = 0; i < 60; i++) {
  r.update(1 / 60, CONFIG.START_SPEED, 0);
  peakScale = Math.max(peakScale, r.ring.scale.x);
}
console.log('after 1 s              : ring visible', r.ring.visible, '| peak scale x' + peakScale.toFixed(2),
  '| opacity', r.ring.material.opacity.toFixed(3));

/* ---- reset ---- */
r.reset();
console.log('\nafter reset()          : boots hidden', boots.every((b) => !b.visible),
  '| shoe back', r.legs.every((l) => l.foot.visible), '| ring off', !r.ring.visible);

/* ---- does the sole actually reach the ballast? ---- */
const soleY = (leg) => {
  scene.updateMatrixWorld(true);
  let lo = Infinity;
  leg.boot.traverse((c) => {
    if (!c.isMesh) return;
    const b = new THREE.Box3().setFromObject(c);
    lo = Math.min(lo, b.min.y);
  });
  return lo;
};
r.reset();
r.setSneakers(true);
for (let i = 0; i < 60; i++) r.update(1 / 60, CONFIG.START_SPEED, 0);
console.log('\nlift eased to          :', r.bootLift.toFixed(3), 'm (target 0.21)');
console.log('boot sole vs ballast   :', soleY(r.legs[0]).toFixed(3), 'm  (0 = standing on the stones)');
r.setSneakers(false);
for (let i = 0; i < 60; i++) r.update(1 / 60, CONFIG.START_SPEED, 0);
console.log('lift released          :', r.bootLift.toFixed(3), 'm');

/* ---- where did that come from? ---- */
r.reset(); r.setSneakers(true);
for (let i = 0; i < 60; i++) r.update(1 / 60, CONFIG.START_SPEED, 0);
scene.updateMatrixWorld(true);
console.log('\ngroup       :', r.group.position.toArray().map(n => +n.toFixed(2)).join(', '));
console.log('hips.y      :', r.hips.position.y.toFixed(3));
console.log('body        :', r.body.position.toArray().map(n => +n.toFixed(2)).join(', '), 'rotX', r.body.rotation.x.toFixed(2));
for (const [i, l] of r.legs.entries()) {
  console.log(`leg${i} knee world y:`, l.knee.getWorldPosition(new THREE.Vector3()).y.toFixed(3),
    '| boot world y:', l.boot.getWorldPosition(new THREE.Vector3()).y.toFixed(3),
    '| hip rotX', l.hip.rotation.x.toFixed(2), 'knee rotX', l.knee.rotation.x.toFixed(2));
}

/* ---- the planted foot over a full stride ---- */
function lowestOverStride(booted) {
  r.reset();
  r.setSneakers(booted);
  for (let i = 0; i < 40; i++) r.update(1 / 60, CONFIG.START_SPEED, 0);   // settle the lift
  let lo = Infinity;
  for (let i = 0; i < 180; i++) {
    r.update(1 / 60, CONFIG.START_SPEED, 0);
    scene.updateMatrixWorld(true);
    for (const l of r.legs) {
      const part = booted ? l.boot : l.foot;
      part.traverse((c) => {
        if (c.isMesh) lo = Math.min(lo, new THREE.Box3().setFromObject(c).min.y);
      });
    }
  }
  return lo;
}
const plain = lowestOverStride(false);
const booted = lowestOverStride(true);
console.log('\nplanted contact over a 3 s stride:');
console.log('  plain shoe  :', plain.toFixed(3), 'm');
console.log('  rubber boot :', booted.toFixed(3), 'm   (drift vs shoe:', (booted - plain).toFixed(3), 'm)');
