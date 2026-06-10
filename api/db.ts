import { Pool, PoolConfig } from 'pg'
import dotenv from 'dotenv'
dotenv.config()

const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/gamesync',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
}

export const pool = new Pool(poolConfig)

export async function query(text: string, params?: unknown[]) {
  const start = Date.now()
  const res = await pool.query(text, params)
  const duration = Date.now() - start
  return res
}

export async function getClient() {
  const client = await pool.connect()
  return client
}
