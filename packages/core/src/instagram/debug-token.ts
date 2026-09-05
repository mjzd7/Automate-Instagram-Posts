// Token-scope diagnostic (docs/PLAN-dashboard.md §5 open item 1). There is no
// in-app OAuth flow -- tokens are minted externally and refreshed via
// fb_exchange_token, which inherits the original grant's scopes silently.
// This module checks what a stored token can ACTUALLY do by asking Meta's
// /debug_token endpoint. Output must never include the token itself.
import { GRAPH_API_VERSION } from "./client.js";

export interface DebugTokenResult {
  isValid: boolean;
  scopes: string[];
  expiresAt: string;
  appId?: string;
}

export interface TokenScopeCheck {
  accountId: string;
  ok: boolean;
  isValid?: boolean;
  scopes?: string[];
  expiresAt?: string;
  missingCore?: string[];
  missingCommentStack?: string[];
  error?: string;
}

export interface CheckTokenScopesOptions {
  accounts: Array<{ id: string }>;
  resolveAccessToken: (accountId: string) => Promise<string>;
  metaAppId?: string;
  metaAppSecret?: string;
  fetchImpl?: typeof fetch;
}

export function buildDebugTokenUrl(inputToken: string, appAccessToken: string): string {
  const params = new URLSearchParams({ input_token: inputToken, access_token: appAccessToken });
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/debug_token?${params.toString()}`;
}

export function parseDebugTokenResponse(body: Record<string, unknown>): DebugTokenResult {
  const data = body.data as Record<string, unknown> | undefined;
  if (!data) throw new Error("parseDebugTokenResponse: response missing data envelope");
  const rawScopes = data.scopes;
  return {
    isValid: data.is_valid === true,
    scopes: Array.isArray(rawScopes) ? rawScopes.map(String) : [],
    expiresAt:
      typeof data.expires_at === "number"
        ? data.expires_at === 0
          ? "never"
          : new Date(data.expires_at * 1000).toISOString()
        : "unknown",
    appId: typeof data.app_id === "string" ? data.app_id : undefined,
  };
}

const REQUIRED_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_read_engagement",
  "pages_show_list",
] as const;

const COMMENT_STACK_SCOPES = ["instagram_manage_comments", "instagram_manage_engagement"] as const;

function missingFor(scopes: string[], required: readonly string[]): string[] {
  return required.filter((scope) => !scopes.includes(scope));
}

export async function checkTokenScopes(options: CheckTokenScopesOptions): Promise<TokenScopeCheck[]> {
  if (!options.metaAppId || !options.metaAppSecret) {
    throw new Error("checkTokenScopes: META_APP_ID and META_APP_SECRET env vars are required");
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const appAccessToken = `${options.metaAppId}|${options.metaAppSecret}`;
  const results: TokenScopeCheck[] = [];

  for (const account of options.accounts) {
    try {
      const accessToken = await options.resolveAccessToken(account.id);
      const res = await fetchImpl(buildDebugTokenUrl(accessToken, appAccessToken));
      const parsed = parseDebugTokenResponse((await res.json()) as Record<string, unknown>);
      results.push({
        accountId: account.id,
        ok: parsed.isValid,
        isValid: parsed.isValid,
        scopes: parsed.scopes,
        expiresAt: parsed.expiresAt,
        missingCore: missingFor(parsed.scopes, [...REQUIRED_SCOPES]),
        missingCommentStack: missingFor(parsed.scopes, COMMENT_STACK_SCOPES),
      });
    } catch (error) {
      results.push({
        accountId: account.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}
