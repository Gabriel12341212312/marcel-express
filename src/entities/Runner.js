/**
 * The runner: a junior developer being chased down a deployment pipeline.
 *
 * Position is only ever (x, y) — the world scrolls past on z, so the runner
 * never moves forward in world space. Lane switching is a lerp toward the
 * target lane's x, jumping is plain ballistics, rolling shrinks the hitbox.
 *
 * The model is a low-poly articulated figure animated procedurally: there are
 * no skeletal assets in this project, and a sine-driven run cycle reads
 * perfectly at this camera distance.
 */
import * as THREE from 'three';
import { CONFIG, laneX } from '../config.js';

const SKIN = 0xd8a877;
const HOODIE = 0x2f6ea8;
const HOODIE_DARK = 0x24557f;
const JEANS = 0x2a2f3a;
const SHOE = 0xe8e4dc;

function box(w, h, d, color) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  );
  m.castShadow = false;
  return m;
}

export class Runner {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.lane = 1;
    this.targetLane = 1;
    this.x = laneX(1);
    this.y = 0;
    this.vy = 0;

    this.jumping = false;
    this.rolling = false;
    this.rollTimer = 0;
    this.stumbleTimer = 0;
    this.invulnTimer = 0;
    this.onTopOf = null;      // obstacle we are currently standing on
    this.dead = false;

