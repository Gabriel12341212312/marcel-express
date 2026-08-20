/**
 * Trackside obstacles — the small stuff between the freight.
 *
 * There are only five shapes, and each one asks for exactly one verb. The
 * silhouette tells you which before you can read the lettering:
 *
 *   low and dark          -> jump it
 *   tall and vertical     -> change lane
 *   hanging overhead      -> roll under it
 *
 * The freight (see Freight.js) does the interesting work; these keep the
 * rhythm going in between.
 */
import * as THREE from 'three';
import { OBSTACLES, CODE_SMELL, BUG } from '../data/lines.js';
import { zoneSignTexture, stencilTexture, glowSprite, mix } from '../world/textures.js';

const geoCache = new Map();
const matCache = new Map();
const geo = (k, f) => { let g = geoCache.get(k); if (!g) { g = f(); geoCache.set(k, g); } return g; };
const mat = (k, f) => { let m = matCache.get(k); if (!m) { m = f(); matCache.set(k, m); } return m; };

const lambert = (color) => mat(`l:${color}`, () => new THREE.MeshLambertMaterial({ color }));

/** A small stencilled label facing the runner. */
function label(def, w, h) {
  const m = mat(`lbl:${def.id}`, () => new THREE.MeshBasicMaterial({
    map: stencilTexture(def.label, mix(def.color, 0xffffff, 0.55)),
    transparent: true, toneMapped: false, depthWrite: false,
  }));
  const p = new THREE.Mesh(geo(`lblg${w}x${h}`, () => new THREE.PlaneGeometry(w, h)), m);
  return p;
}

const BUILDERS = {
  /** Buffer stop / stacked sleepers — low enough to hop. */
  buffer(def) {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const beam = new THREE.Mesh(
        geo('sleeper', () => new THREE.BoxGeometry(2.45, 0.26, 0.9)),
        lambert(mix(0x4a3b2a, def.color, 0.25))
      );
      beam.position.set((i % 2 ? 0.06 : -0.06), 0.16 + i * 0.27, 0);
      g.add(beam);
    }
    // the red plate on the face, which is the only bright thing out here
    const plate = new THREE.Mesh(
      geo('bufplate', () => new THREE.BoxGeometry(2.3, 0.42, 0.14)),
      mat(`bufm:${def.color}`, () => new THREE.MeshLambertMaterial({ color: def.color, emissive: mix(def.color, 0x000000, 0.7) }))
    );
    plate.position.set(0, 0.72, 0.5);
    g.add(plate);
    const l = label(def, 2.2, 0.55);
    l.position.set(0, 0.72, 0.58);
    g.add(l);
    return { group: g, halfW: 1.25, halfD: 0.55, bottom: 0, top: 0.95, mountable: false };
  },

  /** A lineside signal at danger. Tall — go round it. */
  signal(def) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(geo('sigpost', () => new THREE.BoxGeometry(0.22, 4.0, 0.22)), lambert(0x9aa0a4));
    post.position.y = 2.0;
    g.add(post);
    const head = new THREE.Mesh(geo('sighead', () => new THREE.BoxGeometry(0.7, 1.5, 0.3)), lambert(0x2a2e32));
    head.position.y = 3.3;
    g.add(head);
    for (let i = 0; i < 3; i++) {
      const lamp = new THREE.Mesh(
        geo('siglamp', () => new THREE.CylinderGeometry(0.16, 0.16, 0.08, 10)),
        mat(`sigl${i}`, () => new THREE.MeshBasicMaterial({
          color: i === 0 ? 0xff3a2a : 0x1e2226, toneMapped: false,
        }))
      );
      lamp.rotation.x = Math.PI / 2;
      lamp.position.set(0, 3.8 - i * 0.45, 0.18);
      g.add(lamp);
    }
    // a wide skirt at the base so the lane really is blocked
    const base = new THREE.Mesh(geo('sigbase', () => new THREE.BoxGeometry(2.4, 1.0, 0.5)), lambert(0x3a3e42));
    base.position.y = 0.5;
    g.add(base);
    const l = label(def, 2.3, 0.6);
    l.position.set(0, 1.35, 0.3);
    g.add(l);
    return { group: g, halfW: 1.25, halfD: 0.35, bottom: 0, top: 4.0, mountable: false };
  },

  /** Stacked crates. */
  crate(def) {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(
        geo('crate', () => new THREE.BoxGeometry(2.25, 0.78, 1.05)),
        lambert(mix(def.color, 0x000000, 0.35 + i * 0.06))
      );
      c.position.set((i % 2 ? 0.1 : -0.08), 0.4 + i * 0.79, 0);
      c.rotation.y = (i - 1) * 0.04;
      g.add(c);
    }
    const l = label(def, 2.2, 0.6);
    l.position.set(0, 1.6, 0.56);
    g.add(l);
    return { group: g, halfW: 1.2, halfD: 0.58, bottom: 0, top: 2.4, mountable: false };
  },

  /** A lineside relay cabinet. */
  cabinet(def) {
    const g = new THREE.Group();
    const box = new THREE.Mesh(geo('cab', () => new THREE.BoxGeometry(2.2, 2.1, 0.8)), lambert(mix(def.color, 0x000000, 0.4)));
    box.position.y = 1.05;
    g.add(box);
    const roof = new THREE.Mesh(geo('cabroof', () => new THREE.BoxGeometry(2.35, 0.1, 0.95)), lambert(0x3a4046));
    roof.position.y = 2.15;
    g.add(roof);
    // louvres
    for (let i = 0; i < 5; i++) {
      const v = new THREE.Mesh(geo('louvre', () => new THREE.BoxGeometry(1.6, 0.06, 0.05)), lambert(0x1c2024));
      v.position.set(0, 1.5 - i * 0.16, 0.42);
      g.add(v);
    }
    const l = label(def, 2.0, 0.5);
    l.position.set(0, 0.7, 0.43);
    g.add(l);
    return { group: g, halfW: 1.2, halfD: 0.45, bottom: 0, top: 2.2, mountable: false };
  },

  /** Overhead gantry / catenary bracket — roll under. */
  gantry(def) {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(geo('gbeam', () => new THREE.BoxGeometry(2.9, 0.5, 0.4)), lambert(mix(def.color, 0x000000, 0.35)));
    beam.position.y = 1.35;
    g.add(beam);
    const upper = new THREE.Mesh(geo('gupper', () => new THREE.BoxGeometry(2.9, 1.3, 0.22)), lambert(mix(def.color, 0x000000, 0.5)));
    upper.position.y = 2.2;
    g.add(upper);
    // hanging tapes, so the low clearance is legible from far away
    for (let i = -2; i <= 2; i++) {
      const t = new THREE.Mesh(
        geo('gtape', () => new THREE.PlaneGeometry(0.28, 0.42)),
        mat(`gtapem:${def.color}`, () => new THREE.MeshBasicMaterial({
          color: def.color, side: THREE.DoubleSide, transparent: true, opacity: 0.85, toneMapped: false,
        }))
      );
      t.position.set(i * 0.6, 0.92, 0.1);
      g.add(t);
    }
    const l = label(def, 2.6, 0.55);
    l.position.set(0, 1.35, 0.23);
    g.add(l);
    return { group: g, halfW: 1.4, halfD: 0.3, bottom: 1.05, top: 3.0, mountable: false };
  },
};

