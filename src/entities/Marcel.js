/**
 * Marcel.
 *
 * A former IT teacher, now a locomotive. He is on the line behind you and he
 * does not consider this remarkable.
 *
 * ---------------------------------------------------------------------------
 * Where everything sits, and why
 * ---------------------------------------------------------------------------
 *
 * The chase camera is behind BOTH of you: camera, then Marcel, then the
 * runner. So the player looks at Marcel from behind and above, and his nose —
 * where a locomotive's face would naturally go — points away from the camera
 * and is never seen. Three things follow from that, and they are the whole
 * design of this file:
 *
 *   1. His FACE PANEL lives on the roof, mid-body, on a pivot. At rest it
 *      faces forward, down the line, and you see the back of it. Every half
 *      minute or so he swings it round to look straight at the camera for a
 *      second — checking you are still there — and then turns back. That is
 *      the only time marcel.png is legible on the machine itself, which is
 *      what makes it worth looking at.
 *
 *   2. His HEADLIGHTS throw two pools forward onto the ballast between him
 *      and you. Those pools are always in shot, because they land on the
 *      ground the camera is already looking at.
 *
 *   3. His face is PROJECTED into that pool of light, faintly. That is the
 *      permanent "he is back there" cue — it reads long before the locomotive
 *      itself resolves out of the haze.
 *
 * He is drawn from the gap, so the number on the gauge and the machine on the
 * track never disagree, and he steers onto your track a beat after you do.
 * He hauls nothing: at these camera distances his own consist would be behind
 * the lens. The freight on the line does that job instead.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG, safety } from '../config.js';
import {
  locoBodyTexture, glowSprite, marcelFallbackTexture, stencilTexture,
  beamTexture, goboMaskTexture, goboTexture,
} from '../world/textures.js';
import { CALM_LINES, NEAR_LINES, pick } from '../data/lines.js';

/** Wheel plus its crank pin, baked together so it is one draw call that spins. */
let wheelGeo = null;
function wheelGeometry() {
  if (!wheelGeo) {
    const disc = new THREE.CylinderGeometry(0.52, 0.52, 0.16, 12);
    const pin = new THREE.BoxGeometry(0.1, 0.1, 0.34);
    pin.rotateX(Math.PI / 2);
    pin.translate(0, 0.3, 0);
    wheelGeo = mergeGeometries([disc, pin], false);
    disc.dispose();
    pin.dispose();
  }
  return wheelGeo;
}

/** His four machines. Only one exists at a time. */
export const VARIANTS = {
  MODERN: {
    id: 'MODERN', name: 'MARCEL',
    plate: 'MARCEL — SPRINT 4000',
    lamp: 0xffe9c0, chimney: false, scale: 1.0,
    arrival: 'Marcel is on the line behind you.',
  },
  OLD: {
    id: 'OLD', name: 'MARCEL (1954)',
    plate: 'MARCEL — BUILT 1954',
    lamp: 0xffcf80, chimney: true, scale: 0.95,
    arrival: 'The old machine has been brought out. It still runs.',
  },
  FREIGHT: {
    id: 'FREIGHT', name: 'MARCEL — FREIGHT',
    plate: 'MARCEL — 2 400 t',
    lamp: 0xfff0cc, chimney: false, scale: 1.06,
    arrival: 'He has left his consist somewhere. He will not say where.',
  },
  V2: {
    id: 'V2', name: 'MARCEL v2.0',
    plate: 'MARCEL v2.0 — DEPLOYED',
    lamp: 0xff9a6a, chimney: false, scale: 1.12,
    arrival: 'Marcel v2.0 was deployed. Nobody reviewed it.',
  },
};

const LOCO_LEN = 6.0;
const LOCO_W = 3.4;

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

