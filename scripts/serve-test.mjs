import { spawn, spawnSync } from 'node:child_process'
const env = { ...process.env, BASE_PATH: '/offline-board-games/' }
const build = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
  stdio: 'inherit',
  env,
})
if (build.status !== 0) process.exit(build.status || 1)
const server = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    '4173',
    '--strictPort',
  ],
  { stdio: 'inherit', env },
)
process.on('SIGTERM', () => server.kill())
process.on('SIGINT', () => server.kill())
server.on('exit', (code) => process.exit(code || 0))
