import postgres from "postgres";

export type Sql = ReturnType<typeof postgres>;

let sql: Sql | null = null;

/**
 * Server-side Postgres client (Supabase). Set DATABASE_URL in Vercel / .env.local.
 * Uses prepare: false for compatibility with Supabase transaction pooler (PgBouncer).
 */
export function getSql(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url?.trim()) {
    throw new Error(
      "DATABASE_URL is not set. Add your Supabase Postgres connection string (pooler URI recommended for serverless).",
    );
  }
  if (!sql) {
    sql = postgres(url, {
      max: 1,
      ssl: "require",
      prepare: false,
    });
  }
  return sql;
}
