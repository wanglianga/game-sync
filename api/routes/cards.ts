import { Router, type Request, type Response } from 'express'
import { authMiddleware, roleMiddleware } from '../middleware/auth.js'
import { query } from '../db.js'
import { createNotification } from '../services/notification.js'
import type { NotificationType, UserRole } from '../../shared/types.js'

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

const STATUS_ORDER: Record<string, number> = {
  requirement: 0,
  development: 1,
  review: 2,
  done: 3,
}

export async function calculateCardProgress(cardId: string): Promise<number> {
  let progress = 0

  const docResult = await query(
    'SELECT content FROM requirement_docs WHERE card_id = $1 ORDER BY version DESC LIMIT 1',
    [cardId]
  )
  if (docResult.rows.length > 0 && docResult.rows[0].content.length > 0) {
    progress += 20
  }

  const assetResult = await query(
    'SELECT COUNT(*) AS cnt FROM card_assets WHERE card_id = $1 AND confirmed = true',
    [cardId]
  )
  if (Number(assetResult.rows[0].cnt) > 0) {
    progress += 30
  }

  const commitResult = await query(
    'SELECT COUNT(*) AS cnt FROM card_commits WHERE card_id = $1',
    [cardId]
  )
  if (Number(commitResult.rows[0].cnt) > 0) {
    progress += 30
  }

  const commentResult = await query(
    "SELECT COUNT(*) AS cnt FROM comments WHERE card_id = $1 AND status IN ('open', 'pending_confirm')",
    [cardId]
  )
  if (Number(commentResult.rows[0].cnt) === 0) {
    progress += 20
  }

  return progress
}

async function updateCardStatusAndProgress(cardId: string, userId: string): Promise<void> {
  const progress = await calculateCardProgress(cardId)

  let newStatus: string
  if (progress === 100) newStatus = 'done'
  else if (progress >= 70) newStatus = 'review'
  else if (progress >= 30) newStatus = 'development'
  else newStatus = 'requirement'

  const cardResult = await query('SELECT status FROM cards WHERE id = $1', [cardId])
  const currentStatus = cardResult.rows[0]?.status

  if (currentStatus && STATUS_ORDER[newStatus] > STATUS_ORDER[currentStatus]) {
    await query(
      'UPDATE cards SET progress = $1, status = $2, updated_at = NOW() WHERE id = $3',
      [progress, newStatus, cardId]
    )
    await query(
      'INSERT INTO status_history (card_id, from_status, to_status, triggered_by) VALUES ($1, $2, $3, $4)',
      [cardId, currentStatus, newStatus, userId]
    )
  } else {
    await query(
      'UPDATE cards SET progress = $1, updated_at = NOW() WHERE id = $2',
      [progress, cardId]
    )
  }
}

async function notifyTeamMembers(
  teamId: string,
  excludeUserId: string,
  type: NotificationType,
  title: string,
  message: string,
  cardId: string
): Promise<void> {
  const members = await query(
    'SELECT user_id FROM team_members WHERE team_id = $1 AND user_id != $2',
    [teamId, excludeUserId]
  )
  for (const member of members.rows) {
    await createNotification({
      userId: member.user_id,
      teamId,
      type,
      title,
      message,
      cardId,
    })
  }
}

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, priority } = req.query
    const teamId = req.user!.team_id

    let sql = `
      SELECT c.*, u.name AS creator_name,
        (SELECT COUNT(*) FROM card_assets WHERE card_id = c.id) AS asset_count,
        (SELECT COUNT(*) FROM card_commits WHERE card_id = c.id) AS commit_count,
        (SELECT COUNT(*) FROM comments WHERE card_id = c.id AND status IN ('open', 'pending_confirm')) AS pending_review_count
      FROM cards c
      JOIN users u ON c.creator_id = u.id
      WHERE c.team_id = $1
    `
    const params: unknown[] = [teamId]
    let paramIndex = 2

    if (status) {
      sql += ` AND c.status = $${paramIndex++}`
      params.push(status)
    }
    if (priority) {
      sql += ` AND c.priority = $${paramIndex++}`
      params.push(priority)
    }

    sql += ' ORDER BY c.updated_at DESC'

    const result = await query(sql, params)

    const cardIds = result.rows.map((r: any) => r.id)
    const assigneeMap: Record<string, any[]> = {}

    if (cardIds.length > 0) {
      const assigneeResult = await query(
        `SELECT ca.card_id, u.id, u.name, u.role
         FROM card_assignees ca
         JOIN users u ON ca.user_id = u.id
         WHERE ca.card_id = ANY($1)`,
        [cardIds]
      )
      for (const row of assigneeResult.rows) {
        if (!assigneeMap[row.card_id]) assigneeMap[row.card_id] = []
        assigneeMap[row.card_id].push({ id: row.id, name: row.name, role: row.role })
      }
    }

    const cards = result.rows.map((row: any) => ({
      ...row,
      asset_count: Number(row.asset_count),
      commit_count: Number(row.commit_count),
      pending_review_count: Number(row.pending_review_count),
      assignees: assigneeMap[row.id] || [],
    }))

    res.json({ success: true, data: cards })
  } catch (error) {
    console.error('List cards error:', error)
    res.status(500).json({ success: false, error: 'Failed to list cards' })
  }
})

