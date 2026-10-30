import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import {
  exchangeCodeForAccessToken,
  getAssignedInstagramAccounts,
  subscribeApp,
} from "@/lib/ig";
import { saveConfig } from "@/lib/config";

export const runtime = "nodejs";

function redirectPainel(params: Record<string, string>) {
  const url = new URL("/painel", env.appUrl);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

/**
 * Callback do Unified Login. Confere o state, troca o code por token de sistema
 * de negócios, encontra a conta compartilhada, salva tudo e assina os
 * webhooks (comments, messages) para a conta.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return redirectPainel({ error: oauthError });
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("ig_oauth_state")?.value;
  if (!code || !state || state !== savedState) {
    return redirectPainel({ error: "state_invalido" });
  }

  try {
    const token = await exchangeCodeForAccessToken(code);
    const accounts = await getAssignedInstagramAccounts(token.access_token);
    const me = accounts.data?.[0];
    if (!me) throw new Error("Meta did not share an Instagram account with this app");

    const expiresAt = new Date(
      Date.now() + (token.expires_in ?? 60 * 24 * 60 * 60) * 1000,
    ).toISOString();

    await saveConfig({
      ig_user_id: me.id,
      username: me.username,
      name: me.name ?? null,
      profile_picture_url: me.profile_picture_url ?? null,
      access_token: token.access_token,
      token_expires_at: expiresAt,
    });

    // Assina os webhooks da conta (se falhar, seguimos — dá pra reassinar).
    try {
      await subscribeApp(me.id, token.access_token);
    } catch (e) {
      console.error("subscribeApp falhou:", e);
    }

    return redirectPainel({ connected: "1" });
  } catch (e) {
    console.error("OAuth callback falhou:", e);
    return redirectPainel({ error: "falha_conexao" });
  }
}
