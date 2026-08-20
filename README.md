<p align="center">
  <img src="public/marcel.png" width="130" alt="Marcel" />
</p>

<h1 align="center">MARCEL&nbsp;EXPRESS</h1>

<p align="center">
  <i>Marcel taught IT for eleven years. He is now a locomotive.<br/>
  He does not discuss how, and he does not consider it worth discussing.</i>
</p>

---

A quiet three-track endless runner along a freight line. Standing wagons, a
bright overcast sky with a photograph hanging in it, wind on the embankment,
the occasional station announcement about a service that will never arrive —
and eighty tonnes of former teacher on the rails behind you, closing in one
metre at a time.

The joke is that nobody involved finds any of this strange.

---

## Quick start

```bash
npm install
npm run dev
```

```
Production build:   npm run build      npm run preview
Balance check:      npm run sim        (headless, prints the framing maths too)
Placeholder Marcel: npm run gen:enemy
```

---

## Controls

| Input | |
| --- | --- |
| `←` `→` / `A` `D` / swipe | change track — `A` goes left on screen, `D` right |
| `↑` / `Space` / swipe up / tap | jump — clears low obstacles, gets you onto a wagon roof |
| `↓` / `S` / swipe down | roll — the only way under a gantry; in mid-air it drops you fast |
| `Esc` | stop |
| `^` or `` ` `` | there is a terminal. Try `help`. |

---

## Marcel

He is one number — a gap in metres — and that number **is** where he is drawn.
Nothing is faked in the interface:

```
gap 56 m ──▶ 11 m of empty rail behind you, locomotive small on the horizon
gap 30 m ──▶  8 m of rail, clearly a locomotive, clearly gaining
gap 16 m ──▶  7 m, the camera tightens and the lens closes in
gap  9 m ──▶  6 m, heartbeat, lamps on your back
gap  0 m ──▶  he is where you are
```

He also **steers onto your track**, a beat after you switch — which is the
thing that actually makes it feel like being followed rather than being
scored.

**The camera is doing real work.** Two framings blend by how close he is: wide
and unhurried on a long lens when he is far, tight and short-lensed when he is
not — 54° down to 38°. The *lens* is what makes his approach read, because a
rear chase camera cannot do it with distance alone: him nearing the runner
means the camera backing off him.

Height is held **constant**, and it does two jobs at once — it keeps his
roofline *below* the runner's feet on screen so he never covers you, and it
sets the line every overhead structure has to clear so the catenary stays in
the sky instead of sweeping across the track.

```
gap | rail behind you | lens | marcel on screen | runner | clear of runner
 56 |          11.0 m |  54° |            12.4% |   8.8% |           11.3°
 30 |           8.5 m |  47° |            16.4% |  11.4% |            7.5°
 12 |           6.8 m |  41° |            22.9% |  13.8% |            4.3°
  3 |           5.9 m |  39° |            28.2% |  15.3% |            2.5°
