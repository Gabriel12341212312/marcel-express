/**
 * Active power-up effects. Three of them, expressed as derived state that the
 * main loop reads — power-ups never reach into the game themselves.
 */
import { CONFIG } from '../config.js';
import { POWERUPS } from '../data/lines.js';

const TOTALS = {
  SNEAKERS: CONFIG.DURATION_SNEAKERS,
  JETPACK: CONFIG.DURATION_JETPACK,
  GIT_PUSH: CONFIG.DURATION_GIT_PUSH,
  PRIMARY_KEY: CONFIG.DURATION_MAGNET,
};

export class PowerUps {
  constructor(onChange) {
    this.onChange = onChange;
    this.reset();
  }

  reset() {
    /** id -> seconds remaining */
    this.timers = new Map();
    /** try/catch is a charge, not a timer */
    this.shield = false;
    this.notify();
  }

  /** Collect a chip. Returns the definition so the caller can announce it. */
  collect(id) {
    this.grant(id, TOTALS[id] ?? 0);
    return POWERUPS[id];
  }

  grant(id, seconds) {
    if (id === 'EXCEPTION_HANDLER') this.shield = true;
    else this.timers.set(id, Math.max(this.timers.get(id) ?? 0, seconds || TOTALS[id] || 5));
    this.notify();
  }

  has(id) { return (this.timers.get(id) ?? 0) > 0; }

  /** Consume the try/catch charge. True if a crash was swallowed. */
  catchException() {
    if (this.has('GIT_PUSH')) return true;   // pushing straight through
    if (!this.shield) return false;
    this.shield = false;
    this.notify();
    return true;
  }

  get speedMult() { return this.has('GIT_PUSH') ? CONFIG.GIT_PUSH_SPEED_MULT : 1; }
  get magnet() { return this.has('PRIMARY_KEY'); }
  get invincible() { return this.has('GIT_PUSH'); }

  update(dt) {
    if (!this.timers.size) return;
    for (const [id, v] of this.timers) {
      const n = v - dt;
      if (n <= 0) this.timers.delete(id);
      else this.timers.set(id, n);
    }
    this.notify();
  }

  /** Snapshot for the HUD. At most two entries, usually none. */
  list() {
    const out = [];
    for (const [id, v] of this.timers) {
      out.push({ ...POWERUPS[id], remaining: v, total: TOTALS[id] ?? v });
    }
    if (this.shield) out.push({ ...POWERUPS.EXCEPTION_HANDLER, remaining: 1, total: 1, charge: true });
    return out;
  }

  notify() {
    if (this.onChange) this.onChange(this.list());
  }
}
