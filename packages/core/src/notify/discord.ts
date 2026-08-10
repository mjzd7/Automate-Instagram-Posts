// Discord webhook embed color codes (decimal), plan.md §7.22.
const COLOR_FAILURE = 15158332; // red
const COLOR_SUCCESS = 3066993; // green

export interface DiscordNotification {
  title: string;
  description: string;
  level: "failure" | "success";
}

export async function sendDiscordNotification(
  webhookUrl: string,
  notification: DiscordNotification,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchImpl(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: notification.title,
          description: notification.description,
          color: notification.level === "failure" ? COLOR_FAILURE : COLOR_SUCCESS,
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Discord webhook request failed: ${res.status}`);
  }
}
