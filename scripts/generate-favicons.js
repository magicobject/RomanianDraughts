// Writes the favicon set into public/: favicon.svg, favicon-32.png, apple-touch-icon.png and favicon.ico.
// Hand-run (`node scripts/generate-favicons.js`) when the design changes; the results are committed.
// No image library: the PNGs are rasterised here with 4x4 supersampling and encoded with zlib.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const GREEN = [0x3c, 0x50, 0x38], CREAM = [0xf5, 0xed, 0xdc], OCHRE = [0xe0, 0xa9, 0x40];
// the eight-pointed star used for every piece (same outline as the symbol in the page), in a -10..10 box
const STAR = [[0,-9],[2,-4.8],[6.4,-6.4],[4.8,-2],[9,0],[4.8,2],[6.4,6.4],[2,4.8],[0,9],[-2,4.8],[-6.4,6.4],[-4.8,2],[-9,0],[-4.8,-2],[-6.4,-6.4],[-2,-4.8]];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -12 24 24">
  <rect x="-12" y="-12" width="24" height="24" rx="4" fill="#3c5038"/>
  <circle r="10.2" fill="none" stroke="#e0a940" stroke-width="1"/>
  <path fill="#f5eddc" d="M${STAR.map(p => p.join(' ')).join('L')}Z"/>
</svg>
`;

function inPoly(x, y) {
  let inside = false;
  for (let i = 0, j = STAR.length - 1; i < STAR.length; j = i++) {
    const [xi, yi] = STAR[i], [xj, yj] = STAR[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pixel(u, v) { // u, v in -12..12
  const r = Math.hypot(u, v);
  const inRounded = Math.abs(u) <= 12 && Math.abs(v) <= 12 &&
    !(Math.abs(u) > 8 && Math.abs(v) > 8 && Math.hypot(Math.abs(u) - 8, Math.abs(v) - 8) > 4);
  if (!inRounded) return [0, 0, 0, 0];
  if (inPoly(u, v)) return [...CREAM, 255];
  if (Math.abs(r - 10.2) <= 0.5) return [...OCHRE, 255];
  return [...GREEN, 255];
}

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}

function png(size) {
  const SS = 4, rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4); // first byte is the PNG filter type, 0 = none
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const p = pixel(((x + (sx + .5) / SS) / size) * 24 - 12, ((y + (sy + .5) / SS) / size) * 24 - 12);
        acc[0] += p[0] * p[3]; acc[1] += p[1] * p[3]; acc[2] += p[2] * p[3]; acc[3] += p[3];
      }
      const a = acc[3];
      row.set(a ? [Math.round(acc[0] / a), Math.round(acc[1] / a), Math.round(acc[2] / a), Math.round(a / (SS * SS))] : [0, 0, 0, 0], 1 + x * 4);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}

function ico(pngBuf, size) { // an ICO file holding one PNG image
  const head = Buffer.alloc(22);
  head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4);
  head[6] = size; head[7] = size; head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12);
  head.writeUInt32LE(pngBuf.length, 14); head.writeUInt32LE(22, 18);
  return Buffer.concat([head, pngBuf]);
}

const out = path.join(__dirname, '../public');
const p32 = png(32);
fs.writeFileSync(path.join(out, 'favicon.svg'), svg);
fs.writeFileSync(path.join(out, 'favicon-32.png'), p32);
fs.writeFileSync(path.join(out, 'apple-touch-icon.png'), png(180));
fs.writeFileSync(path.join(out, 'favicon.ico'), ico(p32, 32));
console.log('Wrote favicon.svg, favicon-32.png, apple-touch-icon.png, favicon.ico');
