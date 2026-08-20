/**
 * Procedural canvas textures. The only image files in the project are
 * Marcel's face and the legendary card photo; everything else is painted
 * here at startup.
 *
 * The palette is deliberately muted. This is a railway line on an overcast
 * afternoon, not a neon tunnel — the humour works better against something
 * calm.
 *
 * Every generator is memoised by its arguments, because the spawner asks for
 * the same wagon panelling hundreds of times over a long run.
 */
import * as THREE from 'three';

const cache = new Map();

function memo(key, build) {
  let t = cache.get(key);
  if (!t) { t = build(); cache.set(key, t); }
  return t;
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: c.getContext('2d') };
}

function toTexture(c, { repeatX = 1, repeatY = 1, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = aniso;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

/** Blend two 0xRRGGBB colours. */
export function mix(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (
    (Math.round(ar + (br - ar) * t) << 16)
    | (Math.round(ag + (bg - ag) * t) << 8)
    | Math.round(ab + (bb - ab) * t)
  );
}

/** Deterministic 0..1 from an integer — keeps repainted scenery stable. */
function rnd(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/* ---------------------------- the permanent way ---------------------------- */

/** Ballast: crushed stone between and around the tracks. */
export function ballastTexture(zone) {
  return memo(`ballast:${zone.id}`, () => {
    const { c, g } = canvas(256, 256);
    g.fillStyle = hex(zone.floor);
    g.fillRect(0, 0, 256, 256);
    // individual stones, light on top, dark below — reads as gravel at speed
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = 1 + Math.random() * 2.6;
      const l = Math.random();
      g.fillStyle = hex(mix(zone.floor, l > 0.7 ? 0xffffff : 0x000000, 0.10 + Math.random() * 0.22));
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    // oil and rust staining
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(30,18,10,${0.03 + Math.random() * 0.07})`;
      g.beginPath();
      g.ellipse(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 24, 4 + Math.random() * 12, Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
    return toTexture(c, { repeatX: 4, repeatY: 4 });
  });
}

/**
 * One lane's permanent way, seen from above: two rails on wooden sleepers.
 * Drawn as a strip texture so a lane is a single plane rather than hundreds
 * of sleeper meshes.
 */
export function trackTexture(zone) {
  return memo(`track:${zone.id}`, () => {
    const { c, g } = canvas(128, 128);
    g.clearRect(0, 0, 128, 128);

    // sleepers across the strip, two per tile
    for (const sy of [10, 74]) {
      const shade = 0.5 + rnd(sy) * 0.3;
      g.fillStyle = hex(mix(0x4a3b2a, 0x000000, 1 - shade));
      g.fillRect(2, sy, 124, 22);
      // wood grain
      g.strokeStyle = 'rgba(0,0,0,0.22)';
      g.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const yy = sy + 4 + i * 5;
        g.beginPath();
        g.moveTo(2, yy);
        g.lineTo(126, yy + (rnd(sy + i) - 0.5) * 3);
        g.stroke();
      }
    }

    // the rails themselves — polished tops, dark webs
    for (const rx of [30, 84]) {
      g.fillStyle = '#2a2622';
      g.fillRect(rx - 2, 0, 18, 128);
      g.fillStyle = '#9aa0a4';
      g.fillRect(rx + 2, 0, 9, 128);
      g.fillStyle = '#c8ced2';
      g.fillRect(rx + 4, 0, 4, 128);
      // rust on the web
      g.fillStyle = 'rgba(120,66,30,0.35)';
      g.fillRect(rx - 2, 0, 4, 128);
    }
    return toTexture(c, { repeatX: 1, repeatY: 6 });
  });
}

/** The cutting walls either side of the line: concrete retaining panels. */
export function embankmentTexture(zone) {
  return memo(`bank:${zone.id}`, () => {
    const { c, g } = canvas(256, 256);
    g.fillStyle = hex(zone.wall);
    g.fillRect(0, 0, 256, 256);
    // cast concrete panels
    for (let y = 0; y < 256; y += 64) {
      for (let x = 0; x < 256; x += 85) {
        g.fillStyle = hex(mix(zone.wall, rnd(x + y) > 0.5 ? 0xffffff : 0x000000, 0.04 + rnd(x * y) * 0.06));
        g.fillRect(x + 2, y + 2, 81, 60);
      }
    }
    g.strokeStyle = hex(mix(zone.wall, 0x000000, 0.45));
    g.lineWidth = 2;
    for (let y = 0; y <= 256; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
    for (let x = 0; x <= 256; x += 85) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
    // water staining running down from the top
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * 256;
      g.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.08})`;
      g.fillRect(x, 0, 3 + Math.random() * 10, 60 + Math.random() * 190);
    }
    // moss at the base
    for (let i = 0; i < 140; i++) {
      g.fillStyle = `rgba(60,86,50,${0.05 + Math.random() * 0.16})`;
      g.beginPath();
      g.arc(Math.random() * 256, 200 + Math.random() * 56, 2 + Math.random() * 7, 0, Math.PI * 2);
      g.fill();
    }
    return toTexture(c, { repeatX: 3, repeatY: 1 });
  });
}

/**
 * The sky, painted onto the inside of a dome that rides with the camera.
 *
 * Built row by row rather than as a two-stop CSS gradient, because the shape
 * of the falloff is the whole effect:
 *
 *   - it leaves the zenith lightest and eases down on a smoothstep, so the
 *     fade is gradual instead of a visible ramp;
 *   - it lifts a band of haze just above the horizon, which is what makes a
 *     flat overcast sky read as having depth at all;
 *   - and it settles onto EXACTLY the fog colour at and below the horizon, so
 *     distant track dissolves into the sky with no seam, then keeps fading
 *     gently below rather than cutting to a hard line at the skirt.
 */
export function skyTexture(zone) {
  return memo(`sky:${zone.id}`, () => {
    const W = 64;
    const H = 512;
    const { c, g } = canvas(W, H);

    // an overcast sky is BRIGHT — the ground is what should be muted
    const zenith = mix(zone.fog, 0xffffff, 0.60);
    const haze = mix(zone.fog, 0xffffff, 0.36);
    const horizonRow = H * 0.5;
    const smoothstep = (t) => t * t * (3 - 2 * t);

    for (let y = 0; y < H; y++) {
      let col;
      if (y < horizonRow) {
        const t = y / horizonRow;                    // 0 zenith .. 1 horizon
        const base = mix(zenith, zone.fog, smoothstep(t));
        col = mix(base, haze, t ** 4 * 0.85);        // haze gathers near the horizon
      } else {
        // below the horizon, ease the haze back out over a short skirt
        const t = Math.min(1, (y - horizonRow) / (H * 0.14));
        col = mix(haze, zone.fog, smoothstep(t));
      }
      g.fillStyle = hex(col);
      g.fillRect(0, y, W, 1);
    }

    // a few flat cloud bands, kept to the upper half and barely there
    for (let i = 0; i < 9; i++) {
      const y = 20 + Math.random() * (horizonRow - 90);
      const h = 5 + Math.random() * 22;
      const a = 0.018 + Math.random() * 0.035;
      const grad = g.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, `rgba(255,255,255,0)`);
      grad.addColorStop(0.5, `rgba(255,255,255,${a.toFixed(3)})`);
      grad.addColorStop(1, `rgba(255,255,255,0)`);
      g.fillStyle = grad;
      g.fillRect(0, y, W, h);
    }

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    // a pure gradient shows mip banding; keep it linear and unmipped
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    return t;
  });
}

/**
 * The picture that hangs in the sky.
 *
 * Softened rather than pasted: a radial mask dissolves the edges so it has no
 * border, the contrast is pulled in toward the mid-tones so it sits in the
 * cloud instead of punching through it, and it is lifted slightly toward
 * white because everything at that apparent distance should be hazed.
 *
 * @param {HTMLImageElement} img
 */
export function skyImageTexture(img) {
  return memo(`skyimg:${img.src}`, () => {
    const S = 512;
    const { c, g } = canvas(S, S);
    const fit = Math.min(S / img.width, S / img.height);
    const w = img.width * fit;
    const h = img.height * fit;
    g.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);

    const data = g.getImageData(0, 0, S, S);
    const px = data.data;
    for (let i = 0; i < S * S; i++) {
      const o = i * 4;
      const dx = (i % S) / S - 0.5;
      const dy = Math.floor(i / S) / S - 0.5;
      const r = Math.min(1, Math.hypot(dx, dy) * 2.05);
      // soft round vignette, fully gone before the edge of the quad
      const mask = Math.max(0, 1 - r ** 1.7);
      // flatten the contrast and haze it toward white
      for (let k = 0; k < 3; k++) {
        const v = px[o + k] / 255;
        px[o + k] = Math.round(255 * (0.30 + v * 0.62));
      }
      px[o + 3] = Math.round(px[o + 3] * mask);
    }
    g.putImageData(data, 0, 0);

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  });
}

