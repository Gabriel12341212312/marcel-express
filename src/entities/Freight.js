/**
 * Rolling stock: the freight that is standing on the line in front of you.
 *
 * This is the centre of the game. A "consist" is a run of individual wagons
 * coupled nose to tail down one lane, each one its own collision volume with
 * its own roof height — so you can jump up onto a container flat, run along
 * the roofs, drop onto a low flat wagon, and be stopped by the locomotive at
 * the head of the train.
 *
 * ---------------------------------------------------------------------------
 * Draw calls
 * ---------------------------------------------------------------------------
 *
 * A wagon modelled honestly is about twenty meshes — underframe, two bogies,
 * eight wheels, four buffers, body, roof, lettering. With forty-odd wagons on
 * the line that was nine hundred draw calls on its own, and measurement put
 * the game firmly CPU-bound long before the GPU noticed the twenty-nine
 * thousand triangles.
 *
 * So every wagon is baked down to FOUR meshes: one merged steelwork geometry,
 * one merged body geometry, and two lettering decals. The merged geometries
 * are cached by shape, so the hundredth container flat costs one Mesh object
 * and nothing else. Nothing about how it looks changed.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WAGON_LABELS, LOCO_LABELS, pick } from '../data/lines.js';
import { wagonBodyTexture, locoBodyTexture, stencilTexture, glowSprite, crossingSignTexture } from '../world/textures.js';

const geoCache = new Map();
const matCache = new Map();

const geo = (k, f) => { let g = geoCache.get(k); if (!g) { g = f(); geoCache.set(k, g); } return g; };
const mat = (k, f) => { let m = matCache.get(k); if (!m) { m = f(); matCache.set(k, m); } return m; };

const WIDTH = 2.5;
const HALF_W = 1.28;

/** Muted, believable freight liveries. */
const LIVERIES = [0x6a4a3a, 0x3a4a5a, 0x4a4a44, 0x5a3a34, 0x3a5044, 0x584a30];

/** Everything structural is one shade of weathered steel, so it can merge. */
const STEEL = 0x21242a;

/**
 * Wagon catalogue. `top` is the roof you land on; all of them sit inside a
 * ground jump (apex 1.54 m) plus the mount tolerance, so every wagon in the
 * game is reachable from the ballast.
 */
export const WAGONS = {
  container: { len: 7.0, top: 1.48, weight: 10 },
  tank: { len: 6.2, top: 1.40, weight: 8 },
  open: { len: 6.4, top: 1.36, weight: 9 },
  boxcar: { len: 6.8, top: 1.46, weight: 9 },
  flat: { len: 6.6, top: 0.82, weight: 5 },
  hopper: { len: 6.0, top: 1.42, weight: 6 },
  old: { len: 5.4, top: 1.38, weight: 4 },
};

const WAGON_KINDS = Object.keys(WAGONS);

/** Weighted pick so container flats and boxcars are the common sight. */
export function randomWagonKind() {
  const total = WAGON_KINDS.reduce((a, k) => a + WAGONS[k].weight, 0);
  let r = Math.random() * total;
  for (const k of WAGON_KINDS) {
    r -= WAGONS[k].weight;
    if (r <= 0) return k;
  }
  return 'container';
}

/* ---------------------------- merge helpers ---------------------------- */

/**
 * A little builder that collects transformed primitives and bakes them into
 * one geometry. Rotations are applied before the translation, which is what
 * you want for placing a part.
 */
function parts() {
  const list = [];
  return {
    add(g, [x, y, z] = [0, 0, 0], [rx, ry, rz] = [0, 0, 0]) {
      const c = g.clone();
      if (rx) c.rotateX(rx);
      if (ry) c.rotateY(ry);
      if (rz) c.rotateZ(rz);
      c.translate(x, y, z);
      list.push(c);
      return this;
    },
    bake() {
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      return merged;
    },
  };
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r, h, s = 10) => new THREE.CylinderGeometry(r, r, h, s);

const steelMat = () => mat('steel', () => new THREE.MeshLambertMaterial({ color: STEEL }));

function bodyMat(kind, tint) {
  return mat(`wb:${kind}:${tint}`, () => new THREE.MeshLambertMaterial({
    map: wagonBodyTexture(kind, tint), color: 0xffffff,
  }));
}

/** Underframe, bogies, wheels and buffers — one merged geometry per length. */
function chassisGeometry(len) {
  return geo(`chassis:${len}`, () => {
    const p = parts();
    p.add(box(WIDTH, 0.26, len), [0, 0.62, 0]);
    for (const s of [-1, 1]) {
      const bz = s * (len / 2 - 1.5);
      p.add(box(2.0, 0.44, 1.7), [0, 0.34, bz]);
      for (const wx of [-1, 1]) {
        for (const wz of [-0.55, 0.55]) {
          p.add(cyl(0.36, 0.12), [wx * 0.95, 0.36, bz + wz], [0, 0, Math.PI / 2]);
        }
      }
      for (const bx of [-0.78, 0.78]) {
        p.add(cyl(0.16, 0.34, 8), [bx, 0.78, s * (len / 2 + 0.14)], [Math.PI / 2, 0, 0]);
      }
    }
    return p.bake();
  });
}

