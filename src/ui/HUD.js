/**
 * The HUD. Three readouts and one line of speech.
 *
 * Anything that used to be an interface element — zone names, event banners,
 * a rolling log — now happens in the world instead: on a board at the
 * lineside, or stencilled on the side of a wagon.
 */
const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = $('hud');
    this.points = $('points');
    this.dist = $('dist');
    this.gapBar = $('gap-bar');
    this.gapText = $('gap-text');
    this.meter = document.querySelector('#marcel-meter .meter-track');
    this.puEl = $('powerups');
    this.sayEl = $('say');
    this.debugEl = $('debug');
    this.threat = $('threat');
    this.glitchEl = $('glitch');

    this.sayTimer = null;
    this.puSignature = '';
    this.puNodes = [];
  }

  show() { this.el.classList.remove('hidden'); }

  hide() {
    this.el.classList.add('hidden');
    this.setThreat(0);
    this.setGlitch(0);
  }

  reset() {
    this.puEl.innerHTML = '';
    this.puSignature = '';
    this.puNodes = [];
    this.sayEl.classList.add('hidden');
    this.setThreat(0);
    this.setGlitch(0);
  }

  setStats(points, distance) {
    this.points.textContent = points.toLocaleString('en-GB');
    this.dist.textContent = `${Math.floor(distance)} m`;
  }

  /**
   * Marcel's distance. The bar empties as he closes, because a full bar has
   * to mean "good"; it only changes colour when he is genuinely a problem.
   */
  setGap(gap, max, close, gaining = false) {
    const f = Math.max(0, Math.min(1, gap / max));
    this.gapBar.style.width = `${f * 100}%`;
    this.gapText.textContent = `${Math.max(0, Math.round(gap))} m`;
    this.meter.classList.toggle('close', close);
    // the bar already grows while you are gaining; this makes it unmissable
    this.meter.classList.toggle('gaining', gaining);
  }

  /**
   * One line at a time, from whoever spoke last.
   * @param {'marcel'|'tannoy'|'good'|'bad'|''} tone
   */
  say(text, tone = '', ms = 4200) {
    this.sayEl.textContent = text;
    this.sayEl.className = tone;
    this.sayEl.classList.remove('hidden');
    if (this.sayTimer) clearTimeout(this.sayTimer);
    this.sayTimer = setTimeout(() => this.sayEl.classList.add('hidden'), ms);
  }

  setPowerups(list) {
    const sig = list.map((p) => p.id).join(',');
    if (sig !== this.puSignature) {
      this.puSignature = sig;
      this.puEl.innerHTML = '';
      this.puNodes = list.map((p) => {
        const el = document.createElement('div');
        el.className = 'pu';
        el.style.color = `#${p.color.toString(16).padStart(6, '0')}`;
        el.innerHTML = '<span class="name"></span><span class="tag"></span><i class="bar"></i>';
        el.querySelector('.name').textContent = p.label;
        el.querySelector('.tag').textContent = p.charge ? 'ready' : '';
        this.puEl.appendChild(el);
        return { el, bar: el.querySelector('.bar'), tag: el.querySelector('.tag') };
      });
    }
    list.forEach((p, i) => {
      const n = this.puNodes[i];
      if (!n) return;
      const f = p.charge ? 1 : Math.max(0, Math.min(1, p.remaining / p.total));
      n.bar.style.width = `${f * 100}%`;
      if (!p.charge) n.tag.textContent = `${p.remaining.toFixed(1)}s`;
    });
  }

  /** 0..1 — a red wash, and only when he is close. */
  setThreat(v) {
    this.threat.style.opacity = Math.max(0, Math.min(1, v)).toFixed(2);
  }

  /** 0..1 — the 500 error, briefly. */
  setGlitch(v) {
    this.glitchEl.style.opacity = Math.max(0, Math.min(1, v)).toFixed(2);
  }

  setDebug(text) {
    if (text === null) { this.debugEl.classList.add('hidden'); return; }
    this.debugEl.classList.remove('hidden');
    this.debugEl.textContent = text;
  }
}
