/**
 * Quem pode chamar o conector: o Warefly rodando local e as origens listadas
 * em WAREFLY_ORIGENS (separadas por vírgula), como o domínio de produção.
 * Chamadas sem Origin (curl, scripts) passam: CORS só protege do navegador.
 */
const LOCAIS = [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/]

function origensExtras() {
  return (process.env.WAREFLY_ORIGENS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function origemPermitida(origem, extras = origensExtras()) {
  if (!origem) return true
  return LOCAIS.some((r) => r.test(origem)) || extras.includes(origem)
}

module.exports = { origemPermitida }