export class Marcel {
  /**
   * @param {THREE.Scene} scene
   * @param {(text:string, near:boolean)=>void} onLine
   */
  constructor(scene, onLine, hard = false) {
    this.scene = scene;
    this.onLine = onLine;
    this.hard = hard;

    this.gap = hard ? CONFIG.HARD_START_GAP : CONFIG.MARCEL_START_GAP;
    this.gapRegen = hard ? CONFIG.HARD_GAP_REGEN : CONFIG.MARCEL_GAP_REGEN;
    this.blindFor = 0;
    this.lineTimer = 12 + Math.random() * 10;

    this.variantId = 'MODERN';
    this.x = 0;
    this.z = CONFIG.MARCEL_Z_FAR;
    this.lunge = 0;
    this.wheelPhase = 0;

    // the look-back beat
    this.lookTimer = CONFIG.MARCEL_LOOKBACK_MIN
      + Math.random() * (CONFIG.MARCEL_LOOKBACK_MAX - CONFIG.MARCEL_LOOKBACK_MIN);
    this.lookPhase = 0;     // 0 = facing forward, 1 = looking at you
    this.lookState = 'idle';
    this.lookHold = 0;

    /** The face, shared by the roof panel and the ground projection. */
    this.faceTex = marcelFallbackTexture();

    this.root = new THREE.Group();
    scene.add(this.root);

    // The light pools live in their own group at ground level rather than on
    // the locomotive, so his suspension bob never sinks them into the ballast.
    this.lights = new THREE.Group();
    scene.add(this.lights);

    this.buildLightPools();
    this.build('MODERN');
    this.loadFace();
  }

  /* ---------------------------- the machine ---------------------------- */

