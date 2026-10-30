import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

/**
 * Valida a assinatura X-Hub-Signature-256 que a Meta manda em todo webhook.
 *
 * A Meta calcula HMAC-SHA256 do CORPO CRU da requisição usando o app secret
 * como chave, e manda no cabeçalho no formato "sha256=<hex>". Precisamos
 * recalcular sobre os bytes crus (por isso lemos o body como texto antes de
 * dar JSON.parse) e comparar de forma segura contra timing attacks.
 *
 * @param rawBody  corpo exatamente como chegou (string crua, sem re-serializar)
 * @param signatureHeader  valor do cabeçalho "x-hub-signature-256"
 */
export function isValidSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const provided = signatureHeader.slice("sha256=".length);
  const expected = createHmac("sha256", env.metaAppSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  // Precisam ter o mesmo tamanho antes do timingSafeEqual, senão ele lança.
  const providedBuf = Buffer.from(provided, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }

  return timingSafeEqual(providedBuf, expectedBuf);
}
