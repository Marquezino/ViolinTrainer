// Writes public/icon-192.png and public/icon-512.png: a white eighth note on the theme colour.
// Run with: node scripts/make-icons.ts
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const THEME = [0x8a, 0x4b, 0x14]
const WHITE = [255, 255, 255]

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const out = Buffer.alloc(body.length + 8)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), body.length + 4)
  return out
}

/** Coverage 0..1 of the note shape at (x, y), in a unit square; the note stays inside the central 60% (maskable safe zone). */
function noteCoverage(x: number, y: number): number {
  // Head: an ellipse tilted a little; stem: a bar on its right; flag: a slanted bar at the top.
  const hx = 0.4, hy = 0.7
  const dx = x - hx, dy = y - hy
  const c = Math.cos(-0.35), s = Math.sin(-0.35)
  const ex = (dx * c - dy * s) / 0.115, ey = (dx * s + dy * c) / 0.085
  if (ex * ex + ey * ey <= 1) return 1
  if (x >= 0.5 && x <= 0.54 && y >= 0.25 && y <= 0.7) return 1
  // Flag: between two curves to the right of the stem's top.
  if (x > 0.54 && x <= 0.68 && y >= 0.25 + (x - 0.54) * 1.0 && y <= 0.34 + (x - 0.54) * 1.6) return 1
  return 0
}

function png(size: number): Buffer {
  const rows: Buffer[] = []
  const samples = 4
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 3)
    for (let px = 0; px < size; px++) {
      let cover = 0
      for (let sy = 0; sy < samples; sy++)
        for (let sx = 0; sx < samples; sx++)
          cover += noteCoverage((px + (sx + 0.5) / samples) / size, (py + (sy + 0.5) / samples) / size)
      cover /= samples * samples
      for (let i = 0; i < 3; i++) row[1 + px * 3 + i] = Math.round(THEME[i] * (1 - cover) + WHITE[i] * cover)
    }
    rows.push(row)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const size of [192, 512]) writeFileSync(new URL(`../public/icon-${size}.png`, import.meta.url), png(size))
