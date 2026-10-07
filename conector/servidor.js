/**
 * Conector do Warefly × GDIS (contratadaweb). Roda na máquina do usuário,
 * porque o GDIS só é acessível pela rede interna.
 *
 * Executar:  npm start
 * Requer:    npm install  (usa o Edge instalado na máquina)
 */
const express = require('express')
const cors = require('cors')
const { origemPermitida } = require('./origens')
const { validarPedido } = require('./validacao')
const { criarSessao, Recusado } = require('./sessao')

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

const sessao = criarSessao({ emitir })

/** Estado completo, para a aba se recuperar ao abrir ou recarregar. */
app.get('/ping', (req, res) => {
  res.json({ ok: true, ...sessao.estado() })
})

function responderErro(res, err) {
  const status = err instanceof Recusado ? err.status : 500
  res.status(status).json({ ok: false, erro: err.message })
}

app.post('/sessao/iniciar', async (req, res) => {
  try {
    await sessao.iniciar()
    res.json({ ok: true })
  } catch (err) {
    if (!(err instanceof Recusado)) err.message = `Não consegui abrir o GDIS: ${err.message}`
    responderErro(res, err)
  }
})

app.post('/sessao/confirmar', async (req, res) => {
  try {
    await sessao.confirmar()
    res.json({ ok: true })
  } catch (err) {
    responderErro(res, err)
  }
})

app.post('/requisicao-material', (req, res) => {
  const erros = validarPedido(req.body)
  if (erros.length) return res.status(400).json({ ok: false, erro: erros.join(' ') })
  const pedido = {
    periodo: req.body.periodo,
    instalacao: String(req.body.instalacao),
    itens: req.body.itens.map((i) => ({ codigo: String(i.codigo), quantidade: i.quantidade })),
  }
  try {
    void sessao.iniciarTarefa(pedido)
    res.json({ ok: true, total: pedido.itens.length })
  } catch (err) {
    responderErro(res, err)
  }
})

app.post('/cancelar', (req, res) => {
  sessao.cancelar()
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
