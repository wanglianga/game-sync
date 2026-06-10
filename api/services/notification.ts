import { query } from '../db.js'
import { publish } from '../redis.js'
import type { Notification, NotificationType } from '../../shared/types.js'

interface CreateNotificationParams {
  userId: string
  teamId: string
  type: NotificationType
  title: string
  message: string
  cardId?: string
}

export async function createNotification(
  params: CreateNotificationParams,
): Promise<Notification> {
  const { userId, teamId, type, title, message, cardId } = params

  const result = await query(
    `INSERT INTO notifications (user_id, team_id, type, title, message, card_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, teamId, type, title, message, cardId || null],
  )

  const notification = result.rows[0]

  await publish(
    `notifications:${userId}`,
    JSON.stringify(notification),
  )

  return notification
}

export async function notifyTeam(
  teamId: string,
  excludeUserId: string,
  type: NotificationType,
  title: string,
  message: string,
  cardId?: string,
): Promise<void> {
  const membersResult = await query(
    `SELECT user_id FROM team_members WHERE team_id = $1 AND user_id != $2`,
    [teamId, excludeUserId],
  )

  for (const row of membersResult.rows) {
    await createNotification({
      userId: row.user_id,
      teamId,
      type,
      title,
      message,
      cardId,
    })
  }
}
