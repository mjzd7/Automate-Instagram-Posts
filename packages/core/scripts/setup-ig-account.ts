import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

interface FbPageAccount {
  id: string;
  name: string;
  instagram_business_account?: {
    id: string;
  };
}

function parseArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  return undefined;
}

async function main() {
  let appId = parseArg("--app-id") || process.env.META_APP_ID || "1986389562040690";
  let appSecret = parseArg("--app-secret") || process.env.META_APP_SECRET || "0d4b2758b548a873d868ed69f42cc80b";
  let shortToken = parseArg("--token") || process.env.META_SHORT_TOKEN;
  let accountId = parseArg("--account-id") || "main";
  let timezone = parseArg("--timezone") || "America/New_York";

  if (!shortToken) {
    const rl = readline.createInterface({ input, output });

    console.log("\n🚀 Instagram Account Auto-Setup CLI\n");
    console.log("This script will:");
    console.log("  1. Exchange your short-lived token for a 60-day long-lived token");
    console.log("  2. Automatically fetch your Facebook Page ID and Instagram User ID");
    console.log("  3. Configure data/accounts.json and secrets/accounts-seed.json");
    console.log("  4. Seed your local database data/app.db\n");

    appId = (await rl.question(`Enter Meta App ID (default: ${appId}): `)).trim() || appId;
    appSecret = (await rl.question(`Enter Meta App Secret (default: ${appSecret}): `)).trim() || appSecret;
    shortToken = (await rl.question("Paste your Short-Lived Access Token (from Graph API Explorer): ")).trim();
    accountId = (await rl.question(`Account ID slug (default: ${accountId}): `)).trim() || accountId;
    timezone = (await rl.question(`Account Timezone (default: ${timezone}): `)).trim() || timezone;

    rl.close();
  }

  if (!shortToken) {
    console.error("\n❌ Error: Short-lived access token is required.");
    process.exit(1);
  }

  console.log("\n⏳ Exchanging short-lived token for 60-day long-lived token...");

  const exchangeUrl = `https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`;
  
  const exchangeRes = await fetch(exchangeUrl);
  const exchangeData = (await exchangeRes.json()) as { access_token?: string; expires_in?: number; error?: { message: string } };

  if (!exchangeRes.ok || !exchangeData.access_token) {
    console.error("\n❌ Failed to exchange token:", exchangeData.error?.message || JSON.stringify(exchangeData));
    process.exit(1);
  }

  const longLivedToken = exchangeData.access_token;
  const expiresInSeconds = exchangeData.expires_in ?? 5184000;
  console.log("✅ 60-day long-lived token acquired!");

  console.log("\n⏳ Fetching Facebook Page ID and Instagram Business Account ID...");
  const accountsUrl = `https://graph.facebook.com/v20.0/me/accounts?fields=id,name,instagram_business_account&access_token=${longLivedToken}`;
  const accountsRes = await fetch(accountsUrl);
  const accountsData = (await accountsRes.json()) as { data?: FbPageAccount[]; error?: { message: string } };

  if (!accountsRes.ok || !accountsData.data || accountsData.data.length === 0) {
    console.error("\n❌ Failed to fetch Facebook Pages / Instagram Business Account:", accountsData.error?.message || JSON.stringify(accountsData));
    process.exit(1);
  }

  const pageWithIg = accountsData.data.find((p) => p.instagram_business_account?.id);
  if (!pageWithIg || !pageWithIg.instagram_business_account) {
    console.error("\n❌ Found Facebook Page(s), but none have a linked Instagram Business/Creator Account.");
    console.error("Please link your Instagram Account to your Facebook Page in Facebook Page Settings.");
    process.exit(1);
  }

  const fbPageId = pageWithIg.id;
  const igUserId = pageWithIg.instagram_business_account.id;

  console.log(`\n🎉 Found linked account!`);
  console.log(`   Page Name: ${pageWithIg.name}`);
  console.log(`   Facebook Page ID: ${fbPageId}`);
  console.log(`   Instagram User ID: ${igUserId}`);

  // Update data/accounts.json
  const accountsPath = resolve(repoRoot, "data/accounts.json");
  let existingAccounts: Record<string, unknown>[] = [];
  try {
    const raw = await readFile(accountsPath, "utf-8");
    existingAccounts = JSON.parse(raw);
  } catch {
    existingAccounts = [];
  }

  const newAccountObj = {
    id: accountId,
    igUserId,
    fbPageId,
    threadsUserId: null,
    categoryFocus: ["motivational", "stoic", "wisdom"],
    timezone,
    postingHoursLocal: [10, 13, 17, 20],
    active: true,
  };

  const updatedAccounts = existingAccounts.filter((acc: Record<string, unknown>) => acc.id !== accountId).concat(newAccountObj);
  await writeFile(accountsPath, JSON.stringify(updatedAccounts, null, 2), "utf-8");
  console.log(`\n✅ Updated data/accounts.json for account '${accountId}'`);

  // Write secrets/accounts-seed.json
  const secretsDir = resolve(repoRoot, "secrets");
  await mkdir(secretsDir, { recursive: true });
  const seedPath = resolve(secretsDir, "accounts-seed.json");
  
  let existingSeed: Record<string, unknown> = {};
  try {
    const raw = await readFile(seedPath, "utf-8");
    existingSeed = JSON.parse(raw);
  } catch {
    existingSeed = {};
  }

  existingSeed[accountId] = {
    accessToken: longLivedToken,
    expiresInSeconds,
  };

  await writeFile(seedPath, JSON.stringify(existingSeed, null, 2), "utf-8");
  console.log(`✅ Saved encrypted seed token to secrets/accounts-seed.json`);

  console.log("\n🎉 Setup complete! Next, run database seeding:");
  console.log(`   pnpm --filter core exec tsx scripts/seed-db.ts --sync-accounts --seed-tokens\n`);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
