/**
 * MARCEL EXPRESS — entry point and game loop.
 *
 * A quiet three-track endless runner along a freight line. The runner stays
 * at z = 0 and the line scrolls toward -z. Marcel is a locomotive behind you,
 * and — this is the whole point — he is drawn where the chase model says he
 * is, so the number on the gauge and the machine on the track always agree.
 *
 * The camera is doing real work here. Two framings are blended by how close
 * he is: wide and unhurried with a long lens when he is far down the line,
 * tight and short-lensed when he is not. Height is held constant, because it
 * is what keeps his roofline below the runner's feet on screen AND the line
 * every overhead structure has to clear to stay out of the play area. The
 * closing lens is what makes his approach read — a rear chase camera cannot
 * do it with distance alone, since him nearing the runner means the camera
 * backing off him.
 *
 * States: MENU -> RUNNING <-> PAUSED/TERMINAL -> CAUGHT -> RETROSPECTIVE.
 */
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { TrackManager } from './world/TrackManager.js';
import { Spawner } from './world/Spawner.js';
import { Runner } from './entities/Runner.js';
import { Marcel } from './entities/Marcel.js';
import { InputManager } from './systems/InputManager.js';
import { AudioManager } from './systems/AudioManager.js';
import { PowerUps } from './systems/PowerUps.js';
import { EventSystem } from './systems/EventSystem.js';
import { EasterEggs } from './systems/EasterEggs.js';
import { HUD } from './ui/HUD.js';
import { MenuScreens } from './ui/MenuScreens.js';
import { Terminal } from './ui/Terminal.js';
import { CAUGHT_LINES, CRASH_LINES, pick } from './data/lines.js';

const lerp = (a, b, t) => a + (b - a) * t;

/* ---------------------------- renderer ---------------------------- */

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({
  antialias: CONFIG.ANTIALIAS,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.MAX_PIXEL_RATIO));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x121a20, CONFIG.FOG_NEAR, CONFIG.FOG_FAR);
scene.background = new THREE.Color(0x121a20);

const camera = new THREE.PerspectiveCamera(
  CONFIG.FOV, window.innerWidth / window.innerHeight, 0.1, 400
);
camera.position.set(0, CONFIG.CAM_HEIGHT_CALM, -CONFIG.CAM_BACK_CALM);

/* ---------------------------- systems ---------------------------- */

const track = new TrackManager(scene);
const spawner = new Spawner(scene);
const runner = new Runner(scene);
const input = new InputManager();
const audio = new AudioManager();
const hud = new HUD();

let hardMode = false;
const marcel = new Marcel(scene, onMarcelLine, false);

const power = new PowerUps((list) => hud.setPowerups(list));
const events = new EventSystem({
  marcel, track, spawner, power, audio,
  say: (text, tone) => say(text, tone),
});

/* ---------------------------- state ---------------------------- */

let state = 'MENU';   // MENU | RUNNING | PAUSED | TERMINAL | CAUGHT | OVER
let baseSpeed = CONFIG.START_SPEED;
let distance = 0;
let points = 0;
let storyPoints = 0;
let crashes = 0;
let elapsed = 0;
let catchTimer = 0;
let caughtLine = '';
let debugOn = false;
let overlayReturn = 'RUNNING';
let roofTime = 0;        // consecutive seconds spent up on the freight
let taughtRoof = false;  // Marcel only complains about it once per run
let nearMisses = 0;

/**
 * Momentum: the score multiplier, and the only thing a crash really costs.
 *
 * It is fed by risk and nothing else — squeezing past things, and standing up
 * on the freight where Marcel can see you. Hitting something empties it. That
 * is what gives the cowardly line a price: you can run the empty track all
 * day and finish on x1.
 */
let momentum = 0;
const scoreMult = () => Math.min(
  CONFIG.MOMENTUM_MAX_MULT,
  1 + Math.floor(momentum / CONFIG.MOMENTUM_PER_STEP)
);

// camera state, eased rather than snapped
const cam = {
  back: CONFIG.CAM_BACK_CALM,
  height: CONFIG.CAM_HEIGHT_CALM,
  ahead: CONFIG.CAM_LOOK_AHEAD_CALM,
  lookY: CONFIG.CAM_LOOK_HEIGHT_CALM,
};

/** Anything anybody says goes through here, so only one line shows at a time. */
function say(text, tone = '', ms = 4200) {
  if (state !== 'RUNNING' && state !== 'CAUGHT') return;
  hud.say(text, tone, ms);
}

