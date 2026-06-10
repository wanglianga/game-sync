import { query } from './db.js'

export async function runMigrations() {
  try {
    const fs = await import('fs')
    const path = await import('path')
    const { fileURLToPath } = await import('url')

    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const migrationsDir = path.join(__dirname, '../migrations')

    const migTableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = '_migrations'
      )
    `)

    if (!migTableCheck.rows[0].exists) {
      await query(`
        CREATE TABLE IF NOT EXISTS _migrations (
          name VARCHAR(255) PRIMARY KEY,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `)
    }

    const appliedResult = await query('SELECT name FROM _migrations')
    const appliedMigrations = new Set(appliedResult.rows.map((r: any) => r.name))

    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()
    let newMigrations = 0

    for (const file of files) {
      if (appliedMigrations.has(file)) continue

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
      console.log(`  Running migration: ${file}`)
      try {
        await query(sql)
        await query('INSERT INTO _migrations (name) VALUES ($1)', [file])
        newMigrations++
      } catch (sqlError) {
        console.error(`  Error in migration ${file}:`, sqlError)
        throw sqlError
      }
    }

    if (newMigrations > 0) {
      console.log(`Migrations completed: ${newMigrations} applied`)
    } else {
      console.log('Database is up to date')
    }
  } catch (error) {
    console.error('Migration error:', error)
    throw error
  }
}
