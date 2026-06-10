import { Router, type Request, type Response } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { query } from '../db.js'
import {
  generateWeeklyReport,
  saveWeeklyReport,
  getLatestWeeklyReport,
  getAllTeamWeeklyReports,
  generateMarkdownReport,
  generateAllTeamReports,
  getWeekRange,
} from '../services/weeklyReport.js'
import type { UserRole } from '../../shared/types.js'

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

router.get('/weekly/me', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teamId = req.user!.team_id
    const userId = req.user!.id

    const report = await getLatestWeeklyReport(teamId, userId)

    if (!report) {
      res.status(404).json({ success: false, error: 'No weekly report found, please generate one first' })
      return
    }

    res.json({ success: true, data: report })
  } catch (error) {
    console.error('Get my weekly report error:', error)
    res.status(500).json({ success: false, error: 'Failed to get weekly report' })
  }
})

router.get('/weekly/team', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teamId = req.user!.team_id
    const { weekStart, weekEnd } = req.query

    const reports = await getAllTeamWeeklyReports(
      teamId,
      weekStart ? String(weekStart) : undefined,
      weekEnd ? String(weekEnd) : undefined
    )

    res.json({ success: true, data: reports })
  } catch (error) {
    console.error('Get team weekly reports error:', error)
    res.status(500).json({ success: false, error: 'Failed to get team weekly reports' })
  }
})

router.post('/weekly/generate', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teamId = req.user!.team_id
    const userId = req.user!.id
    const role = req.user!.role
    const { weekStart, weekEnd } = req.body

    let ws: Date | undefined
    let we: Date | undefined
    if (weekStart && weekEnd) {
      ws = new Date(weekStart)
      we = new Date(weekEnd)
    } else {
      const range = getWeekRange(new Date())
      ws = range.start
      we = range.end
    }

    const snapshot = await generateWeeklyReport(teamId, userId, role, ws, we)
    const saved = await saveWeeklyReport(teamId, userId, role, snapshot)

    res.json({
      success: true,
      message: 'Weekly report generated successfully',
      data: saved,
    })
  } catch (error) {
    console.error('Generate weekly report error:', error)
    res.status(500).json({ success: false, error: 'Failed to generate weekly report' })
  }
})

router.post('/weekly/generate-all', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teamId = req.user!.team_id
    const userRole = req.user!.role

    if (userRole !== 'planner') {
      res.status(403).json({ success: false, error: 'Only planners can generate all team reports' })
      return
    }

    const { weekStart, weekEnd } = req.body
    let ws: Date | undefined
    let we: Date | undefined
    if (weekStart && weekEnd) {
      ws = new Date(weekStart)
      we = new Date(weekEnd)
    }

    const reports = await generateAllTeamReports(teamId, ws, we)

    res.json({
      success: true,
      message: `Generated ${reports.length} weekly reports for team`,
      data: reports,
    })
  } catch (error) {
    console.error('Generate all team reports error:', error)
    res.status(500).json({ success: false, error: 'Failed to generate team reports' })
  }
})

router.get('/weekly/:id/export', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const teamId = req.user!.team_id

    const result = await query(
      `SELECT wr.*, u.name as user_name FROM weekly_reports wr
       JOIN users u ON wr.user_id = u.id
       WHERE wr.id = $1 AND wr.team_id = $2`,
      [id, teamId]
    )

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Weekly report not found' })
      return
    }

    const report = result.rows[0]
    const markdown = generateMarkdownReport(report.role, report.snapshot, report.user_name)

    const fileName = `weekly-report-${report.role}-${report.week_start}-${report.week_end}.md`

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.send(markdown)
  } catch (error) {
    console.error('Export weekly report error:', error)
    res.status(500).json({ success: false, error: 'Failed to export weekly report' })
  }
})

router.get('/weekly/:id/preview', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const teamId = req.user!.team_id

    const result = await query(
      `SELECT wr.*, u.name as user_name FROM weekly_reports wr
       JOIN users u ON wr.user_id = u.id
       WHERE wr.id = $1 AND wr.team_id = $2`,
      [id, teamId]
    )

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Weekly report not found' })
      return
    }

    const report = result.rows[0]
    const markdown = generateMarkdownReport(report.role, report.snapshot, report.user_name)

    res.json({
      success: true,
      data: {
        id: report.id,
        role: report.role,
        user_name: report.user_name,
        week_start: report.week_start,
        week_end: report.week_end,
        markdown,
      },
    })
  } catch (error) {
    console.error('Preview weekly report error:', error)
    res.status(500).json({ success: false, error: 'Failed to preview weekly report' })
  }
})

export default router
