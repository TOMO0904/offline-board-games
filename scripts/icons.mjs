import { PNG } from 'pngjs'
import { mkdirSync, writeFileSync } from 'node:fs'

mkdirSync('public/icons', { recursive: true })
for (const [name, size] of [
  ['icon-192', 192],
  ['icon-512', 512],
  ['maskable-512', 512],
  ['apple-touch-icon', 180],
]) {
  const png = new PNG({ width: size, height: size })
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let color = [18, 44, 41]
      for (const [cx, cy, white] of [
        [0.36, 0.36, false],
        [0.64, 0.36, true],
        [0.36, 0.64, true],
        [0.64, 0.64, false],
      ]) {
        if (Math.hypot(x / size - cx, y / size - cy) < 0.115)
          color = white ? [245, 243, 237] : [139, 185, 150]
      }
      const i = (y * size + x) * 4
      png.data.set([...color, 255], i)
    }
  writeFileSync(`public/icons/${name}.png`, PNG.sync.write(png))
}
writeFileSync(
  'public/icons/icon.svg',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="24" fill="#122c29"/><g fill="#8bb996"><circle cx="36" cy="36" r="12"/><circle cx="64" cy="64" r="12"/></g><g fill="#f5f3ed"><circle cx="64" cy="36" r="12"/><circle cx="36" cy="64" r="12"/></g></svg>',
)
