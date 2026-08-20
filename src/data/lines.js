/**
 * MARCEL EXPRESS — all copy in one place.
 *
 * House style: understated. Marcel is a former IT teacher who is now a
 * locomotive, and he finds this entirely unremarkable. He does not shout, he
 * does not use exclamation marks, and he never explains the joke. The comedy
 * is that nobody involved considers any of this strange.
 *
 * Wherever possible the IT material is printed on the side of a freight wagon
 * rather than announced in the interface.
 */

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ---------------------------- Marcel ---------------------------- */

/** Said at a comfortable distance. Dry, unhurried, mildly disappointed. */
export const CALM_LINES = [
  'Works on my machine.',
  'We covered this already.',
  'That will be on the exam.',
  'It compiles. That is something.',
  'I am not chasing you. We are on the same track.',
  'I built this locomotive in one evening. In C#.',
  'The train is not late. The schedule was optimistic.',
  'Please do not stand on the freight.',
  'I used to teach. Now I haul.',
  'There is no ticket for this.',
  'Somebody left a wagon on the line. It was me.',
  'This service continues to Production.',
  'Read the stack trace. It is right there.',
  'I have notes.',
  'Naming is hard. Yours is harder.',
  'Do not deploy on a Friday. I did.',
  'The documentation exists. Nobody has opened it.',
  'I was a teacher for eleven years. Then this.',
];

/** Said when he is close enough to be a problem. Still dry. */
export const NEAR_LINES = [
  'You should have committed.',
  'That was probably not the correct branch.',
  'I noticed your merge conflict.',
  'You are running. That is not a solution.',
  'I have reviewed your code. I have notes.',
  'This is still in the backlog.',
  'Your pull request is open. It will stay open.',
  'I am the definition of done.',
  'Estimated: three points.',
  'We are approaching Production.',
];

/** Said the moment he reaches you. One line, no fanfare. */
export const CAUGHT_LINES = [
  'Build failed.',
  'Merged. Without review.',
  'That was a null reference.',
  'Terminating. Exit code 1.',
  'This service has been discontinued.',
  'You have reached the end of the line.',
  'Ticket closed. Wontfix.',
  'Estimated: three points. Actual: this.',
];

/** Said when you hit something. He is not angry, he is curious. */
export const CRASH_LINES = [
  'Interesting approach.',
  'Noted.',
  'That was in the documentation.',
  'I would not have done that.',
  'Reproducible, at least.',
  'We will discuss this in the retrospective.',
  'Hm.',
];

/* ---------------------------- station announcements ---------------------------- */

/**
 * Distant, half-audible tannoy. Pure atmosphere — no mechanical effect. This
 * is where most of the absurdity lives, because it arrives calmly and then
 * simply stops mattering.
 */
export const ANNOUNCEMENTS = [
  'The next service to Production is delayed. Indefinitely.',
  'Please mind the gap between the estimate and the release.',
  'Passengers are reminded not to deploy on Fridays.',
  'The buffet car is a build server. Please do not restart it.',
  'This train does not stop. It has never stopped.',
  'Lost property: one merge conflict, unclaimed since sprint 41.',
  'Will the owner of the red locomotive please report to the sprint review.',
  'The 09:14 to Staging is identical to the 09:14 to Production.',
  'A replacement bus service has been proposed and rejected.',
  'This line was migrated in 2011. The migration is ongoing.',
  'Track 3 is currently a database.',
  'The signal is green. Nobody knows who set it.',
];

/** Flavour on the rare legendary card. */
export const LEGENDARY_LINES = [
  'The requirements document that was correct',
  'A green build on the first try',
  'The legacy system nobody dares to touch',
  'Root access to the coffee machine',
  'A migration that finished',
];

/* ---------------------------- rolling stock ---------------------------- */

/**
 * Stencilled on the side of freight. Half of the game's IT humour is here,
 * where you read it in passing at 30 m/s and it is gone.
 */