```

`npm run sim` prints that table for nine chase distances and fails loudly if
any of it breaks.

### His headlights

Two warm pools thrown forward onto the ballast between him and you, with his
face projected into them. Painted onto the ground rather than cast — a real
spotlight needs shadow maps to show up on flat ground and would cost more than
the effect is worth; at this angle you cannot tell.

The projection is a **baked gobo**, not the photograph. Dropping `marcel.png`
straight into an additive beam barely showed up: additive blending adds
luminance, and a photograph is mostly mid-tones, so most of it contributed
nothing. `goboTexture()` contrast-stretches the image across its own full
luminance range, recolours it to lamp-warm, and carries the brightness in the
**alpha** so additive blending has something to add. The soft round falloff is
baked in as well, so it fades into the pool instead of ending at a rectangle.

The pools are the *permanent* "he is back there" cue, and they are brightest
when he is furthest away — exactly when the locomotive itself has not resolved
out of the haze yet. As he closes they give way and you look at the machine.

### He glances back

Every half minute or so the panel on his roof swings through 180° to look
straight at the camera, holds for about a second, and turns back down the
line. That is the only time `marcel.png` is legible on the machine itself, and
it is meant to be caught out of the corner of an eye. No sound, no message.

The panel is on the **roof** rather than the nose for a geometric reason: the
camera is behind both of you, so his nose points away, and his rear end drops
below the bottom of the frame when he is close. The roof is the only part of
him in shot at every chase distance.

And he does not tire. Past ~3600 m his creep exceeds your natural breathing
room and the gap starts closing on its own. The line never gets more crowded;
he just gets closer. That is where the calm turns.

### His machines

Only one exists at a time, and later ones replace earlier ones. They should
feel rare, so they are.

| From | |
| --- | --- |
| 0 m | **Marcel** — the modern box |
| 1500 m | **Marcel (1954)** — boiler, chimney, coupling rods, oil-coloured lamps |
| 3000 m | **Marcel — Freight** — heavier, and he will not say where the train went |
| 5000 m | **Marcel v2.0** — red, larger, deployed by somebody, reviewed by nobody |

He hauls nothing. At these camera distances his own consist would be behind
the lens; the freight standing on the line does that job instead.

---

## What is on the line

Roughly half of everything is **standing freight**: wagons coupled nose to
tail down one track. Go round it, or jump up and run the roofs — they are
different heights, so crossing a consist takes more than one jump, and there
are story points up there to make it worth the trouble. A locomotive at the
head cannot be climbed, so the roof run always has to end somewhere.

```
container flat · tank wagon · open wagon · covered wagon
flat wagon · hopper · wooden van (1954) · shunting locomotive
```

Every wagon is stencilled with something. That is where most of the IT humour
lives now — you read it at thirty metres a second and it is gone:

```
LEGACY — DO NOT OPEN        503 SERVICE UNAVAILABLE      node_modules
TECHNICAL DEBT — NET 40 t   BACKUPS — UNTESTED           DEPRECATED 2011
UNIT TESTS — EMPTY          STAGING — IDENTICAL TO PROD  TEMP — SINCE 2014
```

### Riding the roofs buys distance

Up on the freight the gap opens at **3.4 m/s instead of 1.0**. It is the only
thing you can actively *do* about the chase, so it has to be worth the
exposure — and it is what makes the differing roof heights matter, because
crossing a consist means jumping between them with a locomotive waiting at the
head.

Measured with the bot in `scripts/simulate.mjs`, which has two styles:

```
                 distance   survived   mounts
cautious play      7.7 km      224 s        0
greedy play       10.6 km      298 s       39
```

Most of that is paid as a **lump the moment you land** — five metres, with a
sound of its own — rather than as a rate. A consist takes under a second to
cross at speed, so the rate alone yielded about two metres per roof run: four
percent of the gauge, which is below the threshold at which anybody notices
anything. The rate is still there for long consists; the lump is what you feel.

That difference is the whole point. Before the roofs paid, every run ended
within six seconds of every other one however well the bot played — a
countdown with scenery. Now how you play decides how far you get.

Nobody is told about it. The first time you stay up there, Marcel complains:
*"Please do not stand on the freight."* A complaint teaches it better than an
instruction, and he already had the line.

### Near misses, and momentum

Squeezing past something pays a little — a few metres off Marcel and some
points. Clearance is measured on whichever axis you actually beat it on:
sideways if you changed track late, vertically if you jumped a barrier or
rolled under a gantry.

Both that and getting up onto the freight feed **momentum**, which multiplies
your score up to x5 and **empties completely when you hit something**. It
decays at 3 a second, so it is not a lifetime total you ratchet up — it is how
aggressively you are playing *right now*. Run the empty track all day and you
will finish on x1.

The multiplier is only on screen while a streak is actually running.

```
                 distance     score   avg multiplier   mounts
cautious play      7.7 km     14.4k        x1.0           0
greedy play        8.8 km   20–37k     x1.65–3.33      22–35
```

```bash
npm run sim -- --style=greedy
```

Between the freight, five trackside shapes, each asking for exactly one verb:

| | | |
| --- | --- | --- |
| low | `BUFFER STOP` · `SLEEPERS` | jump |
| tall | `SIGNAL AT DANGER` · `TECHNICAL DEBT` · `RELAY CABINET` | change track |
| overhead | `CLEARANCE 1.0 m` · `OVERHEAD LINE` | roll |

Plus two things that are not obstacles: a **code smell** parked in the safe
lane (costs velocity, hands Marcel four metres, never kills you) and a **bug**
drifting across the tracks, which is the one thing you are supposed to hit.

Every 1–2 km there is a **level crossing**, and a very long freight sweeping
across it ahead of you. It always clears in time. It is there to be looked at.

### Trains you can run, and trains you cannot

Two kinds of rake, and they feel nothing alike.

**Mixed stock** puts every roof at a different height, so crossing it is a
series of jumps — the shunted-together freight nobody has sorted.

**A uniform rake** is one wagon type end to end: a single flat surface six to
eleven wagons long. One jump on, then just run, with story points the whole
way. About two freight set-ups in five.

**A train coming the other way** takes one track and closes at its own speed on
top of yours — around 56 m/s, roughly twice as fast as anything else arrives.
It cannot be climbed or ducked. The only answer is to not be there.

It is also the one thing in the game with a real warning, because it has to be:

- the **horn** sounds the moment it enters the line
- its **lamps are drawn with fog disabled**, so you can see which track it is on
  long before the fog gives up the train itself
- it only takes a track that is clear for the whole approach, so it never
  appears behind freight you cannot get past
- nothing else spawns while it is inbound — you are solving one problem

**Being hit by one ends the run.** No stumble, no lost metres — it ignores the
try/catch shield and the boost as well, because the one thing on the line that
is always fatal has to be predictable or the warning means nothing.

It passes you, too. Everything else is retired by its centre point, which
deleted a seventy-metre train while its back half was still on screen in front
of the camera; long stock is now retired on its **tail**.

### The line gets denser, not just the locomotive

Difficulty used to come only from Marcel closing in — a timer you watch rather
than something you play against. The track asked no more of you at 8 km than it
did at 1 km. Now the set-ups tighten as you go:

```
    0 m   a set-up every 1.44 s
 2000 m                  1.08 s
 4000 m                  0.86 s
 8000 m                  0.62 s
