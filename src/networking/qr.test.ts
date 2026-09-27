import { expect, it } from 'vitest'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { splitSignal } from './signaling'

it('reads the largest generated QR chunk using the bundled camera decoder', () => {
  const text = splitSignal('OBG1.' + 'Abc012-XYZ_'.repeat(100))[0]
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const scale = 4,
    margin = 4,
    width = (qr.modules.size + margin * 2) * scale
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255)
  for (let y = 0; y < width; y++)
    for (let x = 0; x < width; x++) {
      const row = Math.floor(y / scale) - margin,
        col = Math.floor(x / scale) - margin
      const black =
        row >= 0 &&
        col >= 0 &&
        row < qr.modules.size &&
        col < qr.modules.size &&
        qr.modules.get(row, col)
      if (black) {
        const i = (y * width + x) * 4
        pixels[i] = 0
        pixels[i + 1] = 0
        pixels[i + 2] = 0
      }
    }
  expect(jsQR(pixels, width, width)?.data).toBe(text)
})
