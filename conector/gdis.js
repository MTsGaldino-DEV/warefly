const { chromium } = require('playwright')

const BASE = 'http://192.168.1.110/contratadaweb'

const CONFIG = {
  loginUrl: `${BASE}/login.jsp`,
  menuUrl: `${BASE}/menu.jsp`,
  notaCorretivaUrl: `${BASE}/condis/concod/manutencao/nota_corretiva.jsp`,
}

/** Abre o Edge com o ajuste de compatibilidade que o GDIS espera. */
async function abrirNavegador({ headless = false } = {}) {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless,
    args: ['--start-maximized', '--disable-popup-blocking'],
  })
  const context = await browser.newContext({ viewport: null })

  // O GDIS é um sistema legado que assume comportamento do IE:
  // document.getElementById() encontrando elementos pelo atributo name.
  await context.addInitScript(() => {
    const original = document.getElementById
    document.getElementById = function (id) {
      let el = original.call(document, id)
      if (!el) {
        const porNome = document.getElementsByName(id)
        if (porNome && porNome.length > 0) el = porNome[0]
      }
      return el
    }
  })

  const page = await context.newPage()
  return { browser, context, page }
}

function ehLogin(url) {
  return /\/login/i.test(url)
}

module.exports = { CONFIG, abrirNavegador, ehLogin }
