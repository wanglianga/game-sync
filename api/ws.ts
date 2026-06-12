import { WebSocketServer, WebSocket } from 'ws'
import { createServer, type Server } from 'http'
import jwt from 'jsonwebtoken'
import { redisClient, connectRedis } from './redis.js'

const connectedClients = new Map<string, WebSocket>()

const JWT_SECRET = process.env.JWT_SECRET || 'gamesync-dev-secret'

export function setupWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/api/ws' })

  wss.on('connection', (ws, req) => {
    let authenticated = false
    let userId: string | null = null

    const url = new URL(req.url || '', 'http://localhost')
    const tokenFromQuery = url.searchParams.get('token')

    if (tokenFromQuery) {
      try {
        const decoded = jwt.verify(tokenFromQuery, JWT_SECRET) as { id: string; userId?: string }
        const uid = decoded.id || decoded.userId
        if (uid) {
          userId = uid
          authenticated = true

          if (connectedClients.has(userId)) {
            const old = connectedClients.get(userId)!
            if (old.readyState === WebSocket.OPEN) {
              old.close()
            }
          }

          connectedClients.set(userId, ws)
          ws.send(JSON.stringify({ type: 'auth_ok' }))
        }
      } catch {
        ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid token' }))
        ws.close()
        return
      }
    }

    ws.on('message', async (data) => {
      if (authenticated) return

      try {
        const parsed = JSON.parse(data.toString())

        if (parsed.type === 'auth' && parsed.token) {
          try {
            const decoded = jwt.verify(parsed.token, JWT_SECRET) as { id: string; userId?: string }
            const uid = decoded.id || decoded.userId
            if (uid) {
              userId = uid
              authenticated = true

              if (connectedClients.has(userId)) {
                const old = connectedClients.get(userId)!
                if (old.readyState === WebSocket.OPEN) {
                  old.close()
                }
              }

              connectedClients.set(userId, ws)
              ws.send(JSON.stringify({ type: 'auth_ok' }))
            }
          } catch {
            ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid token' }))
            ws.close()
          }
        }
      } catch {
        // ignore malformed messages
      }
    })

    ws.on('close', () => {
      if (userId && connectedClients.get(userId) === ws) {
        connectedClients.delete(userId)
      }
    })
  })

  subscribeToRedisNotifications()
}

async function subscribeToRedisNotifications(): Promise<void> {
  try {
    await connectRedis()
    const subscriber = redisClient.duplicate()
    await subscriber.connect()

    await subscriber.pSubscribe('notifications:*', (message, channel) => {
      const userId = channel.replace('notifications:', '')
      const client = connectedClients.get(userId)

      if (client && client.readyState === WebSocket.OPEN) {
        try {
          const payload = JSON.parse(message)
          if (payload.type) {
            client.send(JSON.stringify(payload))
          } else {
            client.send(JSON.stringify({ type: 'notification', payload }))
          }
        } catch {
          // ignore parse errors
        }
      }
    })
  } catch (err) {
    console.error('Redis subscription error:', err)
  }
}
