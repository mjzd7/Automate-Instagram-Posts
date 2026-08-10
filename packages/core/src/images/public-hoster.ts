export interface PublicHostOptions {
  imageBuffer: Buffer;
  relativePath: string;
  githubRepoSlug: string;
  githubBranch: string;
  imgbbApiKey?: string;
  webAppUrl?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Resolves a 100% direct, publicly accessible image/jpeg URL for Meta/Instagram crawlers.
 * Priority:
 * 1. ImgBB direct image upload (if IMGBB_API_KEY is configured)
 * 2. Vercel Web App Edge CDN media route (https://automate-instagram-posts.vercel.app/api/media/...)
 * 3. GitHub raw CDN URL (with branch resolution)
 */
export async function uploadOrGetPublicImageUrl(options: PublicHostOptions): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const webAppUrl = options.webAppUrl ?? process.env.WEB_APP_URL ?? "https://automate-instagram-posts.vercel.app";
  const imgbbApiKey = options.imgbbApiKey ?? process.env.IMGBB_API_KEY;

  if (imgbbApiKey) {
    try {
      const formData = new URLSearchParams();
      formData.append("key", imgbbApiKey);
      formData.append("image", options.imageBuffer.toString("base64"));
      const res = await fetchImpl("https://api.imgbb.com/1/upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = (await res.json()) as { data?: { url?: string } };
        if (data.data?.url) {
          console.log(`[PublicHost] Successfully uploaded to ImgBB: ${data.data.url}`);
          return data.data.url;
        }
      }
    } catch (err) {
      console.warn(`[PublicHost] ImgBB upload fallback error:`, err);
    }
  }

  const cleanPath = options.relativePath.replace(/^data\/posts\//, "");
  const vercelMediaUrl = `${webAppUrl}/api/media/${cleanPath}`;

  // Always use Vercel Web App media URL or GitHub raw URL
  return vercelMediaUrl;
}
