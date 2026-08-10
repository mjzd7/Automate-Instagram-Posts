import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import type { Db, DbHandle } from "./client";

/**
 * Read-only variant of openDb() for consumers that only ever query
 * data/app.db (apps/web's dashboard) -- deliberately does NOT call
 * migrate() and does NOT reference the migrations folder at all. Kept in
 * its own module (not just a second export in client.ts) because
 * client.ts's `fileURLToPath(new URL("./migrations", import.meta.url))`
 * is a *static* asset reference Next.js's Turbopack bundler tries to
 * resolve for every file that imports anything from that module, even if
 * the migrating openDb() is never actually called -- keeping this import
 * graph entirely separate avoids that failure for a real bundler consumer.
 */
export function openReadOnlyDb(dbPath: string): DbHandle {
  const client: Client = createClient({ url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}` });
  const db: Db = drizzle(client, { schema });
  return { db, client, close: () => client.close() };
}
