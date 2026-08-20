/**
 * The secret terminal — the biggest easter egg in the game.
 *
 * Press ^ (or the backtick key) at any time to drop a console over the track.
 * The run is suspended while it is open, because Marcel is "blocked on I/O".
 * Most commands are jokes; a handful genuinely change the run, and a few are
 * traps. Nothing in here is required to win.
 */
const $ = (id) => document.getElementById(id);

export class Terminal {
  /**
   * @param {object} api hooks back into the game:
   *   { grant(id, sec), addPoints(n), resetScore(), teleportProduction(),
   *     toggleDebug(), state(), close() }
   */
  constructor(api) {
    this.api = api;
    this.el = $('terminal');
    this.out = $('term-out');
    this.inputEl = $('term-input');
    this.open = false;
    this.buffer = '';
    this.history = [];
    this.histIndex = -1;
    this.sudoAttempts = 0;
    this.inVim = false;
    this.discovered = new Set();

    window.addEventListener('keydown', (e) => this.onKey(e), true);
  }

  /* ---------------------------- lifecycle ---------------------------- */

  toggle() {
    this.open ? this.hide() : this.show();
    return this.open;
  }

  show() {
    this.open = true;
    this.el.classList.remove('hidden');
    if (!this.out.childElementCount) {
      this.print('marcel-runtime 4.0.0 (linux/amd64) — unauthorised shell', 'dim');
      this.print('This incident has been reported. Type "help".', 'dim');
      this.print('');
    }
    this.render();
  }

  hide() {
    this.open = false;
    this.el.classList.add('hidden');
  }

