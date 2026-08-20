/**
 * Easter eggs outside the terminal: a handful of words you can type while
 * running. None of them are needed, none of them are hinted at, and each one
 * works once per run.
 *
 * The whole point is that they are quiet. Nothing flashes; a line of text
 * arrives, something small changes, and the game carries on.
 */
const WORDS = {
  commit: (api) => {
    api.grant('EXCEPTION_HANDLER');
    api.say('You committed. Marcel is almost satisfied.', 'good');
  },
  coffee: (api) => {
    api.grant('GIT_PUSH');
    api.say('Coffee. The only dependency that ever resolves.', 'good');
  },
  sudo: (api) => {
    api.grant('GIT_PUSH');
    api.say('student is not in the sudoers file. Granted anyway.', 'good');
  },
  null: (api) => {
    api.fallBack(6);
    api.say('NullReferenceException. Marcel was null, briefly.', 'good');
  },
  ludmilla: (api) => {
    api.fallBack(10);
    api.say('A Class 232 went past on the down line. Marcel watched it.', 'good');
  },
};

export class EasterEggs {
  constructor(api) {
    this.api = api;
    this.reset();
  }

  reset() {
    this.used = new Set();
    this.debug = false;
    this.found = 0;
  }

  /** Fed by InputManager with the rolling buffer of typed letters. */
  onTyped(typed) {
    if (typed === 'konami') {
      this.debug = !this.debug;
      this.api.setDebug(this.debug);
      this.api.say(this.debug ? 'Debug build. You can see the hitboxes now.' : 'Release build.', 'good');
      return;
    }
    for (const [word, run] of Object.entries(WORDS)) {
      if (!typed.endsWith(word) || this.used.has(word)) continue;
      this.used.add(word);
      this.found++;
      run(this.api);
      this.api.clearTyped();
      return;
    }
  }
}