function onMarcelLine(text, near) {
  say(text, 'marcel', near ? 3200 : 4600);
  audio.speak(near ? 1.7 : 1.3);
}

/* ---------------------------- easter-egg hooks ---------------------------- */

const eggApi = {
  grant: (id, sec) => {
    if (id === 'DNS') { marcel.fallBack(14); marcel.blind(5); return; }
    if (id === 'QUERY_ZERO') { marcel.fallBack(9); return; }
    power.grant(id, sec);
  },
  addPoints: (n) => { points += n; },
  resetScore: () => { points = 0; storyPoints = 0; say('The score is gone. That is what --hard means.', 'bad'); },
  fallBack: (m) => marcel.fallBack(m),
  say,
  setDebug: (v) => { debugOn = v; if (!v) hud.setDebug(null); },
  toggleDebug: () => { debugOn = !debugOn; if (!debugOn) hud.setDebug(null); },
  clearTyped: () => input.clearTyped(),
  teleportProduction: () => {
    track.lockProduction();
    say('You are on the production line now. There is no signal box.', 'bad');
  },
  close: () => closeTerminal(),
  state: () => ({ distance, points, storyPoints, gap: marcel.gap }),
};

const eggs = new EasterEggs(eggApi);
const terminal = new Terminal({ ...eggApi, onSecret: () => {} });

input.onSecret = (typed) => { if (state === 'RUNNING') eggs.onTyped(typed); };
input.onTerminal = () => toggleTerminal();

/* ---------------------------- menus ---------------------------- */

const menus = new MenuScreens({
  onStart: startRun,
  onResume: resumeRun,
  onRestart: startRun,
  onMenu: backToMenu,
  onHardChange: (v) => { hardMode = v; },
  onVolume: (v) => audio.setVolume(v),
});
hardMode = menus.getHardMode();
audio.setVolume(menus.getVolume());

/* ---------------------------- flow ---------------------------- */

function startRun() {
  track.reset();
  spawner.reset();
  runner.reset();
  power.reset();
  events.reset();
  eggs.reset();
  terminal.reset();
  hud.reset();
  marcel.reset(hardMode);

  baseSpeed = CONFIG.START_SPEED;
  distance = 0;
  points = 0;
  storyPoints = 0;
  crashes = 0;
  nearMisses = 0;
  momentum = 0;
  elapsed = 0;
  catchTimer = 0;
  roofTime = 0;
  taughtRoof = false;

  cam.back = CONFIG.CAM_BACK_CALM;
  cam.height = CONFIG.CAM_HEIGHT_CALM;
  cam.ahead = CONFIG.CAM_LOOK_AHEAD_CALM;
  cam.lookY = CONFIG.CAM_LOOK_HEIGHT_CALM;

  state = 'RUNNING';
  menus.hideAll();
  hud.show();
  audio.ensure();
  audio.startAmbience();
  say('Marcel is on the line behind you.', 'marcel', 4000);
}

function pauseRun() {
  if (state !== 'RUNNING') return;
  state = 'PAUSED';
  audio.setEngine(0);
  menus.showPause();
}

function resumeRun() {
  if (state !== 'PAUSED') return;
  state = 'RUNNING';
  menus.hideAll();
}

function backToMenu() {
  state = 'MENU';
  menus.showMenu();
  hud.hide();
  audio.setEngine(0);
  marcel.setVisible(false);
}

function toggleTerminal() {
  if (state === 'RUNNING' || state === 'MENU' || state === 'OVER') {
    overlayReturn = state;
    state = 'TERMINAL';
    input.textMode = true;
    terminal.show();
    audio.setEngine(0);
  } else if (state === 'TERMINAL') {
    closeTerminal();
  }
}

function closeTerminal() {
  terminal.hide();
  input.textMode = false;
  state = overlayReturn;
}

function beginCatch() {
  if (state !== 'RUNNING') return;
  state = 'CAUGHT';
  catchTimer = 0;
  caughtLine = pick(CAUGHT_LINES);
  audio.horn();
  hud.say(caughtLine, 'marcel', 5000);
  hud.setThreat(1);
}

function endRun() {
  state = 'OVER';
  hud.hide();
  audio.setEngine(0);
  audio.stopHeartbeat();
  menus.showGameOver({
    line: caughtLine,
    time: elapsed,
    distance,
    points: Math.floor(points),
    storyPoints,
    crashes,
  });
}