  onKey(e) {
    if (!this.open) return;
    e.stopPropagation();
    e.preventDefault();

    // Esc, ^ and ` all close the shell. While it is open the InputManager
    // stands down, so the toggle key arrives here instead.
    if (e.key === 'Escape' || e.code === 'Backquote' || e.key === '^' || e.code === 'IntlBackslash') {
      if (this.inVim) {
        this.print('Use ":q!" like everybody else.', 'err');
        return;
      }
      this.api.close();
      return;
    }
    if (e.key === 'Enter') {
      const line = this.buffer.trim();
      this.buffer = '';
      this.render();
      this.print(`student@marcel:~$ ${line}`);
      if (line) {
        this.history.push(line);
        this.histIndex = this.history.length;
        this.run(line);
      }
      this.out.scrollTop = this.out.scrollHeight;
      return;
    }
    if (e.key === 'Backspace') {
      this.buffer = this.buffer.slice(0, -1);
      this.render();
      return;
    }
    if (e.key === 'ArrowUp') {
      if (this.histIndex > 0) {
        this.histIndex--;
        this.buffer = this.history[this.histIndex];
        this.render();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      if (this.histIndex < this.history.length - 1) {
        this.histIndex++;
        this.buffer = this.history[this.histIndex];
      } else {
        this.histIndex = this.history.length;
        this.buffer = '';
      }
      this.render();
      return;
    }
    if (e.key.length === 1) {
      this.buffer += e.key;
      this.render();
    }
  }

  render() {
    this.inputEl.textContent = this.buffer;
  }

  print(text = '', cls = '') {
    const div = document.createElement('div');
    if (cls) div.className = cls;
    div.textContent = text;
    this.out.appendChild(div);
    this.out.scrollTop = this.out.scrollHeight;
  }

  lines(arr, cls) {
    for (const l of arr) this.print(l, cls);
  }

  /* ---------------------------- commands ---------------------------- */

  run(raw) {
    const line = raw.trim();
    const lower = line.toLowerCase();
    const [cmd, ...args] = lower.split(/\s+/);
    const rest = line.slice(cmd.length).trim();

    if (this.inVim) {
      if (lower === ':q!' || lower === ':q' || lower === ':wq') {
        this.inVim = false;
        this.print('You escaped vim. This is the real achievement.', 'ok');
        this.secret('vim');
      } else {
        this.print('E37: No write since last change. You are still in vim.', 'err');
      }
      return;
    }

    switch (cmd) {
      case 'help':
        this.lines([
          'Available (allegedly):',
          '  ls  cd  cat  whoami  clear  exit  echo  man',
          '  git <status|log|push|checkout|reset>',
          '  sudo <anything>   docker ps   top   ps',
          '  systemctl status marcel   journalctl',
          '  psql / select ...   ping   curl   dig',
          '  npm install   dotnet run   debug   vim',
          '',
          'Nothing here is required to survive. Marcel is still behind you.',
        ], 'dim');
        break;

      case 'ls':
        this.lines([
          'Program.cs      Marcel.cs        MarcelService.cs   appsettings.json',
          'backlog.db      sprint4000.log   .env               TODO.md',
          'node_modules/   .git/            /production        secrets/',
        ]);
        this.print('secrets/: Permission denied', 'err');
        break;

      case 'cd':
        if (rest.includes('production')) {
          this.print('Entering /production. There are no checkpoints here.', 'err');
          this.api.teleportProduction();
          this.secret('production');
        } else if (rest.includes('secrets')) {
          this.print('bash: cd: secrets/: Permission denied', 'err');
          this.print('Hint: you are not in the sudoers file. Yet.', 'dim');
        } else if (!rest || rest === '~') {
          this.print('Already home. Home is a deployment pipeline.', 'dim');
        } else {
          this.print(`bash: cd: ${rest}: No such file or directory`, 'err');
        }
        break;

      case 'cat':
        if (rest.includes('todo')) {
          this.lines([
            '- [ ] write tests',
            '- [ ] remove the god class',
            '- [ ] ask Marcel what the requirement actually was',
            '- [x] deploy on Friday',
          ]);
        } else if (rest.includes('.env')) {
          this.lines([
            'DB_HOST=marcel.internal',
            'DB_PASSWORD=hunter2',
            'MARCEL_SPEED=yes',
          ], 'err');
          this.print('You should not have read that. Neither should the repository.', 'dim');
          this.secret('env');
        } else if (rest.includes('passwd')) {
          this.print('cat: /etc/passwd: Permission denied', 'err');
        } else if (rest.includes('sprint4000.log')) {
          this.lines([
            '[sprint 3998] velocity 42 — the team is happy',
            '[sprint 3999] velocity 41 — the team is quiet',
            '[sprint 4000] velocity ∞ — the team is gone',
          ], 'dim');
        } else {
          this.print(`cat: ${rest || 'nothing'}: No such file or directory`, 'err');
        }
        break;

      case 'whoami':
        this.lines([
          'student (uid=1001) groups=1001(student),4000(backlog)',
          'not in sudoers. not in the sprint. not safe.',
        ]);
        break;

      case 'sudo': {
        this.sudoAttempts++;
        if (this.sudoAttempts < 3) {
          this.print('[sudo] password for student:', 'dim');
          this.print('student is not in the sudoers file. This incident has been reported.', 'err');
          this.print(`Attempt ${this.sudoAttempts} of 3. Marcel is watching.`, 'dim');
        } else {
          this.print('...', 'dim');
          this.print('Nobody knows how you did that. The line is yours for a while.', 'ok');
          this.api.grant('GIT_PUSH', 10);
          this.secret('sudo');
        }
        break;
      }

      case 'git': this.git(args, rest); break;

      case 'docker':
        this.lines([
          'CONTAINER ID   IMAGE            STATUS            NAMES',
          '4000deadbeef   marcel:latest    Up 11 years       marcel_prod_1',
          'c0ffee123456   student:junior   Restarting (1)    you',
        ]);
        break;

      case 'top':
      case 'ps':
        this.lines([
          '  PID USER      %CPU  COMMAND',
          '    1 root      99.9  marcel.service',
          ' 1337 student    0.1  run --forever',
          ' 4000 root       0.0  [garbage_collector]',
        ]);
        break;

      case 'systemctl':
        this.lines([
          '● marcel.service - The IT Teacher',
          '   Loaded: loaded (/etc/systemd/system/marcel.service; enabled)',
          '   Active: active (hunting) since sprint 4000',
          '     Docs: man:marcel(8) — nobody has read it',
          ' Main PID: 1 (marcel)',
        ], 'ok');
        if (rest.includes('restart') || rest.includes('stop')) {
          this.print('Failed to stop marcel.service: Access denied. He restarts himself.', 'err');
        }
        break;

      case 'journalctl':
        this.lines([
          'marcel[1]: reviewing code...',
          'marcel[1]: requested changes on PR #1',
          'marcel[1]: WARN  student velocity below expectation',
          'marcel[1]: this will definitely be on the exam',
        ], 'dim');
        break;

      case 'ping':
        this.lines([
          'PING marcel.local (10.0.0.1): 56 data bytes',
          '64 bytes from 10.0.0.1: icmp_seq=0 time=840.221 ms',
          '64 bytes from 10.0.0.1: icmp_seq=1 time=0.004 ms',
          'he is getting closer',
        ], 'err');
        break;

      case 'dig':
        this.print('DNS_PROBE_FINISHED_NXDOMAIN — for a moment, he cannot find you.', 'ok');
        this.api.grant('DNS', 0);
        break;

      case 'curl':
        this.lines([
          'HTTP/1.1 503 Service Unavailable',
          'Retry-After: never',
          '{"status":"marcel is the service","healthy":false}',
        ], 'err');
        break;

      case 'psql':
      case 'select':
      case 'sql': {
        if (lower.includes('marcel')) {
          this.lines([
            ' id |  name  | role        | speed',
            '----+--------+-------------+-------',
            '  1 | Marcel | scrum_master| yes',
            '(1 row)',
          ]);
        } else if (lower.includes('drop')) {
          this.print('ERROR: cannot drop table "marcel" because other objects depend on it', 'err');
          this.print('DETAIL: everything depends on it', 'dim');
        } else {
          this.print('Query returned 0 rows. He cannot find you either.', 'ok');
          this.api.grant('QUERY_ZERO', 0);
        }
        break;
      }

      case 'npm':
        this.lines([
          'added 1284 packages, and audited 1285 packages in 4m',
          '61 vulnerabilities (2 low, 1 moderate, 58 marcel)',
          'run `npm audit fix --force` to break everything',
        ], 'dim');
        break;

      case 'dotnet':
        this.lines([
          'Build succeeded.',
          '    0 Warning(s)',
          '    0 Error(s)',
          'Unhandled exception. System.NullReferenceException: Marcel was null.',
          '   at Marcel.Chase(Student you)',
        ], 'err');
        this.secret('nullref');
        break;

      case 'vim':
      case 'vi':
        this.inVim = true;
        this.print('~ ~ ~ you are now in vim. good luck. (:q! to leave)', 'err');
        break;

      case 'man':
        this.lines([
          'MARCEL(8)                 System Manager                MARCEL(8)',
          '',
          'NAME',
          '    marcel - hunts unestimated work',
          '',
          'BUGS',
          '    That is not a bug, that is a feature.',
        ], 'dim');
        break;

      case 'echo':
        this.print(rest || '');
        if (lower.includes('1337')) {
          this.print('elite. +1337 velocity.', 'ok');
          this.api.addPoints(1337);
          this.secret('1337');
        }
        break;

      case 'debug':
        this.api.toggleDebug();
        this.print('debug overlay toggled. now you can see the hitboxes lying to you.', 'ok');
        this.secret('debug');
        break;

      case 'clear':
        this.out.innerHTML = '';
        break;

      case 'rm':
        if (lower.includes('-rf') && (lower.includes(' /') || lower.endsWith('/'))) {
          this.print('rm: it is tempting, but production is watching.', 'err');
          this.print('Nice try. Marcel logged that.', 'dim');
          this.secret('rmrf');
        } else {
          this.print(`rm: cannot remove '${rest}': Operation not permitted`, 'err');
        }
        break;

      case 'exit':
      case 'q':
        this.api.close();
        break;

      case 'history':
        this.lines([
          '  1  git commit -m "fix"',
          '  2  git commit -m "fix fix"',
          '  3  git commit -m "actually fix"',
          '  4  git push --force',
          '  ...',
          '  4000  run',
        ], 'dim');
        break;

      default:
        this.print(`bash: ${cmd}: command not found`, 'err');
        this.print('Did anybody read the task description?', 'dim');
        break;
    }
  }

  git(args, rest) {
    const sub = args[0] ?? '';
    if (sub === 'status') {
      this.lines([
        'On branch main',
        'Your branch is 4000 commits behind marcel/main.',
        '',
        'Changes not staged for commit:',
        '  modified:   your_life.cs',
        '',
        'Untracked files:',
        '  panic.log',
      ]);
      return;
    }
    if (sub === 'log') {
      this.lines([
        'commit 4000deadbeef (HEAD -> main, marcel/main)',
        '    Deploy Marcel to production. Nobody reviewed this.',
        'commit c0ffee000001',
        '    "temporary" fix — 11 years ago',
      ], 'dim');
      return;
    }
    if (sub === 'push') {
      this.print('Everything up-to-date. Everything out of the way.', 'ok');
      this.api.grant('GIT_PUSH', 8);
      this.secret('push');
      return;
    }
    if (sub === 'checkout' || sub === 'switch') {
      if (rest.includes('marcel-fix') || rest.includes('feature/')) {
        this.print("Switched to branch 'feature/marcel-fix'.", 'ok');
        this.print('Somebody tried to fix him. They left this behind:', 'dim');
        this.print('+2500 velocity, and a try/catch.', 'ok');
        this.api.addPoints(2500);
        this.api.grant('EXCEPTION_HANDLER', 0);
        this.secret('branch');
      } else {
        this.print(`error: pathspec '${rest.replace(/^\w+\s*/, '')}' did not match any branch`, 'err');
        this.print('hint: there is a branch nobody merged. feature/something.', 'dim');
      }
      return;
    }
    if (sub === 'reset') {
      if (rest.includes('--hard')) {
        this.print('HEAD is now at 0000000. So is your score.', 'err');
        this.api.resetScore();
        this.secret('reset');
      } else {
        this.print('Unstaged changes after reset: everything.', 'dim');
      }
      return;
    }
    if (sub === 'blame') {
      this.print('4000dead (Marcel  11 years ago) // TODO: fix properly', 'dim');
      return;
    }
    if (sub === 'revert') {
      this.print('Reverted. Marcel has been pushed back down the line.', 'ok');
      this.api.fallBack(14);
      return;
    }
    this.print(`git: '${sub || ''}' is not a git command. See 'git --help'.`, 'err');
  }

  /** Track which easter eggs the player has found, for the retrospective. */
  secret(id) {
    if (this.discovered.has(id)) return;
    this.discovered.add(id);
    this.api.onSecret?.(id, this.discovered.size);
  }

  reset() {
    this.sudoAttempts = 0;
    this.inVim = false;
    this.buffer = '';
    this.render();
  }
}
