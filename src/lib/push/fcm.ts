import { createSign } from "node:crypto";

/**
 * Cliente mínimo do Firebase Cloud Messaging (HTTP v1) sem dependência: assina o JWT da conta de serviço,
 * troca por um access token (cacheado) e envia. A mesma API entrega no Android e no iOS (o Firebase
 * repassa ao APNs com a chave carregada no console). Sem FCM_SERVICE_ACCOUNT_JSON o envio é ignorado.
 */

type ContaDeServico = { project_id: string; client_email: string; private_key: string; token_uri?: string };

let cache: { token: string; expiraEm: number } | null = null;

function conta(): ContaDeServico | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as ContaDeServico;
    return c.project_id && c.client_email && c.private_key ? c : null;
  } catch {
    return null;
  }
}

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

async function accessToken(c: ContaDeServico): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);
  if (cache && cache.expiraEm - 60 > agora) return cache.token;
  const aud = c.token_uri ?? "https://oauth2.googleapis.com/token";
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: c.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud, iat: agora, exp: agora + 3600 })}`;
  const assinatura = createSign("RSA-SHA256").update(unsigned).sign(c.private_key, "base64url");
  const res = await fetch(aud, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${assinatura}` }),
  });
  if (!res.ok) throw new Error(`FCM auth ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cache = { token: j.access_token, expiraEm: agora + j.expires_in };
  return j.access_token;
}

export function fcmConfigurado(): boolean {
  return conta() !== null;
}

export type ResultadoEnvio = "ok" | "token-invalido" | "falha" | "desligado";

export async function enviarPush(token: string, aviso: { titulo: string; corpo: string; destino: string }): Promise<ResultadoEnvio> {
  const c = conta();
  if (!c) return "desligado";
  try {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${c.project_id}/messages:send`, {
      method: "POST",
      headers: { authorization: `Bearer ${await accessToken(c)}`, "content-type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: aviso.titulo, body: aviso.corpo },
          data: { destino: aviso.destino },
          android: { priority: "HIGH", notification: { channel_id: "agenda" } },
          apns: { payload: { aps: { sound: "default" } } },
        },
      }),
    });
    if (res.ok) return "ok";
    const corpo = await res.text();
    // Aparelho que desinstalou o app ou renovou o token: some da base.
    return res.status === 404 || corpo.includes("UNREGISTERED") ? "token-invalido" : "falha";
  } catch (err) {
    console.error("[push] envio falhou", err);
    return "falha";
  }
}