/* ---------------------------- rolling stock ---------------------------- */

/**
 * The side of a freight wagon. Panelling, ribs and weathering vary by type;
 * the stencilled lettering is a separate plane so the two memo caches stay
 * small (a handful of body textures, one per label).
 */
export function wagonBodyTexture(kind, tint) {
  return memo(`wagon:${kind}:${tint}`, () => {
    const { c, g } = canvas(256, 128);
    g.fillStyle = hex(tint);
    g.fillRect(0, 0, 256, 128);

    if (kind === 'old') {
      // planked wooden van
      for (let x = 0; x < 256; x += 16) {
        g.fillStyle = hex(mix(tint, rnd(x) > 0.5 ? 0xffffff : 0x000000, 0.05 + rnd(x * 3) * 0.09));
        g.fillRect(x, 0, 15, 128);
      }
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 2;
      for (let x = 0; x <= 256; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
    } else if (kind === 'boxcar') {
      // corrugated sides with a sliding door in the middle
      for (let x = 0; x < 256; x += 9) {
        g.fillStyle = hex(mix(tint, x % 18 ? 0x000000 : 0xffffff, 0.06));
        g.fillRect(x, 6, 8, 116);
      }
      g.fillStyle = hex(mix(tint, 0x000000, 0.18));
      g.fillRect(96, 12, 64, 104);
      g.strokeStyle = hex(mix(tint, 0x000000, 0.5));
      g.lineWidth = 3;
      g.strokeRect(96, 12, 64, 104);
    } else if (kind === 'hopper' || kind === 'open') {
      // ribbed body with vertical stiffeners
      for (let x = 12; x < 256; x += 32) {
        g.fillStyle = hex(mix(tint, 0x000000, 0.16));
        g.fillRect(x, 4, 7, 120);
      }
    } else {
      // plain plate with a few weld seams
      g.strokeStyle = hex(mix(tint, 0x000000, 0.22));
      g.lineWidth = 2;
      for (let x = 42; x < 256; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
    }

    // universal weathering: rust streaks and grime along the bottom
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * 256;
      g.fillStyle = `rgba(96,52,22,${0.05 + Math.random() * 0.14})`;
      g.fillRect(x, Math.random() * 40, 2 + Math.random() * 5, 30 + Math.random() * 80);
    }
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(0, 108, 256, 20);
    return toTexture(c);
  });
}

/**
 * Stencilled lettering, as sprayed onto freight by somebody in a hurry.
 * Transparent background so it sits on the wagon body as a decal.
 */
export function stencilTexture(text, color = 0xd8d4cc) {
  return memo(`stencil:${text}:${color}`, () => {
    const { c, g } = canvas(512, 128);
    g.clearRect(0, 0, 512, 128);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = 54;
    do {
      g.font = `bold ${size}px "Arial Narrow", "Courier New", monospace`;
      size -= 2;
    } while (g.measureText(text).width > 470 && size > 12);
    g.fillStyle = hex(color);
    g.fillText(text, 256, 64);
    // knock holes through the letters so it reads as a stencil, then weather it
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 90; i++) {
      g.beginPath();
      g.arc(Math.random() * 512, 30 + Math.random() * 68, 1 + Math.random() * 4, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  });
}

/**
 * Locomotive body plating. `variant` picks the era: modern box, the 1954
 * machine, the freight hauler, or the red v2.0 that somebody deployed.
 */
export function locoBodyTexture(variant) {
  return memo(`loco:${variant}`, () => {
    const { c, g } = canvas(256, 256);
    const base = {
      MODERN: 0x2f4a5c,
      OLD: 0x3d3128,
      FREIGHT: 0x4a3a22,
      V2: 0x5a1c1c,
    }[variant] ?? 0x2f4a5c;

    g.fillStyle = hex(base);
    g.fillRect(0, 0, 256, 256);

    // plate seams
    g.strokeStyle = hex(mix(base, 0x000000, 0.45));
    g.lineWidth = 3;
    for (let i = 0; i <= 256; i += 64) {
      g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
    }
    // rivets along every seam — the old machine gets many more
    const step = variant === 'OLD' ? 10 : 18;
    g.fillStyle = hex(mix(base, 0xffffff, 0.22));
    for (let y = 8; y < 256; y += 64) {
      for (let x = 8; x < 256; x += step) {
        g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill();
      }
    }
    // a warning band, because everything on a railway has one
    g.fillStyle = variant === 'V2' ? '#c8b020' : '#b8a838';
    g.fillRect(0, 196, 256, 12);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (let x = -20; x < 276; x += 24) {
      g.beginPath();
      g.moveTo(x, 208); g.lineTo(x + 12, 196); g.lineTo(x + 24, 196); g.lineTo(x + 12, 208);
      g.closePath(); g.fill();
    }
    // grime
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.09})`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 30, 3 + Math.random() * 18);
    }
    return toTexture(c);
  });
}

/* ---------------------------- signage ---------------------------- */

/**
 * A lineside sign or a label plate. Kept small and plain — the joke should
 * arrive as something you read in passing, not as an interface element.
 */
export function plateTexture(label, sub, color, opts = {}) {
  const { w = 512, h = 192, bg = 0x14181c } = opts;
  return memo(`plate:${label}|${sub}|${color}|${w}x${h}`, () => {
    const { c, g } = canvas(w, h);
    g.fillStyle = hex(bg);
    g.fillRect(0, 0, w, h);
    g.strokeStyle = hex(color);
    g.lineWidth = 4;
    g.strokeRect(6, 6, w - 12, h - 12);

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = Math.round(h * 0.30);
    do {
      g.font = `bold ${size}px "Arial Narrow", "Courier New", monospace`;
      size -= 2;
    } while (g.measureText(label).width > w - 48 && size > 10);
    g.fillStyle = '#eef2f4';
    g.fillText(label, w / 2, h * (sub ? 0.40 : 0.5));

    if (sub) {
      let s2 = Math.round(h * 0.13);
      do {
        g.font = `${s2}px "Courier New", monospace`;
        s2 -= 1;
      } while (g.measureText(sub).width > w - 40 && s2 > 7);
      g.fillStyle = hex(mix(color, 0xffffff, 0.35));
      g.fillText(sub, w / 2, h * 0.70);
    }
    return toTexture(c);
  });
}

/** The big lineside board that names the stretch of line you have entered. */
export function zoneSignTexture(zone) {
  return memo(`zonesign:${zone.id}`, () => {
    const { c, g } = canvas(512, 192);
    g.fillStyle = '#eceff1';
    g.fillRect(0, 0, 512, 192);
    g.fillStyle = hex(mix(zone.accent, 0x000000, 0.35));
    g.fillRect(0, 0, 512, 14);
    g.fillRect(0, 178, 512, 14);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = 74;
    do {
      g.font = `bold ${size}px "Arial Narrow", "Helvetica", sans-serif`;
      size -= 2;
    } while (g.measureText(zone.name).width > 464 && size > 16);
    g.fillStyle = '#1a1f24';
    g.fillText(zone.name, 256, 88);
    g.font = '20px "Courier New", monospace';
    g.fillStyle = '#5a646c';
    g.fillText(zone.sub, 256, 142);
    return toTexture(c);
  });
}

/** Andreaskreuz — the crossing warning saltire. */
export function crossingSignTexture() {
  return memo('crossing', () => {
    const { c, g } = canvas(256, 256);
    g.clearRect(0, 0, 256, 256);
    g.lineCap = 'round';
    for (const [a, b] of [[0, 0], [1, 0]]) {
      g.save();
      g.translate(128, 128);
      g.rotate((a ? -1 : 1) * Math.PI / 4);
      g.fillStyle = '#f2f2f0';
      g.fillRect(-118, -20, 236, 40);
      g.fillStyle = '#c8302a';
      g.fillRect(-118, -20, 40, 40);
      g.fillRect(78, -20, 40, 40);
      g.restore();
      void b;
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

/* ---------------------------- collectibles ---------------------------- */

/** A story-point token. */
export function storyPointTexture() {
  return memo('sp', () => {
    const { c, g } = canvas(128, 128);
    g.clearRect(0, 0, 128, 128);
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const x = 64 + Math.cos(a) * 56;
      const y = 64 + Math.sin(a) * 56;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#ffeeb0');
    grad.addColorStop(1, '#d09420');
    g.fillStyle = grad;
    g.fill();
    g.strokeStyle = '#fff6d8';
    g.lineWidth = 5;
    g.stroke();
    g.fillStyle = '#3a2a00';
    g.font = 'bold 46px "Courier New", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('SP', 64, 66);
    return toTexture(c);
  });
}

/** Fallback face for the legendary card when the photo is missing. */
export function glowCardFallbackTexture(label, flavor) {
  return memo(`glow:${label}|${flavor}`, () => {
    const { c, g } = canvas(256, 360);
    const grad = g.createLinearGradient(0, 0, 256, 360);
    grad.addColorStop(0, '#243040');
    grad.addColorStop(1, '#3a2a40');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 360);
    g.strokeStyle = '#e0c88a';
    g.lineWidth = 6;
    g.strokeRect(8, 8, 240, 344);
    g.fillStyle = '#00000055';
    g.fillRect(20, 20, 216, 216);
    g.fillStyle = '#e0c88a';
    g.font = 'bold 22px "Courier New", monospace';
    g.textAlign = 'center';
    g.fillText(label, 128, 276);
    g.font = '13px "Courier New", monospace';
    g.fillStyle = '#b8c6d2';
    g.fillText(flavor.slice(0, 30), 128, 306);
    return toTexture(c);
  });
}

/** A power-up chip. */
export function powerupTexture(p) {
  return memo(`pu:${p.id}`, () => {
    const { c, g } = canvas(192, 192);
    g.clearRect(0, 0, 192, 192);
    g.fillStyle = '#111820';
    g.beginPath();
    if (g.roundRect) g.roundRect(12, 12, 168, 168, 22);
    else g.rect(12, 12, 168, 168);
    g.fill();
    g.strokeStyle = hex(p.color);
    g.lineWidth = 7;
    g.stroke();
    g.fillStyle = hex(mix(p.color, 0x000000, 0.45));
    for (let i = 0; i < 4; i++) {
      g.fillRect(32 + i * 36, 2, 18, 12);
      g.fillRect(32 + i * 36, 178, 18, 12);
    }
    g.fillStyle = '#f2f6f8';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = 42;
    do {
      g.font = `bold ${size}px "Courier New", monospace`;
      size -= 2;
    } while (g.measureText(p.short).width > 132 && size > 12);
    g.fillText(p.short, 96, 96);
    return toTexture(c);
  });
}

/* ---------------------------- Marcel ---------------------------- */

/** Fallback face if marcel.png fails to load. */
export function marcelFallbackTexture() {
  return memo('marcel-fallback', () => {
    const { c, g } = canvas(256, 256);
    g.fillStyle = '#101410';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#8ac08a';
    g.lineWidth = 4;
    g.strokeRect(6, 6, 244, 244);
    g.fillStyle = '#8ac08a';
    g.font = '18px "Courier New", monospace';
    g.textAlign = 'left';
    g.fillText('> marcel --status', 20, 44);
    g.fillText('  active (running)', 20, 70);
    g.font = 'bold 68px "Courier New", monospace';
    g.textAlign = 'center';
    g.fillText('-_-', 128, 158);
    g.font = '16px "Courier New", monospace';
    g.fillText('SINCE SPRINT 4000', 128, 212);
    return toTexture(c);
  });
}

/**
 * A headlight pool, painted as it lands on the ballast: narrow and bright at
 * the lamp, spreading and fading down the track.
 *
 * Drawn rather than lit, because a real spotlight cone needs shadow maps to
 * show up on flat ground and would cost more than the effect is worth. This
 * lies flat on the ballast under additive blending and reads as light.
 */
export function beamTexture() {
  return memo('beam', () => {
    const W = 256, H = 512;
    const { c, g } = canvas(W, H);
    g.clearRect(0, 0, W, H);

    // v = 0 at the lamp (bottom of the canvas), 1 at the far end
    for (let y = 0; y < H; y++) {
      const v = y / H;
      const halfWidth = (0.10 + v * 0.42) * W;      // the cone opening
      const falloff = Math.pow(1 - v, 1.55);        // light gives out with range
      for (let x = 0; x < W; x++) {
        const d = Math.abs(x - W / 2) / halfWidth;
        if (d > 1) continue;
        // soft shoulder across the beam, hottest along the centre line
        const across = Math.pow(Math.cos(d * Math.PI * 0.5), 1.6);
        const a = across * falloff;
        if (a < 0.004) continue;
        g.fillStyle = `rgba(255, 226, 176, ${a.toFixed(3)})`;
        g.fillRect(x, y, 1, 1);
      }
    }

    // a hot core right at the lamp, and a little scatter in the beam
    const core = g.createRadialGradient(W / 2, 8, 0, W / 2, 8, W * 0.30);
    core.addColorStop(0, 'rgba(255,244,214,0.85)');
    core.addColorStop(1, 'rgba(255,232,190,0)');
    g.fillStyle = core;
    g.fillRect(0, 0, W, W * 0.6);

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  });
}

/**
 * Marcel's face, turned into something a lamp could actually project.
 *
 * Laying the photograph itself into the beam under additive blending barely
 * showed up: additive adds luminance, and a photograph is mostly mid-tones on
 * a dark ground, so most of it contributed nothing. This bakes a proper gobo
 * instead — the image is contrast-stretched across its full luminance range,
 * recoloured to lamp-warm, and the brightness is carried in the ALPHA so that
 * additive blending has something to add. The soft round falloff is baked in
 * too, so the projection fades into the pool instead of ending at a rectangle.
 *
 * @param {HTMLImageElement} img the loaded face, same-origin
 */
export function goboTexture(img) {
  return memo(`goboface:${img.src}`, () => {
    const S = 256;
    const { c, g } = canvas(S, S);
    const fit = Math.min(S / img.width, S / img.height) * 0.98;
    const w = img.width * fit;
    const h = img.height * fit;
    g.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);

    const data = g.getImageData(0, 0, S, S);
    const px = data.data;
    const n = S * S;

    // measure the image's own luminance range, so the stencil always uses the
    // full swing whatever photograph somebody drops in
    const lum = new Float32Array(n);
    let lo = 1;
    let hi = 0;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      const a = px[o + 3] / 255;
      const l = a * (0.299 * px[o] + 0.587 * px[o + 1] + 0.114 * px[o + 2]) / 255;
      lum[i] = l;
      if (a > 0.5) {
        if (l < lo) lo = l;
        if (l > hi) hi = l;
      }
    }
    const span = Math.max(0.08, hi - lo);

    for (let i = 0; i < n; i++) {
      const o = i * 4;
      const dx = (i % S) / S - 0.5;
      const dy = Math.floor(i / S) / S - 0.5;
      const r = Math.min(1, Math.hypot(dx, dy) * 2);
      const mask = Math.max(0, 1 - r ** 2.4);
      let l = (lum[i] - lo) / span;
      l = l < 0 ? 0 : l > 1 ? 1 : l;
      l **= 0.7;                                  // lift the mid-tones
      px[o] = 255;
      px[o + 1] = 216 + Math.round(l * 39);
      px[o + 2] = 156 + Math.round(l * 64);
      px[o + 3] = Math.round(255 * mask * (0.20 + 0.80 * l));
    }
    g.putImageData(data, 0, 0);

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  });
}

/**
 * The soft-edged mask his face is projected through, so the gobo fades into
 * the pool instead of sitting in it as a rectangle. Used until the real face
 * has loaded and goboTexture() can bake the proper stencil.
 */
export function goboMaskTexture() {
  return memo('gobo', () => {
    const { c, g } = canvas(256, 256);
    const grad = g.createRadialGradient(128, 128, 20, 128, 128, 126);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.55, '#9a9a9a');
    grad.addColorStop(1, '#000000');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    // break the edge up a little so it reads as light, not as a decal
    for (let i = 0; i < 400; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 90 + Math.random() * 40;
      g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.12})`;
      g.beginPath();
      g.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 4 + Math.random() * 12, 0, Math.PI * 2);
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    return t;
  });
}

/** Soft radial sprite for lamps, halos and smoke. */
export function glowSprite(color = 0xffffff) {
  return memo(`glowspr:${color}`, () => {
    const { c, g } = canvas(128, 128);
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    const h = hex(color);
    grad.addColorStop(0, `${h}ff`);
    grad.addColorStop(0.35, `${h}88`);
    grad.addColorStop(1, `${h}00`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}
