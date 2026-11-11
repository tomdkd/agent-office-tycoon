import express from 'express'
import compression from 'compression'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, join, extname } from 'node:path'
import { WebSocket, WebSocketServer } from 'ws'
import { isAgentActionEvent } from '../src/shared/agentEvent.mjs'

export function createOfficeServer(root = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')) {
  const app = express()
  const server = createServer(app)
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 4096 })

  app.disable('x-powered-by')
  app.use(compression())
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    next()
  })
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }))
  app.post('/api/events', express.json({ limit: '8kb', strict: true }), (req, res) => {
    if (!req.is('application/json')) return res.status(415).json({ error: 'Content-Type must be application/json' })
    if (!isAgentActionEvent(req.body)) return res.status(400).json({ error: 'Invalid agent action event' })
    const message = JSON.stringify(req.body)
    for (const client of sockets.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message, (error) => {
          if (error) console.error('WebSocket broadcast failed:', error.message)
        })
      }
    }
    return res.status(202).json({ status: 'accepted' })
  })
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }))
  app.use(express.static(root, {
    index: false,
    dotfiles: 'deny',
    setHeaders(res, path) {
      res.setHeader('Cache-Control', /[\\/]assets[\\/][^\\/]+-[\w-]{8,}\.(js|css|woff2?|png|jpe?g|gif|webp|svg|ico)$/i.test(path)
        ? 'public, max-age=31536000, immutable' : 'no-cache')
    },
  }))
  app.use((req, res, next) => {
    if ((req.method === 'GET' || req.method === 'HEAD') && !extname(req.path) && !req.path.startsWith('/assets/')) {
      res.setHeader('Cache-Control', 'no-cache')
      return res.sendFile(join(root, 'index.html'), (error) => {
        if (error) next(error)
      })
    }
    return res.status(404).send('Not found')
  })
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    if (error.status === 400 || error.status === 413 || error.status === 415) {
      const message = error.status === 413 ? 'Request too large' : error.status === 415 ? 'Unsupported encoding' : 'Invalid JSON'
      return res.status(error.status).json({ error: message })
    }
    console.error('HTTP request failed:', error)
    return res.status(500).json({ error: 'Internal server error' })
  })

  server.on('upgrade', (request, socket, head) => {
    if (request.url !== '/ws') {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }
    sockets.handleUpgrade(request, socket, head, (client) => sockets.emit('connection', client, request))
  })
  sockets.on('connection', (client) => {
    client.on('error', (error) => console.error('WebSocket error:', error.message))
  })

  function shutdown() {
    for (const client of sockets.clients) client.terminate()
    sockets.close()
    server.close((error) => {
      if (error) {
        console.error('Server shutdown failed:', error)
        process.exitCode = 1
      }
    })
  }
  return { server, shutdown }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT ?? 8080)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT')
  const { server, shutdown } = createOfficeServer()
  server.listen(port, '0.0.0.0', () => console.log(`Office server listening on ${port}`))
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
}
