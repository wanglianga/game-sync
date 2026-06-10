import { Router, type Request, type Response } from 'express'
import { query } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { createNotification, notifyTeam } from '../services/notification.js'

const router = Router()

router.use(authMiddleware)

router.post('/:cardId/comments', async (req: Request, res: Response): Promise<void> => {
  try {
    const { cardId } = req.params
    const { content, parentCommentId } = req.body
    const userId = (req as any).user.userId
    const teamId = (req as any).user.teamId

    if (!content) {
      res.status(400).json({ success: false, error: 'Content is required' })
      return
    }

    const cardResult = await query('SELECT * FROM cards WHERE id = $1', [cardId])
    if (cardResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Card not found' })
      return
    }

    const result = await query(
      `INSERT INTO comments (card_id, author_id, parent_id, content, status)
       VALUES ($1, $2, $3, $4, 'open')
       RETURNING *`,
      [cardId, userId, parentCommentId || null, content],
    )

    const comment = result.rows[0]

    const assigneesResult = await query(
      `SELECT user_id FROM card_assignees WHERE card_id = $1 AND user_id != $2`,
      [cardId, userId],
    )
    for (const row of assigneesResult.rows) {
      await createNotification({
        userId: row.user_id,
        teamId,
        type: 'comment_added',
        title: 'New comment',
        message: `A new comment was added to card "${cardResult.rows[0].title}"`,
        cardId,
      })
    }

    const authorResult = await query(
      'SELECT name, role FROM users WHERE id = $1',
      [userId],
    )
    comment.author_name = authorResult.rows[0]?.name
    comment.author_role = authorResult.rows[0]?.role

    res.status(201).json({ success: true, data: comment })
  } catch (error) {
    console.error('Create comment error:', error)
    res.status(500).json({ success: false, error: 'Failed to create comment' })
  }
})

router.get('/:cardId/comments', async (req: Request, res: Response): Promise<void> => {
  try {
    const { cardId } = req.params

    const result = await query(
      `SELECT c.*, u.name as author_name, u.role as author_role
       FROM comments c
       JOIN users u ON c.author_id = u.id
       WHERE c.card_id = $1
       ORDER BY c.created_at ASC`,
      [cardId],
    )

    const commentMap = new Map()
    const roots: any[] = []

    for (const row of result.rows) {
      const comment = { ...row, replies: [] }
      commentMap.set(comment.id, comment)

      if (comment.parent_id) {
        const parent = commentMap.get(comment.parent_id)
        if (parent) {
          parent.replies.push(comment)
        } else {
          roots.push(comment)
        }
      } else {
        roots.push(comment)
      }
    }

    res.json({ success: true, data: roots })
  } catch (error) {
    console.error('List comments error:', error)
    res.status(500).json({ success: false, error: 'Failed to list comments' })
  }
})

router.put('/comments/:id/reply', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { content } = req.body
    const userId = (req as any).user.userId
    const teamId = (req as any).user.teamId

    if (!content) {
      res.status(400).json({ success: false, error: 'Content is required' })
      return
    }

    const parentResult = await query('SELECT * FROM comments WHERE id = $1', [id])
    if (parentResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Parent comment not found' })
      return
    }

    const parent = parentResult.rows[0]

    const replyResult = await query(
      `INSERT INTO comments (card_id, author_id, parent_id, content, status)
       VALUES ($1, $2, $3, $4, 'open')
       RETURNING *`,
      [parent.card_id, userId, id, content],
    )

    if (parent.status === 'open') {
      await query(
        `UPDATE comments SET status = 'pending_confirm', updated_at = NOW() WHERE id = $1`,
        [id],
      )
    }

    if (parent.author_id !== userId) {
      await createNotification({
        userId: parent.author_id,
        teamId,
        type: 'comment_added',
        title: 'Reply to your comment',
        message: `Someone replied to your comment`,
        cardId: parent.card_id,
      })
    }

    const authorResult = await query(
      'SELECT name, role FROM users WHERE id = $1',
      [userId],
    )
    const reply = replyResult.rows[0]
    reply.author_name = authorResult.rows[0]?.name
    reply.author_role = authorResult.rows[0]?.role

    res.json({ success: true, data: reply })
  } catch (error) {
    console.error('Reply comment error:', error)
    res.status(500).json({ success: false, error: 'Failed to reply to comment' })
  }
})

router.put('/comments/:id/confirm', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const userId = (req as any).user.userId
    const teamId = (req as any).user.teamId
    const userRole = (req as any).user.role

    if (userRole !== 'planner') {
      res.status(403).json({ success: false, error: 'Only planners can confirm comments' })
      return
    }

    const commentResult = await query('SELECT * FROM comments WHERE id = $1', [id])
    if (commentResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Comment not found' })
      return
    }

    const comment = commentResult.rows[0]

    const result = await query(
      `UPDATE comments SET status = 'closed', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    )

    if (comment.author_id !== userId) {
      await createNotification({
        userId: comment.author_id,
        teamId,
        type: 'comment_confirmed',
        title: 'Comment confirmed',
        message: 'Your comment has been confirmed and closed',
        cardId: comment.card_id,
      })
    }

    res.json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error('Confirm comment error:', error)
    res.status(500).json({ success: false, error: 'Failed to confirm comment' })
  }
})

router.get('/pending', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId

    const result = await query(
      `SELECT c.*, u.name as author_name, u.role as author_role,
              cards.title as card_title
       FROM comments c
       JOIN users u ON c.author_id = u.id
       JOIN cards ON c.card_id = cards.id
       JOIN card_assignees ca ON ca.card_id = c.card_id
       WHERE ca.user_id = $1
         AND c.status IN ('open', 'pending_confirm')
       ORDER BY c.updated_at DESC`,
      [userId],
    )

    res.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('Get pending comments error:', error)
    res.status(500).json({ success: false, error: 'Failed to get pending comments' })
  }
})

export default router
