import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const source = dirname(require.resolve('pdfjs-dist/package.json'))
const target = resolve(app, 'public/pdfjs')
mkdirSync(target, { recursive: true })
cpSync(resolve(source, 'build/pdf.mjs'), resolve(target, 'pdf.mjs'))
cpSync(resolve(source, 'build/pdf.worker.min.mjs'), resolve(target, 'pdf.worker.min.mjs'))
for (const folder of ['cmaps', 'standard_fonts', 'wasm']) {
  rmSync(resolve(target, folder), { recursive: true, force: true })
  cpSync(resolve(source, folder), resolve(target, folder), { recursive: true })
}
if (!existsSync(resolve(target, 'cmaps/Adobe-GB1-UCS2.bcmap')) || !existsSync(resolve(target, 'standard_fonts/LiberationSans-Regular.ttf'))) throw new Error('PDF assets are incomplete')