export const WAGON_LABELS = [
  'LEGACY — DO NOT OPEN',
  'PROD DATA — HANDLE CAREFULLY',
  '503 SERVICE UNAVAILABLE',
  'TECHNICAL DEBT — NET 40 t',
  'node_modules',
  'DEPRECATED 2011',
  'UNIT TESTS — EMPTY',
  'BACKUPS — UNTESTED',
  'MERGE CONFLICTS',
  'STAGING — IDENTICAL TO PROD',
  'TICKETS — UNREFINED',
  'NULL',
  'TEMP — SINCE 2014',
  'COFFEE',
  'HOTFIX — FRAGILE',
  'ROLLBACK MATERIAL',
  'SPRINT 4000 — SPARE PARTS',
  'DO NOT MERGE',
  'READ ONLY',
  'PRIMARY KEYS — 12 000 pcs',
];

/** Painted on the nose of whatever locomotive is parked in your way. */
export const LOCO_LABELS = [
  'BR 143 — SHUNTING',
  'MARCEL VI',
  'OUT OF SERVICE',
  'DIESEL — NO SCHEDULE',
  'CLASS 232 "LUDMILLA"',
  'DEPOT ONLY',
];

/* ---------------------------- obstacles ---------------------------- */

/**
 * Small trackside obstacles. Deliberately few: the freight does the heavy
 * lifting, these just vary the verb.
 *
 *   action 'jump'  — low, hop it
 *   action 'dodge' — tall, change lane
 *   action 'roll'  — overhead, duck under
 */
export const OBSTACLES = {
  BUFFER: {
    id: 'BUFFER', action: 'jump', family: 'buffer', color: 0xd04a3a,
    label: 'BUFFER STOP', crash: 'End of line. For that lane.',
  },
  SLEEPERS: {
    id: 'SLEEPERS', action: 'jump', family: 'buffer', color: 0x8a6a3a,
    label: 'SLEEPERS', crash: 'Those were stacked there for a reason.',
  },
  SIGNAL: {
    id: 'SIGNAL', action: 'dodge', family: 'signal', color: 0xd04a3a,
    label: 'SIGNAL AT DANGER', crash: 'The signal was red. It usually is.',
  },
  CRATES: {
    id: 'CRATES', action: 'dodge', family: 'crate', color: 0x8a5a20,
    label: 'TECHNICAL DEBT', crash: 'The interest on that is considerable.',
  },
  CABINET: {
    id: 'CABINET', action: 'dodge', family: 'cabinet', color: 0x3a6a8a,
    label: 'RELAY CABINET', crash: 'That cabinet runs the whole line.',
  },
  GANTRY: {
    id: 'GANTRY', action: 'roll', family: 'gantry', color: 0x4a8ab0,
    label: 'CLEARANCE 1.0 m', crash: 'The clearance was clearly posted.',
  },
  CATENARY: {
    id: 'CATENARY', action: 'roll', family: 'gantry', color: 0x9ab0c0,
    label: 'OVERHEAD LINE', crash: 'Overhead line. Also overhead.',
  },
};

/** Green haze parked in the safe lane. Costs points, never kills. */
export const CODE_SMELL = {
  label: 'CODE SMELL',
  crash: 'Something in that lane has not been refactored since 2014.',
};

/** The one thing you are meant to run into. */
export const BUG = {
  label: 'BUG',
  crash: 'Bug found. Marcel considers this cheating.',
};

/* ---------------------------- power-ups ---------------------------- */

/** Three. That is enough. */
export const POWERUPS = {
  EXCEPTION_HANDLER: {
    id: 'EXCEPTION_HANDLER', label: 'try / catch', short: 'CATCH', color: 0x6ad0ff,
    toast: 'try / catch — one mistake will be swallowed quietly.',
  },
  GIT_PUSH: {
    id: 'GIT_PUSH', label: 'git push', short: 'PUSH', color: 0xffa04a,
    toast: 'git push — the line clears itself for a while.',
  },
  SNEAKERS: {
    id: 'SNEAKERS', label: 'steel toecaps', short: 'JUMP', color: 0x9ae06a,
    toast: 'Steel toecaps. You can clear anything on this line now.',
  },
  JETPACK: {
    id: 'JETPACK', label: 'deploy --airborne', short: 'JET', color: 0xff8a4a,
    toast: 'Straight up. Mind the overhead line.',
  },
  PRIMARY_KEY: {
    id: 'PRIMARY_KEY', label: 'PRIMARY KEY', short: 'PK', color: 0xffd54a,
    toast: 'PRIMARY KEY — everything joins to you now.',
  },
};

