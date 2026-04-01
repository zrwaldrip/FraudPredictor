import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

let db: Database.Database | null = null;

/**
 * Resolve path to operational SQLite DB (shop.db at repo root by default).
 * Override with DATABASE_PATH for deployment (e.g. absolute path to a mounted volume).
 */
export function getDbPath(): string {
  if (process.env.DATABASE_PATH) {
    return path.resolve(process.env.DATABASE_PATH);
  }
  return path.join(process.cwd(), "..", "shop.db");
}

function migrate(database: Database.Database) {
  const cols = database
    .prepare(`PRAGMA table_info(shipments)`)
    .all() as { name: string }[];
  if (!cols.some((c) => c.name === "late_delivery_probability")) {
    database.exec(
      `ALTER TABLE shipments ADD COLUMN late_delivery_probability REAL`,
    );
  }
}

export function getDb(): Database.Database {
  if (db) return db;
  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `Database file not found at ${dbPath}. Set DATABASE_PATH or place shop.db next to the project.`,
    );
  }
  const database = new Database(dbPath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  migrate(database);
  db = database;
  return db;
}