router.post('/', roleMiddleware('planner'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, priority } = req.body
    const teamId = req.user!.team_id
    const creatorId = req.user!.id

    if (!title) {
      res.status(400).json({ success: false, error: 'Title is required' })
      return
    }

    const result = await query(
      `INSERT INTO cards (team_id, creator_id, title, description, priority, status, progress)
       VALUES ($1, $2, $3, $4, $5, 'requirement', 0) RETURNING *`,
      [teamId, creatorId, title, description || '', priority || 'medium']
    )

    const card = result.rows[0]

    await query(
      `INSERT INTO requirement_docs (card_id, content, version, updated_by) VALUES ($1, '', 1, $2)`,
      [card.id, creatorId]
    )

    await query(
      `INSERT INTO card_assignees (card_id, user_id) VALUES ($1, $2)`,
      [card.id, creatorId]
    )

    await updateCardStatusAndProgress(card.id, creatorId)

    const updatedResult = await query('SELECT * FROM cards WHERE id = $1', [card.id])

    await notifyTeamMembers(
      teamId,
      creatorId,
      'card_status_changed',
      'New card created',
      `Card "${title}" has been created`,
      card.id
    )

    res.status(201).json({ success: true, data: updatedResult.rows[0] })
  } catch (error) {
    console.error('Create card error:', error)
    res.status(500).json({ success: false, error: 'Failed to create card' })
  }
})

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const teamId = req.user!.team_id

    const cardResult = await query(
      `SELECT c.*, u.name AS creator_name
       FROM cards c JOIN users u ON c.creator_id = u.id
       WHERE c.id = $1 AND c.team_id = $2`,
      [id, teamId]
    )

    if (cardResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Card not found' })
      return
    }

    const card = cardResult.rows[0]

    const [assigneeResult, docResult, assetResult, commitResult, commentResult, historyResult] =
      await Promise.all([
        query(
          `SELECT u.id, u.name, u.role FROM card_assignees ca JOIN users u ON ca.user_id = u.id WHERE ca.card_id = $1`,
          [id]
        ),
        query(
          `SELECT rd.*, u.name AS updated_by_name FROM requirement_docs rd JOIN users u ON rd.updated_by = u.id WHERE rd.card_id = $1 ORDER BY rd.version DESC LIMIT 1`,
          [id]
        ),
        query(
          `SELECT ca.confirmed, a.* FROM card_assets ca JOIN assets a ON ca.asset_id = a.id WHERE ca.card_id = $1`,
          [id]
        ),
        query(
          `SELECT cc.id AS card_commit_id, c.id, c.commit_hash, c.message, c.url, c.author, c.ref, c.committed_at
           FROM card_commits cc JOIN commits c ON cc.commit_id = c.id WHERE cc.card_id = $1 ORDER BY c.committed_at DESC`,
          [id]
        ),
        query(
          `SELECT cm.*, u.name AS author_name, u.role AS author_role FROM comments cm JOIN users u ON cm.author_id = u.id WHERE cm.card_id = $1 ORDER BY cm.created_at ASC`,
          [id]
        ),
        query(
          `SELECT sh.*, u.name AS triggered_by_name FROM status_history sh JOIN users u ON sh.triggered_by = u.id WHERE sh.card_id = $1 ORDER BY sh.created_at DESC`,
          [id]
        ),
      ])

    card.assignees = assigneeResult.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      role: r.role,
    }))

    card.requirement_doc = docResult.rows[0] || null

    card.assets = assetResult.rows.map((r: any) => ({
      id: r.id,
      team_id: r.team_id,
      uploaded_by: r.uploaded_by,
      filename: r.filename,
      original_name: r.original_name,
      mime_type: r.mime_type,
      size: r.size,
      url: r.url,
      thumbnail_url: r.thumbnail_url,
      version: r.version,
      status: r.status,
      description: r.description,
      created_at: r.created_at,
      confirmed: r.confirmed,
    }))

    card.commits = commitResult.rows.map((r: any) => ({
      id: r.id,
      commit_hash: r.commit_hash,
      message: r.message,
      url: r.url,
      author: r.author,
      ref: r.ref,
      committed_at: r.committed_at,
    }))

    const commentMap: Record<string, any> = {}
    const rootComments: any[] = []
    for (const c of commentResult.rows) {
      commentMap[c.id] = { ...c, replies: [] }
    }
    for (const c of commentResult.rows) {
      if (c.parent_id && commentMap[c.parent_id]) {
        commentMap[c.parent_id].replies.push(commentMap[c.id])
      } else {
        rootComments.push(commentMap[c.id])
      }
    }
    card.comments = rootComments
    card.status_history = historyResult.rows

    res.json({ success: true, data: card })
  } catch (error) {
    console.error('Get card error:', error)
    res.status(500).json({ success: false, error: 'Failed to get card' })
  }
})

