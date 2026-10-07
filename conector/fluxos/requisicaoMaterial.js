/**
 * Monta no GDIS a nota corretiva de requisição de material e para antes de
 * salvar. Passos e nomes de campos vêm das telas nota_corretiva.jsp,
 * ns_corretiva.jsp e inclui_material_corretivo_ns.jsp.
 */
const { frasePeriodo } = require('../periodo')
const { ehLogin } = require('../gdis')

class Cancelado extends Error {}
class SessaoExpirada extends Error {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function checarSessao(context) {
  if (context.pages().some((p) => ehLogin(p.url()))) {
    throw new SessaoExpirada('Sessão do GDIS expirou: a tela voltou para o login.')
  }
}

/** Procura, em todas as janelas e frames, o primeiro que tem o seletor. */
async function acharFrame(context, seletor, timeout) {
  const fim = Date.now() + timeout
  while (Date.now() < fim) {
    checarSessao(context)
    for (const p of context.pages()) {
      for (const f of p.frames()) {
        try {
          if (await f.$(seletor)) return f
        } catch {
          // frame navegando; tenta de novo na próxima volta
        }
      }
    }
    await sleep(300)
  }
  throw new Error(`Não achei "${seletor}" em nenhuma tela do GDIS.`)
}

/** Campos com máscara do GDIS aceitam melhor digitação do que fill. */
async function digitar(alvo, seletor, valor) {
  const campo = alvo.locator(seletor).first()
  await campo.fill('')
  await campo.pressSequentially(String(valor), { delay: 30 })
}

/** Inclui um material pela janela aberta e confere na lista da nota. */
async function incluirItem({ janela, nota, item, dialogos, tempo = 5000 }) {
  const codigo = String(item.codigo)
  const existe = await janela.locator(`#codMaterial option[value="${codigo}"]`).count()
  if (!existe) throw new Error('Código não disponível para o serviço 291 no GDIS.')

  const linhasDaNota = () =>
    nota.evaluate(() => document.querySelectorAll('tbody[id^="tmateriais_291_"] tr').length)
  const antes = await linhasDaNota()
  const dialogosAntes = dialogos.length

  await janela.selectOption('#codMaterial', codigo)
  await digitar(janela, '#txtQtdeMat', item.quantidade)
  await janela.click('[name="btoMateriais"]')

  const entrou = await nota
    .waitForFunction(
      (n) => document.querySelectorAll('tbody[id^="tmateriais_291_"] tr').length > n,
      antes,
      { timeout: tempo },
    )
    .then(
      () => true,
      () => false,
    )
  if (!entrou) {
    const alerta = dialogos.slice(dialogosAntes).join(' / ')
    throw new Error(alerta ? `GDIS: ${alerta}` : 'O material não apareceu na lista da nota.')
  }

  // A linha nova é a última; confere código e quantidade nas células.
  return nota.evaluate(
    ({ codigo, qtd }) => {
      const linhas = document.querySelectorAll('tbody[id^="tmateriais_291_"] tr')
      const tr = linhas[linhas.length - 1]
      const valores = Array.from(tr.querySelectorAll('td, input')).map((el) =>
        (el.tagName === 'INPUT' ? el.value : el.textContent).trim(),
      )
      return { codigoConferido: valores.includes(codigo), qtdConferida: valores.includes(qtd) }
    },
    { codigo, qtd: String(item.quantidade) },
  )
}

async function requisitarMaterial({ context, page, pedido, urlNota, emitir, cancelado, tempo = {} }) {
  const espera = { campos: 20000, item: 5000, ...tempo }
  const dialogos = []
  const aoDialogo = (d) => {
    dialogos.push(d.message())
    emitir({ tipo: 'debug', msg: `Alerta do GDIS: ${d.message()}` })
    d.accept().catch(() => {})
  }
  const acompanhar = (p) => p.on('dialog', aoDialogo)
  context.pages().forEach(acompanhar)
  context.on('page', acompanhar)

  async function etapa(id, msg, fn) {
    if (cancelado()) throw new Cancelado('Cancelado.')
    emitir({ tipo: 'etapa', id, msg, estado: 'andamento' })
    const dialogosAntes = dialogos.length
    try {
      const r = await fn()
      emitir({ tipo: 'etapa', id, msg, estado: 'ok' })
      return r
    } catch (e) {
      const alerta = dialogos.slice(dialogosAntes).join(' / ')
      const texto = alerta && !e.message.includes(alerta) ? `${e.message} GDIS: ${alerta}` : e.message
      emitir({ tipo: 'etapa', id, msg: `${msg}: ${texto}`, estado: 'erro' })
      if (e instanceof Cancelado || e instanceof SessaoExpirada) throw e
      throw new Error(texto)
    }
  }

  try {
    const nota = await etapa('abrir', 'Abrir nota corretiva nova', async () => {
      await page.goto(urlNota, { waitUntil: 'domcontentloaded', timeout: 30000 })
      checarSessao(context)
      const botaoNovo = '[name="btoNovo"], input[type="button"][value="Novo"]'
      const comNovo = await acharFrame(context, botaoNovo, espera.campos)
      await comNovo.locator(botaoNovo).first().click()
      return acharFrame(context, '[name="identificador"]', espera.campos)
    })

    await etapa('instalacao', `Buscar instalação ${pedido.instalacao}`, async () => {
      await digitar(nota, '[name="identificador"]', pedido.instalacao)
      await nota.click('[name="BotaoIdentificador"]')
      await nota
        .waitForFunction(
          () => {
            const v = (n) => ((document.getElementsByName(n)[0] || {}).value || '').trim()
            return v('endereco') || v('subalim')
          },
          null,
          { timeout: espera.campos },
        )
        .catch(() => {
          checarSessao(context)
          throw new Error('Instalação não encontrada: o GDIS não preencheu o endereço.')
        })
    })

    await etapa('campos', 'Preencher motivo, rede e outras informações', async () => {
      await nota.selectOption('[name="motivoCausa"]', '22')
      await nota.selectOption('[name="rede"]', '3')
      await nota.fill('[name="infComplementares"]', frasePeriodo(pedido.periodo))
    })

    await etapa('servico', 'Adicionar serviço 291 com componente Material', async () => {
      await nota.selectOption('[name="selCodServico"]', '291')
      const componente = await nota
        .waitForFunction(
          () => {
            const s = document.getElementsByName('componente')[0]
            const o = s && Array.from(s.options).find((op) => op.text.trim().toUpperCase() === 'MATERIAL')
            return o ? o.value : null
          },
          null,
          { timeout: espera.campos },
        )
        .then((h) => h.jsonValue())
        .catch(() => {
          throw new Error('A lista de componentes não trouxe a opção MATERIAL.')
        })
      await nota.selectOption('[name="componente"]', componente)
      const antes = await nota.locator('#tservicos [id="btoIncluiMaterial"]').count()
      await nota.click('[name="btoServicos"]')
      await nota
        .waitForFunction((n) => document.querySelectorAll('#tservicos [id="btoIncluiMaterial"]').length > n, antes, {
          timeout: espera.campos,
        })
        .catch(() => {
          throw new Error('A linha do serviço não apareceu depois de + Serviços.')
        })
    })

    const janela = await etapa('janela', 'Abrir a janela de materiais', async () => {
      const [j] = await Promise.all([
        context.waitForEvent('page', { timeout: espera.campos }),
        nota.locator('#tservicos [id="btoIncluiMaterial"]').last().click(),
      ])
      await j.waitForLoadState('load')
      await j.waitForSelector('#codMaterial', { timeout: espera.campos })
      // A nota entrega o serviço à janela logo depois de abrir.
      await j.waitForFunction(() => !!window.servico, null, { timeout: espera.campos }).catch(() => {})
      return j
    })

    let incluidos = 0
    for (const item of pedido.itens) {
      if (cancelado()) throw new Cancelado('Cancelado.')
      checarSessao(context)
      const codigo = String(item.codigo)
      emitir({ tipo: 'item', codigo, estado: 'andamento' })
      try {
        const conferido = await incluirItem({ janela, nota, item, dialogos, tempo: espera.item })
        incluidos++
        emitir({
          tipo: 'item',
          codigo,
          estado: 'ok',
          msg: conferido.qtdConferida ? undefined : 'Incluído, mas não consegui conferir a quantidade na lista da nota.',
        })
      } catch (e) {
        emitir({ tipo: 'item', codigo, estado: 'erro', msg: e.message })
      }
    }

    await etapa('fim', 'Fechar a janela de materiais', async () => {
      if (!janela.isClosed()) await janela.close()
    })

    return { incluidos, total: pedido.itens.length }
  } finally {
    context.off('page', acompanhar)
    context.pages().forEach((p) => p.off('dialog', aoDialogo))
  }
}

module.exports = { requisitarMaterial, incluirItem, Cancelado, SessaoExpirada }
