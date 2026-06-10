import { createClient } from 'redis'
import dotenv from 'dotenv'
dotenv.config()

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

export const redisClient = createClient({ url: redisUrl })

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err)
})

let isConnected = false

export async function connectRedis() {
  if (!isConnected) {
    await redisClient.connect()
    isConnected = true
    console.log('Redis connected')
  }
}

export async function disconnectRedis() {
  if (isConnected) {
    await redisClient.quit()
    isConnected = false
  }
}

export async function publish(channel: string, message: string) {
  if (isConnected) {
    await redisClient.publish(channel, message)
  }
}

export async function setCache(key: string, value: string, expireSeconds?: number) {
  if (isConnected) {
    if (expireSeconds) {
      await redisClient.setEx(key, expireSeconds, value)
    } else {
      await redisClient.set(key, value)
    }
  }
}

export async function getCache(key: string): Promise<string | null> {
  if (isConnected) {
    const result: string | null | Record<string, unknown> = await redisClient.get(key) as string | null
    return typeof result === 'string' ? result : null
  }
  return null
}

export async function delCache(key: string) {
  if (isConnected) {
    await redisClient.del(key)
  }
}