/* ---------------------------- wagon shapes ---------------------------- */

/**
 * Each entry returns { steel, body } geometries. Anything painted in the
 * livery goes in `body`; anything structural joins `steel`, which lets a
 * whole wagon render as two draw calls plus its lettering.
 */
const SHAPE = {
  container(len, boxes) {
    const s = parts();
    s.add(box(WIDTH, 0.14, len - 0.4), [0, 0.78, 0]);
    const b = parts();
    const bl = (len - 0.8) / 2 - 0.12;
    for (let i = 0; i < boxes; i++) {
      b.add(box(2.36, 0.70, bl), [0, 1.20, (i - (boxes - 1) / 2) * (bl + 0.2)]);
    }
    return { steel: s.bake(), body: b.bake(), decalY: 1.20 };
  },

  tank(len) {
    // the barrel carries the livery, the fittings are steel
    const b = parts();
    b.add(cyl(0.62, len - 1.0, 14), [0, 1.10, 0], [Math.PI / 2, 0, 0]);
    const s = parts();
    s.add(cyl(0.2, 0.18, 8), [0, 1.78, 0]);
    return { steel: s.bake(), body: b.bake(), decalY: 1.10, decalColor: 0xe6e2da };
  },

  open(len) {
    const b = parts();
    b.add(box(WIDTH, 0.62, len - 0.5), [0, 1.06, 0]);
    const s = parts();
    s.add(box(2.2, 0.30, len - 1.0), [0, 1.22, 0]);
    return { steel: s.bake(), body: b.bake(), decalY: 1.06 };
  },

  boxcar(len) {
    const b = parts();
    b.add(box(WIDTH, 0.72, len - 0.4), [0, 1.10, 0]);
    const s = parts();
    s.add(box(WIDTH + 0.06, 0.10, len - 0.3), [0, 1.44, 0]);
    return { steel: s.bake(), body: b.bake(), decalY: 1.08 };
  },

  flat(len) {
    const b = parts();
    b.add(box(WIDTH, 0.16, len - 0.3), [0, 0.74, 0]);
    const s = parts();
    for (let i = 0; i < 2; i++) s.add(box(1.7, 0.28, 1.5), [0, 0.96, (i - 0.5) * 2.2]);
    return { steel: s.bake(), body: b.bake(), decalY: 0.74, decalColor: 0xc8c4bc };
  },

  hopper(len) {
    const b = parts();
    b.add(box(WIDTH, 0.66, len - 0.6), [0, 1.09, 0]);
    const s = parts();
    s.add(box(1.5, 0.34, len - 1.6), [0, 0.66, 0]);
    return { steel: s.bake(), body: b.bake(), decalY: 1.09 };
  },

  old(len) {
    const b = parts();
    b.add(box(WIDTH - 0.12, 0.68, len - 0.4), [0, 1.06, 0]);
    const s = parts();
    s.add(box(WIDTH, 0.12, len - 0.2), [0, 1.40, 0]);
    // the hand-brake platform somebody stood on in 1954
    s.add(box(0.08, 0.5, 0.08), [0.9, 1.6, len / 2 - 0.4]);
    return { steel: s.bake(), body: b.bake(), decalY: 1.06, decalColor: 0xd8c8a8 };
  },
};

/**
 * Lettering on both flanks. Both planes share one material, so they bake into
 * a single geometry and the wagon keeps its lettering for one draw call
 * instead of two. Cached per (length, height) — which is per wagon type.
 */
function addDecals(group, text, len, y, color) {
  const m = mat(`dec:${text}:${color}`, () => new THREE.MeshBasicMaterial({
    map: stencilTexture(text, color), transparent: true, toneMapped: false, depthWrite: false,
  }));
  const g = geo(`decg:${len}:${y}`, () => {
    const w = len * 0.78;
    const list = [-1, 1].map((s) => {
      const p = new THREE.PlaneGeometry(w, w * 0.25);
      p.rotateY(s * Math.PI / 2);
      p.translate(s * (WIDTH / 2 + 0.02), y, 0);
      return p;
    });
    const merged = mergeGeometries(list, false);
    for (const p of list) p.dispose();
    return merged;
  });
  group.add(new THREE.Mesh(g, m));
}

/* ---------------------------- public builders ---------------------------- */

/**
 * One freight wagon: four meshes, whatever it is made of.
 * @param {string} kind key into WAGONS
 * @param {string} [label] stencilled lettering
 */
