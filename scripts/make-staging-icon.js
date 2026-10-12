#!/usr/bin/env node
// Generates the STAGING app icons (orange background + white capital "S") so the
// staging app is distinguishable from the live one. Zero dependencies: it rasterises
// the shapes itself and encodes PNGs with Node's built-in zlib.
// Usage: node scripts/make-staging-icon.js [outDir]   (default: frontend/assets)
// Outputs: icon-staging.png, adaptive-icon-staging.png (transparent foreground),
//          favicon-staging.png. Live assets are never touched.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ORANGE = [0xf5, 0x7c, 0x00];
const WHITE = [255, 255, 255];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- coverage functions (return 0..1 for a point, in a unit space centred at 0,0) ----
const rad = (d) => (d * Math.PI) / 180;
function angDist(a, from, to) { // is angle a within [from,to] (degrees, from<=to), normalised
  const span = to - from;
  let d = (((a - from) % 360) + 360) % 360;
  return d <= span;
}
function distToArc(px, py, cx, cy, R, from, to) {
  const dx = px - cx, dy = py - cy;
  const a = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angDist(a, from, to)) return Math.abs(Math.hypot(dx, dy) - R);
  const e1 = [cx + R * Math.cos(rad(from)), cy + R * Math.sin(rad(from))];
  const e2 = [cx + R * Math.cos(rad(to)), cy + R * Math.sin(rad(to))];
  return Math.min(Math.hypot(px - e1[0], py - e1[1]), Math.hypot(px - e2[0], py - e2[1]));
}
// S glyph: two stacked arcs. Height H, stroke width W, centred on (0,0).
function sGlyph(H, W) {
  const R = (H - W) / 4; // each bowl radius (centreline)
  return (x, y) => {
    const up = distToArc(x, y, 0, -R, R, 90, 330); // upper bowl: from bottom, via left & top, to upper-right
    const lo = distToArc(x, y, 0, R, R, 270, 510); // lower bowl: from top, via right & bottom, to lower-left
    return Math.min(up, lo) <= W / 2;
  };
}
function ring(R, w) { return (x, y) => Math.abs(Math.hypot(x, y) - R) <= w / 2; }

function render(size, shapes, bg) {
  const buf = Buffer.alloc(size * size * 4);
  const SS = 3;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    if (bg) { [r, g, b] = bg; a = 255; }
    for (const s of shapes) {
      let hit = 0;
      for (let i = 0; i < SS; i++) for (let j = 0; j < SS; j++) {
        const ux = (x + (i + 0.5) / SS) / size * 1024 - 512;
        const uy = (y + (j + 0.5) / SS) / size * 1024 - 512;
        if (s.fn(ux, uy)) hit++;
      }
      const cov = (hit / (SS * SS)) * s.alpha;
      if (cov > 0) {
        const na = cov + (a / 255) * (1 - cov);
        const mix = (c0, c1) => (c1 * cov + c0 * (a / 255) * (1 - cov)) / na;
        r = mix(r, s.color[0]); g = mix(g, s.color[1]); b = mix(b, s.color[2]); a = na * 255;
      }
    }
    const o = (y * size + x) * 4;
    buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = Math.round(a);
  }
  return encodePng(size, buf);
}

const rings = (scale) => [440, 340].map((R) => ({ fn: ring(R * scale, 14 * scale), color: WHITE, alpha: 0.4 }));
const s = (H, W) => ({ fn: sGlyph(H, W), color: WHITE, alpha: 1 });

const outDir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'frontend', 'assets'));
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon-staging.png'), render(1024, [...rings(1), s(620, 105)], ORANGE));
// Adaptive foreground: everything inside the central 66% safe zone (<= ~340px radius).
fs.writeFileSync(path.join(outDir, 'adaptive-icon-staging.png'), render(1024, [...rings(0.62), s(430, 74)], null));
fs.writeFileSync(path.join(outDir, 'favicon-staging.png'), render(48, [s(800, 150)], ORANGE));
console.log('Wrote staging icons to ' + outDir);
