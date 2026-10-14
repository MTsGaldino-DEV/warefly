/**
 * Sessão do GDIS no Edge do robô e a tarefa em andamento. Guarda o estado
 * (login pendente, sessão ok, andamento da última tarefa) para a aba do
 * Warefly se recuperar depois de recarregar ou trocar de página.
 */
const { CONFIG, abrirNavegador, ehLogin } = require('./gdis')
const { requisitarMaterial, Cancelado, SessaoExpirada } = require('./fluxos/requisicaoMaterial')

class Recusado extends Error {
  constructor(status, msg) {
    super(msg)
    this.status = status
  }
}

const URLS_GDIS = { login: CONFIG.loginUrl, menu: CONFIG.menuUrl, nota: CONFIG.notaCorretivaUrl }

function criarSessao({ emitir, urls = URLS_GDIS, abrir = () => abrirNavegador(), tempo } = {}) {
  let navegador = null // { browser, context, page, dialogos }
  let sessaoOk = false
  let aguardandoLogin = false
  let tarefa = null // { cancelado: boolean }
  let andamento = { etapas: [], itens: {}, fim: null }

  function avisar(evento) {
    if (evento.tipo === 'etapa') {
      andamento.etapas = [...andamento.etapas.filter((e) => e.id !== evento.id), { id: evento.id, msg: evento.msg, estado: evento.estado }]
    }
    if (evento.tipo === 'item') andamento.itens[evento.codigo] = { estado: evento.estado, msg: evento.msg }
    if (evento.tipo === 'fim') andamento.fim = evento
    emitir(evento)
  }

  function perder(msg) {
    sessaoOk = false
    aguardandoLogin = false
    if (tarefa) tarefa.cancelado = true
    avisar({ tipo: 'sessao_perdida', msg })
  }

  async function fecharNavegador() {
    const antigo = navegador
    navegador = null // antes de fechar, para o aviso de "Edge fechado" não disparar
    if (antigo) await antigo.browser.close().catch(() => {})
  }

  return {
    estado() {
      return { sessaoOk, tarefaAtiva: !!tarefa, aguardandoLogin, andamento }
    },

    paginaDoRobo() {
      return navegador?.page ?? null
    },

    async iniciar() {
      if (tarefa) throw new Recusado(409, 'Há uma tarefa em andamento.')
      await fecharNavegador()
      sessaoOk = false
      aguardandoLogin = false
      const atual = await abrir()
      navegador = atual
      // Fechar a janela não encerra o processo do Edge aberto pelo Playwright:
      // o sinal de que a pessoa fechou é a aba do robô fechando.
      const fechou = () => {
        if (navegador !== atual) return
        navegador = null
        atual.browser.close().catch(() => {})
        perder('O Edge foi fechado. Abra o login do GDIS de novo.')
      }
      atual.page.on('close', fechou)
      atual.browser.on('disconnected', fechou)
      await atual.page.goto(urls.login, { waitUntil: 'domcontentloaded', timeout: 30000 })
      aguardandoLogin = true
      avisar({
        tipo: 'aguardando_login',
        msg: 'Edge aberto. Entre no GDIS (senha e reCAPTCHA) e depois clique em "Já entrei".',
      })
    },

    async confirmar() {
      if (!navegador) throw new Recusado(400, 'Abra o login do GDIS primeiro.')
      if (tarefa) throw new Recusado(409, 'Há uma tarefa em andamento.')
      await navegador.page.goto(urls.menu, { waitUntil: 'domcontentloaded', timeout: 20000 })
      if (ehLogin(navegador.page.url())) {
        throw new Recusado(400, 'Ainda na tela de login. Entre no GDIS e tente de novo.')
      }
      sessaoOk = true
      aguardandoLogin = false
      avisar({ tipo: 'sessao_ok', msg: 'Sessão do GDIS confirmada.' })
    },

    /** Começa a tarefa e devolve a promessa do fim; recusa na hora se não pode. */
    iniciarTarefa(pedido) {
      if (!sessaoOk || !navegador || navegador.page.isClosed()) {
        throw new Recusado(400, 'Sessão do GDIS não confirmada.')
      }
      if (tarefa) throw new Recusado(409, 'Já existe uma tarefa em andamento.')
      const esta = { cancelado: false }
      tarefa = esta
      andamento = { etapas: [], itens: {}, fim: null }
      const { context, page, dialogos } = navegador
      const total = pedido.itens.length
      return (async () => {
        try {
          const { incluidos } = await requisitarMaterial({
            context,
            page,
            dialogos,
            pedido,
            urlNota: urls.nota,
            emitir: avisar,
            cancelado: () => esta.cancelado,
            tempo,
          })
          avisar({
            tipo: 'fim',
            ok: true,
            incluidos,
            total,
            msg: `Pronto, ${incluidos} de ${total} itens incluídos. Revise no GDIS e clique em Salvar.`,
          })
        } catch (err) {
          if (err instanceof SessaoExpirada && sessaoOk) perder(err.message)
          const incluidos = Object.values(andamento.itens).filter((i) => i.estado === 'ok').length
          const msg =
            err instanceof SessaoExpirada
              ? `A tarefa parou: ${err.message}`
              : err instanceof Cancelado
                ? 'Cancelado. O que já foi preenchido continua no GDIS.'
                : `A nota não foi montada: ${err.message}`
          avisar({ tipo: 'fim', ok: false, incluidos, total, msg })
        } finally {
          tarefa = null
        }
      })()
    },

    cancelar() {
      if (tarefa) tarefa.cancelado = true
    },

    async encerrar() {
      await fecharNavegador()
    },
  }
}

module.exports = { criarSessao, Recusado }
