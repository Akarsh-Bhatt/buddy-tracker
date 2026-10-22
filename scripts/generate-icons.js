// Generates 16x16, 48x48, 128x128 valid PNG icons for the extension
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createPNG(size, color = { r: 139, g: 92, b: 246 }) {
  // Simple uncompressed PNG generator
  const width = size;
  const height = size;

  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const ihdrChunk = createChunk('IHDR', ihdr);

  // Scanlines: 1 filter byte + 4 bytes per pixel (RGBA)
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  const center = size / 2;
  const radius = size * 0.45;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        // Rounded badge gradient
        const factor = 1 - (dist / radius) * 0.3;
        rawData[pxOffset] = Math.min(255, Math.round(color.r * factor)); // R
        rawData[pxOffset + 1] = Math.min(255, Math.round(color.g * factor)); // G
        rawData[pxOffset + 2] = Math.min(255, Math.round(color.b * factor)); // B
        rawData[pxOffset + 3] = 255; // Alpha
      } else {
        // Transparent
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type);
  const length = data.length;
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(length, 0);

  const crcData = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(crcData);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// Standard CRC32 table & function
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const iconsDir = path.resolve('extension', 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

[16, 48, 128].forEach((size) => {
  const pngBuf = createPNG(size);
  const dest = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(dest, pngBuf);
  console.log(`Generated valid PNG: ${dest} (${size}x${size}, ${pngBuf.length} bytes)`);
});
