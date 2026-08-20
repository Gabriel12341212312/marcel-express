/**
 * Input for a three-lane runner: keyboard, touch swipes, and the cheat-code
 * listener that unlocks the easter eggs.
 *
 * Actions are queued as one-shots and drained once per frame, so a fast tap
 * during a stalled frame is never swallowed.
 */
const SWIPE_MIN = 34;       // px before a drag counts as a swipe
const SWIPE_MAX_TIME = 600; // ms

export class InputManager {
  constructor() {
    this.queue = [];
    this.keys = new Set();
    /** Callback for typed cheat words: (word) => void */
    this.onSecret = null;
    /** Callback for the terminal key (^ / backtick). */
    this.onTerminal = null;
    /** While true, keys go to the in-game terminal instead of the runner. */
    this.textMode = false;

    this.typed = '';
    this.konami = 0;
    this.KONAMI = [
      'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
      'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA',
    ];

    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    // touch
    this.touchStart = null;
    const el = window;
    el.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      this.touchStart = { x: t.clientX, y: t.clientY, at: performance.now() };
    }, { passive: true });
    el.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: true });
  }

  onKeyDown(e) {
    // the terminal swallows everything while it is open
    if (this.textMode) return;

    if (e.code === 'Backquote' || e.key === '^' || e.code === 'IntlBackslash') {
      e.preventDefault();
      // the terminal listens on the same target; without this it would also
      // see the key that opened it and type a stray backtick into the prompt
      e.stopImmediatePropagation();
      if (this.onTerminal) this.onTerminal();
      return;
    }

    this.keys.add(e.code);

    // konami: the classic, and it turns on the debug overlay
    if (e.code === this.KONAMI[this.konami]) {
      this.konami++;
      if (this.konami === this.KONAMI.length) {
        this.konami = 0;
        if (this.onSecret) this.onSecret('konami');
      }
    } else {
      this.konami = e.code === this.KONAMI[0] ? 1 : 0;
    }

    // typed cheat words (sudo, prod, gc, ...)
    if (/^Key[A-Z]$/.test(e.code)) {
      this.typed = (this.typed + e.code.slice(3).toLowerCase()).slice(-12);
      if (this.onSecret) this.onSecret(this.typed);
    }

    if (e.repeat) return;
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': this.queue.push('left'); break;
      case 'ArrowRight': case 'KeyD': this.queue.push('right'); break;
      case 'ArrowUp': case 'KeyW': case 'Space': this.queue.push('jump'); e.preventDefault(); break;
      case 'ArrowDown': case 'KeyS': this.queue.push('roll'); e.preventDefault(); break;
      case 'Escape': this.queue.push('pause'); break;
      case 'Enter': this.queue.push('confirm'); break;
      default: break;
    }
  }

  onTouchEnd(e) {
    if (!this.touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - this.touchStart.x;
    const dy = t.clientY - this.touchStart.y;
    const dtime = performance.now() - this.touchStart.at;
    this.touchStart = null;
    if (dtime > SWIPE_MAX_TIME) return;
    if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) {
      this.queue.push('jump');   // tap = jump
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) this.queue.push(dx > 0 ? 'right' : 'left');
    else this.queue.push(dy > 0 ? 'roll' : 'jump');
  }

  /** Drain the queued actions for this frame. */
  drain() {
    const q = this.queue;
    this.queue = [];
    return q;
  }

  clearTyped() {
    this.typed = '';
  }
}
