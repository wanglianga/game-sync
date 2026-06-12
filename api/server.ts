import app from './app.js'
import { runMigrations } from './migrate.js'
import { connectRedis, disconnectRedis } from './redis.js'
import { setupWebSocket } from './ws.js'
import { startWeeklyReportScheduler, stopWeeklyReportScheduler, startOverdueNotificationScheduler, stopOverdueNotificationScheduler } from './services/scheduler.js'

const PORT = process.env.PORT || 3001

async function start() {
  try {
    await runMigrations()
    console.log('Database ready')

    await connectRedis()

    const server = app.listen(PORT, () => {
      console.log(`Server ready on port ${PORT}`)
    })

    setupWebSocket(server)
    startWeeklyReportScheduler()
    startOverdueNotificationScheduler()

    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received')
      stopWeeklyReportScheduler()
      stopOverdueNotificationScheduler()
      server.close(async () => {
        await disconnectRedis()
        console.log('Server closed')
        process.exit(0)
      })
    })

    process.on('SIGINT', () => {
      console.log('SIGINT signal received')
      stopWeeklyReportScheduler()
      stopOverdueNotificationScheduler()
      server.close(async () => {
        await disconnectRedis()
        console.log('Server closed')
        process.exit(0)
      })
    })
  } catch (err) {
    console.error('Failed to start server:', err)
    process.exit(1)
  }
}

start()

export default app
