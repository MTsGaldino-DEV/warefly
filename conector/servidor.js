/**
 * Conector do Warefly × GDIS (contratadaweb). Roda na máquina do usuário,
 * porque o GDIS só é acessível pela rede interna.
 *
 * Executar:  npm start
 * Requer:    npm install  (usa o Edge instalado na máquina)
 */
const express = require('express')
const cors = require('cors')
const { CONFIG, abrirNavegador, ehLogin } = require('./gdis')
const { origemPermitida } = require('./origens')
const { validarPedido } = require('./validacao')
const { requisitarMaterial, Cancelado, SessaoExpirada } = require('./fluxos/requisicaoMaterial')

const PORTA = 3335 // 3333 é do Visão de Dono e 3334 do TraceOne

const app = express()

// Página HTTPS chamando http://localhost: o Edge pergunta antes (Private Network Access).
app.use((req, res, next) => {
  if (req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true')
  }
  next()
})
app.use((req, res, next) => {
  if (!origemPermitida(req.headers.origin)) {
    return res.status(403).json({ ok: false, erro: 'Origem não autorizada a usar o conector.' })
  }
  next()
})
app.use(cors({ origin: true }))
app.use(express.json({ limit: '1mb' }))

let navegador = null // { browser, context, page }
let sessaoOk = false
let tarefa = null // { cancelado: boolean }

// ── SSE ───────────────────────────────────────────────────────────────────────
let clientes = []

function emitir(evento) {
  const dados = `data: ${JSON.stringify(evento)}\n\n`
  clientes.forEach((res) => res.write(dados))
  console.log(`[${evento.tipo}] ${evento.msg ?? ''}${evento.codigo ? ` ${evento.codigo} ${evento.estado}` : ''}`)
}

app.get('/eventos', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
  clientes.push(res)
  req.on('close', () => {
    clientes = clientes.filter((c) => c !== res)
  })
})

app.get('/ping', (req, res) => {
  res.json({ ok: true, sessaoOk, tarefaAtiva: !!tarefa })
})

// ── Sessão ───────────────────────────────────────────────────────────────────
function perderSessao(msg) {
  sessaoOk = false
  emitir({ tipo: 'sessao_perdida', msg })
}

app.post('/sessao/iniciar', async (req, res) => {
  if (tarefa) return res.status(409).json({ ok: false, erro: 'Há uma tarefa em andamento.' })
  try {
    if (navegador) await navegador.browser.close().catch(() => {})
    sessaoOk = false
    navegador = await abrirNavegador()
    const atual = navegador
    atual.browser.on('disconnected', () => {
      if (navegador !== atual) return
      navegador = null
      if (tarefa) tarefa.cancelado = true
      perderSessao('O Edge foi fechado. Abra o login do GDIS de novo.')
    })
    await navegador.page.goto(CONFIG.loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    emitir({
      tipo: 'aguardando_login',
      msg: 'Edge aberto. Entre no GDIS (senha e reCAPTCHA) e depois clique em "Já entrei".',
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ ok: false, erro: `Não consegui abrir o GDIS: ${err.message}` })
  }
})

app.post('/sessao/confirmar', async (req, res) => {
  if (!navegador) return res.status(400).json({ ok: false, erro: 'Abra o login do GDIS primeiro.' })
  try {
    await navegador.page.goto(CONFIG.menuUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
    if (ehLogin(navegador.page.url())) {
      return res.status(400).json({ ok: false, erro: 'Ainda na tela de login. Entre no GDIS e tente de novo.' })
    }
    sessaoOk = true
    emitir({ tipo: 'sessao_ok', msg: 'Sessão do GDIS confirmada.' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message })
  }
})

// ── Requisição de material ───────────────────────────────────────────────────
app.post('/requisicao-material', (req, res) => {
  if (!sessaoOk || !navegador) return res.status(400).json({ ok: false, erro: 'Sessão do GDIS não confirmada.' })
  if (tarefa) return res.status(409).json({ ok: false, erro: 'Já existe uma tarefa em andamento.' })
  const erros = validarPedido(req.body)
  if (erros.length) return res.status(400).json({ ok: false, erro: erros.join(' ') })

  const pedido = {
    periodo: req.body.periodo,
    instalacao: String(req.body.instalacao),
    itens: req.body.itens.map((i) => ({ codigo: String(i.codigo), quantidade: i.quantidade })),
  }
  tarefa = { cancelado: false }
  res.json({ ok: true, total: pedido.itens.length })
  void executar(pedido, tarefa)
})

async function executar(pedido, esta) {
  const total = pedido.itens.length
  try {
    const { incluidos } = await requisitarMaterial({
      context: navegador.context,
      page: navegador.page,
      pedido,
      urlNota: CONFIG.notaCorretivaUrl,
      emitir,
      cancelado: () => esta.cancelado,
    })
    emitir({
      tipo: 'fim',
      ok: true,
      incluidos,
      total,
      msg: `Pronto, ${incluidos} de ${total} itens incluídos. Revise no GDIS e clique em Salvar.`,
    })
  } catch (err) {
    if (err instanceof SessaoExpirada) perderSessao(err.message)
    const msg =
      err instanceof Cancelado
        ? 'Cancelado. O que já foi preenchido continua no GDIS.'
        : `A nota não foi montada: ${err.message}`
    emitir({ tipo: 'fim', ok: false, incluidos: 0, total, msg })
  } finally {
    tarefa = null
  }
}

app.post('/cancelar', (req, res) => {
  if (tarefa) tarefa.cancelado = true
  res.json({ ok: true })
})

app.listen(PORTA, () => {
  console.log('')
  console.log('╔══════════════════════════════════════════════╗')
  console.log('║   Conector Warefly × GDIS                    ║')
  console.log(`║   Rodando em http://localhost:${PORTA}           ║`)
  console.log('║                                              ║')
  console.log('║   Deixe esta janela aberta enquanto usa.     ║')
  console.log('║   Para parar: Ctrl + C                       ║')
  console.log('╚══════════════════════════════════════════════╝')
  console.log('')
})
