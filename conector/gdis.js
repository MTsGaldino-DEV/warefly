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

  // Um só ouvinte de alertas para o navegador inteiro. Enquanto o robô
  // trabalha, o fluxo ativa um tratador que aceita e registra. Fora disso o
  // alerta fica na tela para a pessoa: sem nenhum ouvinte o Playwright
  // descartaria sozinho, inclusive o confirm do Salvar.
  let tratador = null
  context.on('dialog', (d) => {
    if (tratador) tratador(d)
  })
  const dialogos = {
    ativar(fn) {
      tratador = fn
    },
    desativar() {
      tratador = null
    },
  }

  const page = await context.newPage()
  return { browser, context, page, dialogos }
}

function ehLogin(url) {
  return /\/login/i.test(url)
}

module.exports = { CONFIG, abrirNavegador, ehLogin }
