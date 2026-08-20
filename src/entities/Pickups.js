/**
 * Collectibles: story points, the rare legendary card, and three power-up
 * chips. That is the whole list — the game deliberately does not have a
 * drawer full of them.
 */
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { POWERUPS, LEGENDARY_LINES, pick } from '../data/lines.js';
import {
  storyPointTexture, powerupTexture, glowCardFallbackTexture, glowSprite,
} from '../world/textures.js';

/* The legendary photo is fetched once and shared by every card. */
let photo = null;
let photoTried = false;

function ensurePhoto() {
  if (photoTried) return;
  photoTried = true;
  new THREE.TextureLoader().load(
    CONFIG.GLOW_CARD_TEXTURE_PATH,
    (t) => { t.colorSpace = THREE.SRGBColorSpace; photo = t; },
    undefined,
    () => { /* the drawn fallback is already in place */ }
  );
}

const cache = new Map();
const memo = (k, f) => { let v = cache.get(k); if (!v) { v = f(); cache.set(k, v); } return v; };

/* ---------------------------- story points ---------------------------- */

export function createStoryPoint() {
  const mesh = new THREE.Mesh(
    memo('spGeo', () => new THREE.CylinderGeometry(0.33, 0.33, 0.09, 6)),
    memo('spMat', () => new THREE.MeshLambertMaterial({
      map: storyPointTexture(), emissive: 0x4a3400,
    }))
  );
  mesh.rotation.x = Math.PI / 2;
  const g = new THREE.Group();
  g.add(mesh);
  return {
    group: g, kind: 'sp', spin: mesh, value: CONFIG.STORY_POINT_VALUE,
    taken: false,
  };
}

/* ---------------------------- the legendary card ---------------------------- */

/**
 * Rare, and the only genuinely showy object in the game. Its halo ignores
 * every dimming effect, so during a 500 error it is the one thing still lit.
 */
export function createGlowCard() {
  ensurePhoto();
  const text = pick(LEGENDARY_LINES);
  const g = new THREE.Group();

  const frame = new THREE.Mesh(
    memo('gcGeo', () => new THREE.PlaneGeometry(1.3, 1.85)),
    new THREE.MeshBasicMaterial({
      map: photo ?? glowCardFallbackTexture('LEGENDARY', text),
      side: THREE.DoubleSide,
      toneMapped: false,
    })
  );
  g.add(frame);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowSprite(0xffd8a0),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.7,
  }));
  halo.scale.setScalar(CONFIG.GLOW_CARD_HALO);
  g.add(halo);

  return {
    group: g, kind: 'glow', spin: frame, halo, text,
    value: CONFIG.GLOW_CARD_POINTS, taken: false, _frame: frame,
  };
}

/** Swap in the photo for cards spawned before the fetch finished. */
export function refreshGlowCard(p) {
  if (p.kind === 'glow' && photo && p._frame.material.map !== photo) {
    p._frame.material.map = photo;
    p._frame.material.needsUpdate = true;
  }
}

/* ---------------------------- power-ups ---------------------------- */

export function createPowerup(id) {
  const def = POWERUPS[id];
  const g = new THREE.Group();

  const chip = new THREE.Mesh(
    memo('puGeo', () => new THREE.BoxGeometry(1.0, 1.0, 0.15)),
    new THREE.MeshBasicMaterial({ map: powerupTexture(def), transparent: true, toneMapped: false })
  );
  g.add(chip);

  const ring = new THREE.Mesh(
    memo('puRing', () => new THREE.TorusGeometry(0.82, 0.055, 8, 26)),
    new THREE.MeshBasicMaterial({ color: def.color, toneMapped: false })
  );
  g.add(ring);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowSprite(def.color), blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, opacity: 0.45,
  }));
  halo.scale.setScalar(3.0);
  g.add(halo);

  return { group: g, kind: 'powerup', def, spin: chip, ring, taken: false };
}

/** Weighted pick. The shield is the common one; the magnet is a treat. */
export function randomPowerupId() {
  const table = [['EXCEPTION_HANDLER', 10], ['GIT_PUSH', 7], ['PRIMARY_KEY', 5]];
  const total = table.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * total;
  for (const [id, w] of table) {
    r -= w;
    if (r <= 0) return id;
  }
  return 'EXCEPTION_HANDLER';
}

/** Idle animation shared by every pickup. */
export function animatePickup(p, dt, t) {
  if (p.kind === 'sp') {
    p.spin.rotation.z += dt * 2.6;
  } else if (p.spin) {
    p.spin.rotation.y += dt * 1.3;
  }
  if (p.ring) {
    p.ring.rotation.x += dt * 0.9;
    p.ring.rotation.y += dt * 1.3;
  }
  if (p.halo) {
    p.halo.scale.setScalar(CONFIG.GLOW_CARD_HALO * (1 + Math.sin(t * CONFIG.GLOW_CARD_PULSE) * 0.14));
  }
}
