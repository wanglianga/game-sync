import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { query } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { notifyTeam } from '../services/notification.js'
import { updateCardStatusAndProgress } from './cards.js'

const router = Router()

router.use(authMiddleware)

const IMAGE_MIMES = ['image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    const uniqueName = `${uuidv4()}${ext}`
    cb(null, uniqueName)
  },
})

const upload = multer({ storage })

router.post('/upload', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id
    const teamId = req.user!.team_id

    if (!req.file) {
      res.status(400).json({ success: false, error: 'File is required' })
      return
    }

    const { cardIds: cardIdsJson, description } = req.body
    let cardIds: string[] = []

    try {
      cardIds = cardIdsJson ? JSON.parse(cardIdsJson) : []
    } catch {
      cardIds = []
    }

    const file = req.file
    const url = `/uploads/${file.filename}`
    const isImage = IMAGE_MIMES.includes(file.mimetype)
    const thumbnailUrl = isImage ? url : null

    const assetResult = await query(
      `INSERT INTO assets (team_id, uploaded_by, filename, original_name, mime_type, size, url, thumbnail_url, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [teamId, userId, file.filename, file.originalname, file.mimetype, file.size, url, thumbnailUrl, description || ''],
    )

    const asset = assetResult.rows[0]

    for (const cardId of cardIds) {
      await query(
        `INSERT INTO card_assets (card_id, asset_id, confirmed) VALUES ($1, $2, false)`,
        [cardId, asset.id],
      )

      await notifyTeam(
        teamId,
        userId,
        'asset_uploaded',
        'New asset uploaded',
        `A new asset "${file.originalname}" was linked to a card`,
        cardId,
      )

      await updateCardStatusAndProgress(cardId, userId)
    }

    asset.card_ids = cardIds

    res.status(201).json({ success: true, data: asset })
  } catch (error) {
    console.error('Upload asset error:', error)
    res.status(500).json({ success: false, error: 'Failed to upload asset' })
  }
})

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const teamId = req.user!.team_id

    const result = await query(
      `SELECT a.*, u.name as uploader_name
       FROM assets a
       JOIN users u ON a.uploaded_by = u.id
       WHERE a.team_id = $1
       ORDER BY a.created_at DESC`,
      [teamId],
    )

    const assets = result.rows

    for (const asset of assets) {
      const cardIdsResult = await query(
        `SELECT card_id FROM card_assets WHERE asset_id = $1`,
        [asset.id],
      )
      asset.card_ids = cardIdsResult.rows.map((r: any) => r.card_id)
    }

    res.json({ success: true, data: assets })
  } catch (error) {
    console.error('List assets error:', error)
    res.status(500).json({ success: false, error: 'Failed to list assets' })
  }
})

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const teamId = req.user!.team_id

    const result = await query(
      `SELECT a.*, u.name as uploader_name
       FROM assets a
       JOIN users u ON a.uploaded_by = u.id
       WHERE a.id = $1 AND a.team_id = $2`,
      [id, teamId],
    )

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Asset not found' })
      return
    }

    const asset = result.rows[0]

    const cardIdsResult = await query(
      `SELECT card_id FROM card_assets WHERE asset_id = $1`,
      [id],
    )
    asset.card_ids = cardIdsResult.rows.map((r: any) => r.card_id)

    res.json({ success: true, data: asset })
  } catch (error) {
    console.error('Get asset error:', error)
    res.status(500).json({ success: false, error: 'Failed to get asset' })
  }
})

router.put('/:id/confirm', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { cardId } = req.body
    const teamId = req.user!.team_id
    const userId = req.user!.id

    if (!cardId) {
      res.status(400).json({ success: false, error: 'cardId is required' })
      return
    }

    const assetResult = await query(
      `SELECT * FROM assets WHERE id = $1 AND team_id = $2`,
      [id, teamId],
    )
    if (assetResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Asset not found' })
      return
    }

    await query(
      `UPDATE card_assets SET confirmed = true WHERE asset_id = $1 AND card_id = $2`,
      [id, cardId],
    )

    await updateCardStatusAndProgress(cardId, userId)

    await notifyTeam(
      teamId,
      userId,
      'asset_uploaded',
      'Asset confirmed',
      `An asset has been confirmed for a card`,
      cardId,
    )

    res.json({ success: true, message: 'Asset confirmed for card' })
  } catch (error) {
    console.error('Confirm asset error:', error)
    res.status(500).json({ success: false, error: 'Failed to confirm asset' })
  }
})

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const userId = req.user!.id
    const teamId = req.user!.team_id
    const userRole = req.user!.role

    const assetResult = await query(
      `SELECT * FROM assets WHERE id = $1 AND team_id = $2`,
      [id, teamId],
    )
    if (assetResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Asset not found' })
      return
    }

    const asset = assetResult.rows[0]

    if (asset.uploaded_by !== userId && userRole !== 'planner') {
      res.status(403).json({ success: false, error: 'Only the uploader or a planner can delete this asset' })
      return
    }

    const linkedCardsResult = await query(
      `SELECT card_id FROM card_assets WHERE asset_id = $1`,
      [id],
    )
    const linkedCardIds = linkedCardsResult.rows.map((r: any) => r.card_id)

    await query(`DELETE FROM card_assets WHERE asset_id = $1`, [id])

    await query(`DELETE FROM assets WHERE id = $1`, [id])

    const filePath = path.join(process.cwd(), 'uploads', asset.filename)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    for (const cardId of linkedCardIds) {
      await updateCardStatusAndProgress(cardId, userId)
    }

    res.json({ success: true, message: 'Asset deleted' })
  } catch (error) {
    console.error('Delete asset error:', error)
    res.status(500).json({ success: false, error: 'Failed to delete asset' })
  }
})

export default router