export function createWagon(kind, label = pick(WAGON_LABELS)) {
  const spec = WAGONS[kind] ?? WAGONS.container;
  const tint = LIVERIES[Math.floor(Math.random() * LIVERIES.length)];
  const boxes = kind === 'container' ? (Math.random() < 0.72 ? 2 : 1) : 0;
  const shapeKey = `${kind}:${spec.len}:${boxes}`;
  const shape = geo(`shape:${shapeKey}`, () => SHAPE[kind](spec.len, boxes));

  const g = new THREE.Group();
  g.add(new THREE.Mesh(chassisGeometry(spec.len), steelMat()));
  if (shape.steel) g.add(new THREE.Mesh(shape.steel, steelMat()));
  if (shape.body) g.add(new THREE.Mesh(shape.body, bodyMat(kind, tint)));
  addDecals(g, label, spec.len, shape.decalY, shape.decalColor ?? 0xd8d4cc);

  return {
    group: g,
    kind: 'obstacle',
    family: 'wagon',
    def: { id: `WAGON_${kind}`, label, crash: crashLineFor(kind) },
    halfW: HALF_W,
    halfD: spec.len / 2,
    bottom: 0,
    top: spec.top,
    mountable: true,
    zOffset: spec.len / 2,
    length: spec.len,
  };
}

function crashLineFor(kind) {
  return {
    container: 'That container has been in transit since 2019.',
    tank: 'Do not run into the tank wagon. Ever.',
    open: 'The load shifted. So did you.',
    boxcar: 'The door was closed. It is always closed.',
    flat: 'You lost to a flat wagon.',
    hopper: 'That hopper is full of unrefined tickets.',
    old: 'Built 1954. Still harder than you.',
  }[kind] ?? 'You met the freight.';
}

/**
 * A train coming the other way.
 *
 * Unlike everything else on the line this one moves, and it closes at its own
 * speed on top of yours — so it arrives far faster than the scenery does. It
 * occupies exactly one track and cannot be climbed: the only answer is to not
 * be there when it arrives.
 *
 * The headlamp is the whole design. Fog closes at 190 m, so the machine itself
 * stays hidden until about three seconds out; the lamps are drawn with fog
 * DISABLED and additive, which means you can see which track it is on long
 * before you can see the train. That, plus the horn, is the warning.
 */
export function createOncomingTrain(wagonCount = 10) {
  const g = new THREE.Group();
  const locoLen = 8.6;

  // the locomotive leads, turned to face back down the line at you
  const loco = new THREE.Group();
  loco.add(new THREE.Mesh(chassisGeometry(locoLen), steelMat()));
  const body = geo(`onBody:${locoLen}`, () => parts()
    .add(box(WIDTH + 0.1, 1.5, locoLen - 1.4), [0, 1.5, 0])
    .add(box(WIDTH - 0.2, 0.8, 2.4), [0, 2.62, -1.0])
    .bake());
  loco.add(new THREE.Mesh(body, mat('onLoco', () => new THREE.MeshLambertMaterial({
    map: locoBodyTexture('MODERN'),
  }))));
  loco.rotation.y = Math.PI;
  g.add(loco);

  // the lamps: unfogged and additive, so they burn through the haze
  const lampMat = mat('onLamp', () => new THREE.SpriteMaterial({
    map: glowSprite(0xfff2d0),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    fog: false,
  }));
  const lamps = [];
  for (const s of [-1, 1]) {
    const lamp = new THREE.Sprite(lampMat);
    lamp.scale.setScalar(4.5);
    lamp.position.set(s * 0.95, 1.5, -locoLen / 2 - 0.4);
    g.add(lamp);
    lamps.push(lamp);
  }

  // its consist trails away behind it
  let z = locoLen / 2 + 0.6;
  for (let i = 0; i < wagonCount; i++) {
    const kind = randomWagonKind();
    const w = createWagon(kind);
    w.group.position.z = z + WAGONS[kind].len / 2;
    g.add(w.group);
    z += WAGONS[kind].len + 0.55;
  }

  return {
    group: g,
    kind: 'obstacle',
    family: 'oncoming',
    def: { id: 'ONCOMING', label: 'ONCOMING', crash: 'That one was coming the other way.' },
    halfW: HALF_W + 0.08,
    halfD: z / 2,
    bottom: 0,
    top: 3.1,
    mountable: false,     // you do not board a train doing 26 m/s at you
    zOffset: z / 2 - locoLen / 2,
    length: z,
    lamps,
  };
}

/**
 * A locomotive standing on the line. Taller than a wagon and NOT mountable,
 * so a consist headed by one always forces a decision at the end of the roof
 * run: drop off early or change lane.
 */
