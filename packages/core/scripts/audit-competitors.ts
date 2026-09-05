import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../..");

if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(join(repoRoot, ".env.local"));
  } catch {}
}

const igUserId = process.env.INSTAGRAM_ACCOUNT_ID || "17841403077482207";
const token = process.env.INSTAGRAM_ACCESS_TOKEN;

console.log("IG User ID:", igUserId, "Token exists:", !!token);

const testUsernames = [
  "dailystoic",
  "foundr",
  "mindsetofgreatness",
  "wealth",
  "thesuccessclub",
  "6amsuccess",
  "mindset.therapy",
];

interface CompetitorPost {
  id: string;
  media_type: string;
  like_count?: number;
  comments_count?: number;
  caption?: string;
  permalink?: string;
  timestamp?: string;
  children?: {
    data?: Array<{ media_type: string; media_url?: string }>;
  };
}

async function run() {
  const allCarousels: Array<{
    account: string;
    likes: number;
    comments: number;
    caption: string;
    permalink: string;
    slides: number;
  }> = [];

  const allReels: Array<{
    account: string;
    likes: number;
    comments: number;
    caption: string;
    permalink: string;
  }> = [];

  for (const username of testUsernames) {
    console.log(`\n========================================`);
    console.log(`🔍 Querying Business Discovery for @${username}`);
    console.log(`========================================`);

    const fields = `business_discovery.username(${username}){username,name,followers_count,media_count,media.limit(15){id,caption,like_count,comments_count,media_type,media_url,permalink,timestamp,children{media_type,media_url}}}`;
    const url = `https://graph.facebook.com/v26.0/${igUserId}?fields=${encodeURIComponent(fields)}&access_token=${token}`;

    try {
      const res = await fetch(url);
      const data = (await res.json()) as {
        business_discovery?: {
          username?: string;
          followers_count?: number;
          media_count?: number;
          media?: {
            data?: CompetitorPost[];
          };
        };
        error?: {
          message?: string;
        };
      };
      if (data.error) {
        console.log(`❌ Error for @${username}:`, data.error.message);
        continue;
      }
      const bd = data.business_discovery;
      if (!bd) {
        console.log(`❌ No business discovery data for @${username}`);
        continue;
      }
      console.log(`✅ @${bd.username} — ${bd.followers_count?.toLocaleString()} followers, ${bd.media_count} posts`);

      const mediaList: CompetitorPost[] = bd.media?.data || [];
      console.log(`Found ${mediaList.length} recent posts:`);

      for (const m of mediaList) {
        const type = m.media_type;
        const likes = m.like_count || 0;
        const comments = m.comments_count || 0;
        const slides = m.children?.data?.length || (type === "CAROUSEL_ALBUM" ? 5 : 1);
        const captionFirstLine = (m.caption || "").split("\n")[0]?.trim() ?? "";

        console.log(`  [${type}] [${slides} slides] [${likes.toLocaleString()} likes | ${comments} cmts] "${captionFirstLine.substring(0, 60)}..."`);

        if (type === "CAROUSEL_ALBUM") {
          allCarousels.push({
            account: username,
            likes,
            comments,
            caption: m.caption || "",
            permalink: m.permalink || "",
            slides,
          });
        } else if (type === "VIDEO") {
          allReels.push({
            account: username,
            likes,
            comments,
            caption: m.caption || "",
            permalink: m.permalink || "",
          });
        }
      }
    } catch (err) {
      console.log(`❌ Error fetching @${username}:`, err);
    }
  }

  // Rank Top Carousels by Engagement
  console.log("\n==========================================================================");
  console.log("🔥 TOP PERFORMING COMPETITOR CAROUSELS (REVERSE-ENGINEERING BLUEPRINT) 🔥");
  console.log("==========================================================================");
  allCarousels.sort((a, b) => b.likes - a.likes);

  allCarousels.slice(0, 8).forEach((c, idx) => {
    console.log(`\n#${idx + 1} [@${c.account}] — ${c.likes.toLocaleString()} Likes | ${c.comments} Comments | ${c.slides} Slides`);
    console.log(`    Headline Hook: "${c.caption.split("\n")[0]}"`);
    console.log(`    Caption Body: "${c.caption.substring(0, 200).replace(/\n/g, " ")}..."`);
    console.log(`    Link: ${c.permalink}`);
  });
}

run();
