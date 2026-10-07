const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const express = require('express')
const { abrirNavegador } = require('../gdis')
const { requisitarMaterial, incluirItem } = require('../fluxos/requisicaoMaterial')

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

async function rodar(pedido) {
  const eventos = []
  const resultado = await requisitarMaterial({
    context: nav.context,
    page: nav.page,
    pedido,
    urlNota: `${base}/nota.html`,
    emitir: (e) => eventos.push(e),
    cancelado: () => false,
    tempo: { campos: 3000 },
  })
  return { resultado, eventos }
}

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
