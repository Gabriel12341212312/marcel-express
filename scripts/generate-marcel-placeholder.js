/**
 * Generates a placeholder face PNG at public/marcel.png —
 * a shadowy scarecrow in a suit with glowing eyes, drawn pixel-by-pixel
 * and encoded with Node's built-in zlib (no dependencies).
 *
 *   npm run gen:enemy
 *
 * Replace marcel.png with any PNG you like — the game will pick it up
 * automatically via CONFIG.ENEMY_TEXTURE_PATH.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const W = 256;
const H = 512;

const pixels = new Uint8Array(W * H * 4); // RGBA, alpha 0 by default

function setPx(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  pixels[i] = r;
  pixels[i + 1] = g;
  pixels[i + 2] = b;
  pixels[i + 3] = a;
}

function fillRect(x0, y0, x1, y1, r, g, b, a = 255) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) setPx(x, y, r, g, b, a);
  }
}

function fillEllipse(cx, cy, rx, ry, r, g, b, a = 255) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) setPx(x, y, r, g, b, a);
    }
  }
}

/* --- the scarecrow --- */

const SUIT = [28, 28, 34];
const SUIT_LIGHT = [44, 44, 54];
const SHIRT = [220, 214, 200];
const TIE = [140, 20, 20];
const SKIN = [200, 180, 150];
const WHITE = [255, 255, 255];
const DARK = [20, 20, 24];

// head
fillEllipse(128, 92, 38, 48, ...SKIN);
// hair shadow
fillEllipse(128, 62, 40, 24, ...DARK, 220);
// eyes + pupils
fillEllipse(106, 88, 8, 8, ...WHITE);
fillEllipse(150, 88, 8, 8, ...WHITE);
fillEllipse(107, 89, 3, 3, ...DARK);
fillEllipse(149, 89, 3, 3, ...DARK);
// jagged mouth
for (let x = 108; x <= 148; x += 2) {
  const wob = Math.sin(x * 0.35) * 3;
  fillRect(x, 120 + Math.round(wob), x + 1, 122 + Math.round(wob), 60, 50, 55);
}
// torso (suit)
fillRect(88, 170, 168, 335, ...SUIT);
// lapels
fillRect(92, 160, 118, 212, ...SUIT_LIGHT);
fillRect(138, 160, 164, 212, ...SUIT_LIGHT);
// shirt V
for (let y = 170; y <= 250; y++) {
  const half = Math.round((y - 170) * 0.18);
  fillRect(128 - half, y, 128 + half, y, ...SHIRT);
}
// tie
fillRect(121, 172, 135, 178, ...TIE);
fillRect(121, 179, 135, 240, ...TIE);
// arms
fillRect(76, 176, 92, 312, ...SUIT);
fillRect(164, 176, 180, 312, ...SUIT);
fillEllipse(78, 300, 9, 9, ...SKIN);
fillEllipse(178, 300, 9, 9, ...SKIN);
// legs
fillRect(104, 335, 124, 452, ...SUIT);
fillRect(132, 335, 152, 452, ...SUIT);
// shoes
fillRect(98, 452, 128, 466, ...DARK);
fillRect(128, 452, 158, 466, ...DARK);
// soft floor shadow
fillEllipse(128, 482, 64, 10, 0, 0, 0, 60);

/* --- PNG encoding (no deps: manual chunks + zlib + CRC32) --- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 6;  // RGBA
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter
ihdr[12] = 0; // interlace

const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0; // filter: none
  Buffer.from(pixels.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);

writeFileSync(new URL('../public/marcel.png', import.meta.url), png);
console.log('Wrote marcel.png placeholder (' + W + 'x' + H + ') at the project root.');
