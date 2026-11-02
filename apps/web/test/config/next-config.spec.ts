import { execFileSync } from 'node:child_process'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outputDirectory = (mode: 'development' | 'production' | 'test', override = ''): string => JSON.parse(
  execFileSync(process.execPath, ['-e', 'process.stdout.write(JSON.stringify(require("./next.config.js").distDir))'], {
    cwd: webRoot,
    env: { ...process.env, NODE_ENV: mode, NEXT_DIST_DIR: override },
    encoding: 'utf8',
  }),
)

describe('Next build output isolation', () => {
  it('keeps development and production outputs outside each other so a build cannot erase live dev assets', () => {
    const dev = resolve(webRoot, outputDirectory('development'))
    const production = resolve(webRoot, outputDirectory('production'))
    expect(dev).not.toBe(production)
    expect(dev.startsWith(production + sep)).toBe(false)
    expect(production.startsWith(dev + sep)).toBe(false)
  })

  it('preserves an explicit output directory for isolated verification', () => {
    for (const mode of ['development', 'production'] as const) {
      expect(outputDirectory(mode, '.next/isolated-verification')).toBe('.next/isolated-verification')
    }
  })
})