/* ---------------------------- public API ---------------------------- */

export function createObstacle(id) {
  const def = OBSTACLES[id];
  const built = BUILDERS[def.family](def);
  built.def = def;
  built.kind = 'obstacle';
  built.family = def.family;
  built.zOffset = 0;
  return built;
}

/** Green haze in the safe lane. Costs points, never kills. */
export function createCodeSmell() {
  const g = new THREE.Group();
  const m = mat('smell', () => new THREE.SpriteMaterial({
    map: glowSprite(0x7aa858), blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, opacity: 0.34,
  }));
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Sprite(m);
    s.scale.setScalar(1.7 + Math.random() * 1.5);
    s.position.set((Math.random() - 0.5) * 1.7, 0.7 + Math.random() * 1.3, (Math.random() - 0.5) * 1.7);
    g.add(s);
  }
  const sign = new THREE.Mesh(
    geo('smellsign', () => new THREE.PlaneGeometry(2.2, 0.55)),
    mat('smellsignm', () => new THREE.MeshBasicMaterial({
      map: stencilTexture(CODE_SMELL.label, 0x9ad080), transparent: true, toneMapped: false, depthWrite: false,
    }))
  );
  sign.position.set(0, 1.9, 0);
  g.add(sign);
  return {
    group: g, kind: 'smell', family: 'smell', def: CODE_SMELL,
    halfW: 1.1, halfD: 0.8, bottom: 0, top: 2.2, mountable: false, zOffset: 0,
  };
}

/** The one thing you are meant to run into. */
export function createBug() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    geo('bug', () => new THREE.IcosahedronGeometry(0.5, 0)),
    mat('bugm', () => new THREE.MeshLambertMaterial({ color: 0x4ad08a, emissive: 0x0e3a24, flatShading: true }))
  );
  g.add(body);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowSprite(0x4ad08a), blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, opacity: 0.4,
  }));
  halo.scale.setScalar(2.6);
  g.add(halo);
  return {
    group: g, kind: 'bug', family: 'bug', def: BUG, body,
    halfW: 0.7, halfD: 0.7, bottom: 0.4, top: 1.6, mountable: false, zOffset: 0,
    strafe: Math.random() * Math.PI * 2,
  };
}

/**
 * A lineside board announcing the stretch of line. Scenery only — this is how
 * the zone name is delivered now, instead of a label in the corner of the
 * screen.
 */
export function createZoneBoard(zone, sideX) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.2, 0.14), lambert(0x8a9096));
  post.position.set(0, 1.6, 0);
  g.add(post);
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 1.72),
    new THREE.MeshBasicMaterial({
      map: zoneSignTexture(zone),
      toneMapped: false,
    })
  );
  board.position.set(0, 3.3, 0.09);
  board.rotation.y = sideX > 0 ? Math.PI : 0;
  if (sideX > 0) board.position.z = -0.09;
  g.add(board);
  return g;
}
