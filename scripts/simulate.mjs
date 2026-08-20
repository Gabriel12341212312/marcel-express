/**
 * Headless smoke test and balance check.
 *
 * Stubs just enough DOM/canvas for three.js and the texture generators, then
 * drives the real game systems through several minutes of scripted play. It
 * mirrors main.js's gameplay() call order exactly, so anything that would
 * throw in the browser throws here first — and the summary at the end is what
 * you look at after changing a number in config.js.
 *
 *   npm run sim
 *   node scripts/simulate.mjs --hard --seconds=420
 */
const NOOP = () => {};

function fakeCtx() {
  const grad = { addColorStop: NOOP };
  return new Proxy({}, {
    get(_, k) {
      if (k === 'measureText') return () => ({ width: 40 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
      if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (k === 'canvas') return { width: 1, height: 1 };
      return NOOP;
    },
    set() { return true; },
  });
}

function fakeElement(tag = 'div') {
  return {
    tagName: tag.toUpperCase(),
    width: 1, height: 1,
    style: {}, dataset: {}, children: [],
    classList: { add: NOOP, remove: NOOP, toggle: NOOP, contains: () => false },
    getContext: () => fakeCtx(),
    appendChild(c) { this.children.push(c); return c; },
    removeChild: NOOP, remove: NOOP,
    addEventListener: NOOP, removeEventListener: NOOP, setAttribute: NOOP,
    querySelector: () => fakeElement(), querySelectorAll: () => [],
    get childElementCount() { return this.children.length; },
    set innerHTML(_) { this.children = []; },
    get innerHTML() { return ''; },
    textContent: '', scrollTop: 0, scrollHeight: 0,
    toDataURL: () => 'data:,',
  };
}

globalThis.window = {
  addEventListener: NOOP, removeEventListener: NOOP,
  devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720,
  localStorage: { getItem: () => null, setItem: NOOP },
};
globalThis.document = {
  createElement: (t) => fakeElement(t),
  createElementNS: (_, t) => fakeElement(t),
  getElementById: () => fakeElement(),
  querySelector: () => fakeElement(),
  addEventListener: NOOP, hidden: false,
};
globalThis.localStorage = window.localStorage;
globalThis.self = globalThis;

/**
 * A stand-in for the browser's Image. It always fails to load, which is the
 * useful case to exercise headlessly: anything that fetches a picture has to
 * degrade gracefully when the file is not there.
 */
globalThis.Image = class {
  set src(v) {
    this._src = v;
    queueMicrotask(() => this.onerror?.(new Error('no images headless')));
  }

  get src() { return this._src; }
};

const THREE = await import('three');
const base = '../src/';
const { CONFIG } = await import(base + 'config.js');
const { TrackManager } = await import(base + 'world/TrackManager.js');
const { Spawner } = await import(base + 'world/Spawner.js');
const { Runner } = await import(base + 'entities/Runner.js');
const { Marcel } = await import(base + 'entities/Marcel.js');
const { PowerUps } = await import(base + 'systems/PowerUps.js');
const { EventSystem } = await import(base + 'systems/EventSystem.js');

const HARD = process.argv.includes('--hard');
const SECONDS = Number(process.argv.find((a) => a.startsWith('--seconds='))?.split('=')[1]) || 300;
const STYLE = process.argv.find((a) => a.startsWith('--style='))?.split('=')[1] ?? 'safe';

const scene = new THREE.Scene();
const track = new TrackManager(scene);
const spawner = new Spawner(scene);
const runner = new Runner(scene);
const marcel = new Marcel(scene, NOOP, HARD);

const audio = new Proxy({}, { get: () => NOOP });
const power = new PowerUps(NOOP);
const said = [];
const events = new EventSystem({
  marcel, track, spawner, power, audio,
  say: (text, tone) => said.push(`${tone || '-'}: ${text}`),
});

/* ---------------------------- the loop ---------------------------- */

let baseSpeed = CONFIG.START_SPEED;
let distance = 0, points = 0, storyPoints = 0, crashes = 0, t = 0;
let caught = false, caughtAt = null;
let momentum = 0;
let peakMult = 1;
let wasOnRoof = false;
let idleFrames = 0, busyFrames = 0, actions = 0, lastActionT = 0;
const gapsBetweenActions = [];
let multSum = 0, multFrames = 0;
const scoreMult = () => Math.min(CONFIG.MOMENTUM_MAX_MULT, 1 + Math.floor(momentum / CONFIG.MOMENTUM_PER_STEP));
const seen = {
  hit: new Set(), powerups: new Set(), variants: new Set(['MODERN']),
  collected: 0, roofFrames: 0, crossings: 0, nearMisses: 0, mounts: 0, oncoming: 0, oncomingHits: 0,
};

function groundHeight() {
  let gy = 0;
  for (const o of spawner.obstacles) {
    if (!o.mountable) continue;
    if (Math.abs(o.z) > o.halfD + 0.42) continue;
    if (Math.abs(runner.x - o.x) > o.halfW + CONFIG.PLAYER_RADIUS) continue;
    if (runner.y >= o.top - 0.3 && o.top > gy) gy = o.top;
  }
  return gy;
}

/**
 * Two bots, because the interesting question is not "can it survive" but
 * "does playing well pay".
 *
 *   safe   — always takes the emptiest lane. Never climbs anything.
 *   greedy — hunts standing freight, jumps onto it and rides the roofs,
 *            because that is what buys distance off Marcel.
 *
 * Running both against the same rules is how you find out whether the roof
 * bonus actually changes outcomes or just adds a number to the config.
 */
function bot(speed, style) {
  const greedy = style === 'greedy';
  const onRoof = runner.y > 0.5;
  const look = Math.max(16, speed * 1.25);
  const cost = [0, 0, 0];
  let needJump = false;
  let needRoll = false;

  for (const o of spawner.obstacles) {
    const front = o.z - o.halfD;
    // an oncoming train closes twice as fast, so look twice as far for it
    if (front < 0.5 || front > (o.family === 'oncoming' ? look * 2.6 : look)) continue;
    if (o.kind === 'bug') continue;
    const lane = CONFIG.LANE_X.findIndex((x) => Math.abs(x - o.x) < 1.4);
    if (lane < 0) continue;

    // a greedy runner WANTS the freight, so it scores as a reward, not a cost
    if (o.family === 'oncoming') cost[lane] += 40;   // never, under any circumstances
    else if (o.kind === 'smell') cost[lane] += 0.3;
    else if (o.mountable) cost[lane] += greedy ? -0.9 : 0.6;
    else cost[lane] += 1.4;

    if (lane !== runner.targetLane) continue;

    if (front < speed * 0.45) {
      if (o.bottom > 0.5) needRoll = true;
      else if (o.top <= 1.05) needJump = true;
      else if (o.mountable && runner.y < o.top - 0.3) {
        // jump early enough that the apex lands on the roof rather than the
        // end wall — measured at roughly four tenths of a second out
        if (front < speed * (greedy ? 0.42 : 0.36)) needJump = true;
      }
    }
  }

  const best = cost.indexOf(Math.min(...cost));
  // never step off a roof we are being paid to stand on
  const stay = greedy && onRoof && cost[runner.targetLane] < 0;
  if (!stay && cost[runner.targetLane] > cost[best] + 0.25) {
    if (best < runner.targetLane) runner.moveLeft(); else runner.moveRight();
  }
  if (needRoll) runner.roll();
  else if (needJump) runner.jump();
}

const DT = 1 / 60;
for (let frame = 0; frame < 60 * SECONDS && !caught; frame++) {
  t += DT;
  baseSpeed = Math.min(CONFIG.MAX_SPEED,
    baseSpeed + (HARD ? CONFIG.HARD_SPEED_RAMP : CONFIG.SPEED_RAMP) * DT);
  const speed = baseSpeed * power.speedMult * (runner.stumbling ? CONFIG.STUMBLE_SPEED_MULT : 1);
  const moved = speed * DT;

  distance += moved;
  points += moved * CONFIG.POINTS_PER_METER * scoreMult();

  const laneBefore = runner.targetLane, yBefore = runner.vy, rollBefore = runner.rolling;
  bot(speed, STYLE);
  if (runner.targetLane !== laneBefore || runner.vy > yBefore + 1 || (runner.rolling && !rollBefore)) {
    actions++; gapsBetweenActions.push(t - lastActionT); lastActionT = t;
  }

  track.update(DT, moved, t);
  spawner.update(DT, moved, t, {
    distance, speed, hard: HARD,
    magnet: power.magnet, runnerX: runner.x, runnerY: runner.y,
    onCrossing: () => { seen.crossings++; },
    onOncoming: () => { seen.oncoming++; },
  });

  {
    const window_ = speed * 1.6;   // roughly what a player can react to
    let busy = false;
    for (const o of spawner.obstacles) {
      const front = o.z - o.halfD;
      if (front > 0 && front < window_) { busy = true; break; }
    }
    busy ? busyFrames++ : idleFrames++;
  }
  const gy = groundHeight();
  momentum = Math.max(0, momentum - CONFIG.MOMENTUM_DECAY * DT);
  if (gy > 0.5) {
    if (!wasOnRoof) { momentum += CONFIG.MOMENTUM_PER_MOUNT; marcel.fallBack(CONFIG.MARCEL_MOUNT_BONUS); seen.mounts++; }
    seen.roofFrames++;
    momentum += CONFIG.MOMENTUM_PER_ROOF_SECOND * DT;
  }
  wasOnRoof = gy > 0.5;
  runner.update(DT, speed, gy);

  // collisions — identical rules to main.js
  const hb = runner.hitbox();
  for (const o of spawner.obstacles) {
    if (o.hitDone || o.dead) continue;
    if (Math.abs(o.z) > o.halfD + hb.halfD) continue;
    const ox = o.kind === 'bug' ? o.group.position.x : o.x;
    if (Math.abs(runner.x - ox) > o.halfW + hb.halfW) continue;
    const oy0 = o.kind === 'bug' ? o.group.position.y - 0.6 : o.bottom;
    const oy1 = o.kind === 'bug' ? o.group.position.y + 0.6 : o.top;
    if (hb.top <= oy0 || hb.bottom >= oy1 - 0.12) continue;

    if (o.kind === 'bug') { o.dead = true; points += CONFIG.BUG_BOUNTY; continue; }
    if (o.kind === 'smell') {
      o.dead = true;
      points -= CONFIG.CODE_SMELL_PENALTY;
      marcel.closeIn(CONFIG.MARCEL_SMELL_PENALTY);
      continue;
    }
    if (runner.invulnTimer > 0) continue;
    seen.hit.add(o.def.id ?? o.def.label);
    if (power.invincible) { o.dead = true; continue; }
    if (power.catchException()) { o.dead = true; continue; }
    crashes++; momentum = 0; o.hitDone = true; runner.stumble();
    if (o.family === 'oncoming') seen.oncomingHits++;
    marcel.closeIn(HARD ? CONFIG.HARD_CRASH_PENALTY : CONFIG.MARCEL_CRASH_PENALTY);
  }

  // near misses — identical rules to main.js
  for (const o of spawner.obstacles) {
    if (o.missScored || o.dead || o.z > 0) continue;
    o.missScored = true;
    if (o.hitDone || o.kind === 'smell' || o.kind === 'bug') continue;
    const lateral = Math.abs(runner.x - o.x) - (o.halfW + hb.halfW);
    if (o.mountable && hb.bottom >= o.top - 0.2) continue;
    let clearance = lateral;
    if (lateral < 0) clearance = hb.bottom >= o.top ? hb.bottom - o.top : o.bottom - hb.top;
    if (clearance < 0 || clearance > CONFIG.NEAR_MISS_MARGIN) continue;
    seen.nearMisses++;
    momentum += CONFIG.MOMENTUM_PER_NEAR_MISS;
    points += CONFIG.NEAR_MISS_POINTS * scoreMult();
    marcel.fallBack(CONFIG.NEAR_MISS_GAP);
  }

  const cx = runner.x, cy = runner.y + (runner.rolling ? 0.5 : 0.95);
  for (const p of spawner.pickups) {
    if (p.taken) continue;
    const dx = cx - p.group.position.x, dy = cy - p.group.position.y, dz = -p.z;
    if (dx * dx + dy * dy + dz * dz > 2.4 * 2.4) continue;
    p.taken = true;
    seen.collected++;
    if (p.kind === 'sp') { storyPoints++; points += p.value; }
    else if (p.kind === 'powerup') { seen.powerups.add(p.def.id); power.collect(p.def.id); }
    else { storyPoints += 13; points += p.value; }
  }

  peakMult = Math.max(peakMult, scoreMult());
  multSum += scoreMult(); multFrames++;
  power.update(DT);
  events.update(DT, { distance });
  const swap = marcel.updateVariant(distance);
  if (swap) seen.variants.add(swap.id);
  marcel.update(DT, t, speed, runner.x, distance, gy > 0.5);
  if (marcel.caught) { caught = true; caughtAt = { distance, t }; }
}

/* ---------------------------- collision checks ---------------------------- */

/**
 * The bot above is good enough that it can finish a run without touching
 * anything, which would hide a broken collision test. These two checks prove
 * the machinery works rather than trusting a clean scoreboard.
 */
function withFreshWorld(fn) {
  spawner.reset();
  runner.reset();
  return fn();
}

/** Walk straight into a standing consist and confirm it registers. */
const blindCheck = withFreshWorld(() => {
  const speed = 20;
  spawner.spawnConsist(1, 40, 4);
  let hits = 0;
  for (let i = 0; i < 60 * 8; i++) {
    spawner.update(DT, speed * DT, i * DT, { distance: 0, speed, hard: false });
    runner.update(DT, speed, groundHeight());
    const hb = runner.hitbox();
    for (const o of spawner.obstacles) {
      if (o.hitDone || Math.abs(o.z) > o.halfD + hb.halfD) continue;
      if (Math.abs(runner.x - o.x) > o.halfW + hb.halfW) continue;
      if (hb.top <= o.bottom || hb.bottom >= o.top - 0.12) continue;
      o.hitDone = true;
      hits++;
    }
  }
  return hits;
});

/** Jump onto the head of a consist and run the roofs. */
function mountCheck(jumpAt) {
  return withFreshWorld(() => {
    const speed = 20;
    spawner.spawnConsist(1, 50, 5);
    const first = spawner.obstacles[0];
    let roof = 0, jumped = false, clipped = false;
    for (let i = 0; i < 60 * 10; i++) {
      const front = first.z - first.halfD;
      if (!jumped && front <= jumpAt) { runner.jump(); jumped = true; }
      spawner.update(DT, speed * DT, i * DT, { distance: 0, speed, hard: false });
      const gy = groundHeight();
      if (gy > 0.5) roof++;
      runner.update(DT, speed, gy);
      const hb = runner.hitbox();
      for (const o of spawner.obstacles) {
        if (Math.abs(o.z) > o.halfD + hb.halfD) continue;
        if (Math.abs(runner.x - o.x) > o.halfW + hb.halfW) continue;
        if (hb.top <= o.bottom || hb.bottom >= o.top - 0.12) continue;
        clipped = true;
      }
      if (spawner.obstacles.length === 0) break;
    }
    // `clipped` only means the runner touched a wagon end without jumping
    // again — roofs differ in height, so crossing a consist needs more than
    // one jump. It is expected, not a failure.
    return { jumpAt, framesOnRoof: roof, clippedWithoutFurtherJumps: clipped };
  });
}

const mount = [9, 6, 4, 2].map(mountCheck);

/* ---------------------------- framing check ---------------------------- */

/**
 * The one geometric promise the game makes: Marcel is always in frame, and he
 * never covers the runner. Both follow from the camera height, so check it
 * across the whole range of the chase rather than trusting the numbers.
 *
 * `clearOfRunner` is the vertical gap on screen, in degrees, between the
 * runner's feet and Marcel's roofline. It must stay positive.
 */
const lerp = (a, b, k) => a + (b - a) * k;
const deg = (r) => (r * 180) / Math.PI;
const framing = [];
for (const gap of [56, 46, 30, 20, 16, 12, 9, 6, 3]) {
  const s = Math.max(0, Math.min(1, gap / CONFIG.MARCEL_MAX_GAP));
  const back = lerp(CONFIG.CAM_BACK_TENSE, CONFIG.CAM_BACK_CALM, s);
  const height = lerp(CONFIG.CAM_HEIGHT_TENSE, CONFIG.CAM_HEIGHT_CALM, s);
  const ahead = lerp(CONFIG.CAM_LOOK_AHEAD_TENSE, CONFIG.CAM_LOOK_AHEAD_CALM, s);
  const lookY = lerp(CONFIG.CAM_LOOK_HEIGHT_TENSE, CONFIG.CAM_LOOK_HEIGHT_CALM, s);

  const noseZ = CONFIG.MARCEL_Z_NEAR + (CONFIG.MARCEL_Z_FAR - CONFIG.MARCEL_Z_NEAR) * s;
  const scale = CONFIG.MARCEL_SCALE_NEAR + (CONFIG.MARCEL_SCALE_FAR - CONFIG.MARCEL_SCALE_NEAR) * s;
  const roof = 2.88 * scale;
  const LOCO_LEN = 6.0;
  // his rear end, and the roof panel that carries his face
  const tailZ = noseZ - LOCO_LEN * scale;
  const panelZ = noseZ - 2.3 * scale;

  const fov = lerp(CONFIG.FOV_TENSE, CONFIG.FOV_CALM, s);
  const pitch = deg(Math.atan2(lookY - height, ahead + back));
  const half = fov / 2;
  const top = pitch + half;
  const bottom = pitch - half;

  const dzM = back + noseZ;                       // camera -> his nose
  const marcelTop = deg(Math.atan2(roof - height, dzM));
  const marcelBottom = deg(Math.atan2(-height, dzM));
  const runnerBottom = deg(Math.atan2(-height, back));
  const runnerTop = deg(Math.atan2(CONFIG.PLAYER_HEIGHT - height, back));

  // how much of the frame he actually occupies, after clipping
  const visible = Math.max(0, Math.min(marcelTop, top) - Math.max(marcelBottom, bottom));

  // the camera must stay clear of his back end, and the roof panel that
  // carries his face has to stay inside the frame at every chase distance
  const camToTail = back + tailZ;
  const panelTop = deg(Math.atan2(3.8 * scale - height, back + panelZ));
  const panelBottom = deg(Math.atan2(2.0 * scale - height, back + panelZ));
  const panelVisible = Math.max(0, Math.min(panelTop, top) - Math.max(panelBottom, bottom));

  framing.push({
    gap,
    fov: +fov.toFixed(0),
    trackBetween: +(-noseZ).toFixed(1),           // metres of empty rail behind you
    marcelDistFromCam: +dzM.toFixed(1),
    camClearOfHisTail: +camToTail.toFixed(1),     // must stay positive
    marcelScreenHeight: `${((visible / fov) * 100).toFixed(1)}%`,
    facePanelVisible: panelVisible > 1.5,
    clearOfRunner: +(runnerBottom - marcelTop).toFixed(1),
    runnerScreenHeight: `${(((runnerTop - runnerBottom) / fov) * 100).toFixed(1)}%`,
  });
}
// he must always be worth looking at, never on top of the player, never
// wrapped around the camera, and his face must always be somewhere in shot
const framingOk = framing.every((f) => parseFloat(f.marcelScreenHeight) > 8
  && f.clearOfRunner > 0 && f.camClearOfHisTail > 0.5 && f.facePanelVisible);


// --- what the renderer is actually being asked to draw ---
function sceneCost(root) {
  const geos = new Set(), mats = new Set();
  let meshes = 0, sprites = 0, objects = 0, tris = 0;
  root.traverse((o) => {
    objects++;
    if (o.isSprite) { sprites++; mats.add(o.material.uuid); return; }
    if (!o.isMesh) return;
    meshes++;
    geos.add(o.geometry.uuid);
    mats.add(o.material.uuid);
    const g = o.geometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return { objects, meshes, sprites, drawCalls: meshes + sprites,
           uniqueGeometries: geos.size, uniqueMaterials: mats.size, triangles: Math.round(tris) };
}
const cost = {
  whole: sceneCost(scene),
  track: sceneCost(track.group),
  spawned: sceneCost(spawner.group),
  marcel: sceneCost(marcel.root),
};

console.log(JSON.stringify({
  sceneCost: cost,
  mode: (HARD ? 'hard' : 'normal') + ' / ' + STYLE,
  survivedSeconds: +t.toFixed(1),
  distance: Math.round(distance),
  finalSpeed: +baseSpeed.toFixed(1),
  points: Math.round(points),
  storyPoints,
  crashes,
  caught,
  caughtAt: caughtAt && { m: Math.round(caughtAt.distance), s: +caughtAt.t.toFixed(1) },
  gapAtEnd: +marcel.gap.toFixed(1),
  framesRunningOnFreight: seen.roofFrames,
  pickups: seen.collected,
  crossings: seen.crossings,
  deadAirPercent: +((idleFrames / (idleFrames + busyFrames)) * 100).toFixed(1),
  actions,
  actionsPerMinute: +((actions / t) * 60).toFixed(1),
  medianSecondsBetweenActions: +(gapsBetweenActions.sort((a, b) => a - b)[Math.floor(gapsBetweenActions.length / 2)] ?? 0).toFixed(2),
  oncomingTrains: seen.oncoming,
  oncomingHits: seen.oncomingHits,
  nearMisses: seen.nearMisses,
  peakMultiplier: peakMult,
  averageMultiplier: +(multSum / multFrames).toFixed(2),
  mounts: seen.mounts,
  marcelVariants: [...seen.variants],
  obstaclesHit: [...seen.hit],
  powerupsSeen: [...seen.powerups],
  live: {
    obstacles: spawner.obstacles.length,
    pickups: spawner.pickups.length,
    scenery: spawner.scenery.length,
  },
  blindWalkHits: blindCheck,
  mountCheck: mount,
  linesSpoken: said.length,
  sampleLines: said.slice(0, 4),
  zone: track.currentZone().id,
  framingOk,
  framing,
}, null, 2));
