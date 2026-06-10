import { query } from './db.js'

export async function runMigrations() {
  try {
    const result = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'teams'
      )
    `)

    if (!result.rows[0].exists) {
      console.log('Running database migrations...')
      const fs = await import('fs')
      const path = await import('path')
      const { fileURLToPath } = await import('url')

      const __filename = fileURLToPath(import.meta.url)
      const __dirname = path.dirname(__filename)
      const migrationsDir = path.join(__dirname, '../migrations')

      const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()

      for (const file of files) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
        console.log(`  Running: ${file}`)
        await query(sql)
      }

      console.log('Migrations completed')
    } else {
      console.log('Database already initialized')
    }
  } catch (error) {
    console.error('Migration error:', error)
    throw error
  }
}
