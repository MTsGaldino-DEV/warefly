const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const express = require('express')
const { abrirNavegador } = require('../gdis')
const { criarSessao } = require('../sessao')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function esperar(condicao, ms = 5000) {
  const fim = Date.now() + ms
  while (Date.now() < fim) {
    if (condicao()) return
    await sleep(100)
  }
  throw new Error('Condição não aconteceu a tempo.')
}

let servidor, base

test.before(async () => {
  const app = express()
  app.use(express.static(path.join(__dirname, 'gdis-falso')))
  await new Promise((r) => (servidor = app.listen(0, r)))
  base = `http://127.0.0.1:${servidor.address().port}`
})

test.after(() => servidor.close())

function nova() {
  const eventos = []
  const sessao = criarSessao({
    emitir: (e) => eventos.push(e),
    urls: { login: `${base}/login.html`, menu: `${base}/nota.html`, nota: `${base}/nota.html` },
    abrir: () => abrirNavegador({ headless: true }),
    tempo: { campos: 3000 },
  })
  return { sessao, eventos }
}

test('fechar a janela do Edge derruba a sessão', async () => {
  const { sessao, eventos } = nova()
  await sessao.iniciar()
  await sessao.confirmar()
  assert.equal(sessao.estado().sessaoOk, true)

  await sessao.paginaDoRobo().close()
  await esperar(() => !sessao.estado().sessaoOk)
  assert.ok(eventos.some((e) => e.tipo === 'sessao_perdida'))
  assert.throws(() => sessao.iniciarTarefa({ periodo: '2026-05', instalacao: '3013248220', itens: [] }), /Sessão/)
  await sessao.encerrar()
})

test('a sessão guarda o login pendente e o andamento da última tarefa', async () => {
  const { sessao } = nova()
  await sessao.iniciar()
  assert.equal(sessao.estado().aguardandoLogin, true)
  await sessao.confirmar()
  assert.equal(sessao.estado().aguardandoLogin, false)

  const fim = sessao.iniciarTarefa({
    periodo: '2026-05',
    instalacao: '3013248220',
    itens: [
      { codigo: '1776', quantidade: 2 },
      { codigo: '999999', quantidade: 1 },
    ],
  })
  assert.equal(sessao.estado().tarefaAtiva, true)
  await fim

  const { andamento, tarefaAtiva } = sessao.estado()
  assert.equal(tarefaAtiva, false)
  assert.equal(andamento.itens['1776'].estado, 'ok')
  assert.equal(andamento.itens['999999'].estado, 'erro')
  assert.ok(andamento.etapas.some((e) => e.id === 'servico' && e.estado === 'ok'))
  assert.equal(andamento.fim.ok, true)
  assert.equal(andamento.fim.incluidos, 1)
  await sessao.encerrar()
})
