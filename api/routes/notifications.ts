import { Router, type Request, type Response } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { query } from '../db.js'
import { publish } from '../redis.js'
import type { UserRole, Notification } from '../../shared/types.js'

const router = Router()

router.use(authMiddleware)

interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    name: string
    role: UserRole
    team_id: string
  }
}

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id
    const teamId = req.user!.team_id
    const { limit = 50, offset = 0, read } = req.query

    let sql = `
      SELECT n.*, 
        (n.created_at < NOW() - INTERVAL '48 hours' AND n.read = FALSE) as is_overdue
      FROM notifications n
      WHERE n.user_id = $1 AND n.team_id = $2
    `
    const params: unknown[] = [userId, teamId]
    let paramIndex = 3

    if (read !== undefined) {
      sql += ` AND n.read = $${paramIndex}`
      params.push(read === 'true')
      paramIndex++
    }

    sql += ` ORDER BY n.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(Number(limit), Number(offset))

    const result = await query(sql, params)

    const notifications = result.rows.map((row: any) => ({
      ...row,
      is_overdue: row.is_overdue === true,
    })) as (Notification & { is_overdue: boolean })[]

    const countResult = await query(
      `SELECT COUNT(*) as total FROM notifications WHERE user_id = $1 AND team_id = $2`,
      [userId, teamId]
    )

    const unreadCountResult = await query(
      `SELECT COUNT(*) as unread FROM notifications WHERE user_id = $1 AND team_id = $2 AND read = FALSE`,
      [userId, teamId]
    )

    res.json({
      success: true,
      data: {
        notifications,
        total: Number(countResult.rows[0].total),
        unread: Number(unreadCountResult.rows[0].unread),
      },
    })
  } catch (error) {
    console.error('Get notifications error:', error)
    res.status(500).json({ success: false, error: 'Failed to get notifications' })
  }
})

router.get('/unread-count', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id
    const teamId = req.user!.team_id

    const result = await query(
      `SELECT COUNT(*) as unread FROM notifications WHERE user_id = $1 AND team_id = $2 AND read = FALSE`,
      [userId, teamId]
    )

    res.json({
      success: true,
      data: {
        unread: Number(result.rows[0].unread),
      },
    })
  } catch (error) {
    console.error('Get unread count error:', error)
    res.status(500).json({ success: false, error: 'Failed to get unread count' })
  }
})

router.put('/:id/read', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id
    const teamId = req.user!.team_id
    const { id } = req.params

    const result = await query(
      `UPDATE notifications SET read = TRUE, notified_overdue = TRUE 
       WHERE id = $1 AND user_id = $2 AND team_id = $3
       RETURNING *`,
      [id, userId, teamId]
    )

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Notification not found' })
      return
    }

    await publish(
      `notifications:${userId}`,
      JSON.stringify({ type: 'read', id })
    )

    res.json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error('Mark notification read error:', error)
    res.status(500).json({ success: false, error: 'Failed to mark notification as read' })
  }
})

router.put('/read-all', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id
    const teamId = req.user!.team_id

    const result = await query(
      `UPDATE notifications SET read = TRUE, notified_overdue = TRUE 
       WHERE user_id = $1 AND team_id = $2 AND read = FALSE
       RETURNING id`,
      [userId, teamId]
    )

    await publish(
      `notifications:${userId}`,
      JSON.stringify({ type: 'read_all' })
    )

    res.json({
      success: true,
      data: {
        updated: result.rows.length,
      },
    })
  } catch (error) {
    console.error('Mark all read error:', error)
    res.status(500).json({ success: false, error: 'Failed to mark all notifications as read' })
  }
})

export default router
