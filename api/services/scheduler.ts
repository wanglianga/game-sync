import { query } from '../db.js'
import { publish } from '../redis.js'
import { generateAllTeamReports } from './weeklyReport.js'
import { isSunday } from './weeklyReport.js'
import type { Notification } from '../../shared/types.js'

let schedulerInterval: NodeJS.Timeout | null = null
let lastRunDate: string | null = null
let overdueCheckInterval: NodeJS.Timeout | null = null

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

export function startOverdueNotificationScheduler(): void {
  if (overdueCheckInterval) {
    console.log('[Scheduler] Overdue notification scheduler already running')
    return
  }

  console.log('[Scheduler] Overdue notification scheduler started (checks every 15 minutes)')

  overdueCheckInterval = setInterval(async () => {
    try {
      await runOverdueNotificationJob()
    } catch (error) {
      console.error('[Scheduler] Overdue notification job error:', error)
    }
  }, 15 * 60 * 1000)

  void runOverdueNotificationJob()
}

export function stopOverdueNotificationScheduler(): void {
  if (overdueCheckInterval) {
    clearInterval(overdueCheckInterval)
    overdueCheckInterval = null
    console.log('[Scheduler] Overdue notification scheduler stopped')
  }
}

async function runOverdueNotificationJob(): Promise<void> {
  console.log('[Scheduler] Checking for overdue notifications...')

  const result = await query(
    `SELECT n.* 
     FROM notifications n
     WHERE n.read = FALSE 
       AND n.notified_overdue = FALSE
       AND n.created_at < NOW() - INTERVAL '48 hours'`
  )

  const overdueNotifications = result.rows as Notification[]

  if (overdueNotifications.length === 0) {
    return
  }

  console.log(`[Scheduler] Found ${overdueNotifications.length} overdue notifications`)

  for (const notification of overdueNotifications) {
    try {
      await query(
        `UPDATE notifications SET notified_overdue = TRUE WHERE id = $1`,
        [notification.id]
      )

      const reminderNotification = await query(
        `INSERT INTO notifications (user_id, team_id, type, title, message, card_id)
         VALUES ($1, $2, 'overdue_reminder', $3, $4, $5)
         RETURNING *`,
        [
          notification.user_id,
          notification.team_id,
          '漏掉预警：消息未读超过48小时',
          `您有一条消息已超过48小时未读：${notification.title}`,
          notification.card_id,
        ]
      )

      await publish(
        `notifications:${notification.user_id}`,
        JSON.stringify(reminderNotification.rows[0])
      )

      await publish(
        `notifications:${notification.user_id}`,
        JSON.stringify({ type: 'overdue', id: notification.id })
      )
    } catch (err) {
      console.error(`[Scheduler] Failed to process overdue notification ${notification.id}:`, err)
    }
  }

  console.log(`[Scheduler] Processed ${overdueNotifications.length} overdue notifications`)
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
