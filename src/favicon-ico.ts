import { Buffer } from "node:buffer"

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

/** Package square PNGs losslessly into a multi-resolution ICO (modern browsers/Windows). */
export function createFaviconIco(images: readonly Uint8Array[]): Buffer {
  if (!images.length || images.length > 65535) {
    throw new Error("An ICO needs between 1 and 65535 PNG images")
  }
  const sizes = new Set<number>()
  const frames = images.map((image) => {
    const png = Buffer.from(image)
    if (png.length < 33 || !png.subarray(0, 8).equals(PNG_SIGNATURE) || png.toString("ascii", 12, 16) !== "IHDR") {
      throw new Error("ICO images must be PNG files with an IHDR header")
    }
    const size = png.readUInt32BE(16)
    if (size < 1 || size > 256 || png.readUInt32BE(20) !== size) {
      throw new Error("ICO images must be square and between 1 and 256 pixels")
    }
    if (sizes.has(size)) throw new Error(`Duplicate ICO image size: ${size}`)
    sizes.add(size)
    return { png, size }
  }).sort((a, b) => a.size - b.size)

  const directory = Buffer.alloc(6 + frames.length * 16)
  directory.writeUInt16LE(1, 2) // Image type: icon, not cursor.
  directory.writeUInt16LE(frames.length, 4)
  let offset = directory.length
  for (const [index, { png, size }] of frames.entries()) {
    const entry = 6 + index * 16
    directory[entry] = size === 256 ? 0 : size
    directory[entry + 1] = size === 256 ? 0 : size
    directory.writeUInt16LE(1, entry + 4)
    directory.writeUInt16LE(32, entry + 6)
    directory.writeUInt32LE(png.length, entry + 8)
    directory.writeUInt32LE(offset, entry + 12)
    offset += png.length
  }
  return Buffer.concat([directory, ...frames.map(({ png }) => png)])
}