router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const userId = req.user!.id
    const teamId = req.user!.team_id
    const userRole = req.user!.role

    const cardResult = await query('SELECT * FROM cards WHERE id = $1 AND team_id = $2', [id, teamId])
    if (cardResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Card not found' })
      return
    }

    const card = cardResult.rows[0]
    if (card.creator_id !== userId && userRole !== 'planner') {
      res.status(403).json({ success: false, error: 'Only creator or planner can update' })
      return
    }

    const { title, description, priority } = req.body
    const updates: string[] = []
    const params: unknown[] = []
    let paramIndex = 1

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`)
      params.push(title)
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      params.push(description)
    }
    if (priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`)
      params.push(priority)
    }

    if (updates.length === 0) {
      res.status(400).json({ success: false, error: 'No fields to update' })
      return
    }

    updates.push('updated_at = NOW()')
    params.push(id)

    await query(
      `UPDATE cards SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      params
    )

    await updateCardStatusAndProgress(id, userId)

    const updatedResult = await query('SELECT * FROM cards WHERE id = $1', [id])

    await notifyTeamMembers(
      teamId,
      userId,
      'card_status_changed',
      'Card updated',
      `Card "${updatedResult.rows[0].title}" has been updated`,
      id
    )

    res.json({ success: true, data: updatedResult.rows[0] })
  } catch (error) {
    console.error('Update card error:', error)
    res.status(500).json({ success: false, error: 'Failed to update card' })
  }
})

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const userId = req.user!.id
    const teamId = req.user!.team_id
    const userRole = req.user!.role

    const cardResult = await query('SELECT * FROM cards WHERE id = $1 AND team_id = $2', [id, teamId])
    if (cardResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Card not found' })
      return
    }

    const card = cardResult.rows[0]
    if (card.creator_id !== userId && userRole !== 'planner') {
      res.status(403).json({ success: false, error: 'Only creator or planner can delete' })
      return
    }

    const cardTitle = card.title
    await query('DELETE FROM cards WHERE id = $1', [id])

    await notifyTeamMembers(
      teamId,
      userId,
      'card_status_changed',
      'Card deleted',
      `Card "${cardTitle}" has been deleted`,
      id
    )

    res.json({ success: true, message: 'Card deleted' })
  } catch (error) {
    console.error('Delete card error:', error)
    res.status(500).json({ success: false, error: 'Failed to delete card' })
  }
})

router.put('/:id/requirement', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const userId = req.user!.id
    const teamId = req.user!.team_id
    const { content } = req.body

    const cardResult = await query('SELECT * FROM cards WHERE id = $1 AND team_id = $2', [id, teamId])
    if (cardResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Card not found' })
      return
    }

    const currentDoc = await query(
      'SELECT version FROM requirement_docs WHERE card_id = $1 ORDER BY version DESC LIMIT 1',
      [id]
    )
    const newVersion = currentDoc.rows.length > 0 ? currentDoc.rows[0].version + 1 : 1

    const docResult = await query(
      `INSERT INTO requirement_docs (card_id, content, version, updated_by) VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, content || '', newVersion, userId]
    )

    await updateCardStatusAndProgress(id, userId)

    await notifyTeamMembers(
      teamId,
      userId,
      'card_status_changed',
      'Requirement updated',
      `Requirement for card "${cardResult.rows[0].title}" has been updated`,
      id
    )

    res.json({ success: true, data: docResult.rows[0] })
  } catch (error) {
    console.error('Update requirement error:', error)
    res.status(500).json({ success: false, error: 'Failed to update requirement' })
  }
})

