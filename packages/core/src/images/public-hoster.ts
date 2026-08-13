export interface PublicHostOptions {
  imageBuffer?: Buffer;
  relativePath: string;
  githubRepoSlug: string;
  githubBranch: string;
  webAppUrl?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Resolves a 100% direct, uncompressed, high-definition image/jpeg URL for Meta/Instagram crawlers.
 * Priority:
 * 1. Vercel Web App Edge CDN media route (https://automate-instagram-posts.vercel.app/api/media/...)
 * 2. GitHub raw CDN URL (with branch resolution)
 */
export async function uploadOrGetPublicImageUrl(options: PublicHostOptions): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const webAppUrl = options.webAppUrl ?? process.env.WEB_APP_URL ?? "https://automate-instagram-posts.vercel.app";

  const cleanPath = options.relativePath.replace(/^data\/posts\//, "");
  const vercelMediaUrl = `${webAppUrl}/api/media/${cleanPath}`;

  const fallbackUrl = `https://raw.githubusercontent.com/${options.githubRepoSlug}/${options.githubBranch}/${options.relativePath}`;

  // Primary: Vercel Web App Edge CDN media route (delivers full 100% HD JPEG)
  try {
    const head = await fetchImpl(vercelMediaUrl, { method: "HEAD" });
    const contentType = head.headers.get("content-type") ?? "";
    if (head.ok && contentType.startsWith("image/")) {
      console.log(`[PublicHost] Using primary Vercel Edge CDN Media URL: ${vercelMediaUrl}`);
      return vercelMediaUrl;
    }
  } catch {}

  console.log(`[PublicHost] Vercel URL not ready/available, falling back to GitHub RAW URL: ${fallbackUrl}`);
  return fallbackUrl;
}
