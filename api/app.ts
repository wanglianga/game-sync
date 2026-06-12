/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import cardRoutes from './routes/cards.js'
import commentRoutes from './routes/comments.js'
import assetRoutes from './routes/assets.js'
import webhookRoutes from './routes/webhooks.js'
import reportRoutes from './routes/reports.js'
import notificationRoutes from './routes/notifications.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/cards', cardRoutes)
app.use('/api/comments', commentRoutes)
app.use('/api/assets', assetRoutes)
app.use('/api/webhooks', webhookRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/notifications', notificationRoutes)

/**
 * health
 */
app.use('/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

app.use(express.static(path.join(__dirname, '..', 'dist')))

app.get('*', (req: Request, res: Response): void => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'))
    return
  }
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
