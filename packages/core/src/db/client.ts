import { fileURLToPath } from "node:url";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema";

const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url));

export type Db = LibSQLDatabase<typeof schema>;

export interface DbHandle {
  db: Db;
  client: Client;
  close: () => void;
}

/**
 * Opens the local libSQL file (plan.md §4: git-native, `file:./data/app.db`,
 * no hosted DB) and applies any pending migrations. Safe to call every run —
 * migrate() is idempotent and tracks applied migrations in its own table.
 */
export async function openDb(dbPath: string): Promise<DbHandle> {
  const client = createClient({ url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}` });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return { db, client, close: () => client.close() };
}