/* ---------------------------- events ---------------------------- */

/**
 * Six, and they are rare. Each one is a short line and a real mechanical
 * change; none of them takes over the screen.
 */
export const EVENTS = [
  { kind: 'TIMEOUT', weight: 10, minMeters: 300, good: true,
    line: '504 Gateway Timeout. Marcel loses the connection.' },
  { kind: 'GARBAGE_COLLECT', weight: 8, minMeters: 600, good: true,
    line: 'GC.Collect(). The line ahead is swept.' },
  { kind: 'CACHE_HIT', weight: 7, minMeters: 500, good: true,
    line: 'Cache hit. Somebody left story points on the line.' },
  { kind: 'SERVER_500', weight: 8, minMeters: 700, good: false,
    line: '500 Internal Server Error. Marcel apologises for the picture.' },
  { kind: 'CODE_REVIEW', weight: 9, minMeters: 800, good: false,
    line: 'Marcel requested changes. There is more on the line now.' },
  { kind: 'REVERT', weight: 7, minMeters: 1100, good: false,
    line: 'git revert HEAD. Marcel is closer than he was.' },
];

/* ---------------------------- environments ---------------------------- */

/**
 * Four stretches of line, rotating. Muted, but not dim: an overcast day is a
 * bright one, and the quiet comes from the low saturation rather than from a
 * lack of light. The name is announced by a sign at the lineside, not the HUD.
 */
export const ZONES = [
  {
    id: 'DEPOT', name: 'DEPOT', sub: 'localhost — nothing here is real',
    fog: 0x30414d, floor: 0x424c55, wall: 0x4e5860, accent: 0x6a9ab0, light: 0xcfe0ea,
  },
  {
    id: 'MAINLINE', name: 'MAIN LINE', sub: 'origin/main — do not push directly',
    fog: 0x33453b, floor: 0x455046, wall: 0x515d54, accent: 0x7ab88a, light: 0xd8ecdc,
  },
  {
    id: 'ARCHIVE', name: 'THE ARCHIVE', sub: 'last commit: eleven years ago',
    fog: 0x453d2e, floor: 0x544b3e, wall: 0x5e5548, accent: 0xc4a86a, light: 0xf0e4c8,
  },
  {
    id: 'PRODUCTION', name: 'PRODUCTION', sub: 'live — please do not touch anything',
    fog: 0x472f2e, floor: 0x543e3c, wall: 0x5f4744, accent: 0xd07a6a, light: 0xf2ccc0,
  },
];

/** Lineside signs. Quiet, and mostly true. */
export const SIGNS = [
  ['MIND THE GAP', 'between the estimate and the release'],
  ['DO NOT DEPLOY ON FRIDAY', 'this is a notice, not a suggestion'],
  ['SPRINT 4000', 'velocity: unmeasured'],
  ['CODE FREEZE', 'nobody told the locomotive'],
  ['README.md', 'unread'],
  ['ON CALL', 'you'],
  ['CLEARANCE 1.0 m', 'measured optimistically'],
  ['SHUNTING IN PROGRESS', 'since 2014'],
  ['STAFF ONLY', 'there is no staff'],
  ['DEFINITION OF DONE', 'it compiles'],
];

/* ---------------------------- retrospective ---------------------------- */

export const RETRO_GOOD = [
  'You kept moving. That is most of it.',
  'The build was green for a while.',
  'Nothing was escalated to management.',
  'You found bugs before anyone else did.',
];

export const RETRO_BAD = [
  'The requirements were never written down.',
  'The estimate was three points.',
  'The stack trace was right there.',
  'Nobody read the log output.',
];

export const RETRO_WHY = [
  'Marcel has no dependencies. Marcel is the dependency.',
  'Marcel runs in release mode.',
  'Marcel was already warm.',
  'Marcel does not context switch.',
  'Marcel has right of way.',
];