  build(variantId) {
    const v = VARIANTS[variantId];
    this.variantId = variantId;
    if (this.body) {
      // he only has four machines, but a rebuild that leaked its geometry
      // would still hand the driver a slow drip of dead buffers
      this.root.remove(this.body);
      this.body.traverse((o) => {
        if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
        else if (o.isSprite) o.material.dispose();
      });
    }

    const g = new THREE.Group();
    this.body = g;
    this.rods = null;
    this.root.add(g);

    const skin = new THREE.MeshLambertMaterial({ map: locoBodyTexture(variantId) });
    const dark = new THREE.MeshLambertMaterial({ color: variantId === 'V2' ? 0x2a1010 : 0x1c2026 });
    const trim = new THREE.MeshLambertMaterial({ color: variantId === 'OLD' ? 0x6a5a3a : 0x8a9098 });

    // Origin is the NOSE, so his front face is at local z = 0 and the drawn
    // distance is exactly the number the chase model is holding.
    //
    // Hull, nose and cab never move relative to each other, so they are one
    // mesh. Only the parts that actually animate — the wheels, the rods, the
    // face panel — stay separate.
    const shell = [];
    const part = (geom, x, y, z, rx = 0) => {
      if (rx) geom.rotateX(rx);
      geom.translate(x, y, z);
      shell.push(geom);
    };
    part(new THREE.BoxGeometry(LOCO_W, 1.45, LOCO_LEN), 0, 1.32, -LOCO_LEN / 2);
    part(new THREE.BoxGeometry(LOCO_W - 0.25, 1.0, 1.1), 0, 1.0, 0.42, -0.22);
    part(new THREE.BoxGeometry(LOCO_W - 0.2, 0.92, 2.2), 0, 2.42, -LOCO_LEN + 1.7);
    if (variantId === 'OLD') {
      part(new THREE.CylinderGeometry(0.84, 0.84, LOCO_LEN - 2.6, 14), 0, 1.7, -2.5, Math.PI / 2);
    }
    g.add(new THREE.Mesh(mergeGeometries(shell, false), skin));
    for (const s of shell) s.dispose();
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x1a222a, toneMapped: false })
    );
    glass.position.set(0, 2.5, -LOCO_LEN + 2.82);
    g.add(glass);

    const skirt = new THREE.Mesh(new THREE.BoxGeometry(LOCO_W + 0.1, 0.34, LOCO_LEN - 0.6), dark);
    skirt.position.set(0, 0.5, -LOCO_LEN / 2);
    g.add(skirt);

    // wheels — visibly turning is most of what makes him read as a train
    this.wheels = [];
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const w = new THREE.Mesh(wheelGeometry(), dark);
        w.rotation.z = Math.PI / 2;
        w.position.set(s * (LOCO_W / 2 - 0.12), 0.52, -1.4 - i * 1.6);
        g.add(w);
        this.wheels.push(w);
      }
    }

    if (variantId === 'OLD') {
      for (const s of [-1, 1]) {
        const rod = new THREE.Mesh(
          new THREE.BoxGeometry(0.09, 0.14, 3.6),
          new THREE.MeshBasicMaterial({ color: 0x8a9098 })
        );
        rod.position.set(s * (LOCO_W / 2 - 0.02), 0.82, -3.0);
        g.add(rod);
        (this.rods ??= []).push(rod);
      }
    }

    this.buildFacePanel(g, variantId, dark, trim);
    this.buildLamps(g, v, trim, dark);

    // the red wash, only when he is genuinely close
    this.aura = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowSprite(0xd83a2a), blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, opacity: 0,
    }));
    this.aura.scale.set(13, 8, 1);
    this.aura.position.set(0, 1.6, -1.5);
    g.add(this.aura);

    g.scale.setScalar(v.scale * (this.hard ? 1.05 : 1));
  }

  /**
   * The face panel, on a vertical pivot on the roof.
   *
   * Roof-mounted because that is the part of him the camera can always see:
   * at close range his rear end drops below the bottom of the frame, and his
   * nose points away. At rest the panel faces forward (you see its metal
   * back); the look-back beat swings it through 180 degrees.
   */
  buildFacePanel(g, variantId, dark, trim) {
    const rig = new THREE.Group();
    rig.position.set(0, 2.86, -2.3);
    g.add(rig);
    this.lookRig = rig;

    // the housing, so there is something solid to look at when he is not
    const housing = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.9, 0.22), dark);
    rig.add(housing);
    for (const [w, h, x, y] of [[2.16, 0.13, 0, 0.96], [2.16, 0.13, 0, -0.96], [0.13, 2.05, -1.02, 0], [0.13, 2.05, 1.02, 0]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.26), trim);
      bar.position.set(x, y, 0);
      rig.add(bar);
    }
    // a pintle so it reads as something that turns
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 8), trim);
    pin.position.y = -1.15;
    rig.add(pin);

    this.faceMat = new THREE.MeshLambertMaterial({
      map: this.faceTex,
      transparent: true,
      emissive: 0x2e2a24,
    });
    this.face = new THREE.Mesh(new THREE.PlaneGeometry(1.86, 1.86), this.faceMat);
    this.face.position.z = 0.13;   // on the +z side: visible at rig yaw = PI
    rig.add(this.face);

    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 0.38),
      new THREE.MeshBasicMaterial({
        map: stencilTexture(VARIANTS[variantId].plate, variantId === 'V2' ? 0xffc8b8 : 0xd8dce0),
        transparent: true, toneMapped: false, depthWrite: false,
      })
    );
    // the number plate goes on his back end, which is the end you can read
    plate.rotation.y = Math.PI;
    plate.position.set(0, 2.05, -LOCO_LEN + 0.55);
    g.add(plate);
  }

  buildLamps(g, v, trim, dark) {
    this.lamps = [];
    const lampY = v.chimney ? 2.4 : 0.98;
    for (const s of [-1, 1]) {
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.22, 10), trim);
      housing.rotation.x = Math.PI / 2;
      housing.position.set(s * 1.28, lampY, 0.76);
      g.add(housing);

      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowSprite(v.lamp), blending: THREE.AdditiveBlending,
        depthWrite: false, transparent: true, opacity: 0.9,
      }));
      glow.scale.setScalar(1.9);
      glow.position.set(s * 1.28, lampY, 0.92);
      g.add(glow);
      this.lamps.push(glow);
    }

    // a real light too, so the ballast and the runner's back actually warm up
    this.beamLight = new THREE.SpotLight(v.lamp, 0, 46, 0.5, 0.7, 1.4);
    this.beamLight.position.set(0, 2.0, 0.8);
    g.add(this.beamLight);
    this.beamTarget = new THREE.Object3D();
    this.beamTarget.position.set(0, 0, 22);
    g.add(this.beamTarget);
    this.beamLight.target = this.beamTarget;

    // exhaust
    this.smoke = [];
    const stackZ = -LOCO_LEN + 4.6;
    const stackY = v.chimney ? 2.9 : 2.05;
    if (v.chimney) {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.8, 12), dark);
      stack.position.set(0, 2.5, stackZ);
      g.add(stack);
    }
    const smokeMat = new THREE.SpriteMaterial({
      map: glowSprite(0xb0b6bc), transparent: true, opacity: 0.18, depthWrite: false,
    });
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Sprite(smokeMat.clone());
      s.position.set(0, stackY, stackZ);
      g.add(s);
      this.smoke.push({ sprite: s, life: i / 5, y0: stackY, z0: stackZ });
    }
  }

  /**
   * The two headlight pools and the face projected between them.
   *
   * All three lie flat on the ballast with additive blending and no depth
   * writes. Painting the light rather than casting it means no shadow maps,
   * no second render pass, and it works the same on every machine — and on
   * flat ground at this angle you cannot tell the difference.
   */
  buildLightPools() {
    const L = CONFIG.MARCEL_BEAM_LENGTH;
    const W = CONFIG.MARCEL_BEAM_WIDTH;

    this.beams = [];
    for (const s of [-1, 1]) {
      const beam = new THREE.Mesh(
        new THREE.PlaneGeometry(W, L),
        new THREE.MeshBasicMaterial({
          map: beamTexture(),
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          opacity: CONFIG.MARCEL_BEAM_OPACITY,
          toneMapped: false,
          side: THREE.DoubleSide,
        })
      );
      beam.rotation.x = -Math.PI / 2;     // flat, lit end nearest the lamp
      beam.rotation.z = s * 0.045;        // the two cones splay very slightly
      beam.position.set(s * 1.15, 0.05, L / 2 + 0.9);
      beam.renderOrder = 2;
      this.beams.push(beam);
      this.lights.add(beam);
    }

    this.goboMat = new THREE.MeshBasicMaterial({
      map: this.faceTex,
      alphaMap: goboMaskTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0,
      toneMapped: false,
      color: 0xffd9a8,
      side: THREE.DoubleSide,
    });
    this.gobo = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 7.4), this.goboMat);
    // flat, and turned in-plane so the projected head points down the track
    this.gobo.rotation.set(-Math.PI / 2, 0, Math.PI);
    this.gobo.position.set(0, 0.06, 8.2);
    this.gobo.renderOrder = 3;
    this.lights.add(this.gobo);
  }

  loadFace() {
    const path = this.hard ? CONFIG.MARCEL_HARD_TEXTURE_PATH : CONFIG.MARCEL_TEXTURE_PATH;
    new THREE.TextureLoader().load(
      path,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        this.faceTex = tex;
        this.faceMat.map = tex;
        this.faceMat.needsUpdate = true;
        // bake the projection stencil; if the image is unreadable for any
        // reason, the masked placeholder we started with stays
        try {
          this.goboMat.map = goboTexture(tex.image);
          this.goboMat.alphaMap = null;   // the falloff is baked into the stencil
        } catch (e) {
          this.goboMat.map = tex;
        }
        this.goboMat.needsUpdate = true;
      },
      undefined,
      () => { /* the drawn fallback stays; he continues regardless */ }
    );
  }

  /* ---------------------------- chase model ---------------------------- */

  closeIn(m) { this.gap = Math.max(-1, this.gap - m); }
  fallBack(m) { this.gap = Math.min(CONFIG.MARCEL_MAX_GAP, this.gap + m); }
  blind(s) { this.blindFor = Math.max(this.blindFor, s); }
  get caught() { return this.gap <= 0; }
  get safety() { return safety(this.gap); }

  updateVariant(distance) {
    const want = distance >= CONFIG.VARIANT_AT.V2 ? 'V2'
      : distance >= CONFIG.VARIANT_AT.FREIGHT ? 'FREIGHT'
        : distance >= CONFIG.VARIANT_AT.OLD ? 'OLD'
          : 'MODERN';
    if (want === this.variantId) return null;
    this.build(want);
    return VARIANTS[want];
  }

  /* ---------------------------- the look back ---------------------------- */

  /**
   * Turn the roof panel round, hold, turn back. Nothing else happens — no
   * sound, no message. It is meant to be caught out of the corner of an eye.
   */
  updateLookBack(dt) {
    switch (this.lookState) {
      case 'idle':
        this.lookTimer -= dt;
        if (this.lookTimer <= 0) this.lookState = 'turning';
        break;
      case 'turning':
        this.lookPhase = Math.min(1, this.lookPhase + dt / 0.45);
        if (this.lookPhase >= 1) {
          this.lookState = 'holding';
          this.lookHold = CONFIG.MARCEL_LOOKBACK_HOLD;
        }
        break;
      case 'holding':
        this.lookHold -= dt;
        if (this.lookHold <= 0) this.lookState = 'returning';
        break;
      case 'returning':
        this.lookPhase = Math.max(0, this.lookPhase - dt / 0.55);
        if (this.lookPhase <= 0) {
          this.lookState = 'idle';
          this.lookTimer = CONFIG.MARCEL_LOOKBACK_MIN
            + Math.random() * (CONFIG.MARCEL_LOOKBACK_MAX - CONFIG.MARCEL_LOOKBACK_MIN);
        }
        break;
      default:
        break;
    }

    const e = easeInOut(this.lookPhase);
    // 0 -> facing down the line, PI -> facing the camera
    this.lookRig.rotation.y = e * Math.PI;
    // he leans into it very slightly, the way somebody turns their head
    this.lookRig.rotation.z = Math.sin(e * Math.PI) * 0.06;
    this.faceMat.emissive.setScalar(0.18 + e * 0.16);
  }

  /* ---------------------------- per-frame ---------------------------- */

  update(dt, t, speed, playerX, distance = 0) {
    if (this.blindFor > 0) {
      this.blindFor -= dt;
      this.gap = Math.min(CONFIG.MARCEL_MAX_GAP, this.gap + this.gapRegen * 2.6 * dt);
    } else {
      const creep = Math.min(CONFIG.MARCEL_CREEP_MAX, distance / CONFIG.MARCEL_CREEP_AT);
      this.gap = Math.min(CONFIG.MARCEL_MAX_GAP, this.gap + (this.gapRegen - creep) * dt);
    }

    const s = this.safety;
    const near = 1 - s;
    const shake = Math.max(0, 1 - this.gap / CONFIG.MARCEL_TENSE_GAP);

    // drawn position: a real, monotonic function of the gap
    let targetZ = CONFIG.MARCEL_Z_NEAR + (CONFIG.MARCEL_Z_FAR - CONFIG.MARCEL_Z_NEAR) * s;
    const lungeWant = this.gap < CONFIG.MARCEL_LUNGE_GAP
      ? (1 - this.gap / CONFIG.MARCEL_LUNGE_GAP) * 1.0 : 0;
    this.lunge += (lungeWant - this.lunge) * Math.min(1, dt * 4);
    targetZ += this.lunge;
    this.z += (targetZ - this.z) * Math.min(1, dt * 3.2);

    // he steers onto your track, a beat late
    this.x += (playerX - this.x) * Math.min(1, dt * CONFIG.MARCEL_LANE_STEER);

    this.root.position.set(
      this.x + Math.sin(t * 2.3) * (0.05 + shake * 0.2),
      Math.sin(t * 9 + 1.7) * shake * 0.08,
      this.z
    );
    this.root.rotation.z = Math.sin(t * 1.9) * (0.005 + shake * 0.018);
    this.root.rotation.y = THREE.MathUtils.clamp((playerX - this.x) * -0.05, -0.12, 0.12);

    // the pools follow him but never leave the ballast
    this.lights.position.set(this.root.position.x, 0, this.z);
    this.lights.rotation.y = this.root.rotation.y;

    const sc = (CONFIG.MARCEL_SCALE_NEAR + (CONFIG.MARCEL_SCALE_FAR - CONFIG.MARCEL_SCALE_NEAR) * s)
      * VARIANTS[this.variantId].scale * (this.hard ? 1.05 : 1);
    this.body.scale.setScalar(sc);

    this.wheelPhase += dt * speed * 0.85;
    for (const w of this.wheels) w.rotation.y = this.wheelPhase;
    if (this.rods) for (const r of this.rods) r.position.y = 0.82 + Math.sin(this.wheelPhase) * 0.16;

    this.updateLookBack(dt);

    /* --- light --- */

    // The pools carry most of the "he is back there" signal at long range, so
    // they stay strong when he is far and give way to the machine itself when
    // he is close enough to see properly.
    const poolFade = 0.55 + 0.45 * s;
    for (const b of this.beams) b.material.opacity = CONFIG.MARCEL_BEAM_OPACITY * poolFade;
    this.goboMat.opacity = CONFIG.MARCEL_GOBO_OPACITY * (0.25 + 0.75 * s)
      * (0.88 + Math.sin(t * 1.3) * 0.12);

    this.beamLight.intensity = 26 + near * 150;
    for (const l of this.lamps) l.scale.setScalar(1.6 + near * 1.1 + Math.sin(t * 7) * 0.05);
    this.aura.material.opacity = Math.max(0, shake - 0.15) * 0.45;

    for (const p of this.smoke) {
      p.life += dt * (0.3 + speed * 0.008);
      if (p.life > 1) {
        p.life = 0;
        p.sprite.position.set((Math.random() - 0.5) * 0.4, p.y0, p.z0);
      }
      p.sprite.position.y = p.y0 + p.life * 3.2;
      p.sprite.position.z = p.z0 - p.life * (2 + speed * 0.1);
      p.sprite.scale.setScalar(0.9 + p.life * 4);
      p.sprite.material.opacity = (1 - p.life) * 0.16;
    }

    this.lineTimer -= dt;
    if (this.lineTimer <= 0) {
      const isNear = this.gap < CONFIG.MARCEL_TENSE_GAP;
      const [lo, hi] = isNear
        ? [CONFIG.LINE_INTERVAL_NEAR_MIN, CONFIG.LINE_INTERVAL_NEAR_MAX]
        : [CONFIG.LINE_INTERVAL_CALM_MIN, CONFIG.LINE_INTERVAL_CALM_MAX];
      this.lineTimer = lo + Math.random() * (hi - lo);
      this.onLine(pick(isNear ? NEAR_LINES : CALM_LINES), isNear);
    }
  }

  /** He runs over the runner. The panel turns to watch it happen. */
  playCatch(dt) {
    this.z = Math.min(this.z + dt * 14, 2.0);
    this.root.position.z = this.z;
    this.lights.position.z = this.z;
    this.root.position.x += (0 - this.root.position.x) * Math.min(1, dt * 6);
    this.lookPhase = Math.min(1, this.lookPhase + dt * 2.2);
    this.lookRig.rotation.y = easeInOut(this.lookPhase) * Math.PI;
    this.aura.material.opacity = 0.65;
    this.beamLight.intensity = 220;
  }

  setVisible(v) {
    this.root.visible = v;
    this.lights.visible = v;
  }

  reset(hard) {
    this.hard = hard;
    this.gap = hard ? CONFIG.HARD_START_GAP : CONFIG.MARCEL_START_GAP;
    this.gapRegen = hard ? CONFIG.HARD_GAP_REGEN : CONFIG.MARCEL_GAP_REGEN;
    this.blindFor = 0;
    this.lunge = 0;
    this.x = 0;
    this.z = CONFIG.MARCEL_Z_FAR;
    this.lineTimer = 12 + Math.random() * 10;
    this.lookPhase = 0;
    this.lookState = 'idle';
    this.lookTimer = CONFIG.MARCEL_LOOKBACK_MIN
      + Math.random() * (CONFIG.MARCEL_LOOKBACK_MAX - CONFIG.MARCEL_LOOKBACK_MIN);
    this.setVisible(true);
    if (this.variantId !== 'MODERN') this.build('MODERN');
    this.loadFace();
  }

  dispose() {
    this.scene.remove(this.root);
    this.scene.remove(this.lights);
  }
}