    this.runPhase = 0;
    this.tilt = 0;
    this.buildModel();
  }

  /* ---------------------------- model ---------------------------- */

  buildModel() {
    const g = this.group;

    this.body = new THREE.Group();
    g.add(this.body);

    // hips are the animation root; everything hangs off them
    this.hips = new THREE.Group();
    this.hips.position.y = 0.92;
    this.body.add(this.hips);

    this.torso = box(0.52, 0.62, 0.32, HOODIE);
    this.torso.position.y = 0.3;
    this.hips.add(this.torso);

    const hood = box(0.5, 0.18, 0.34, HOODIE_DARK);
    hood.position.set(0, 0.58, -0.02);
    this.hips.add(hood);

    this.head = box(0.34, 0.34, 0.32, SKIN);
    this.head.position.y = 0.78;
    this.hips.add(this.head);

    // a hint of hair so the back of the head is not a flat skin box
    const hair = box(0.36, 0.14, 0.34, 0x3a2a1c);
    hair.position.y = 0.14;
    this.head.add(hair);

    // headphones — every junior dev has them on
    for (const s of [-1, 1]) {
      const cup = box(0.07, 0.14, 0.14, 0x14161c);
      cup.position.set(s * 0.2, 0.0, 0);
      this.head.add(cup);
    }
    const band = box(0.42, 0.05, 0.08, 0x14161c);
    band.position.y = 0.18;
    this.head.add(band);

    // arms: upper arm pivots at the shoulder, forearm at the elbow
    this.arms = [];
    for (const s of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(s * 0.33, 0.5, 0);
      this.hips.add(shoulder);
      const upper = box(0.15, 0.32, 0.16, HOODIE);
      upper.position.y = -0.16;
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -0.32;
      shoulder.add(elbow);
      const lower = box(0.13, 0.3, 0.14, SKIN);
      lower.position.y = -0.15;
      elbow.add(lower);
      this.arms.push({ shoulder, elbow, side: s });
    }

    // legs
    this.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * 0.14, 0, 0);
      this.hips.add(hip);
      const upper = box(0.19, 0.42, 0.2, JEANS);
      upper.position.y = -0.21;
      hip.add(upper);
      const knee = new THREE.Group();
      knee.position.y = -0.42;
      hip.add(knee);
      const lower = box(0.17, 0.4, 0.18, JEANS);
      lower.position.y = -0.2;
      knee.add(lower);
      const foot = box(0.19, 0.11, 0.3, SHOE);
      foot.position.set(0, -0.42, 0.06);
      knee.add(foot);
      this.legs.push({ hip, knee, side: s });
    }

    // laptop backpack: reads instantly from behind, which is the only angle
    // the player ever sees.
    const pack = box(0.42, 0.44, 0.18, 0x3a3f4a);
    pack.position.set(0, 0.3, -0.24);
    this.hips.add(pack);
    const sticker = new THREE.Mesh(
      new THREE.PlaneGeometry(0.26, 0.26),
      new THREE.MeshBasicMaterial({ color: 0x8fe04a })
    );
    sticker.position.set(0, 0.02, -0.1);
    sticker.rotation.y = Math.PI;
    pack.add(sticker);

    // shield bubble for the try/catch power-up
    this.shield = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 20, 14),
      new THREE.MeshBasicMaterial({
        color: 0x4ad0ff, transparent: true, opacity: 0.22,
        side: THREE.DoubleSide, depthWrite: false,
      })
    );
    this.shield.position.y = 1.0;
    this.shield.visible = false;
    g.add(this.shield);
  }

  /* ---------------------------- control ---------------------------- */

  moveLeft() {
    if (this.dead) return false;
    if (this.targetLane > 0) {
      this.targetLane--;
      return true;
    }
    return false;
  }

  moveRight() {
    if (this.dead) return false;
    if (this.targetLane < CONFIG.LANE_X.length - 1) {
      this.targetLane++;
      return true;
    }
    return false;
  }

  jump() {
    if (this.dead || this.jumping) return false;
    this.jumping = true;
    this.rolling = false;
    this.rollTimer = 0;
    this.vy = CONFIG.JUMP_VELOCITY;
    return true;
  }

  roll() {
    if (this.dead) return false;
    // rolling mid-air slams you down — the standard runner "fast fall"
    if (this.jumping) {
      this.vy = Math.min(this.vy, -CONFIG.JUMP_VELOCITY * 0.9);
    }
    this.rolling = true;
    this.rollTimer = CONFIG.ROLL_DURATION;
    return true;
  }

  /** Knocked about by an obstacle: brief speed loss, no death. */
  stumble() {
    this.stumbleTimer = CONFIG.STUMBLE_DURATION;
    this.invulnTimer = 0.9;
  }

  get stumbling() {
    return this.stumbleTimer > 0;
  }

  /** Current collision box, accounting for rolling and standing on things. */
  hitbox() {
    const h = this.rolling ? CONFIG.ROLL_HEIGHT : CONFIG.PLAYER_HEIGHT;
    return {
      x: this.x, y: this.y, z: 0,
      halfW: CONFIG.PLAYER_RADIUS,
      halfD: 0.42,
      bottom: this.y,
      top: this.y + h,
    };
  }

  /* ---------------------------- per-frame ---------------------------- */

  /**
   * @param {number} dt      seconds
   * @param {number} speed   current forward speed (drives the run cycle)
   * @param {number} groundY height of whatever is under us (0 = the track)
   */
  update(dt, speed, groundY = 0) {
    if (this.rollTimer > 0) {
      this.rollTimer -= dt;
      if (this.rollTimer <= 0) this.rolling = false;
    }
    if (this.stumbleTimer > 0) this.stumbleTimer -= dt;
    if (this.invulnTimer > 0) this.invulnTimer -= dt;

    // lane slide
    const tx = laneX(this.targetLane);
    const dx = tx - this.x;
    const step = CONFIG.LANE_SWITCH_SPEED * dt;
    if (Math.abs(dx) <= step) {
      this.x = tx;
      this.lane = this.targetLane;
    } else {
      this.x += Math.sign(dx) * step;
    }
    // lean into the turn
    const targetTilt = THREE.MathUtils.clamp(-dx * 0.22, -0.3, 0.3);
    this.tilt += (targetTilt - this.tilt) * Math.min(1, dt * 12);

    // vertical
    this.vy -= CONFIG.GRAVITY * dt;
    this.y += this.vy * dt;
    if (this.y <= groundY) {
      this.y = groundY;
      this.vy = 0;
      this.jumping = false;
    } else {
      this.jumping = true;
    }

    this.animate(dt, speed);

    this.group.position.set(this.x, this.y, 0);
    this.group.rotation.z = this.tilt;
    this.shield.position.y = this.rolling ? 0.6 : 1.0;
  }

  animate(dt, speed) {
    const airborne = this.jumping;
    this.runPhase += dt * (3.4 + speed * 0.30);
    const p = this.runPhase;

    if (this.rolling) {
      // tuck: fold the whole body forward and spin it
      const t = 1 - this.rollTimer / CONFIG.ROLL_DURATION;
      this.body.rotation.x = Math.sin(Math.min(1, t) * Math.PI) * 1.5;
      this.hips.position.y = 0.92 - Math.sin(Math.min(1, t) * Math.PI) * 0.42;
      for (const l of this.legs) {
        l.hip.rotation.x = -1.1;
        l.knee.rotation.x = 1.6;
      }
      for (const a of this.arms) {
        a.shoulder.rotation.x = 1.2;
        a.elbow.rotation.x = -1.4;
      }
      this.head.rotation.x = 0.5;
      return;
    }

    this.body.rotation.x = 0;
    this.head.rotation.x = 0;

    if (airborne) {
      // tuck-and-reach jump pose, blended by vertical velocity
      const up = THREE.MathUtils.clamp(this.vy / CONFIG.JUMP_VELOCITY, -1, 1);
      this.hips.position.y = 0.92;
      for (const l of this.legs) {
        l.hip.rotation.x = -0.7 + up * 0.35 * l.side;
        l.knee.rotation.x = 1.0 - up * 0.4;
      }
      for (const a of this.arms) {
        a.shoulder.rotation.x = -1.5 - up * 0.6;
        a.elbow.rotation.x = -0.5;
      }
      this.body.rotation.x = -0.12 - up * 0.1;
      return;
    }

    // grounded run cycle
    const swing = Math.sin(p);
    const swing2 = Math.sin(p + Math.PI);
    const bob = Math.abs(Math.sin(p)) * 0.07;
    this.hips.position.y = 0.92 + bob;
    this.body.rotation.x = -0.13 - (this.stumbling ? 0.25 : 0);

    this.legs[0].hip.rotation.x = swing * 0.95;
    this.legs[1].hip.rotation.x = swing2 * 0.95;
    this.legs[0].knee.rotation.x = Math.max(0, -swing) * 1.35;
    this.legs[1].knee.rotation.x = Math.max(0, -swing2) * 1.35;

    this.arms[0].shoulder.rotation.x = swing2 * 0.85;
    this.arms[1].shoulder.rotation.x = swing * 0.85;
    this.arms[0].elbow.rotation.x = -0.75 - Math.max(0, swing2) * 0.6;
    this.arms[1].elbow.rotation.x = -0.75 - Math.max(0, swing) * 0.6;
    for (const a of this.arms) a.shoulder.rotation.z = a.side * 0.16;

    this.head.rotation.y = Math.sin(p * 0.5) * 0.06;
  }

  setShield(on) {
    this.shield.visible = on;
  }

  /** Blink the model during post-crash invulnerability. */
  updateBlink(t) {
    const blink = this.invulnTimer > 0 && Math.sin(t * 40) < 0;
    this.body.visible = !blink;
  }

  /** Death animation: fold up and drop. */
  playCaught(dt) {
    this.dead = true;
    this.body.rotation.x = Math.min(this.body.rotation.x + dt * 3, 1.4);
    this.group.position.y = Math.max(0, this.group.position.y - dt * 2);
  }

  reset() {
    this.lane = 1;
    this.targetLane = 1;
    this.x = laneX(1);
    this.y = 0;
    this.vy = 0;
    this.jumping = false;
    this.rolling = false;
    this.rollTimer = 0;
    this.stumbleTimer = 0;
    this.invulnTimer = 0;
    this.dead = false;
    this.onTopOf = null;
    this.runPhase = 0;
    this.tilt = 0;
    this.body.visible = true;
    this.body.rotation.set(0, 0, 0);
    this.group.position.set(this.x, 0, 0);
    this.group.rotation.set(0, 0, 0);
    this.shield.visible = false;
  }
}
