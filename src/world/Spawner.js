/**
 * Spawner: what is standing on the line, and where.
 *
 * The rhythm is deliberately unhurried. Roughly half of the set-ups are
 * standing freight — a run of coupled wagons in one lane that you can either
 * go round or jump up onto and run along the roofs. The rest are small
 * trackside obstacles that keep the other two verbs alive.
 *
 * Every set-up is checked to leave at least one survivable lane.
 */
import * as THREE from 'three';
import { CONFIG, laneX } from '../config.js';
import { createObstacle, createCodeSmell, createBug } from '../entities/Obstacles.js';
import {
  createWagon, createParkedLoco, randomWagonKind,
  createLevelCrossing, createCrossingFreight, createOncomingTrain,
} from '../entities/Freight.js';
import {
  createStoryPoint, createGlowCard, createPowerup,
  randomPowerupId, animatePickup, refreshGlowCard,
} from '../entities/Pickups.js';
import { WAGON_LABELS, pick } from '../data/lines.js';

const JUMPABLE = ['BUFFER', 'SLEEPERS'];
const DODGE = ['SIGNAL', 'CRATES', 'CABINET'];
const ROLLABLE = ['GANTRY', 'CATENARY'];

const chance = (p) => Math.random() < p;
const rndInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

export class Spawner {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.obstacles = [];
    this.pickups = [];
    this.scenery = [];   // non-colliding set pieces
    this.reset();
  }

  reset() {
    for (const o of this.obstacles) this.group.remove(o.group);
    for (const p of this.pickups) this.group.remove(p.group);
    for (const s of this.scenery) this.group.remove(s.group);
    this.obstacles = [];
    this.pickups = [];
    this.scenery = [];
    this.nextObstacleZ = CONFIG.SPAWN_START_METERS;
    this.nextPickupZ = 70;
    this.nextCrossingAt = CONFIG.CROSSING_MIN_METERS
      + Math.random() * (CONFIG.CROSSING_MAX_METERS - CONFIG.CROSSING_MIN_METERS);
    this.density = 1;
    this.densityTimer = 0;
    this.suppress = 0;
    this.cacheHit = 0;
    this.freeLanes = [0, 1, 2];
    this.nextOncomingAt = CONFIG.ONCOMING_MIN_METERS
      + Math.random() * (CONFIG.ONCOMING_MAX_METERS - CONFIG.ONCOMING_MIN_METERS);
    this.oncoming = null;
    this.lastType = '';
  }

  get horizon() { return CONFIG.SEGMENTS_AHEAD * CONFIG.SEGMENT_LENGTH; }

  /* ---------------------------- event hooks ---------------------------- */

  collectGarbage(seconds) {
    for (const o of this.obstacles) if (o.z > 6) o.dead = true;
    this.suppress = seconds;
  }

  raiseDensity(mult, seconds) {
    this.density = mult;
    this.densityTimer = seconds;
  }

  startCacheHit(seconds) { this.cacheHit = seconds; }

  /* ---------------------------- placement ---------------------------- */

  add(o, lane, z) {
    o.lane = lane;
    o.x = laneX(lane);
    o.z = z + (o.zOffset ?? 0);
    o.group.position.set(o.x, 0, o.z);
    this.group.add(o.group);
    this.obstacles.push(o);
    return o;
  }

  addPickup(p, lane, z, y = 1.15) {
    p.lane = lane;
    p.z = z;
    p.group.position.set(laneX(lane), y, z);
    this.group.add(p.group);
    this.pickups.push(p);
    return p;
  }

  addScenery(group, z, life = 60) {
    const s = { group, z, life };
    group.position.z = z;
    this.group.add(group);
    this.scenery.push(s);
    return s;
  }

  /**
   * A standing freight: wagons coupled nose to tail down one lane, optionally
   * headed by a locomotive you cannot climb. Story points sit along the roofs,
   * so the greedy line and the safe line are different lines.
   *
   * @returns {number} the metres of track the consist occupies
   * @param {number} lane
   * @param {number} z
   * @param {number} wagons
   * @param {string} [uniform] one wagon type for the whole rake — a train you
   *   can simply RUN along, because every roof is at the same height. Mixed
   *   stock makes crossing a consist a series of jumps; this makes it a
   *   sprint, and the two feel completely different underfoot.
   */
  spawnConsist(lane, z, wagons, uniform = null) {
    let cursor = z;
    const roofs = [];
    for (let i = 0; i < wagons; i++) {
      const kind = uniform ?? randomWagonKind();
      const w = createWagon(kind, pick(WAGON_LABELS));
      this.add(w, lane, cursor);
      roofs.push({ z: cursor + w.length / 2, top: w.top });
      cursor += w.length + 0.55;
    }
    // a locomotive at the far end: the roof run has to end somewhere
    if (chance(CONFIG.FREIGHT_LOCO_CHANCE)) {
      const loco = createParkedLoco(chance(0.3) ? 'OLD' : 'FREIGHT');
      this.add(loco, lane, cursor);
      cursor += loco.length + 0.55;
    }
    // reward the roof run
    for (const r of roofs) {
      // a near-continuous line of them, because this is the only invitation
      // the player gets to try climbing onto a train in the first place
      if (chance(0.85)) this.addPickup(createStoryPoint(), lane, r.z, r.top + 0.75);
    }
    return cursor - z;
  }

  /** A rare works train: all pre-war stock, and it is worth walking on. */
  spawnHeritageTrain(lane, z) {
    let cursor = z;
    for (let i = 0; i < 6; i++) {
      const w = createWagon('old', i === 0 ? 'WORKS TRAIN 1954' : pick(WAGON_LABELS));
      this.add(w, lane, cursor);
      this.addPickup(createStoryPoint(), lane, cursor + w.length / 2, w.top + 0.75);
      cursor += w.length + 0.55;
    }
    const loco = createParkedLoco('OLD');
    this.add(loco, lane, cursor);
    return cursor + loco.length - z;
  }

  /**
   * The level crossing. Scenery only: the road, the saltires, the barriers,
   * and a very long freight sweeping across the line ahead of you. It always
   * clears in time. It is there to be looked at.
   */
  spawnCrossing() {
    // close enough to be seen coming out of the haze, and fast enough that
    // it is always gone by the time you reach the crossing
    const z = 150;
    const cross = createLevelCrossing(CONFIG.CUT_HALF_WIDTH);
    this.addScenery(cross.group, z);

    const freight = createCrossingFreight(rndInt(9, 13));
    freight.group.position.set(-freight.length - CONFIG.CUT_HALF_WIDTH - 6, 0, z);
    this.group.add(freight.group);
    this.scenery.push({ group: freight.group, z, life: 60, crossSpeed: 55 });
    return cross;
  }

  /**
   * Send a train the other way down one track.
   *
   * Fairness is the whole job here. It closes at your speed PLUS its own, so
   * it arrives about twice as fast as anything else, and it cannot be climbed
   * or ducked — the only answer is to leave that track. So:
   *
   *   - it only goes on a track that is clear for the whole approach, which
   *     stops it appearing behind standing freight you cannot get past
   *   - nothing new spawns while it is inbound, so you are solving one problem
   *   - the horn sounds immediately, and its lamps are drawn unfogged so the
   *     track it is on reads long before the train itself does
   */
  spawnOncoming(onWarn) {
    const busy = new Set();
    for (const o of this.obstacles) {
      if (o.z > -20 && o.z < this.horizon + 260) busy.add(o.lane);
    }
    const free = [0, 1, 2].filter((l) => !busy.has(l));
    if (!free.length) return false;      // try again in a moment

    const lane = pick(free);
    const train = createOncomingTrain(rndInt(CONFIG.ONCOMING_WAGONS_MIN, CONFIG.ONCOMING_WAGONS_MAX));
    train.closing = CONFIG.ONCOMING_SPEED;
    this.add(train, lane, this.horizon + 150);
    this.oncoming = train;
    this.suppress = Math.max(this.suppress, 3.2);
    if (onWarn) onWarn(lane);
    return true;
  }

  /**
   * Lay a line of story points through the sky for the jetpack to fly along.
   *
   * It waves gently across the tracks rather than running dead straight, so
   * the flight is still steering rather than a cutscene you watch — and it
   * starts close, because the climb takes about a second and the coins have to
   * be there when you arrive.
   */
  spawnSkyCoins(lane) {
    const A = CONFIG.JETPACK_ALTITUDE;
    const span = CONFIG.JETPACK_COIN_SPAN;
    const step = 3.4;
    for (let d = 14; d < span; d += step) {
      const t = d / span;
      // a slow sine across the three tracks, rounded to a real one
      const drift = Math.round(Math.sin(t * Math.PI * 2.2) * 1.2);
      const l = Math.max(0, Math.min(2, lane + drift));
      this.addPickup(createStoryPoint(), l, d, A + Math.sin(t * Math.PI * 4) * 0.5);
    }
  }

  /* ---------------------------- patterns ---------------------------- */

  /** One set-up. Returns the lanes that stayed clear. */
  spawnPattern(z, ctx) {
    const lanes = [0, 1, 2];
    const prog = Math.min(1, ctx.distance / 3000);
    let type;

    if (chance(CONFIG.FREIGHT_SHARE)) type = 'freight';
    else {
      const r = Math.random();
      if (r < 0.40) type = 'single';
      else if (r < 0.72) type = 'double';
      else if (r < 0.87) type = 'gantryRow';
      else type = 'jumpRow';
      // never the same full-width demand twice running — that reads as unfair
      if (type === this.lastType && (type === 'gantryRow' || type === 'jumpRow')) type = 'double';
    }
    this.lastType = type;
    const free = [];

    if (type === 'freight') {
      const lane = lanes[Math.floor(Math.random() * 3)];
      const wagons = rndInt(
        CONFIG.FREIGHT_MIN_WAGONS,
        Math.round(CONFIG.FREIGHT_MIN_WAGONS + (CONFIG.FREIGHT_MAX_WAGONS - CONFIG.FREIGHT_MIN_WAGONS) * prog)
      );
      let len;
      if (chance(0.05)) {
        len = this.spawnHeritageTrain(lane, z);       // the works train
      } else if (chance(CONFIG.FLAT_CONSIST_CHANCE)) {
        // a long rake of identical stock: one jump on, then just run
        len = this.spawnConsist(lane, z,
          rndInt(CONFIG.FLAT_CONSIST_MIN, CONFIG.FLAT_CONSIST_MAX), randomWagonKind());
      } else {
        len = this.spawnConsist(lane, z, wagons);
      }
      free.push(...lanes.filter((l) => l !== lane));
      // once you are past the halfway mark, a second consist sometimes shares
      // the line, leaving exactly one lane open
      if (prog > 0.45 && chance(0.30)) {
        const second = free[Math.floor(Math.random() * free.length)];
        this.spawnConsist(second, z + rndInt(4, 12), Math.max(2, wagons - 2));
        const idx = free.indexOf(second);
        if (idx >= 0) free.splice(idx, 1);
      }
      // push the next set-up past the end of the train
      this.consistTail = len;
      return free.length ? free : lanes;
    }

    if (type === 'single') {
      const lane = lanes[Math.floor(Math.random() * 3)];
      const pool = chance(0.4) ? JUMPABLE : DODGE;
      this.add(createObstacle(pick(pool)), lane, z);
      free.push(...lanes.filter((l) => l !== lane));
    }

    if (type === 'double') {
      const keep = lanes[Math.floor(Math.random() * 3)];
      for (const l of lanes) {
        if (l === keep) continue;
        this.add(createObstacle(pick(chance(0.35) ? JUMPABLE : DODGE)), l, z + (Math.random() - 0.5) * 2);
      }
      free.push(keep);
    }

    if (type === 'gantryRow') {
      for (const l of lanes) this.add(createObstacle(pick(ROLLABLE)), l, z + (l - 1) * 0.5);
      free.push(...lanes);
    }

    if (type === 'jumpRow') {
      for (const l of lanes) this.add(createObstacle(pick(JUMPABLE)), l, z + (l - 1) * 0.5);
      free.push(...lanes);
    }

    // the occasional bait in the safe lane
    if (free.length && chance(ctx.hard ? 0.16 : 0.11)) {
      this.add(createCodeSmell(), pick(free), z + 10 + Math.random() * 6);
    }
    if (chance(CONFIG.BUG_CHANCE)) {
      this.add(createBug(), lanes[Math.floor(Math.random() * 3)], z + 16 + Math.random() * 10);
    }

    this.consistTail = 0;
    return free.length ? free : lanes;
  }

  /** Collectibles between the set-ups. */
  spawnPickups(z, free, ctx) {
    const lane = pick(free);
    const r = Math.random();
    if (r < CONFIG.POWERUP_CHANCE) {
      this.addPickup(createPowerup(randomPowerupId()), lane, z, 1.4);
      return;
    }
    if (r < CONFIG.POWERUP_CHANCE + CONFIG.GLOW_CARD_CHANCE) {
      this.addPickup(createGlowCard(), lane, z, 1.7);
      return;
    }
    const count = rndInt(4, 8);
    const arc = chance(0.3);
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0;
      const y = arc ? 0.95 + Math.sin(t * Math.PI) * 1.4 : 1.15;
      this.addPickup(createStoryPoint(), lane, z + i * 2.5, y);
    }
    void ctx;
  }

  /* ---------------------------- per-frame ---------------------------- */

  update(dt, moved, t, ctx) {
    if (this.densityTimer > 0) {
      this.densityTimer -= dt;
      if (this.densityTimer <= 0) this.density = 1;
    }
    if (this.suppress > 0) this.suppress -= dt;
    if (this.cacheHit > 0) {
      this.cacheHit -= dt;
      if (Math.random() < dt * 7) {
        this.addPickup(createStoryPoint(), Math.floor(Math.random() * 3),
          this.horizon + Math.random() * 30, 1.0 + Math.random() * 1.2);
      }
    }

    // scroll
    for (const o of this.obstacles) {
      o.z -= moved;
      // an oncoming train closes at its own speed on top of the world scroll
      if (o.closing) o.z -= o.closing * dt;
      o.group.position.z = o.z;
      if (o.kind === 'bug') {
        o.strafe += dt * 1.5;
        o.group.position.x = laneX(o.lane) + Math.sin(o.strafe) * 2.6;
        o.group.position.y = 0.9 + Math.sin(o.strafe * 2.1) * 0.28;
        o.body.rotation.set(t * 2.2, t * 1.7, 0);
        o.x = o.group.position.x;
      }
    }
    for (const p of this.pickups) {
      p.z -= moved;
      p.group.position.z = p.z;
      animatePickup(p, dt, t);
      refreshGlowCard(p);
    }
    for (const s of this.scenery) {
      s.z -= moved;
      s.group.position.z = s.z;
      if (s.crossSpeed) s.group.position.x += s.crossSpeed * dt;
    }

    // PRIMARY KEY pulls story points onto you
    if (ctx.magnet) {
      for (const p of this.pickups) {
        if (p.taken || p.z < -4 || p.z > CONFIG.MAGNET_RADIUS * 2.2) continue;
        const dx = ctx.runnerX - p.group.position.x;
        const dz = -p.z;
        if (Math.hypot(dx, dz) > CONFIG.MAGNET_RADIUS) continue;
        const k = Math.min(1, dt * 6);
        p.group.position.x += dx * k;
        p.group.position.y += (ctx.runnerY + 0.9 - p.group.position.y) * k;
        p.z += dz * k;
        p.group.position.z = p.z;
      }
    }

    // retire
    this.obstacles = this.obstacles.filter((o) => {
      // Retire on the TAIL, not the centre. A seventy-metre train measured by
      // its centre was being deleted while its back half was still on screen
      // in front of the camera — it appeared to vanish rather than pass you.
      if (o.z + o.halfD < -46 || o.dead) { this.group.remove(o.group); return false; }
      return true;
    });
    this.pickups = this.pickups.filter((p) => {
      if (p.z < -26 || p.taken) { this.group.remove(p.group); return false; }
      return true;
    });
    this.scenery = this.scenery.filter((s) => {
      if (s.z < -60) { this.group.remove(s.group); return false; }
      return true;
    });

    // spawn
    this.nextObstacleZ -= moved;
    this.nextPickupZ -= moved;

    if (this.suppress <= 0 && this.nextObstacleZ < this.horizon) {
      this.consistTail = 0;
      const free = this.spawnPattern(this.horizon + 10, ctx);
      this.freeLanes = free;
      // reaction time should stay roughly constant however fast you are going
      const scale = ctx.speed / CONFIG.START_SPEED;
      let gap = (CONFIG.PATTERN_GAP_MIN
        + Math.random() * (CONFIG.PATTERN_GAP_MAX - CONFIG.PATTERN_GAP_MIN)) * scale;
      gap /= this.density * (ctx.hard ? CONFIG.HARD_SPAWN_MULT : 1);
      // and the further you get, the less rest you are given
      gap /= 1 + ctx.distance / CONFIG.DENSITY_AT;
      gap = Math.max(CONFIG.PATTERN_GAP_FLOOR * scale, gap);
      // a long consist has to be cleared before the next thing appears
      this.nextObstacleZ = this.horizon + 10 + (this.consistTail || 0) + gap;
    }

    if (this.nextPickupZ < this.horizon) {
      this.spawnPickups(this.horizon + 6, this.freeLanes, ctx);
      this.nextPickupZ = this.horizon + 6 + 30 + Math.random() * 34;
    }

    // a train the other way
    if (ctx.distance > this.nextOncomingAt) {
      if (this.spawnOncoming(ctx.onOncoming)) {
        this.nextOncomingAt = ctx.distance + CONFIG.ONCOMING_MIN_METERS
          + Math.random() * (CONFIG.ONCOMING_MAX_METERS - CONFIG.ONCOMING_MIN_METERS);
      } else {
        this.nextOncomingAt = ctx.distance + 60;   // line was busy, ask again
      }
    }
    if (this.oncoming && (this.oncoming.dead || this.oncoming.z < -60)) this.oncoming = null;

    // the crossing, as a rare landmark
    if (ctx.distance > this.nextCrossingAt) {
      this.nextCrossingAt = ctx.distance + CONFIG.CROSSING_MIN_METERS
        + Math.random() * (CONFIG.CROSSING_MAX_METERS - CONFIG.CROSSING_MIN_METERS);
      this.spawnCrossing();
      if (ctx.onCrossing) ctx.onCrossing();
    }
  }
}