/* ---------------------------- collision ---------------------------- */

/** Highest mountable roof the runner is currently over. */
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

function crash(o) {
  if (power.invincible) { o.dead = true; audio.sweep(); return; }
  if (power.catchException()) {
    o.dead = true;
    audio.caught();
    say('Caught by the exception handler. Nothing happened.', 'good', 3000);
    return;
  }
  crashes++;
  momentum = 0;
  o.hitDone = true;
  audio.crash();
  runner.stumble();
  marcel.closeIn(hardMode ? CONFIG.HARD_CRASH_PENALTY : CONFIG.MARCEL_CRASH_PENALTY);
  // he comments, dryly, rather than the screen shouting
  say(Math.random() < 0.55 ? pick(CRASH_LINES) : o.def.crash, 'marcel', 3200);
}

/**
 * Near misses.
 *
 * Scored the moment an obstacle passes the runner's plane. Clearance is
 * measured on whichever axis you actually beat it on — sideways if you
 * changed track late, vertically if you jumped a barrier or rolled under a
 * gantry — and the smallest of those is how close you came.
 *
 * The payoff is small on purpose. It is not meant to be farmed; it is meant
 * to make the empty lane feel like the coward's line, which is what stops
 * "always take the free track" from being the whole game.
 */
function checkNearMisses() {
  const hb = runner.hitbox();
  for (const o of spawner.obstacles) {
    if (o.missScored || o.dead || o.z > 0) continue;
    o.missScored = true;
    if (o.hitDone || o.kind === 'smell' || o.kind === 'bug') continue;

    const ox = o.kind === 'bug' ? o.group.position.x : o.x;
    const lateral = Math.abs(runner.x - ox) - (o.halfW + hb.halfW);
    // riding on top of it is not a near miss, it is a roof run
    if (o.mountable && hb.bottom >= o.top - 0.2) continue;

    let clearance = lateral;
    if (lateral < 0) {
      // we were over or under it rather than beside it
      clearance = hb.bottom >= o.top ? hb.bottom - o.top : o.bottom - hb.top;
    }
    if (clearance < 0 || clearance > CONFIG.NEAR_MISS_MARGIN) continue;

    nearMisses++;
    momentum += CONFIG.MOMENTUM_PER_NEAR_MISS;
    points += CONFIG.NEAR_MISS_POINTS * scoreMult();
    marcel.fallBack(CONFIG.NEAR_MISS_GAP);
    audio.graze();
  }
}

function checkCollisions() {
  const hb = runner.hitbox();

  for (const o of spawner.obstacles) {
    if (o.hitDone || o.dead) continue;
    if (Math.abs(o.z) > o.halfD + hb.halfD) continue;
    const ox = o.kind === 'bug' ? o.group.position.x : o.x;
    if (Math.abs(runner.x - ox) > o.halfW + hb.halfW) continue;

    const oy0 = o.kind === 'bug' ? o.group.position.y - 0.6 : o.bottom;
    const oy1 = o.kind === 'bug' ? o.group.position.y + 0.6 : o.top;
    // standing on the roof of something mountable is not a collision
    if (hb.top <= oy0 || hb.bottom >= oy1 - 0.12) continue;

    if (o.kind === 'bug') {
      o.dead = true;
      points += CONFIG.BUG_BOUNTY;
      audio.good();
      say(o.def.crash, 'good', 2800);
      continue;
    }
    if (o.kind === 'smell') {
      o.dead = true;
      points = Math.max(0, points - CONFIG.CODE_SMELL_PENALTY);
      marcel.closeIn(CONFIG.MARCEL_SMELL_PENALTY);
      audio.error();
      say(o.def.crash, 'bad', 2800);
      continue;
    }
    if (runner.invulnTimer > 0) continue;
    crash(o);
  }

  const cx = runner.x;
  const cy = runner.y + (runner.rolling ? 0.5 : 0.95);
  for (const p of spawner.pickups) {
    if (p.taken) continue;
    const dx = cx - p.group.position.x;
    const dy = cy - p.group.position.y;
    const dz = -p.z;
    if (dx * dx + dy * dy + dz * dz > 2.4 * 2.4) continue;
    p.taken = true;
    collect(p);
  }
}

