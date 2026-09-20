// Gera um par de chaves VAPID (ECDSA P-256) pro Web Push, no formato que
// `@block65/webcrypto-web-push` (usado no cloudflare-worker) e o
// `PushManager.subscribe()` do navegador esperam: chave pública em
// base64url do ponto EC bruto (65 bytes), chave privada em base64url do
// escalar bruto (o campo `d` do JWK).
//
// Uso: node scripts/generate-vapid-keys.js
//
// A pública vai em VAPID_PUBLIC_KEY (cloudflare-worker/wrangler.toml e
// src/lib/pushNotifications.js). A privada é secreta — nunca commitar,
// configurar só via `wrangler secret put VAPID_PRIVATE_KEY`.

const { subtle } = globalThis.crypto;

function toBase64Url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function main() {
  const keyPair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const rawPublicKey = await subtle.exportKey('raw', keyPair.publicKey);
  const jwkPrivateKey = await subtle.exportKey('jwk', keyPair.privateKey);

  console.log('VAPID_PUBLIC_KEY=' + toBase64Url(rawPublicKey));
  console.log('VAPID_PRIVATE_KEY=' + jwkPrivateKey.d);
}

main();
