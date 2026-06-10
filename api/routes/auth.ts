import { Router, type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import type { UserRole } from '../../shared/types.js'

const router = Router()

const JWT_SECRET = process.env.JWT_SECRET || 'gamesync-dev-secret'

function signToken(payload: { id: string; email: string; name: string; role: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { email, password, name, role, inviteCode } = req.body

  if (!email || !password || !name || !role || !inviteCode) {
    res.status(400).json({ success: false, error: 'Missing required fields: email, password, name, role, inviteCode' })
    return
  }

  const validRoles: UserRole[] = ['planner', 'programmer', 'artist']
  if (!validRoles.includes(role)) {
    res.status(400).json({ success: false, error: 'Invalid role. Must be planner, programmer, or artist' })
    return
  }

  try {
    const existing = await query('SELECT id FROM users WHERE email = $1', [email])
    if (existing.rows.length > 0) {
      res.status(409).json({ success: false, error: 'Email already registered' })
      return
    }

    const teamResult = await query('SELECT id, name FROM teams WHERE invite_code = $1', [inviteCode])
    if (teamResult.rows.length === 0) {
      res.status(400).json({ success: false, error: 'Invalid invite code' })
      return
    }

    const team = teamResult.rows[0]
    const passwordHash = await bcrypt.hash(password, 10)

    const userResult = await query(
      'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role',
      [email, passwordHash, name, role]
    )

    const user = userResult.rows[0]

    await query(
      'INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)',
      [team.id, user.id]
    )

    const token = signToken({ id: user.id, email: user.email, name: user.name, role: user.role })

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          team_id: team.id,
        },
      },
    })
  } catch (err) {
    console.error('Register error:', err)
    res.status(500).json({ success: false, error: 'Registration failed' })
  }
})

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body

  if (!email || !password) {
    res.status(400).json({ success: false, error: 'Missing required fields: email, password' })
    return
  }

  try {
    const userResult = await query(
      'SELECT id, email, password_hash, name, role FROM users WHERE email = $1',
      [email]
    )

    if (userResult.rows.length === 0) {
      res.status(401).json({ success: false, error: 'Invalid email or password' })
      return
    }

    const user = userResult.rows[0]
    const valid = await bcrypt.compare(password, user.password_hash)

    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid email or password' })
      return
    }

    const teamResult = await query(
      'SELECT team_id FROM team_members WHERE user_id = $1 LIMIT 1',
      [user.id]
    )

    const teamId = teamResult.rows.length > 0 ? teamResult.rows[0].team_id : null

    const token = signToken({ id: user.id, email: user.email, name: user.name, role: user.role })

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          team_id: teamId,
        },
      },
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ success: false, error: 'Login failed' })
  }
})

router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userResult = await query(
      'SELECT id, email, name, role, avatar_url, created_at FROM users WHERE id = $1',
      [req.user!.id]
    )

    if (userResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'User not found' })
      return
    }

    const user = userResult.rows[0]

    const teamResult = await query(
      'SELECT team_id FROM team_members WHERE user_id = $1 LIMIT 1',
      [user.id]
    )

    const teamId = teamResult.rows.length > 0 ? teamResult.rows[0].team_id : null

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar_url: user.avatar_url,
        team_id: teamId,
        created_at: user.created_at,
      },
    })
  } catch (err) {
    console.error('Get user error:', err)
    res.status(500).json({ success: false, error: 'Failed to get user info' })
  }
})

export default router