function collect(p) {
  if (p.kind === 'sp') {
    storyPoints++;
    points += p.value;
    audio.coin();
  } else if (p.kind === 'glow') {
    storyPoints += 13;
    points += p.value;
    audio.chime();
    say(p.text, 'good', 3600);
  } else if (p.kind === 'powerup') {
    const def = power.collect(p.def.id);
    audio.powerup();
    say(def.toast, 'good', 3400);
  }
}

/* ---------------------------- input ---------------------------- */

function handleInput() {
  for (const action of input.drain()) {
    if (action === 'pause') {
      if (state === 'RUNNING') pauseRun();
      else if (state === 'PAUSED') resumeRun();
      continue;
    }
    if (state !== 'RUNNING') continue;
    switch (action) {
      case 'left': if (runner.moveLeft()) audio.switchTrack(); break;
      case 'right': if (runner.moveRight()) audio.switchTrack(); break;
      case 'jump': if (runner.jump()) audio.jump(); break;
      case 'roll': if (runner.roll()) audio.land(); break;
      default: break;
    }
  }
}

/* ---------------------------- per-frame ---------------------------- */

let footTimer = 0;

function gameplay(dt, t) {
  baseSpeed = Math.min(
    CONFIG.MAX_SPEED,
    baseSpeed + (hardMode ? CONFIG.HARD_SPEED_RAMP : CONFIG.SPEED_RAMP) * dt
  );
  const speed = baseSpeed * power.speedMult * (runner.stumbling ? CONFIG.STUMBLE_SPEED_MULT : 1);
  const moved = speed * dt;

  distance += moved;
  elapsed += dt;
  points += moved * CONFIG.POINTS_PER_METER * scoreMult();

  track.update(dt, moved, t);
  spawner.update(dt, moved, t, {
    distance, speed, hard: hardMode,
    magnet: power.magnet, runnerX: runner.x, runnerY: runner.y,
    onCrossing: () => say('A freight is crossing ahead. It will be a while.', 'tannoy', 4600),
  });

  const gy = groundHeight();
  const onRoof = gy > 0.5;
  runner.update(dt, speed, gy);
  runner.updateBlink(t);
  runner.setShield(power.shield);
  checkCollisions();
  checkNearMisses();

  // Teaching the roof bonus without a tutorial: the first time you stay up on
  // the freight, Marcel tells you off for it. He already had the line, and a
  // complaint is a better hint than an instruction — you learn that standing
  // up there is worth something because it is the one thing that annoys him.
  momentum = Math.max(0, momentum - CONFIG.MOMENTUM_DECAY * dt);
  if (onRoof && roofTime === 0) momentum += CONFIG.MOMENTUM_PER_MOUNT;
  if (onRoof) momentum += CONFIG.MOMENTUM_PER_ROOF_SECOND * dt;
  roofTime = onRoof ? roofTime + dt : 0;
  if (!taughtRoof && roofTime > 0.7) {
    taughtRoof = true;
    say('Please do not stand on the freight.', 'marcel', 4200);
    audio.speak(1.4);
  }

  audio.tickRails(dt, speed);

  footTimer -= dt;
  if (footTimer <= 0 && !runner.jumping && !runner.rolling) {
    footTimer = 1 / (2.4 + speed * 0.13);
    audio.footstep(gy > 0.5);
  }

  power.update(dt);
  events.update(dt, { distance });

  // his later machines, announced once each
  const swapped = marcel.updateVariant(distance);
  if (swapped) {
    say(swapped.arrival, 'marcel', 5200);
    audio.horn();
  }
  marcel.update(dt, t, speed, runner.x, distance, gy > 0.5);
  if (marcel.caught) beginCatch();

  /* --- feedback, all keyed off the same one number --- */

  const s = marcel.safety;
  const near = 1 - s;
  audio.setEngine(0.18 + near * 0.82);
  audio.setHeartbeat(marcel.gap < CONFIG.MARCEL_BREATH_GAP ? near : 0);
  audio.maybeTickHeartbeat();
  hud.setThreat(marcel.gap < CONFIG.MARCEL_TENSE_GAP
    ? (1 - marcel.gap / CONFIG.MARCEL_TENSE_GAP) * 0.8 : 0);
  hud.setGlitch(events.glitch * 0.55);
  hud.setStats(Math.floor(points), distance, scoreMult());
  hud.setGap(marcel.gap, CONFIG.MARCEL_MAX_GAP, marcel.gap < CONFIG.MARCEL_TENSE_GAP, gy > 0.5);

  if (debugOn) {
    hud.setDebug(
      `speed    ${speed.toFixed(1)} m/s\n`
      + `distance ${distance.toFixed(0)} m\n`
      + `gap      ${marcel.gap.toFixed(1)} m  (safety ${s.toFixed(2)})\n`
      + `marcel z ${marcel.z.toFixed(1)}  x ${marcel.x.toFixed(2)}  ${marcel.variantId}\n`
      + `cam      back ${cam.back.toFixed(1)} h ${cam.height.toFixed(1)}\n`
      + `lane     ${runner.lane} -> ${runner.targetLane}   y ${runner.y.toFixed(2)} / ${gy.toFixed(2)}\n`
      + `world    ${spawner.obstacles.length} obs, ${spawner.pickups.length} pick, ${spawner.scenery.length} set\n`
      + `event in ${events.next.toFixed(0)}s`
    );
  }

  updateCamera(dt, s);
}

