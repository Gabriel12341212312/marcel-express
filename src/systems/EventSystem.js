/**
 * Occasional things that go wrong (or briefly right) on the line.
 *
 * Six events, roughly one every eighty seconds, each one a single line of
 * text and a real mechanical change. Nothing here takes over the screen — an
 * event should feel like a thing that happened, not like a cutscene.
 *
 * The station announcements live here too. They have no mechanical effect at
 * all; they are the quiet the rest of the game plays against.
 */
import { CONFIG } from '../config.js';
import { EVENTS, ANNOUNCEMENTS, pick } from '../data/lines.js';

export class EventSystem {
  /** @param {object} deps { marcel, track, spawner, power, audio, say } */
  constructor(deps) {
    this.d = deps;
    this.reset();
  }

  reset() {
    this.next = CONFIG.EVENT_FIRST_MIN
      + Math.random() * (CONFIG.EVENT_FIRST_MAX - CONFIG.EVENT_FIRST_MIN);
    this.nextAnnounce = 14 + Math.random() * 20;
    this.recent = [];

    this.glitchTimer = 0;   // 500 Internal Server Error
    this.glitch = 0;
  }

  update(dt, ctx) {
    this.next -= dt;
    if (this.next <= 0) {
      this.fireRandom(ctx);
      this.next = CONFIG.EVENT_INTERVAL_MIN
        + Math.random() * (CONFIG.EVENT_INTERVAL_MAX - CONFIG.EVENT_INTERVAL_MIN);
    }

    this.nextAnnounce -= dt;
    if (this.nextAnnounce <= 0) {
      this.nextAnnounce = CONFIG.ANNOUNCE_INTERVAL_MIN
        + Math.random() * (CONFIG.ANNOUNCE_INTERVAL_MAX - CONFIG.ANNOUNCE_INTERVAL_MIN);
      this.d.say(pick(ANNOUNCEMENTS), 'tannoy');
      this.d.audio.tannoy();
    }

    if (this.glitchTimer > 0) {
      this.glitchTimer -= dt;
      this.glitch = 0.25 + Math.abs(Math.sin(performance.now() * 0.011)) * 0.4;
      this.d.track.lightFactor = 0.62 + Math.random() * 0.14;
      if (this.glitchTimer <= 0) {
        this.glitch = 0;
        this.d.track.lightFactor = 1;
      }
    }
  }

  fireRandom(ctx) {
    const usable = EVENTS.filter((e) => ctx.distance >= e.minMeters && !this.recent.includes(e.kind));
    const pool = usable.length ? usable : EVENTS.filter((e) => ctx.distance >= e.minMeters);
    if (!pool.length) return;

    const total = pool.reduce((a, e) => a + e.weight, 0);
    let r = Math.random() * total;
    let chosen = pool[0];
    for (const e of pool) {
      r -= e.weight;
      if (r <= 0) { chosen = e; break; }
    }
    this.recent.push(chosen.kind);
    if (this.recent.length > 3) this.recent.shift();
    this.fire(chosen);
  }

  fire(e) {
    const { marcel, spawner, power, audio, say } = this.d;
    say(e.line, e.good ? 'good' : 'bad');

    switch (e.kind) {
      case 'TIMEOUT':
        marcel.fallBack(11);
        marcel.blind(4);
        audio.good();
        break;
      case 'GARBAGE_COLLECT':
        spawner.collectGarbage(4);
        audio.sweep();
        break;
      case 'CACHE_HIT':
        spawner.startCacheHit(6);
        audio.good();
        break;
      case 'SERVER_500':
        this.glitchTimer = 3.5;
        audio.error();
        break;
      case 'CODE_REVIEW':
        spawner.raiseDensity(1.45, 16);
        audio.error();
        break;
      case 'REVERT':
        marcel.closeIn(8);
        audio.error();
        break;
      default:
        break;
    }
    void power;
  }
}
