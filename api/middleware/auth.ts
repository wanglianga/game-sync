import { type Request, type Response, type NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { query } from '../db.js'
import type { UserRole } from '../../shared/types.js'

const JWT_SECRET = process.env.JWT_SECRET || 'gamesync-dev-secret'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
  team_id: string | null
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const token = authHeader.substring(7)

  try {
    const payload = jwt.verify(token, JWT_SECRET) as Omit<AuthUser, 'team_id'>

    const teamResult = await query(
      'SELECT team_id FROM team_members WHERE user_id = $1 LIMIT 1',
      [payload.id]
    )
    const team_id = teamResult.rows.length > 0 ? teamResult.rows[0].team_id : null

    req.user = { ...payload, team_id }
    next()
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' })
  }
}

export function roleMiddleware(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' })
      return
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' })
      return
    }

    next()
  }
}
