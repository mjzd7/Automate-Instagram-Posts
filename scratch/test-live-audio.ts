import { openDb } from "../packages/core/src/db/client.js";
import { getToken } from "../packages/core/src/db/repositories/ig-token.repo.js";
import { findAccountRow } from "../packages/core/src/db/repositories/accounts.repo.js";
import { decryptToken } from "../packages/core/src/crypto/token-encryption.js";
import { searchMetaAudioTracks } from "../packages/core/src/audio/meta-audio-client.js";
import path from "node:path";

async function run() {
  const dbPath = path.resolve(process.cwd(), "data/app.db");
  const { db, close } = await openDb(dbPath);
  
  try {
    const account = await findAccountRow(db, "main");
    if (!account || !account.igUserId) {
      console.error("Account not found or has no igUserId");
      return;
    }
    
    const tokenRow = await getToken(db, account.id);
    if (!tokenRow) {
      console.error(`No token found for account '${account.id}'`);
      return;
    }

    const key = process.env.ENCRYPTION_KEY || process.env.META_APP_SECRET || "0d4b2758b548a873d868ed69f42cc80b";
    const accessToken = decryptToken(tokenRow.accessTokenEncrypted, key);
    
    console.log(`Testing Meta Audio API for account ${account.id} (igUserId: ${account.igUserId})...`);
    const tracks = await searchMetaAudioTracks({
      igUserId: account.igUserId,
      accessToken,
      query: "lofi"
    });
    console.log(`✅ Successfully fetched ${tracks.length} commercially eligible tracks!`);
    if (tracks.length > 0) {
      console.log("Sample tracks:", JSON.stringify(tracks.slice(0, 2), null, 2));
    }
  } catch (err) {
    console.error("Error fetching audio:", err);
  } finally {
    close();
  }
}

run();