```

That also fixed the real problem behind "it is boring", which turned out to be
measurable rather than a matter of taste:

```
                 dead air   actions/min   crashes
before              47.8%          14.7       0-1
after              8 – 13%        28 – 30       5-6
```

**Dead air** is the share of the run with nothing inside reaction distance —
half the game was holding forward down an empty line, one input every four
seconds. Comparable runners sit at 40–60 actions a minute.

Marcel's creep was pushed out from 3600 m to 5200 m in exchange, so the
pressure now comes from the line instead of from a clock.

---

## Three power-ups

That is the whole list.

| | |
| --- | --- |
| `try / catch` | swallows exactly one mistake, quietly |
| `git push` | the line clears itself for a few seconds |
| `PRIMARY KEY` | every story point in range joins to you |
| `steel toecaps` | jump 4.98 m instead of 1.54 — over anything, including a train coming the other way |
| `deploy --airborne` | the jetpack |

### The jetpack

Straight up to 9.6 m — over the contact wires at 8.6 and the gantry boom at
9.2 — cruise for seven seconds, then back down. Nothing on the line can touch
you up there, and a line of story points is laid out ahead of you, waving
gently across the three tracks.

Measured over a full flight: fly straight and you collect **29%** of the line;
follow it across the tracks and you collect **100%**. So it is still steering
rather than a cutscene.

The pose does the work, and it is three attitudes rather than one:

```
 0.00 s   climb     y 0.15    pitch −31°   leaning back into the thrust
 1.05 s   cruise    y 9.60    pitch +50°   belly down, arms swept past the hips
 8.57 s   descend   y 9.63                 pulling upright again
 9.95 s   landed    y 0.00    pitch  −7°   feet back on the ballast
