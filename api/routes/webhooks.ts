import { Router, type Request, type Response } from 'express'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { query } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { notifyTeam } from '../services/notification.js'
import { updateCardStatusAndProgress } from './cards.js'

const router = Router()

router.post('/config', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { repoUrl } = req.body
    const userId = req.user!.id
    const teamId = req.user!.team_id

    if (!repoUrl) {
      res.status(400).json({ success: false, error: 'repoUrl is required' })
      return
    }

    const secret = uuidv4()

    const result = await query(
      `INSERT INTO webhook_configs (team_id, created_by, repo_url, secret)
       VALUES ($1, $2, $3, $4)
       RETURNING id, team_id, created_by, repo_url, secret, created_at`,
      [teamId, userId, repoUrl, secret],
    )

    res.status(201).json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error('Create webhook config error:', error)
    res.status(500).json({ success: false, error: 'Failed to create webhook config' })
  }
})

router.get('/config', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const teamId = req.user!.team_id

    const result = await query(
      `SELECT id, team_id, created_by, repo_url, created_at FROM webhook_configs WHERE team_id = $1 ORDER BY created_at DESC`,
      [teamId],
    )

    res.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('List webhook configs error:', error)
    res.status(500).json({ success: false, error: 'Failed to list webhook configs' })
  }
})

router.delete('/config/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const teamId = req.user!.team_id

    const result = await query(
      `DELETE FROM webhook_configs WHERE id = $1 AND team_id = $2 RETURNING id`,
      [id, teamId],
    )

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Webhook config not found' })
      return
    }

    res.json({ success: true, message: 'Webhook config deleted' })
  } catch (error) {
    console.error('Delete webhook config error:', error)
    res.status(500).json({ success: false, error: 'Failed to delete webhook config' })
  }
})

router.post('/git/:configId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { configId } = req.params

    const configResult = await query(
      `SELECT * FROM webhook_configs WHERE id = $1`,
      [configId],
    )

    if (configResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Webhook config not found' })
      return
    }

    const config = configResult.rows[0]

    const signature =
      req.headers['x-hub-signature-256'] as string ||
      req.headers['x-gitea-signature'] as string

    if (!signature) {
      res.status(401).json({ success: false, error: 'Missing signature header' })
      return
    }

    const rawBody = (req as any).rawBody || JSON.stringify(req.body)
    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', config.secret)
      .update(rawBody)
      .digest('hex')

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      res.status(401).json({ success: false, error: 'Invalid signature' })
      return
    }

    const payload = req.body
    const commits: any[] = payload.commits || []
    const ref: string = payload.ref || ''
    const linkedCardIds: string[] = []

    const eventResult = await query(
      `INSERT INTO webhook_events (config_id, event_type, payload)
       VALUES ($1, 'push', $2)
       RETURNING id`,
      [configId, JSON.stringify(payload)],
    )

    const eventId = eventResult.rows[0].id

    for (const commit of commits) {
      const message: string = commit.message || ''
      const commitHash: string = commit.id || ''
      const author: string = commit.author?.name || null
      const url: string = commit.url || null
      const timestamp: string = commit.timestamp || new Date().toISOString()

      const cardRefs = extractCardRefs(message)

      const commitResult = await query(
        `INSERT INTO commits (webhook_config_id, commit_hash, message, url, author, ref, committed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [configId, commitHash, message, url, author, ref, timestamp],
      )

      const commitId = commitResult.rows[0].id

      for (const cardId of cardRefs) {
        const cardCheck = await query('SELECT id FROM cards WHERE id = $1', [cardId])
        if (cardCheck.rows.length > 0) {
          await query(
            `INSERT INTO card_commits (card_id, commit_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [cardId, commitId],
          )
          if (!linkedCardIds.includes(cardId)) {
            linkedCardIds.push(cardId)
          }
        }
      }
    }

    if (linkedCardIds.length > 0) {
      await query(
        `UPDATE webhook_events SET payload = payload || $1 WHERE id = $2`,
        [JSON.stringify({ linked_card_ids: linkedCardIds }), eventId],
      )
    }

    for (const cardId of linkedCardIds) {
      await updateCardStatusAndProgress(cardId, config.created_by)
      await notifyTeam(
        config.team_id,
        config.created_by,
        'pr_linked',
        'Commit linked to card',
        `A new commit references card #${cardId}`,
        cardId,
      )
    }

    res.json({ success: true, data: { eventId, linkedCardIds } })
  } catch (error) {
    console.error('Git webhook error:', error)
    res.status(500).json({ success: false, error: 'Failed to process webhook' })
  }
})

router.get('/events', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const teamId = req.user!.team_id

    const result = await query(
      `SELECT we.*, wc.repo_url
       FROM webhook_events we
       JOIN webhook_configs wc ON we.config_id = wc.id
       WHERE wc.team_id = $1
       ORDER BY we.created_at DESC
       LIMIT 50`,
      [teamId],
    )

    res.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('List webhook events error:', error)
    res.status(500).json({ success: false, error: 'Failed to list webhook events' })
  }
})

function extractCardRefs(message: string): string[] {
  const refs: string[] = []
  const patterns = [
    /(?:closes|fixes|references?)\s*#([a-f0-9-]+)/gi,
    /#([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/gi,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(message)) !== null) {
      if (!refs.includes(match[1])) {
        refs.push(match[1])
      }
    }
  }

  return refs
}

export default router
