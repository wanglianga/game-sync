import { query } from '../db.js'
import { generateAllTeamReports } from './weeklyReport.js'
import { isSunday } from './weeklyReport.js'

let schedulerInterval: NodeJS.Timeout | null = null
let lastRunDate: string | null = null

export function startWeeklyReportScheduler(): void {
  if (schedulerInterval) {
    console.log('[Scheduler] Weekly report scheduler already running')
    return
  }

  console.log('[Scheduler] Weekly report scheduler started (checks every hour)')

  schedulerInterval = setInterval(async () => {
    try {
      await runWeeklyReportJob()
    } catch (error) {
      console.error('[Scheduler] Weekly report job error:', error)
    }
  }, 60 * 60 * 1000)

  void runWeeklyReportJob()
}

export function stopWeeklyReportScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
    console.log('[Scheduler] Weekly report scheduler stopped')
  }
}

async function runWeeklyReportJob(): Promise<void> {
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  if (!isSunday(now)) {
    return
  }

  if (lastRunDate === todayStr) {
    return
  }

  console.log(`[Scheduler] Running weekly report generation at ${now.toISOString()}`)

  const teamsResult = await query('SELECT id FROM teams')
  const teamIds: string[] = teamsResult.rows.map((r: any) => r.id)

  for (const teamId of teamIds) {
    try {
      const reports = await generateAllTeamReports(teamId)
      console.log(`[Scheduler] Generated ${reports.length} weekly reports for team ${teamId}`)
    } catch (teamError) {
      console.error(`[Scheduler] Failed to generate reports for team ${teamId}:`, teamError)
    }
  }

  lastRunDate = todayStr
  console.log(`[Scheduler] Weekly report generation completed at ${new Date().toISOString()}`)
}

export async function triggerWeeklyReportNow(teamId?: string): Promise<{ success: boolean; message: string; teams: number }> {
  console.log(`[Scheduler] Manual weekly report trigger at ${new Date().toISOString()}`)

  let teamIds: string[] = []
  if (teamId) {
    teamIds = [teamId]
  } else {
    const teamsResult = await query('SELECT id FROM teams')
    teamIds = teamsResult.rows.map((r: any) => r.id)
  }

  let successCount = 0
  for (const tid of teamIds) {
    try {
      await generateAllTeamReports(tid)
      successCount++
    } catch (teamError) {
      console.error(`[Scheduler] Manual trigger failed for team ${tid}:`, teamError)
    }
  }

  return {
    success: successCount > 0,
    message: `Generated reports for ${successCount}/${teamIds.length} teams`,
    teams: successCount,
  }
}
