/**
 * Dev-only endpoints the map editor uses to read/save `src/world/maps/data/*.map.json`.
 * `apply: 'serve'` means this does not exist in production builds at all.
 *
 * The dev server listens on the LAN (so phones can test), so writing files over HTTP must
 * not be open to everyone. Requests are accepted only if ALL of these hold:
 *   - the TCP peer is this machine (loopback or one of its own interface addresses)
 *   - if the browser sent Sec-Fetch-Site it says same-origin (so not even a page on another
 *     localhost port, which Vite's default CORS policy would otherwise trust)
 *   - the custom `x-map-editor: 1` header is present (forces a CORS preflight for other
 *     origins, which this middleware never answers)
 * and the body is validated like any other save (valid key, valid map, <= 2 MB).
 */
import os from 'node:os'
import path from 'node:path'
import type { IncomingMessage } from 'node:http'
import type { Plugin } from 'vite'
import { checkMap, listKeys, readMap, saveMap } from './mapStore.ts'

const MAX_BODY = 2 * 1024 * 1024

function isLocalPeer(req: IncomingMessage): boolean {
  const addr = (req.socket.remoteAddress ?? '').replace(/^::ffff:/, '')
  if (addr === '127.0.0.1' || addr === '::1') return true
  return Object.values(os.networkInterfaces()).flat().some((i) => i?.address === addr)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) {
        reject(new Error('body too large'))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export function mapEditorPlugin(): Plugin {
  let dir = ''
  return {
    name: 'talk-space-map-editor',
    apply: 'serve',
    configResolved(config) {
      dir = path.join(config.root, 'src/world/maps/data')
    },
    // The editor is the source of truth while open; a save must not hot-reload the page under it.
    handleHotUpdate({ file }) {
      if (file.startsWith(dir) && file.endsWith('.map.json')) return []
    },
    configureServer(server) {
      server.middlewares.use('/__dev/maps', async (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(body))
        }
        try {
          const site = req.headers['sec-fetch-site'] // absent for non-browser clients such as curl
          if (!isLocalPeer(req) || (site !== undefined && site !== 'same-origin' && site !== 'none') || req.headers['x-map-editor'] !== '1') {
            return send(403, { error: 'map editor endpoints are local-only' })
          }
          const key = decodeURIComponent((req.url ?? '/').split('?')[0]!.replace(/^\//, ''))

          if (req.method === 'GET' && key === '') {
            const maps = listKeys(dir).map((k) => {
              const r = readMap(dir, k)
              return { key: k, map: r.map, issues: r.issues }
            })
            return send(200, { maps })
          }
          if (req.method === 'PUT' && key !== '') {
            const text = await readBody(req)
            let body: unknown
            try {
              body = JSON.parse(text)
            } catch {
              return send(400, { ok: false, issues: [{ level: 'error', path: '', message: 'body is not valid JSON' }] })
            }
            const { map } = checkMap(body)
            if (map && map.key !== key) return send(400, { ok: false, issues: [{ level: 'error', path: 'key', message: `body key "${map.key}" does not match URL key "${key}"` }] })
            const result = saveMap(dir, body, { allowCreate: true })
            return send(result.ok ? 200 : 422, { ok: result.ok, issues: result.issues })
          }
          send(405, { error: 'method not allowed' })
        } catch (e) {
          send(500, { error: (e as Error).message })
        }
      })
    },
  }
}
