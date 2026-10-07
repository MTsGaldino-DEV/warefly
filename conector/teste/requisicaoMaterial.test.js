const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const express = require('express')
const { abrirNavegador } = require('../gdis')
const { requisitarMaterial, incluirItem, Cancelado, SessaoExpirada } = require('../fluxos/requisicaoMaterial')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let servidor, base, nav

test.before(async () => {
  const app = express()
  app.use(express.static(path.join(__dirname, 'gdis-falso')))
  await new Promise((r) => (servidor = app.listen(0, r)))
  base = `http://127.0.0.1:${servidor.address().port}`
  nav = await abrirNavegador({ headless: true })
})

test.after(async () => {
  await nav.browser.close()
  servidor.close()
})

async function rodar(pedido, extras = {}) {
  const eventos = []
  const resultado = await requisitarMaterial({
    context: nav.context,
    page: nav.page,
    dialogos: nav.dialogos,
    pedido,
    urlNota: `${base}/nota.html`,
    emitir: (e) => eventos.push(e),
    cancelado: () => false,
    tempo: { campos: 3000 },
    ...extras,
  })
  return { resultado, eventos }
}

const UM_ITEM = { periodo: '2026-05', instalacao: '3013248220', itens: [{ codigo: '1776', quantidade: 1 }] }

const itensDe = (eventos, estado) => eventos.filter((e) => e.tipo === 'item' && e.estado === estado)

test('preenche a nota, inclui os materiais e não salva', async () => {
  const { resultado, eventos } = await rodar({
    periodo: '2026-05',
    instalacao: '3013248220',
    itens: [
      { codigo: '1776', quantidade: 3 },
      { codigo: '999999', quantidade: 1 },
      { codigo: '240', quantidade: 12 },
    ],
  })
  assert.deepEqual(resultado, { incluidos: 2, total: 3 })
  assert.deepEqual(itensDe(eventos, 'ok').map((e) => e.codigo), ['1776', '240'])
  const [falhou] = itensDe(eventos, 'erro')
  assert.equal(falhou.codigo, '999999')
  assert.match(falhou.msg, /não disponível/)

  const nota = nav.page
  assert.equal(await nota.inputValue('[name="motivoCausa"]'), '22')
  assert.equal(await nota.inputValue('[name="rede"]'), '3')
  assert.equal(
    await nota.inputValue('[name="infComplementares"]'),
    'REQUISICAO DE MATERIAIS DE MANUTENCAO PARA O PERIODO 0105 3005',
  )
  assert.equal(await nota.inputValue('[name="componente"]'), '649')
  const linhas = await nota.locator('#tmateriais_291_1 tr').allTextContents()
  assert.equal(linhas.length, 2)
  assert.match(linhas[0], /1776.*3/)
  assert.equal(nav.context.pages().length, 1, 'a janela de materiais foi fechada')
  assert.ok(eventos.some((e) => e.tipo === 'etapa' && e.id === 'fim' && e.estado === 'ok'))
})

test('instalação não encontrada para na etapa 2 com o alerta do GDIS', async () => {
  await assert.rejects(
    rodar({ periodo: '2026-05', instalacao: '1111111111', itens: [{ codigo: '1776', quantidade: 1 }] }),
    /Instalação não encontrada/,
  )
})

// A validação do conector barra códigos repetidos, então o alerta de repetido
// só acontece quando o material já estava na nota: o teste reabre a janela e
// chama incluirItem direto com um código que já entrou.
test('alerta do GDIS na inclusão vira erro do item', async () => {
  await rodar({ periodo: '2026-05', instalacao: '3013248220', itens: [{ codigo: '1776', quantidade: 1 }] })
  const nota = nav.page
  const [janela] = await Promise.all([nav.context.waitForEvent('page'), nota.click('#btoIncluiMaterial')])
  await janela.waitForLoadState('load')
  const dialogos = []
  janela.on('dialog', (d) => {
    dialogos.push(d.message())
    d.accept()
  })
  await assert.rejects(incluirItem({ janela, nota, item: { codigo: '1776', quantidade: 1 }, dialogos }), /já existe na lista/)
  await janela.close()
})

test('fora do robô, um confirm do GDIS fica esperando a pessoa', async () => {
  await rodar(UM_ITEM)
  const outra = await nav.context.newPage()
  await outra.goto(`${base}/novo.html`)
  await outra.evaluate(() => {
    setTimeout(() => {
      window.resposta = confirm('Confirma a gravação?')
    }, 0)
  })
  await sleep(300)
  const lendo = outra.evaluate(() => String(window.resposta)).catch(() => 'fechada')
  const resposta = await Promise.race([lendo, sleep(1500).then(() => 'pendente')])
  assert.equal(resposta, 'pendente', 'o confirm não pode ser respondido sozinho')
  await outra.close({ runBeforeUnload: false })
})

test('cancelar no meio não deixa a janela de materiais travar a próxima', async () => {
  let chamadas = 0
  const pedido = { ...UM_ITEM, itens: [{ codigo: '1776', quantidade: 1 }, { codigo: '240', quantidade: 2 }] }
  // 5 etapas antes dos itens + 1 por item: a 7ª consulta é antes do segundo item.
  await assert.rejects(rodar(pedido, { cancelado: () => ++chamadas >= 7 }), Cancelado)
  const { resultado } = await rodar(UM_ITEM)
  assert.deepEqual(resultado, { incluidos: 1, total: 1 })
})

test('o robô só mexe na própria aba, mesmo com outra nota aberta', async () => {
  const outra = await nav.context.newPage()
  await outra.goto(`${base}/novo.html`)
  await rodar(UM_ITEM)
  assert.equal(await outra.inputValue('[name="identificador"]'), '')
  assert.equal(await nav.page.inputValue('[name="identificador"]'), '3013248220')
  await outra.close()
})

// Fecha a aba do robô: precisa ser o último teste do arquivo.
test('fechar o Edge no meio para a tarefa como sessão perdida', async () => {
  let chamadas = 0
  const pedido = { ...UM_ITEM, itens: [{ codigo: '1776', quantidade: 1 }, { codigo: '240', quantidade: 2 }] }
  const cancelado = async () => {
    if (++chamadas === 6) await nav.page.close({ runBeforeUnload: false })
    return false
  }
  await assert.rejects(rodar(pedido, { cancelado }), SessaoExpirada)
})