export function createParkedLoco(variant = 'FREIGHT') {
  const len = 8.6;
  const g = new THREE.Group();
  g.add(new THREE.Mesh(chassisGeometry(len), steelMat()));

  const body = geo(`locoBody:${len}`, () => parts()
    .add(box(WIDTH + 0.1, 1.35, len - 1.6), [0, 1.42, 0])
    .bake());
  g.add(new THREE.Mesh(
    body,
    mat(`lm:${variant}`, () => new THREE.MeshLambertMaterial({ map: locoBodyTexture(variant) }))
  ));

  const cab = geo('locoCab', () => parts()
    .add(box(WIDTH, 0.75, 2.4), [0, 2.42, -0.6])
    .bake());
  g.add(new THREE.Mesh(cab, mat('locoCabMat', () => new THREE.MeshLambertMaterial({ color: 0x2a3038 }))));

  const glass = new THREE.Mesh(
    geo('locoGlass', () => new THREE.PlaneGeometry(2.2, 0.5)),
    mat('glass', () => new THREE.MeshBasicMaterial({ color: 0x161d24, toneMapped: false }))
  );
  glass.position.set(0, 2.48, 0.62);
  g.add(glass);

  const label = pick(LOCO_LABELS);
  addDecals(g, label, len, 1.42, 0xe0dcd2);

  return {
    group: g,
    kind: 'obstacle',
    family: 'loco',
    def: { id: 'PARKED_LOCO', label, crash: 'That is a locomotive. It was always going to win.' },
    halfW: HALF_W + 0.06,
    halfD: len / 2,
    bottom: 0,
    top: 2.85,
    mountable: false,
    zOffset: len / 2,
    length: len,
  };
}

/* ---------------------------- level crossing ---------------------------- */

/**
 * A level crossing: road surface, saltire posts, raised barriers and lamps.
 * Scenery only — it never collides. It is a quiet landmark, and somewhere for
 * the crossing freight to be crossing.
 */
export function createLevelCrossing(halfWidth) {
  const g = new THREE.Group();

  const road = new THREE.Mesh(
    geo('road', () => new THREE.PlaneGeometry(halfWidth * 2 + 6, 7)),
    mat('roadMat', () => new THREE.MeshLambertMaterial({ color: 0x2a2c2e }))
  );
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.02;
  g.add(road);

  // posts and raised booms, merged into one white-steel mesh
  const furniture = geo(`crossFurniture:${halfWidth}`, () => {
    const p = parts();
    for (const s of [-1, 1]) {
      p.add(box(0.16, 3.6, 0.16), [s * (halfWidth - 1.2), 1.8, 0]);
      // the boom stands up, which is both out of the play area and what a
      // crossing looks like once the train has gone through
      p.add(box(0.14, halfWidth - 1.6, 0.14),
        [s * (halfWidth - 1.2), 1.2 + (halfWidth - 1.6) / 2, 0.5], [0, 0, s * 0.12]);
    }
    return p.bake();
  });
  g.add(new THREE.Mesh(furniture, mat('crossSteel', () => new THREE.MeshLambertMaterial({ color: 0xd8d8d4 }))));

  const saltire = mat('saltire', () => new THREE.MeshBasicMaterial({
    map: crossingSignTexture(), transparent: true, toneMapped: false, side: THREE.DoubleSide,
  }));
  const saltireGeo = geo('saltireGeo', () => new THREE.PlaneGeometry(2.0, 2.0));
  const lampMat = mat('crossLamp', () => new THREE.SpriteMaterial({
    map: glowSprite(0xff3a2a), blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, opacity: 0.9,
  }));
  for (const s of [-1, 1]) {
    const sign = new THREE.Mesh(saltireGeo, saltire);
    sign.position.set(s * (halfWidth - 1.2), 3.2, 0.12);
    g.add(sign);
    const lamp = new THREE.Sprite(lampMat);
    lamp.scale.setScalar(1.3);
    lamp.position.set(s * (halfWidth - 1.2), 2.1, 0.2);
    g.add(lamp);
  }

  return { group: g };
}

/**
 * A very long freight sweeping across the line on a diamond crossing, seen
 * from a distance. It always clears before you reach it — quiet spectacle,
 * not a hazard.
 */
export function createCrossingFreight(wagonCount = 11) {
  const g = new THREE.Group();
  let x = 0;
  for (let i = 0; i < wagonCount; i++) {
    const kind = randomWagonKind();
    const w = createWagon(kind);
    w.group.rotation.y = Math.PI / 2;   // a quarter turn, so it runs across us
    w.group.position.x = x;
    g.add(w.group);
    x += WAGONS[kind].len + 0.6;
  }
  const loco = createParkedLoco('FREIGHT');
  loco.group.rotation.y = Math.PI / 2;
  loco.group.position.x = x + 4;
  g.add(loco.group);
  return { group: g, length: x + 12 };
}
