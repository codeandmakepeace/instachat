import "server-only";
import { env } from "./env";

/**
 * Cliente da Instagram API com Unified Login.
 *
 * API: https://graph.facebook.com/v26.0
 * OAuth: Facebook Login for Business with an Instagram-asset configuration.
 *
 * Não precisa de página do Facebook. O client_id do OAuth é o
 * Meta App ID and app secret (legacy env names remain supported).
 */

export const API_VERSION = "v26.0";
export const GRAPH_BASE = `https://graph.facebook.com/${API_VERSION}`;

// -------------------------------------------------------------------------
// Tipos das mensagens que sabemos enviar
// -------------------------------------------------------------------------

/** Só texto. */
export type TextMessage = { text: string };

/** Texto + botão de resposta rápida (a pessoa toca e isso abre a janela 24h). */
export type QuickReplyMessage = {
  text: string;
  quick_replies: { content_type: "text"; title: string; payload: string }[];
};

/** Template de botão com um link (web_url). */
export type ButtonMessage = {
  attachment: {
    type: "template";
    payload: {
      template_type: "button";
      text: string;
      buttons: { type: "web_url"; url: string; title: string }[];
    };
  };
};

export type OutgoingMessage = TextMessage | QuickReplyMessage | ButtonMessage;

/** Destinatário: por comment_id (resposta privada) ou por id (DM na conversa). */
export type Recipient = { comment_id: string } | { id: string };

// -------------------------------------------------------------------------
// Helpers internos de HTTP
// -------------------------------------------------------------------------

export class InstagramApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "InstagramApiError";
  }
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new InstagramApiError(
      `Instagram API ${res.status}: ${text}`,
      res.status,
      json,
    );
  }
  return json as T;
}

// -------------------------------------------------------------------------
// OAuth / tokens
// -------------------------------------------------------------------------

/** Monta a URL para onde mandamos a pessoa autorizar o app. */
export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.metaAppId,
    config_id: env.instagramConfigId,
    redirect_uri: `${env.appUrl}/api/oauth/callback`,
    response_type: "code",
    display: "popup",
    override_default_response_type: "true",
    state,
    prompt: "login",
  });
  return `https://www.facebook.com/dialog/oauth?${params.toString()}`;
}

/** Troca o code do Unified Login por um business system-user access token. */
export async function exchangeCodeForAccessToken(
  code: string,
): Promise<{ access_token: string; token_type?: string; expires_in?: number }> {
  const params = new URLSearchParams({
    client_id: env.metaAppId,
    client_secret: env.metaAppSecret,
    code,
  });
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`);
  return parse(res);
}

// -------------------------------------------------------------------------
// Perfil / assinatura / mídia
// -------------------------------------------------------------------------

export type IgProfile = {
  id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
};

/** Instagram assets shared with this app during Unified Login. */
export async function getAssignedInstagramAccounts(
  token: string,
): Promise<{ data: IgProfile[] }> {
  const params = new URLSearchParams({
    fields: "id,username",
    access_token: token,
  });
  const res = await fetch(`${GRAPH_BASE}/me/assigned_instagram_accounts?${params.toString()}`);
  return parse(res);
}

/** Assina os webhooks (comments, messages) para a conta. Fazemos no callback. */
export async function subscribeApp(
  igId: string,
  token: string,
): Promise<{ success: boolean }> {
  const form = new URLSearchParams({
    subscribed_fields: "comments,messages",
    access_token: token,
  });
  const res = await fetch(`${GRAPH_BASE}/${igId}/subscribed_apps`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  return parse(res);
}

export type IgMedia = {
  id: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  caption?: string;
  permalink: string;
};

/** Lista os posts/reels da conta (para o seletor visual no painel). */
export async function getMedia(
  igId: string,
  token: string,
): Promise<{ data: IgMedia[]; paging?: unknown }> {
  const params = new URLSearchParams({
    fields: "id,media_type,media_url,thumbnail_url,caption,permalink",
    access_token: token,
  });
  const res = await fetch(`${GRAPH_BASE}/${igId}/media?${params.toString()}`);
  return parse(res);
}

// -------------------------------------------------------------------------
// Envio de mensagens e respostas de comentário
// -------------------------------------------------------------------------

/**
 * Envia uma mensagem.
 * - recipient { comment_id }: RESPOSTA PRIVADA — fura a janela de 24h (1x por
 *   comentário, em até 7 dias).
 * - recipient { id }: DM normal — só dentro de uma conversa já aberta.
 */
export async function sendMessage(
  igId: string,
  token: string,
  recipient: Recipient,
  message: OutgoingMessage,
): Promise<{ recipient_id?: string; message_id?: string }> {
  const res = await fetch(`${GRAPH_BASE}/${igId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient,
      message,
      access_token: token,
    }),
  });
  return parse(res);
}

/** Resposta PÚBLICA em um comentário (aparece no post). */
export async function replyToComment(
  commentId: string,
  token: string,
  message: string,
): Promise<{ id: string }> {
  const form = new URLSearchParams({ message, access_token: token });
  const res = await fetch(`${GRAPH_BASE}/${commentId}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  return parse(res);
}
