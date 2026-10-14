const test = require('node:test')
const assert = require('node:assert/strict')
const { codigosPeriodo, frasePeriodo } = require('../periodo')
const { validarPedido } = require('../validacao')
const { origemPermitida } = require('../origens')
const { bannerInicio, linhaAutoria, registrarAutoria } = require('../autoria')
const { version } = require('../package.json')

test('período vira 01MM 30MM', () => {
  assert.equal(codigosPeriodo('2026-05'), '0105 3005')
  assert.equal(codigosPeriodo('2026-10'), '0110 3010')
  assert.equal(frasePeriodo('2026-05'), 'REQUISICAO DE MATERIAIS DE MANUTENCAO PARA O PERIODO 0105 3005')
})

test('período inválido dá erro', () => {
  for (const p of ['2026-13', '2026-00', '05/2026', '', undefined]) assert.throws(() => codigosPeriodo(p))
})

const valido = { periodo: '2026-05', instalacao: '3013248220', itens: [{ codigo: '1776', quantidade: 2 }] }

test('pedido válido não tem erros', () => {
  assert.deepEqual(validarPedido(valido), [])
})

test('cada regra do pedido', () => {
  assert.match(validarPedido({ ...valido, instalacao: '123' }).join(), /10 dígitos/)
  assert.match(validarPedido({ ...valido, itens: [] }).join(), /ao menos um item/)
  assert.match(validarPedido({ ...valido, itens: [{ codigo: '17A', quantidade: 1 }] }).join(), /só números/)
  assert.match(validarPedido({ ...valido, itens: [{ codigo: '1', quantidade: 0 }] }).join(), /1 a 999/)
  assert.match(validarPedido({ ...valido, itens: [{ codigo: '1', quantidade: 1000 }] }).join(), /1 a 999/)
  assert.match(validarPedido({ ...valido, itens: [{ codigo: '1', quantidade: 1.5 }] }).join(), /1 a 999/)
  assert.match(
    validarPedido({ ...valido, itens: [{ codigo: '1', quantidade: 1 }, { codigo: '1', quantidade: 2 }] }).join(),
    /repetido/,
  )
  assert.match(validarPedido({ ...valido, periodo: 'x' }).join(), /Período inválido/)
})

test('origens permitidas', () => {
  assert.equal(origemPermitida('http://localhost:5173', []), true)
  assert.equal(origemPermitida('http://127.0.0.1:4173', []), true)
  assert.equal(origemPermitida('https://warefly.exemplo.com', ['https://warefly.exemplo.com']), true)
  assert.equal(origemPermitida('https://site-qualquer.com', []), false)
  assert.equal(origemPermitida(undefined, []), true)
})

test('autoria do conector', () => {
  assert.equal(
    linhaAutoria(),
    `Warefly · conector v${version} · Desenvolvido por Matheus De Oliveira Galdino, 2026 · devmatheus94@gmail.com`,
  )
  const saida = []
  const linha = registrarAutoria('Requisição de material no GDIS', new Date('2026-10-14T17:40:00Z'), (l) => saida.push(l))
  assert.deepEqual(saida, [linha])
  assert.match(linha, /^\[autoria\] 14\/10\/2026,? 14:40:00 · Requisição de material no GDIS · Warefly · conector v/)
})

test('quadro de abertura traz a assinatura', () => {
  const quadro = bannerInicio(3335)
  assert.match(quadro, /║ {3}Desenvolvido por Matheus Galdino +║/)
  assert.match(quadro, /http:\/\/localhost:3335/)
  const linhas = quadro.split('\n').filter((l) => /^[╔║╚]/.test(l))
  assert.ok(linhas.every((l) => l.length === linhas[0].length), 'todas as linhas do quadro com a mesma largura')
})
