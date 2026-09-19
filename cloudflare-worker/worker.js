// Worker que gera credenciais TURN de curta duração pra o GustaShare.
//
// Por que isso existe: o GustaShare não tem backend (roda 100% no
// navegador/Electron, sem servidor próprio). O TURN da Cloudflare Realtime
// exige que a credencial seja gerada por um backend — a API Token
// (TURN_API_TOKEN) é secreta e nunca pode ir pro navegador. Esse Worker é
// a peça mínima que falta: guarda o token em segredo e devolve pro
// cliente só a credencial já pronta e temporária.
//
// Configuração (uma vez só, via `wrangler secret put`):
//   wrangler secret put TURN_KEY_ID       # o "ID de token Turn" do painel
//   wrangler secret put TURN_API_TOKEN    # o "Token de API" do painel
//
// Deploy:
//   cd cloudflare-worker && npx wrangler deploy
//
// O app (src/lib/webrtc.js) chama a URL publicada por esse Worker antes de
// entrar numa sala, com fallback pro TURN estático da Metered se esse
// endpoint falhar ou demorar demais.

const TTL_SECONDS = 6 * 60 * 60; // 6h — bem mais que uma sessão típica

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (request.method !== 'GET') {
      return json({ error: 'method not allowed' }, 405);
    }
    if (!env.TURN_KEY_ID || !env.TURN_API_TOKEN) {
      return json({ error: 'worker sem TURN_KEY_ID/TURN_API_TOKEN configurados' }, 500);
    }

    try {
      const upstream = await fetch(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.TURN_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ttl: TTL_SECONDS }),
        }
      );

      if (!upstream.ok) {
        return json({ error: 'cloudflare turn api error', status: upstream.status }, 502);
      }

      const data = await upstream.json();
      return json(data, 200);
    } catch {
      return json({ error: 'falha ao gerar credenciais TURN' }, 502);
    }
  },
};