/**
 * Blend the calm and tense framings by how safe you are.
 *
 * The height is the important one: with Marcel's roof under 2.9 m, a camera
 * this high always sees over him, which is what lets him sit right behind the
 * runner without ever hiding them.
 */
function updateCamera(dt, s) {
  const wantBack = lerp(CONFIG.CAM_BACK_TENSE, CONFIG.CAM_BACK_CALM, s);
  const wantHeight = lerp(CONFIG.CAM_HEIGHT_TENSE, CONFIG.CAM_HEIGHT_CALM, s);
  const wantAhead = lerp(CONFIG.CAM_LOOK_AHEAD_TENSE, CONFIG.CAM_LOOK_AHEAD_CALM, s);
  const wantLookY = lerp(CONFIG.CAM_LOOK_HEIGHT_TENSE, CONFIG.CAM_LOOK_HEIGHT_CALM, s);

  const k = Math.min(1, dt * CONFIG.CAM_EASE);
  cam.back += (wantBack - cam.back) * k;
  cam.height += (wantHeight - cam.height) * k;
  cam.ahead += (wantAhead - cam.ahead) * k;
  cam.lookY += (wantLookY - cam.lookY) * k;

  const shake = (1 - s) * 0.05 + (runner.stumbling ? 0.12 : 0) + events.glitch * 0.06;
  camera.position.set(
    runner.x * 0.34 + (Math.random() - 0.5) * shake,
    cam.height + (Math.random() - 0.5) * shake,
    -cam.back
  );
  camera.lookAt(runner.x * 0.22, cam.lookY, cam.ahead);

  // the lens narrows as he closes, which is most of how his approach reads
  const fovTarget = lerp(CONFIG.FOV_TENSE, CONFIG.FOV_CALM, s);
  camera.fov += (fovTarget - camera.fov) * Math.min(1, dt * CONFIG.CAM_EASE);
  camera.updateProjectionMatrix();
}

function catching(dt) {
  catchTimer += dt;
  marcel.playCatch(dt);
  runner.playCaught(dt);
  camera.position.x += (Math.random() - 0.5) * 0.2;
  camera.position.y += (Math.random() - 0.5) * 0.2;
  camera.lookAt(0, 1.4, -3);
  hud.setThreat(1);
  if (catchTimer > 2.3) endRun();
}

function menuCamera(t) {
  // a long, slow look down the line, with nobody on it
  camera.position.set(Math.sin(t * 0.14) * 3.0, 5.4, -14);
  camera.lookAt(Math.sin(t * 0.1) * 2.0, 2.6, 40);
  camera.fov = CONFIG.FOV;
  camera.updateProjectionMatrix();
}

/* ---------------------------- loop ---------------------------- */

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'RUNNING') pauseRun();
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  handleInput();

  if (state === 'RUNNING') {
    gameplay(dt, t);
  } else if (state === 'CAUGHT') {
    catching(dt);
    track.update(dt, 0, t);
  } else if (state === 'MENU') {
    const drift = CONFIG.START_SPEED * dt * 0.42;
    track.update(dt, drift, t);
    spawner.update(dt, drift, t, {
      distance: 0, speed: CONFIG.START_SPEED, hard: false,
      runnerX: 0, runnerY: 0,
    });
    menuCamera(t);
  } else {
    track.update(dt, 0, t);
  }

  const z = track.currentZone();
  scene.fog.color.setHex(z.fog);
  scene.background.setHex(z.fog);
  track.followCamera(camera);

  renderer.render(scene, camera);
}

marcel.setVisible(false);
menus.showMenu();
animate();