```

Fifty degrees, not flat — enough to read as flying rather than as falling
forwards. The thrust runs longest on the climb, eases at cruise, and drops to
a trickle on the way down.

---

## Six events

Roughly one every eighty seconds. Each is a single line and a real change; none
of them takes over the screen.

```
504 Gateway Timeout       he loses the connection
GC.Collect()              the line ahead is swept
Cache hit                 somebody left story points on the line
500 Internal Server Error he apologises for the picture
Marcel requested changes  there is more on the line now
git revert HEAD           he is closer than he was
```

Underneath them, the **station tannoy** runs on its own clock and does nothing
at all:

> *The next service to Production is delayed. Indefinitely.*
> *Track 3 is currently a database.*
> *A replacement bus service has been proposed and rejected.*

---

## The picture in the sky

There is a photograph hanging in the sky, faded into the cloud. It is not a
joke you are told about; it is just up there.

```js
SKY_IMAGE_PATH: '/glow-card.webp',   // point this at anything in /public
SKY_IMAGE_OPACITY: 0.42,
```

Drop a file in `public/` and change that one line to swap it. If the file is
missing the sky is simply empty — nothing breaks.

It is sized by measurement rather than by eye: in the wide framing the camera
pitches down far enough that the visible band of sky is only about **14°**
tall, between the horizon and the top of the frame. The picture fills most of
that band (13% × 25% of the screen), and the soft radial fade lets it graze
the haze at the bottom and the frame at the top without either reading as a
cut. It hangs on the sky rig, so it rides with the camera and never drifts.

---

## Four stretches of line

The scenery repaints every 900 m. The name arrives on a board at the lineside,
not in the corner of the screen.

`DEPOT` · `MAIN LINE` · `THE ARCHIVE` · `PRODUCTION`

---

## The interface

Score, Marcel's distance, and whatever power-up you are holding. Nothing else.
When somebody speaks — Marcel, the tannoy, an event — one line appears at the
bottom and then goes away.

---

## Easter eggs

Press `^` for a terminal. The run suspends; Marcel is blocked on I/O. Most of
it is decoration, some of it genuinely changes the run (`git push`, the third
`sudo` attempt, a branch nobody merged), one of it is a trap (`git reset
--hard`), and `vim` is exactly what you expect.

Words you can type while running: `commit`, `coffee`, `sudo`, `null`,
`ludmilla`. Once each, per run. The Konami code turns on the debug overlay.

---

## Project structure

```
/index.html · /vercel.json
/public/marcel.png · marcelHard.png · glow-card.webp
/src
  main.js                  entry, loop, collision, and the chase camera
  config.js                every tunable number
  data/lines.js            all copy: wagon lettering, Marcel, tannoy, signage
  world/
    TrackManager.js        recycled track segments, sky, sun, zone boards
    Spawner.js             consists, trackside obstacles, level crossings
    textures.js            ballast, rails, wagon panelling, stencils, signs
  entities/
    Runner.js              tracks, jump, roll, procedural run cycle
    Marcel.js              the locomotive: gap model, variants, lane steering
    Freight.js             wagons, parked locomotives, the crossing freight
    Obstacles.js           the five trackside shapes
    Pickups.js             story points, the legendary card, three chips
  systems/
    InputManager.js  AudioManager.js  PowerUps.js  EventSystem.js  EasterEggs.js
  ui/
    HUD.js  MenuScreens.js  Terminal.js
  style.css
/scripts
  simulate.mjs             headless run + framing proof
```

Flow: `MENU → RUNNING ↔ STOPPED / TERMINAL → CAUGHT → RETROSPECTIVE`

---

## Sound

No audio files. Wind across the cutting, a low rail hum, and rail joints that
clack faster as you do. Marcel's diesel sits under all of it and rises only
when he is close, so most of the time you hear him without looking — and
occasionally you notice he has got loud.

---

## Deploying to Vercel

`vercel.json` is set up already (Vite preset, `dist` output, immutable caching
on hashed assets).

```bash
npx vercel --prod
```

Or push to GitHub and import at [vercel.com/new](https://vercel.com/new) — no
settings to change. It is a static bundle; no server, no environment
variables.

---

## Performance

The game is **draw-call bound, not fill-rate bound** — measured, not assumed.
Twenty-nine thousand triangles is nothing; twelve hundred draw calls is not.

A wagon modelled honestly is about twenty meshes (underframe, two bogies,
eight wheels, four buffers, body, roof, lettering), and with forty-odd wagons
standing on the line that was most of the frame on its own. So everything
static is baked down with `mergeGeometries` and cached by shape:

| | before | after |
| --- | --- | --- |
| draw calls (4 consists + a crossing freight) | 1233 | **306** |
| objects in the scene | 1418 | **465** |
| materials the renderer juggles | 195 | **95** |
| frame time, measured back to back | ~21 ms | **~5 ms** |

- a **freight wagon** is 3 meshes instead of ~20 — merged steelwork, merged
  body, and both flanks' lettering in one geometry
- a **track segment** is 4 instead of 14 — the three permanent ways merge, the
  two retaining walls merge, the whole catenary bay merges
- **Marcel's** hull, nose, cab and boiler are one mesh; each wheel carries its
  crank pin in the same geometry
- **materials are shared per zone**, not per segment: recycling a segment is
  now a pointer assignment instead of four forced shader re-derives, which at
  speed was happening several times a second
- pixel ratio is capped at 1 and MSAA is **off** by default. Both barely moved
  the needle here precisely because the bottleneck is on the CPU — turn
  `ANTIALIAS` back on in `src/config.js` if you have a real graphics card

Frame timings drift on a shared machine; the draw-call and object counts are
the deterministic figures. `npm run sim` reports the scene cost after a run.

---

## Tuning

Everything is in `src/config.js`. After changing anything:

```bash
npm run sim
```

It runs several minutes of headless play against the real systems, then prints
distance, crashes, which of Marcel's machines appeared, and the camera framing
at nine chase distances — including whether he stayed in frame and stayed
clear of the runner.

---

<p align="center"><sup>MARCEL EXPRESS — Three.js + Vite.</sup></p>
