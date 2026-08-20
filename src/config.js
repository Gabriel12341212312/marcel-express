/**
 * MARCEL EXPRESS — central tunable constants.
 *
 * World model: the runner stays at z = 0 and the line scrolls toward -z.
 * Anything ahead has z > 0, Marcel sits at z < 0. Float precision stays
 * perfect no matter how long the run lasts.
 */
export const CONFIG = {
  /* ---------------------------- assets ---------------------------- */
  MARCEL_TEXTURE_PATH: '/marcel.png',
  MARCEL_HARD_TEXTURE_PATH: '/marcelHard.png',
  GLOW_CARD_TEXTURE_PATH: '/glow-card.webp',

  // A picture hanging in the sky, moderately faded into the cloud.
  // Point this anywhere in /public. If the file is missing the sky simply
  // stays empty — nothing breaks.
  SKY_IMAGE_PATH: '/glow-card.webp',
  SKY_IMAGE_OPACITY: 0.42,   // how far it fades into the sky
  // Sized and hung by measurement, not by eye: in the wide framing the camera
  // pitches down far enough that the visible band of sky is only about 14
  // degrees tall, between the horizon and the top of the frame. This fills
  // most of that band, and the soft edges let it graze the haze at the bottom
  // and the frame at the top without either showing as a cut.
  SKY_IMAGE_SIZE: 62,        // metres across, at SKY_IMAGE_DISTANCE
  SKY_IMAGE_DISTANCE: 250,
  SKY_IMAGE_HEIGHT: 34,      // above the camera

  /* ---------------------------- track ---------------------------- */
  // Ordered LEFT-TO-RIGHT AS SEEN ON SCREEN, which is the opposite of world
  // +x: the camera looks down +z, so its right-hand vector is world -x.
  // Lane 0 must therefore be the largest x. Everything downstream works in
  // lane indices, so this one line is what makes A/D, swipes and Marcel's
  // lane steering all agree with the picture.
  LANE_X: [2.75, 0, -2.75],
  LANE_SWITCH_SPEED: 13,
  SEGMENT_LENGTH: 16,
  SEGMENTS_AHEAD: 12,   // 192 m; fog closes at 190, so the far edge is unseen
  SEGMENTS_BEHIND: 3,        // the camera sits well back — keep line behind us
  CUT_HALF_WIDTH: 9.0,       // distance to the embankment walls
  CUT_HEIGHT: 7.0,

  /* ---------------------------- runner ---------------------------- */
  START_SPEED: 16,
  MAX_SPEED: 40,             // calmer top end than an arcade runner
  SPEED_RAMP: 0.22,
  JUMP_VELOCITY: 9.6,
  GRAVITY: 30,
  ROLL_DURATION: 0.62,
  PLAYER_RADIUS: 0.46,
  PLAYER_HEIGHT: 1.75,
  ROLL_HEIGHT: 0.85,
  STUMBLE_DURATION: 0.75,
  STUMBLE_SPEED_MULT: 0.42,

  /* ---------------------------- Marcel: the chase ---------------------------- */
  // Internally he is a gap in metres. That gap drives where he is DRAWN, so
  // the number and the picture never disagree.
  MARCEL_START_GAP: 46,
  MARCEL_MAX_GAP: 56,
  MARCEL_GAP_REGEN: 1.0,     // metres of breathing room earned per second

  // Running the wagon roofs BUYS distance, and this is the number that makes
  // the game a game. Without it the gap only ever moves on its own schedule
  // and the player can lose ground but never take it — a chase you cannot
  // fight back in is a countdown with scenery. Up here you are exposed, the
  // roofs are at different heights, and a locomotive at the head of the
  // consist ends the run of them; that is what you are being paid for.
  MARCEL_ROOF_REGEN: 3.4,

  // A consist takes under a second to cross, so the RATE alone yields about
  // two metres per roof run — four percent of the gauge, which nobody can
  // see. The felt reward has to be a lump paid the moment you land.
  MARCEL_MOUNT_BONUS: 5.0,

  // Squeezing past something pays a little. Deliberately small: it should
  // make the empty lane feel like the coward's line, not become a farm.
  NEAR_MISS_MARGIN: 0.55,   // metres of clearance that still counts as close
  NEAR_MISS_GAP: 1.5,       // metres bought off Marcel
  NEAR_MISS_POINTS: 15,

  // Momentum: risk builds it, a crash empties it. It multiplies the score,
  // which is what stops the safe lane from being the optimal lane.
  // It DECAYS, which is the whole point: without that it is a ratchet that
  // even cautious play walks up to the cap, and then it separates nobody.
  // With decay it reads as how aggressively you are playing right now.
  MOMENTUM_PER_NEAR_MISS: 7,
  // A consist takes barely a second to cross at speed, so the reward is for
  // GETTING UP THERE, with a smaller rate for staying. A per-second rate
  // alone paid almost nothing for a whole roof run.
  MOMENTUM_PER_MOUNT: 14,
  MOMENTUM_PER_ROOF_SECOND: 8,
  MOMENTUM_DECAY: 3.0,       // per second
  MOMENTUM_PER_STEP: 14,     // momentum needed per extra multiplier level
  MOMENTUM_MAX_MULT: 5,
  MARCEL_CRASH_PENALTY: 11,
  // He is a train: he does not tire, and you do. Past MARCEL_CREEP_AT metres
  // his creep exceeds your natural regen and the gap starts closing on its
  // own. This is what turns a calm run into a tense one without ever making
  // the line itself more crowded.
  MARCEL_CREEP_AT: 3600,
  MARCEL_CREEP_MAX: 2.4,
  MARCEL_SMELL_PENALTY: 4,

  // Visual mapping. The camera cannot literally sit 56 m behind the runner
  // without making the runner a speck, so the gap is compressed into a band
  // the camera can hold — but it is a real, continuous, monotonic mapping:
  // more gap always means visibly further back down the line.
  MARCEL_Z_NEAR: -5.6,       // drawn position at gap 0 (on top of you)
  MARCEL_Z_FAR: -11.0,       // drawn position at max gap (well down the line)
  MARCEL_SCALE_NEAR: 1.05,
  MARCEL_SCALE_FAR: 0.94,
  MARCEL_LANE_STEER: 1.5,    // how fast he swings onto your lane (units/s)

  // Headlights. Two warm pools thrown forward onto the ballast between him
  // and you — at long range they are how you find him before you can make
  // out the locomotive itself.
  MARCEL_BEAM_LENGTH: 17,
  MARCEL_BEAM_WIDTH: 2.6,
  MARCEL_BEAM_OPACITY: 0.42,
  MARCEL_GOBO_OPACITY: 0.95,  // his face, projected into the pool
  // He glances back to check you are still there. Rarely, and briefly.
  MARCEL_LOOKBACK_MIN: 26,
  MARCEL_LOOKBACK_MAX: 58,
  MARCEL_LOOKBACK_HOLD: 1.2,
  MARCEL_LUNGE_GAP: 5,       // below this he surges at you
  MARCEL_TENSE_GAP: 16,      // below this the music, camera and lights change
  MARCEL_BREATH_GAP: 9,      // below this the heartbeat starts

  /* ---------------------------- hard mode ---------------------------- */
  HARD_START_GAP: 32,
  HARD_GAP_REGEN: 0.72,
  HARD_CRASH_PENALTY: 14,
  HARD_SPEED_RAMP: 0.30,
  HARD_SPAWN_MULT: 1.22,

  /* ---------------------------- camera ---------------------------- */
  // Two framings, blended by how close Marcel is:
  //   calm  — wide, low, a long quiet view down the line with the locomotive
  //           small behind you
  //   tense — tight and high, the runner large, the locomotive filling the
  //           bottom of the frame
  // The camera height is not cosmetic: it is what keeps Marcel's roofline
  // BELOW the runner's feet on screen, so he never covers the player.
  CAM_BACK_CALM: 18.5,
  CAM_BACK_TENSE: 13.0,
  CAM_HEIGHT_CALM: 7.8,
  // Held CONSTANT on purpose. It is the number that keeps his roofline below
  // the runner's feet on screen, and it is also the line every piece of
  // overhead scenery has to clear so it stays in the sky instead of across
  // the track. A camera that changes height would break both promises.
  CAM_HEIGHT_TENSE: 7.8,
  CAM_LOOK_AHEAD_CALM: 9,
  CAM_LOOK_AHEAD_TENSE: 3,
  CAM_LOOK_HEIGHT_CALM: 1.0,
  CAM_LOOK_HEIGHT_TENSE: 0.2,
  CAM_EASE: 2.2,             // how slowly the framing changes (low = cinematic)
  // The frame closes in as he does: a narrower lens when he is on top of you
  // both grows him on screen and tightens the shot. This is what makes the
  // approach read as an approach — a rear chase camera cannot do it with
  // distance alone, because closing on the runner means backing off the lens.
  FOV_CALM: 54,
  FOV_TENSE: 38,
  FOV: 54,          // menu / initial camera; play blends FOV_TENSE..FOV_CALM
  FOG_NEAR: 40,
  FOG_FAR: 190,

  /* ---------------------------- spawning ---------------------------- */
  SPAWN_START_METERS: 120,
  PATTERN_GAP_MIN: 34,       // metres between set-ups at start speed
  PATTERN_GAP_MAX: 62,
  PATTERN_GAP_FLOOR: 20,
  FREIGHT_SHARE: 0.45,       // share of set-ups that are standing freight
  POWERUP_CHANCE: 0.09,
  GLOW_CARD_CHANCE: 0.04,
  GLOW_CARD_HALO: 4.0,
  GLOW_CARD_PULSE: 1.6,
  BUG_CHANCE: 0.05,

  /* ---------------------------- freight ---------------------------- */
  FREIGHT_MIN_WAGONS: 3,
  FREIGHT_MAX_WAGONS: 9,
  FREIGHT_LOCO_CHANCE: 0.45, // consists that are headed by a locomotive
  CROSSING_MIN_METERS: 1200, // metres between level-crossing set pieces
  CROSSING_MAX_METERS: 2200,

  /* ---------------------------- power-ups ---------------------------- */
  DURATION_GIT_PUSH: 6.5,
  DURATION_MAGNET: 12,
  GIT_PUSH_SPEED_MULT: 1.35,
  MAGNET_RADIUS: 7.5,

  /* ---------------------------- scoring ---------------------------- */
  POINTS_PER_METER: 1,
  STORY_POINT_VALUE: 10,
  GLOW_CARD_POINTS: 150,
  BUG_BOUNTY: 80,
  CODE_SMELL_PENALTY: 40,

  /* ---------------------------- events & pacing ---------------------------- */
  EVENT_FIRST_MIN: 55,
  EVENT_FIRST_MAX: 85,
  EVENT_INTERVAL_MIN: 60,
  EVENT_INTERVAL_MAX: 100,
  ANNOUNCE_INTERVAL_MIN: 38,  // station tannoy — atmosphere only
  ANNOUNCE_INTERVAL_MAX: 70,
  LINE_INTERVAL_CALM_MIN: 18, // how often Marcel says something, unhurried
  LINE_INTERVAL_CALM_MAX: 34,
  LINE_INTERVAL_NEAR_MIN: 7,
  LINE_INTERVAL_NEAR_MAX: 13,

  /* ---------------------------- Marcel's variants ---------------------------- */
  // Rare, and they should feel like it. Metres at which each becomes his form.
  VARIANT_AT: {
    OLD: 1500,      // the 1954 machine, wooden cab, oil lamps
    FREIGHT: 3000,  // hauling a consist he refuses to discuss
    V2: 5000,       // marcel v2.0 — deployed, red, humming
  },

  /* ---------------------------- zones ---------------------------- */
  ZONE_LENGTH: 900,

  /* ---------------------------- rendering ---------------------------- */
  // Measured, not guessed: the game is CPU/draw-call bound, so the pixel
  // ratio barely moves the needle while MSAA costs about 40% of the frame.
  // Turn ANTIALIAS back on if you are running this on something with a real
  // graphics card.
  MAX_PIXEL_RATIO: 1,
  ANTIALIAS: false,
};

/** Lane index -> world x. */
export const laneX = (i) => CONFIG.LANE_X[Math.max(0, Math.min(CONFIG.LANE_X.length - 1, i))];

/** 0 (Marcel on top of you) .. 1 (as far away as he gets). */
export function safety(gap) {
  return Math.max(0, Math.min(1, gap / CONFIG.MARCEL_MAX_GAP));
}