router.get('/:id/requirement/versions', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const teamId = req.user!.team_id

    const cardResult = await query('SELECT id FROM cards WHERE id = $1 AND team_id = $2', [id, teamId])
    if (cardResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Card not found' })
      return
    }

    const versions = await query(
      `SELECT rd.*, u.name AS updated_by_name
       FROM requirement_docs rd JOIN users u ON rd.updated_by = u.id
       WHERE rd.card_id = $1 ORDER BY rd.version DESC`,
      [id]
    )

    res.json({ success: true, data: versions.rows })
  } catch (error) {
    console.error('List requirement versions error:', error)
    res.status(500).json({ success: false, error: 'Failed to list requirement versions' })
  }
})

router.post('/:id/assignees', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { userId: assigneeUserId } = req.body
    const teamId = req.user!.team_id
    const userId = req.user!.id

    const cardResult = await query('SELECT * FROM cards WHERE id = $1 AND team_id = $2', [id, teamId])
    if (cardResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Card not found' })
      return
    }

    await query(
      'INSERT INTO card_assignees (card_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [id, assigneeUserId]
    )

    const assignee = await query('SELECT id, name, role FROM users WHERE id = $1', [assigneeUserId])

    await notifyTeamMembers(
      teamId,
      userId,
      'card_status_changed',
      'Assignee added',
      `A new assignee was added to card "${cardResult.rows[0].title}"`,
      id
    )

    res.status(201).json({ success: true, data: assignee.rows[0] })
  } catch (error) {
    console.error('Add assignee error:', error)
    res.status(500).json({ success: false, error: 'Failed to add assignee' })
  }
})

router.delete('/:id/assignees/:userId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, userId: assigneeUserId } = req.params
    const teamId = req.user!.team_id
    const userId = req.user!.id

    const cardResult = await query('SELECT * FROM cards WHERE id = $1 AND team_id = $2', [id, teamId])
    if (cardResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Card not found' })
      return
    }

    await query('DELETE FROM card_assignees WHERE card_id = $1 AND user_id = $2', [id, assigneeUserId])

    await notifyTeamMembers(
      teamId,
      userId,
      'card_status_changed',
      'Assignee removed',
      `An assignee was removed from card "${cardResult.rows[0].title}"`,
      id
    )

    res.json({ success: true, message: 'Assignee removed' })
  } catch (error) {
    console.error('Remove assignee error:', error)
    res.status(500).json({ success: false, error: 'Failed to remove assignee' })
  }
})

export default router
