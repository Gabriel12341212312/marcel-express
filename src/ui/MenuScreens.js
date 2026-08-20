/**
 * Menus: start, pause and the retrospective that replaces a normal game-over
 * screen. Settings and the personal best live in localStorage.
 */
import { RETRO_GOOD, RETRO_BAD, RETRO_WHY, pick } from '../data/lines.js';

const $ = (id) => document.getElementById(id);
const KEY_HARD = 'sod-hard';
const KEY_VOL = 'sod-vol';
const KEY_BEST = 'sod-best';

export class MenuScreens {
  constructor({ onStart, onResume, onRestart, onMenu, onHardChange, onVolume }) {
    this.menu = $('menu');
    this.pause = $('pause');
    this.gameover = $('gameover');

    this.hardBtn = $('btn-hard');
    this.hardMode = localStorage.getItem(KEY_HARD) === '1';
    this.onHardChange = onHardChange;
    this.updateHardButton();
    this.hardBtn.addEventListener('click', () => {
      this.hardMode = !this.hardMode;
      localStorage.setItem(KEY_HARD, this.hardMode ? '1' : '0');
      this.updateHardButton();
      onHardChange?.(this.hardMode);
    });

    $('btn-start').addEventListener('click', onStart);
    $('btn-resume').addEventListener('click', onResume);
    $('btn-quit').addEventListener('click', onMenu);
    $('btn-restart').addEventListener('click', onRestart);
    $('btn-menu').addEventListener('click', onMenu);

    this.vol = $('vol');
    this.vol.value = localStorage.getItem(KEY_VOL) ?? '0.8';
    this.vol.addEventListener('input', () => {
      localStorage.setItem(KEY_VOL, this.vol.value);
      onVolume?.(parseFloat(this.vol.value));
    });

    this.best = parseInt(localStorage.getItem(KEY_BEST) ?? '0', 10) || 0;
    $('hiscore').textContent = this.best;
  }

  updateHardButton() {
    this.hardBtn.textContent = this.hardMode ? 'Hard Mode: ON' : 'Hard Mode: OFF';
    this.hardBtn.classList.toggle('active', this.hardMode);
  }

  getHardMode() { return this.hardMode; }
  getVolume() { return parseFloat(this.vol.value); }

  showMenu() {
    $('hiscore').textContent = this.best;
    this.menu.classList.remove('hidden');
    this.pause.classList.add('hidden');
    this.gameover.classList.add('hidden');
  }

  showPause() {
    this.pause.classList.remove('hidden');
    this.menu.classList.add('hidden');
    this.gameover.classList.add('hidden');
  }

  /**
   * The retrospective. Three of the six questions a real one asks, answered
   * with whatever the run actually did.
   */
  showGameOver(stats) {
    $('go-line').textContent = `"${stats.line}"`;
    const m = Math.floor(stats.time / 60);
    const s = Math.floor(stats.time % 60);
    $('go-stats').textContent =
      `${Math.floor(stats.distance)} M · ${m}:${String(s).padStart(2, '0')} · `
      + `${stats.storyPoints} SP · ${stats.points} VELOCITY`;

    $('retro-good').textContent = stats.storyPoints > 0
      ? `${stats.storyPoints} story points were actually delivered.`
      : pick(RETRO_GOOD);
    $('retro-bad').textContent = stats.crashes > 0
      ? `${stats.crashes} unhandled exception${stats.crashes === 1 ? '' : 's'} reached production.`
      : pick(RETRO_BAD);
    $('retro-why').textContent = pick(RETRO_WHY);

    const isBest = stats.points > this.best;
    if (isBest) {
      this.best = stats.points;
      localStorage.setItem(KEY_BEST, String(this.best));
    }
    $('go-new').classList.toggle('hidden', !isBest);

    this.gameover.classList.remove('hidden');
    this.menu.classList.add('hidden');
    this.pause.classList.add('hidden');
  }

  hideAll() {
    this.menu.classList.add('hidden');
    this.pause.classList.add('hidden');
    this.gameover.classList.add('hidden');
  }
}
