import { env } from "@/lib/env";
import { getConnectedConfig } from "@/lib/config";

export const runtime = "nodejs";

function authorized(req: Request): boolean {
  return req.headers.get("authorization") === `Bearer ${env.cronSecret}`;
}

/**
 * Unified Login tokens are business system-user tokens. The old Instagram
 * refresh_access_token endpoint does not apply; reconnect when the configured
 * token expires until token management is implemented.
 */
async function handle(req: Request) {
  if (!authorized(req)) return new Response("unauthorized", { status: 401 });

  const config = await getConnectedConfig();
  if (!config) return Response.json({ refreshed: false, reason: "sem_conexao" });

  return Response.json({
    refreshed: false,
    reason: "unified_login_system_user_tokens_require_business_token_management_or_reconnect",
    expires_at: config.token_expires_at,
  });
}

export const POST = handle;
export const GET = handle;
