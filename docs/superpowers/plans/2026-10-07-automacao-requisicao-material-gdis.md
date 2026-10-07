# Automação de requisição de material no GDIS — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aba **Automação** (só admin) que monta a lista de materiais e manda o conector local preencher a nota corretiva de requisição no GDIS, parando antes de salvar.

**Architecture:** A pasta `conector/` vira o conector do Warefly (Express + Playwright/Edge na porta 3335), com o servidor separado do fluxo da nota. O fluxo é testado contra um GDIS falso servido localmente, que imita os nomes e ids das telas reais. O app ganha uma página que fala com o conector por `fetch` e SSE.

**Tech Stack:** Node 24 (CommonJS, `node --test`), Express 4, Playwright (canal `msedge`); React 19 + Vite + Vitest + Playwright e2e no app.

**Spec:** [docs/superpowers/specs/2026-10-07-automacao-requisicao-material-gdis-design.md](../specs/2026-10-07-automacao-requisicao-material-gdis-design.md)

## Global Constraints

- Conector na porta **3335**; GDIS em `http://192.168.1.110/contratadaweb`.
- O robô **nunca** clica em Salvar.
- Frase: `REQUISICAO DE MATERIAIS DE MANUTENCAO PARA O PERIODO 01MM 30MM` (maio → `0105 3005`).
- Validação: período `AAAA-MM`; instalação com 10 dígitos; ≥1 item; código só dígitos; quantidade inteira 1–999; sem código repetido.
- Aba só para `ehAdmin`, rota `/automacao/requisicao-material`, grupo de menu `Automação`.
- Nada é gravado no banco; `localStorage` só com `try/catch`.
- CORS do conector: só `http://localhost:*`, `http://127.0.0.1:*` e as origens em `WAREFLY_ORIGENS`; responde `Access-Control-Allow-Private-Network: true`.
- Textos da interface em português, no tom das telas existentes.

## Review Focus

- Lista colada do Excel com cabeçalho, linhas vazias ou vírgula decimal → a linha ruim é apontada pelo número e as boas entram (teste em `requisicaoGdis.test.ts`).
- Instalação que o GDIS não reconhece → a tarefa para na etapa 2 com mensagem clara, sem seguir preenchendo (teste do fluxo com o GDIS falso).
- Código que não existe na janela de materiais → só aquele item falha, os demais entram (teste do fluxo).
- Alerta do GDIS ao incluir material (ex.: repetido) → vira o erro do item com o texto do alerta (teste do fluxo).
- Usuário fecha o Edge no meio → conector marca a sessão como perdida e a aba volta a pedir login (tratado em `servidor.js`, conferido no teste manual).

---

### Task 1: Funções puras do conector (período, validação, origens)

**Files:**
- Create: `conector/periodo.js`, `conector/validacao.js`, `conector/origens.js`
- Test: `conector/teste/puros.test.js`
- Modify: `conector/package.json`

**Interfaces:**
- Produces: `codigosPeriodo(periodo: string): string`, `frasePeriodo(periodo: string): string`, `validarPedido(pedido): string[]`, `origemPermitida(origem?: string, extras?: string[]): boolean`

- [ ] **Step 1: Teste que falha** — `conector/teste/puros.test.js`:

```js
const test = require('node:test')
const assert = require('node:assert/strict')
const { codigosPeriodo, frasePeriodo } = require('../periodo')
const { validarPedido } = require('../validacao')
const { origemPermitida } = require('../origens')

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
```

- [ ] **Step 2: Rodar e ver falhar** — `cd conector && node --test teste/` → FAIL (`Cannot find module '../periodo'`).

- [ ] **Step 3: Implementar**

`conector/periodo.js`:

```js
/** "2026-05" → "0105 3005": do dia 01 ao dia 30 do mês, sem barras. */
function codigosPeriodo(periodo) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(periodo ?? ''))
  const mes = m ? Number(m[2]) : 0
  if (mes < 1 || mes > 12) throw new Error(`Período inválido: "${periodo ?? ''}". Use AAAA-MM.`)
  return `01${m[2]} 30${m[2]}`
}

function frasePeriodo(periodo) {
  return `REQUISICAO DE MATERIAIS DE MANUTENCAO PARA O PERIODO ${codigosPeriodo(periodo)}`
}

module.exports = { codigosPeriodo, frasePeriodo }
```

`conector/validacao.js`:

```js
const { codigosPeriodo } = require('./periodo')

/** Erros do pedido de requisição; lista vazia quando está tudo certo. */
function validarPedido(pedido) {
  const { periodo, instalacao, itens } = pedido || {}
  const erros = []
  try {
    codigosPeriodo(periodo)
  } catch (e) {
    erros.push(e.message)
  }
  if (!/^\d{10}$/.test(String(instalacao ?? ''))) erros.push('A instalação deve ter 10 dígitos.')
  if (!Array.isArray(itens) || itens.length === 0) {
    erros.push('Informe ao menos um item.')
    return erros
  }
  const vistos = new Set()
  itens.forEach((item, i) => {
    const n = i + 1
    const codigo = String(item?.codigo ?? '')
    const qtd = item?.quantidade
    if (!/^\d+$/.test(codigo)) erros.push(`Item ${n}: o código "${codigo}" deve ter só números.`)
    else if (vistos.has(codigo)) erros.push(`Item ${n}: código ${codigo} repetido.`)
    vistos.add(codigo)
    if (!Number.isInteger(qtd) || qtd < 1 || qtd > 999) erros.push(`Item ${n}: a quantidade deve ser inteira, de 1 a 999.`)
  })
  return erros
}

module.exports = { validarPedido }
```

`conector/origens.js`:

```js
/**
 * Quem pode chamar o conector: o Warefly rodando local e as origens listadas
 * em WAREFLY_ORIGENS (separadas por vírgula), como o domínio de produção.
 * Chamadas sem Origin (curl, scripts) passam: CORS só protege do navegador.
 */
const LOCAIS = [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/]

function origensExtras() {
  return (process.env.WAREFLY_ORIGENS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function origemPermitida(origem, extras = origensExtras()) {
  if (!origem) return true
  return LOCAIS.some((r) => r.test(origem)) || extras.includes(origem)
}

module.exports = { origemPermitida }
```

`conector/package.json`:

```json
{
  "name": "conector-warefly",
  "version": "2.0.0",
  "private": true,
  "description": "Conector local do Warefly: automações no GDIS pela rede interna",
  "main": "servidor.js",
  "scripts": {
    "start": "node servidor.js",
    "test": "node --test teste/"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "playwright": "^1.44.0"
  }
}
```

- [ ] **Step 4: Rodar e ver passar** — `node --test teste/` → PASS.

- [ ] **Step 5: Commit** — `git add conector/periodo.js conector/validacao.js conector/origens.js conector/teste conector/package.json conector/package-lock.json conector/.gitignore` · `feat(conector): período, validação e origens do conector do Warefly`

---

### Task 2: Fluxo da nota contra um GDIS falso

**Files:**
- Create: `conector/gdis.js`, `conector/fluxos/requisicaoMaterial.js`
- Create: `conector/teste/gdis-falso/nota.html`, `novo.html`, `material.html`
- Test: `conector/teste/requisicaoMaterial.test.js`

**Interfaces:**
- Consumes: `frasePeriodo` (Task 1)
- Produces:
  - `gdis.js`: `CONFIG = { loginUrl, menuUrl, notaCorretivaUrl }`, `abrirNavegador({ headless?: boolean }): Promise<{ browser, context, page }>`, `ehLogin(url: string): boolean`
  - `fluxos/requisicaoMaterial.js`: `requisitarMaterial({ context, page, pedido, urlNota, emitir, cancelado, tempo? }): Promise<{ incluidos: number, total: number }>`; classes `Cancelado`, `SessaoExpirada` (estendem `Error`)
  - Eventos emitidos: `{ tipo: 'etapa', id, msg, estado }`, `{ tipo: 'item', codigo, estado, msg? }`, `{ tipo: 'debug', msg }`. `estado` ∈ `andamento | ok | erro`.

O GDIS falso imita só o que o robô toca: `btoNovo` numa tela com iframe; `identificador` + `BotaoIdentificador` que preenche `endereco` (ou alerta "Instalação não encontrada"); `motivoCausa`, `rede`, `infComplementares`, `selCodServico` que carrega `componente` com atraso; `btoServicos` que cria a linha com `a#btoIncluiMaterial`; a janela com `codMaterial`, `txtQtdeMat`, `btoMateriais` chamando `window.opener.addMaterial`, que alerta "Este material já existe na lista." no repetido.

- [ ] **Step 1: GDIS falso**

`conector/teste/gdis-falso/nota.html`:

```html
<!doctype html>
<html><body>
  <h1>Cadastro de NSMC</h1>
  <iframe id="FrameNsProgramadaJsp" srcdoc="<input type='button' name='btoNovo' value='Novo' onclick=&quot;top.location.href='novo.html'&quot;>"></iframe>
</body></html>
```

`conector/teste/gdis-falso/novo.html`:

```html
<!doctype html>
<html><body>
<form name="dados">
  <input name="identificador"> <input type="button" name="BotaoIdentificador" value="Buscar">
  <input name="endereco" readonly> <input name="subalim" id="subalim" readonly>
  <select name="motivoCausa" id="motivoCausa"><option value=""></option><option value="17">17 - MATERIAL</option><option value="22">22 - PROBLEMAS OPERACIONAIS NO SISTEMA</option></select>
  <select name="rede" id="rede"><option value=""></option><option value="1">BT</option><option value="2">MT</option><option value="3">BT/MT</option></select>
  <textarea name="infComplementares" id="infComplementares"></textarea>
  <select id="selCodServico" name="selCodServico"><option value=""></option><option value="22">22</option><option value="291">291</option></select>
  <select name="componente" id="componente"><option value=""></option></select>
  <input type="button" id="btoServicos" name="btoServicos" value="+ Serviços">
  <input type="Submit" value="Salvar" id="inserir" name="inserir" disabled>
  <table><tbody id="tservicos"></tbody></table>
</form>
<script>
  var $ = function (n) { return document.getElementsByName(n)[0] }
  $('BotaoIdentificador').onclick = function () {
    setTimeout(function () {
      if ($('identificador').value === '3013248220') { $('endereco').value = 'RUA TESTE'; $('subalim').value = 'ABC01' }
      else alert('Instalação não encontrada.')
    }, 200)
  }
  $('selCodServico').addEventListener('change', function () {
    setTimeout(function () { $('componente').innerHTML = '<option value=""></option><option value="649">MATERIAL</option><option value="12">POSTE</option>' }, 200)
  })
  var servico = null
  $('btoServicos').onclick = function () {
    if ($('componente').value !== '649') return alert('Escolha o componente')
    servico = { codServ: '291', poste: '1', idTrMaterial: 'tmateriais_291_1', materiais: [] }
    document.getElementById('tservicos').innerHTML =
      '<tr><td>0</td><td>1</td><td>291 - REPOSICAO DE MATERIAL</td><td>MATERIAL</td>' +
      '<td><a id="btoIncluiMaterial" style="cursor:pointer">Incluir Materiais</a></td></tr>' +
      '<tr><td colspan="10"><table><tbody id="tmateriais_291_1"></tbody></table></td></tr>'
    document.getElementById('btoIncluiMaterial').onclick = function () {
      var j = window.open('material.html', 'materiais')
      j.addEventListener('load', function () { j.setServico(servico) })
    }
  }
  window.findObject = function (id) { return document.getElementById(id) }
  window.addMaterial = function (idMaterial, s, codigo, desc, qtd) {
    if (s.materiais.indexOf(codigo) >= 0) return alert('Material não incluído.\nEste material já existe na lista.')
    s.materiais.push(codigo)
    document.getElementById(s.idTrMaterial).insertAdjacentHTML('beforeend',
      '<tr><td>' + codigo + '</td><td>' + desc + '</td><td>' + qtd + '</td><td>x</td></tr>')
  }
</script>
</body></html>
```

`conector/teste/gdis-falso/material.html`:

```html
<!doctype html>
<html><body>
<select id="codMaterial" name="codMaterial"><option value=""></option><option value="1776">1776</option><option value="379454">379454</option><option value="240">240</option></select>
<select id="selMaterial" name="selMaterial"><option value=""></option><option value="1776">PARAFUSO</option><option value="379454">ACESSÓRIO DESCONECTAVEL</option><option value="240">CABO 240MM2</option></select>
<input type="text" id="txtQtdeMat" name="txtQtdeMat" maxlength="3">
<input type="button" name="btoMateriais" value="+ Materiais"> <input type="button" name="btoFechar" value="Fechar">
<script>
  var servico
  function setServico(s) { servico = s }
  var cod = document.getElementById('codMaterial'), desc = document.getElementById('selMaterial')
  cod.addEventListener('change', function () { desc.value = cod.value })
  document.getElementsByName('btoMateriais')[0].onclick = function () {
    if (!desc.value) return alert('Escolha o material')
    if (!document.getElementById('txtQtdeMat').value.trim()) return alert('Preencha a quantidade de materiais.')
    window.opener.addMaterial(0, servico, desc.value, desc.options[desc.selectedIndex].text, document.getElementById('txtQtdeMat').value)
    cod.selectedIndex = 0; desc.selectedIndex = 0; document.getElementById('txtQtdeMat').value = ''
  }
</script>
</body></html>
```

- [ ] **Step 2: Teste que falha** — `conector/teste/requisicaoMaterial.test.js`:

```js
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const express = require('express')
const { abrirNavegador } = require('../gdis')
const { requisitarMaterial } = require('../fluxos/requisicaoMaterial')

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
const { incluirItem } = require('../fluxos/requisicaoMaterial')

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
```

- [ ] **Step 3: Rodar e ver falhar** — `node --test teste/` → FAIL (`Cannot find module '../gdis'`).

- [ ] **Step 4: Implementar** `conector/gdis.js`:

```js
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
```

`conector/fluxos/requisicaoMaterial.js`:

```js
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
      const comNovo = await acharFrame(context, '[name="btoNovo"], input[type="button"][value="Novo"]', espera.campos)
      await comNovo.locator('[name="btoNovo"], input[type="button"][value="Novo"]').first().click()
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
```

- [ ] **Step 5: Rodar e ver passar** — `node --test teste/` → PASS (precisa do Edge instalado; o canal `msedge` usa o Edge da máquina).

- [ ] **Step 6: Commit** — `feat(conector): fluxo da nota corretiva de requisição de material`

---

### Task 3: Servidor do conector

**Files:**
- Create: `conector/servidor.js`, `conector/README.md`
- Delete: `conector/conector.js`

**Interfaces:**
- Consumes: `CONFIG`, `abrirNavegador`, `ehLogin` (Task 2); `requisitarMaterial`, `Cancelado`, `SessaoExpirada` (Task 2); `validarPedido`, `origemPermitida` (Task 1)
- Produces (HTTP, porta 3335): `GET /ping → { ok, sessaoOk, tarefaAtiva }`; `GET /eventos` (SSE); `POST /sessao/iniciar`; `POST /sessao/confirmar`; `POST /requisicao-material` (corpo `{ periodo, instalacao, itens: [{ codigo, quantidade }] }`); `POST /cancelar`. Erros: `{ ok: false, erro: string }` com status 400/403/409/500. Eventos de sessão: `aguardando_login`, `sessao_ok`, `sessao_perdida`; fim de tarefa: `{ tipo: 'fim', ok: boolean, incluidos, total, msg }`.

- [ ] **Step 1: Implementar** `conector/servidor.js`:

```js
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
  if (evento.tipo !== 'debug') console.log(`[${evento.tipo}] ${evento.msg ?? evento.codigo ?? ''}`)
  else console.log(`[debug] ${evento.msg}`)
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
```

`fim` com `ok: false` informa `incluidos: 0` porque o total parcial não é conhecido fora do fluxo; os eventos `item` já mostram o que entrou.

`conector/README.md`:

```markdown
# Conector Warefly × GDIS

Roda na sua máquina e faz automações no GDIS (rede interna da Cemig) a pedido da aba **Automação** do Warefly.

## Instalar

    cd conector
    npm install

Usa o Microsoft Edge instalado na máquina.

## Usar

    npm start

Deixe a janela aberta. No Warefly, abra **Automação → Solicitar material no GDIS**, clique em **Abrir login do GDIS**, entre no GDIS (senha e reCAPTCHA) e clique em **Já entrei**.

O robô preenche a nota e **não salva**: revise no GDIS e clique em Salvar.

## Produção

Por segurança o conector só aceita chamadas do Warefly rodando local. Para o Warefly publicado, informe o endereço:

    set WAREFLY_ORIGENS=https://seu-warefly.vercel.app
    npm start

## Testes

    npm test

Os testes do fluxo rodam contra um GDIS falso em `teste/gdis-falso/`.
```

- [ ] **Step 2: Conferir que sobe** — `node -e "require('./servidor.js')"` em segundo plano, `curl http://localhost:3335/ping` → `{"ok":true,"sessaoOk":false,"tarefaAtiva":false}`; `curl -H "Origin: https://site-qualquer.com" http://localhost:3335/ping` → 403.

- [ ] **Step 3: Rodar `npm test`** → PASS.

- [ ] **Step 4: Commit** — `git rm --cached` não é preciso (conector.js nunca foi versionado); apagar `conector/conector.js`. `feat(conector): servidor do Warefly na porta 3335 com sessão GDIS e requisição de material`

---

### Task 4: Regras da aba no app (funções puras)

**Files:**
- Create: `app/src/lib/requisicaoGdis.ts`
- Test: `app/src/lib/requisicaoGdis.test.ts`

**Interfaces:**
- Produces:
  - `type ItemRequisicao = { codigo: string; quantidade: string; materialId: string | null }`
  - `INSTALACAO_PADRAO = '3013248220'`
  - `codigosPeriodo(periodo: string): string` (lança em período inválido)
  - `frasePeriodo(periodo: string): string`
  - `mesSeguinte(hoje?: Date): string` → `'AAAA-MM'`
  - `lerLista(texto: string, jaNaLista: Set<string>, idDoCodigo: (codigo: string) => string | null): { itens: ItemRequisicao[]; erros: string[] }`
  - `validarRequisicao(periodo: string, instalacao: string, itens: ItemRequisicao[]): string[]`
  - `paraEnvio(periodo: string, instalacao: string, itens: ItemRequisicao[]): { periodo: string; instalacao: string; itens: { codigo: string; quantidade: number }[] }`

- [ ] **Step 1: Teste que falha** — `app/src/lib/requisicaoGdis.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { codigosPeriodo, frasePeriodo, lerLista, mesSeguinte, paraEnvio, validarRequisicao } from './requisicaoGdis'

const catalogo: Record<string, string> = { '1776': 'id-1776', '240': 'id-240' }
const idDoCodigo = (c: string) => catalogo[c] ?? null

describe('período', () => {
  it('vira 01MM 30MM', () => {
    expect(codigosPeriodo('2026-05')).toBe('0105 3005')
    expect(codigosPeriodo('2026-10')).toBe('0110 3010')
    expect(frasePeriodo('2026-05')).toBe('REQUISICAO DE MATERIAIS DE MANUTENCAO PARA O PERIODO 0105 3005')
  })
  it('recusa mês inválido', () => {
    expect(() => codigosPeriodo('2026-13')).toThrow()
    expect(() => codigosPeriodo('')).toThrow()
  })
  it('mês seguinte vira o ano em dezembro', () => {
    expect(mesSeguinte(new Date(2026, 9, 7))).toBe('2026-11')
    expect(mesSeguinte(new Date(2026, 11, 31))).toBe('2027-01')
  })
})

describe('lerLista', () => {
  it('aceita ponto e vírgula, tab e espaços e ignora linhas vazias', () => {
    const r = lerLista('1776;3\n\n240\t12\n999999   1\n', new Set(), idDoCodigo)
    expect(r.erros).toEqual([])
    expect(r.itens).toEqual([
      { codigo: '1776', quantidade: '3', materialId: 'id-1776' },
      { codigo: '240', quantidade: '12', materialId: 'id-240' },
      { codigo: '999999', quantidade: '1', materialId: null },
    ])
  })
  it('aponta a linha ruim pelo número e mantém as boas', () => {
    const r = lerLista('Código;Qtd\n1776;2\n240;1,5\n123', new Set(), idDoCodigo)
    expect(r.itens.map((i) => i.codigo)).toEqual(['1776'])
    expect(r.erros).toEqual([
      'Linha 1: use "código; quantidade" com código só de números.',
      'Linha 3: a quantidade deve ser inteira, de 1 a 999.',
      'Linha 4: use "código; quantidade" com código só de números.',
    ])
  })
  it('não repete código já na lista nem dentro do texto', () => {
    const r = lerLista('1776;1\n240;1\n240;2', new Set(['1776']), idDoCodigo)
    expect(r.itens.map((i) => i.codigo)).toEqual(['240'])
    expect(r.erros).toEqual(['Linha 1: o código 1776 já está na lista.', 'Linha 3: o código 240 já está na lista.'])
  })
})

describe('validarRequisicao', () => {
  const ok = [{ codigo: '1776', quantidade: '2', materialId: 'id-1776' }]
  it('passa quando está certo', () => {
    expect(validarRequisicao('2026-05', '3013248220', ok)).toEqual([])
  })
  it('aponta cada problema', () => {
    expect(validarRequisicao('2026-05', '301', ok)).toContain('A instalação deve ter 10 dígitos.')
    expect(validarRequisicao('2026-05', '3013248220', [])).toContain('Informe ao menos um item.')
    expect(validarRequisicao('2026-05', '3013248220', [{ ...ok[0], quantidade: '' }])).toContain(
      '1776: a quantidade deve ser inteira, de 1 a 999.',
    )
    expect(validarRequisicao('x', '3013248220', ok)[0]).toMatch(/mês/)
  })
})

it('paraEnvio converte quantidade em número', () => {
  expect(paraEnvio('2026-05', '3013248220', [{ codigo: '1776', quantidade: '2', materialId: null }])).toEqual({
    periodo: '2026-05',
    instalacao: '3013248220',
    itens: [{ codigo: '1776', quantidade: 2 }],
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `cd app && npx vitest run src/lib/requisicaoGdis.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar** `app/src/lib/requisicaoGdis.ts`:

```ts
/** Regras da requisição de material no GDIS (as mesmas do conector). */

export type ItemRequisicao = { codigo: string; quantidade: string; materialId: string | null }

export const INSTALACAO_PADRAO = '3013248220'

/** "2026-05" → "0105 3005": do dia 01 ao dia 30 do mês, sem barras. */
export function codigosPeriodo(periodo: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(periodo)
  const mes = m ? Number(m[2]) : 0
  if (!m || mes < 1 || mes > 12) throw new Error('Escolha o mês da requisição.')
  return `01${m[2]} 30${m[2]}`
}

export function frasePeriodo(periodo: string): string {
  return `REQUISICAO DE MATERIAIS DE MANUTENCAO PARA O PERIODO ${codigosPeriodo(periodo)}`
}

export function mesSeguinte(hoje = new Date()): string {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function qtdValida(q: string): boolean {
  if (!/^\d+$/.test(q.trim())) return false
  const n = Number(q)
  return n >= 1 && n <= 999
}

/** Lê "código; quantidade" por linha (aceita ;, tab ou espaços, como vem do Excel). */
export function lerLista(
  texto: string,
  jaNaLista: Set<string>,
  idDoCodigo: (codigo: string) => string | null,
): { itens: ItemRequisicao[]; erros: string[] } {
  const itens: ItemRequisicao[] = []
  const erros: string[] = []
  const vistos = new Set(jaNaLista)
  texto.split(/\r?\n/).forEach((linha, i) => {
    const n = i + 1
    if (!linha.trim()) return
    const partes = linha.trim().split(/[;\t ]+/)
    const [codigo, quantidade] = partes
    if (partes.length !== 2 || !/^\d+$/.test(codigo)) {
      erros.push(`Linha ${n}: use "código; quantidade" com código só de números.`)
      return
    }
    if (!qtdValida(quantidade)) {
      erros.push(`Linha ${n}: a quantidade deve ser inteira, de 1 a 999.`)
      return
    }
    if (vistos.has(codigo)) {
      erros.push(`Linha ${n}: o código ${codigo} já está na lista.`)
      return
    }
    vistos.add(codigo)
    itens.push({ codigo, quantidade, materialId: idDoCodigo(codigo) })
  })
  return { itens, erros }
}

export function validarRequisicao(periodo: string, instalacao: string, itens: ItemRequisicao[]): string[] {
  const erros: string[] = []
  try {
    codigosPeriodo(periodo)
  } catch (e) {
    erros.push((e as Error).message)
  }
  if (!/^\d{10}$/.test(instalacao)) erros.push('A instalação deve ter 10 dígitos.')
  if (!itens.length) erros.push('Informe ao menos um item.')
  for (const item of itens) {
    if (!qtdValida(item.quantidade)) erros.push(`${item.codigo}: a quantidade deve ser inteira, de 1 a 999.`)
  }
  return erros
}

export function paraEnvio(periodo: string, instalacao: string, itens: ItemRequisicao[]) {
  return {
    periodo,
    instalacao,
    itens: itens.map((i) => ({ codigo: i.codigo, quantidade: Number(i.quantidade) })),
  }
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run src/lib/requisicaoGdis.test.ts` → PASS.

- [ ] **Step 5: Commit** — `feat(app): regras da requisição de material no GDIS`

---

### Task 5: Aba Automação (conector, página, menu, rota, e2e)

**Files:**
- Create: `app/src/lib/conector.ts`, `app/src/pages/automacao/RequisicaoMaterial.tsx`, `app/e2e/05-automacao.spec.ts`
- Modify: `app/src/components/icones.tsx` (+`IcAutomacao`), `app/src/components/Layout.tsx` (item de menu), `app/src/App.tsx` (rota), `app/.env.local-e2e` (+`VITE_CONECTOR_URL`)

**Interfaces:**
- Consumes: Task 4 inteira; HTTP do conector (Task 3); `useCatalogo().materiais` / `material(id)`; `MaterialBusca`; `PaginaTopo`, `Regiao`, `Campo`, `Aviso`, `StatusBadge`, `Vazio`.
- Produces: `URL_CONECTOR`, `pingConector(): Promise<EstadoConector | null>`, `chamarConector(caminho: string, corpo?: unknown): Promise<void>`, `ouvirConector(aoEvento: (e: EventoConector) => void): () => void`, `type EventoConector`, `type EstadoPasso = 'andamento' | 'ok' | 'erro'`.

- [ ] **Step 1: e2e que falha** — `app/e2e/05-automacao.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { entrar } from './apoio'

test('admin abre a automação e vê o conector desligado', async ({ page }) => {
  await entrar(page, 'admin')
  await page.getByRole('link', { name: 'Solicitar material no GDIS' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Solicitar material no GDIS')
  await expect(page.getByText('Conector desligado.')).toBeVisible()
  await expect(page.getByText('REQUISICAO DE MATERIAIS DE MANUTENCAO PARA O PERIODO')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Montar nota no GDIS' })).toBeDisabled()

  await page.getByRole('button', { name: 'Colar lista' }).click()
  await page.getByLabel('Lista de materiais').fill('900001;2\n123456;1\nabc')
  await page.getByRole('button', { name: 'Adicionar à lista' }).click()
  await expect(page.getByText('Linha 3: use "código; quantidade" com código só de números.')).toBeVisible()
  await expect(page.getByRole('row', { name: /900001/ })).toContainText('PARAFUSO M16')
  await expect(page.getByRole('row', { name: /123456/ })).toContainText('fora do catálogo')
})

test('quem não é admin não vê a automação', async ({ page }) => {
  await entrar(page, 'gestao')
  await expect(page.getByRole('link', { name: 'Solicitar material no GDIS' })).toHaveCount(0)
  await page.goto('/automacao/requisicao-material')
  await expect(page.getByText('Acesso restrito ao administrador.')).toBeVisible()
})
```

(`900001 PARAFUSO M16` é cadastrado pelo `01-cadastros.spec.ts`, que roda antes.)

- [ ] **Step 2: Conector no app** — `app/.env.local-e2e` ganha `VITE_CONECTOR_URL=http://127.0.0.1:39999` (porta fechada: o e2e sempre vê o conector desligado, mesmo com o conector real rodando).

`app/src/lib/conector.ts`:

```ts
/** Conversa com o conector local do Warefly (pasta conector/, porta 3335). */

export const URL_CONECTOR = (import.meta.env.VITE_CONECTOR_URL as string | undefined) ?? 'http://localhost:3335'

export type EstadoConector = { sessaoOk: boolean; tarefaAtiva: boolean }
export type EstadoPasso = 'andamento' | 'ok' | 'erro'

export type EventoConector =
  | { tipo: 'aguardando_login' | 'sessao_ok' | 'sessao_perdida' | 'debug'; msg: string }
  | { tipo: 'etapa'; id: string; msg: string; estado: EstadoPasso }
  | { tipo: 'item'; codigo: string; estado: EstadoPasso; msg?: string }
  | { tipo: 'fim'; ok: boolean; incluidos: number; total: number; msg: string }

/** Estado do conector, ou null se ele não responde. */
export async function pingConector(): Promise<EstadoConector | null> {
  try {
    const r = await fetch(`${URL_CONECTOR}/ping`, { signal: AbortSignal.timeout(2000) })
    if (!r.ok) return null
    const j = (await r.json()) as { sessaoOk: boolean; tarefaAtiva: boolean }
    return { sessaoOk: j.sessaoOk, tarefaAtiva: j.tarefaAtiva }
  } catch {
    return null
  }
}

export async function chamarConector(caminho: string, corpo?: unknown): Promise<void> {
  let r: Response
  try {
    r = await fetch(`${URL_CONECTOR}${caminho}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo ?? {}),
    })
  } catch {
    throw new Error('O conector não respondeu. Confira se ele está rodando.')
  }
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; erro?: string }
  if (!r.ok || j.ok === false) throw new Error(j.erro ?? `O conector recusou o pedido (${r.status}).`)
}

/** Assina os eventos do conector; devolve a função que encerra a assinatura. */
export function ouvirConector(aoEvento: (e: EventoConector) => void): () => void {
  const fonte = new EventSource(`${URL_CONECTOR}/eventos`)
  fonte.onmessage = (m) => {
    try {
      aoEvento(JSON.parse(m.data as string) as EventoConector)
    } catch {
      // evento malformado: ignora
    }
  }
  return () => fonte.close()
}
```

- [ ] **Step 3: Ícone, menu e rota**

`app/src/components/icones.tsx` (depois de `IcEquipes`):

```tsx
/** Automação: raio. */
export const IcAutomacao = () => (
  <Icone>
    <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
  </Icone>
)
```

`app/src/components/Layout.tsx`: importar `IcAutomacao` e, ao fim de `useMenu` (antes do `return itens`):

```tsx
  if (ehAdmin) {
    itens.push({ para: '/automacao/requisicao-material', rotulo: 'Solicitar material no GDIS', grupo: 'Automação', icone: <IcAutomacao /> })
  }
```

`app/src/App.tsx`: importar `RequisicaoMaterial` de `./pages/automacao/RequisicaoMaterial` e, depois da rota `admin/saldo-inicial`:

```tsx
              <Route path="automacao/requisicao-material" element={<SoAdmin><RequisicaoMaterial /></SoAdmin>} />
```

- [ ] **Step 4: Página** — `app/src/pages/automacao/RequisicaoMaterial.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { useCatalogo } from '../../auth/CatalogoContext'
import { MaterialBusca } from '../../components/MaterialBusca'
import { Aviso, Campo, PaginaTopo, Regiao, StatusBadge, Vazio } from '../../components/ui'
import {
  chamarConector,
  ouvirConector,
  pingConector,
  type EstadoConector,
  type EstadoPasso,
  type EventoConector,
} from '../../lib/conector'
import {
  INSTALACAO_PADRAO,
  frasePeriodo,
  lerLista,
  mesSeguinte,
  paraEnvio,
  validarRequisicao,
  type ItemRequisicao,
} from '../../lib/requisicaoGdis'

const CHAVE = 'warefly.requisicaoGdis'

type Guardado = { periodo: string; instalacao: string; itens: ItemRequisicao[] }

function lerGuardado(): Guardado | null {
  try {
    const bruto = localStorage.getItem(CHAVE)
    return bruto ? (JSON.parse(bruto) as Guardado) : null
  } catch {
    return null
  }
}

function guardar(g: Guardado) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(g))
  } catch {
    // sem armazenamento: a tela só não lembra a lista
  }
}

const TOM: Record<EstadoPasso, 'info' | 'ok' | 'alerta'> = { andamento: 'info', ok: 'ok', erro: 'alerta' }
const ROTULO: Record<EstadoPasso, string> = { andamento: 'Em andamento', ok: 'Feito', erro: 'Erro' }

type Andamento = {
  etapas: { id: string; msg: string; estado: EstadoPasso }[]
  itens: Record<string, { estado: EstadoPasso; msg?: string }>
  fim: Extract<EventoConector, { tipo: 'fim' }> | null
}

const ANDAMENTO_VAZIO: Andamento = { etapas: [], itens: {}, fim: null }

export function RequisicaoMaterial() {
  const { material, materiais } = useCatalogo()
  const inicial = useMemo(lerGuardado, [])
  const [periodo, setPeriodo] = useState(inicial?.periodo ?? mesSeguinte())
  const [instalacao, setInstalacao] = useState(inicial?.instalacao ?? INSTALACAO_PADRAO)
  const [itens, setItens] = useState<ItemRequisicao[]>(inicial?.itens ?? [])
  const [colando, setColando] = useState(false)
  const [textoLista, setTextoLista] = useState('')
  const [errosLista, setErrosLista] = useState<string[]>([])

  const [conector, setConector] = useState<EstadoConector | null | undefined>(undefined)
  const [aguardandoLogin, setAguardandoLogin] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'info' | 'sucesso'; texto: string } | null>(null)
  const [andamento, setAndamento] = useState<Andamento>(ANDAMENTO_VAZIO)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => guardar({ periodo, instalacao, itens }), [periodo, instalacao, itens])

  // Estado do conector: consulta a cada 3 s enquanto a tela está aberta.
  useEffect(() => {
    let vivo = true
    const consultar = () => void pingConector().then((e) => vivo && setConector(e))
    consultar()
    const t = setInterval(consultar, 3000)
    return () => {
      vivo = false
      clearInterval(t)
    }
  }, [])

  const ligado = !!conector
  useEffect(() => {
    if (!ligado) return
    return ouvirConector((e) => {
      if (e.tipo === 'aguardando_login') setAguardandoLogin(true)
      if (e.tipo === 'sessao_ok') {
        setAguardandoLogin(false)
        setConector((c) => (c ? { ...c, sessaoOk: true } : c))
      }
      if (e.tipo === 'sessao_perdida') {
        setAguardandoLogin(false)
        setConector((c) => (c ? { ...c, sessaoOk: false } : c))
        setMensagem({ tipo: 'erro', texto: e.msg })
      }
      if (e.tipo === 'etapa')
        setAndamento((a) => ({
          ...a,
          etapas: [...a.etapas.filter((x) => x.id !== e.id), { id: e.id, msg: e.msg, estado: e.estado }],
        }))
      if (e.tipo === 'item')
        setAndamento((a) => ({ ...a, itens: { ...a.itens, [e.codigo]: { estado: e.estado, msg: e.msg } } }))
      if (e.tipo === 'fim') setAndamento((a) => ({ ...a, fim: e }))
    })
  }, [ligado])

  const idDoCodigo = useMemo(() => {
    const mapa = new Map(materiais.map((m) => [m.codigo_sap, m.id]))
    return (codigo: string) => mapa.get(codigo) ?? null
  }, [materiais])

  let frase = ''
  try {
    frase = frasePeriodo(periodo)
  } catch {
    frase = ''
  }
  const erros = validarRequisicao(periodo, instalacao, itens)
  const rodando = !!conector?.tarefaAtiva
  const podeMontar = !!conector?.sessaoOk && !rodando && !ocupado && erros.length === 0

  async function acao(fn: () => Promise<void>) {
    setMensagem(null)
    setOcupado(true)
    try {
      await fn()
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: (e as Error).message })
    } finally {
      setOcupado(false)
    }
  }

  function adicionarColados() {
    const r = lerLista(textoLista, new Set(itens.map((i) => i.codigo)), idDoCodigo)
    setItens([...itens, ...r.itens])
    setErrosLista(r.erros)
    if (!r.erros.length) {
      setTextoLista('')
      setColando(false)
    }
  }

  function montar() {
    void acao(async () => {
      setAndamento(ANDAMENTO_VAZIO)
      await chamarConector('/requisicao-material', paraEnvio(periodo, instalacao, itens))
      setConector((c) => (c ? { ...c, tarefaAtiva: true } : c))
    })
  }

  return (
    <div className="pilha">
      <PaginaTopo
        titulo="Solicitar material no GDIS"
        trilha={['Automação', 'Solicitar material no GDIS']}
        sub="Monta no GDIS a nota corretiva de requisição de material. O robô para antes de salvar: você revisa e clica em Salvar no GDIS."
      />

      <Regiao titulo="Conector">
        {conector === undefined ? (
          <p className="sec">Procurando o conector…</p>
        ) : conector === null ? (
          <Aviso tipo="atencao">
            Conector desligado. Rode <span className="mono">npm start</span> na pasta <span className="mono">conector</span>{' '}
            desta máquina.
          </Aviso>
        ) : conector.sessaoOk ? (
          <p>
            <StatusBadge tom="ok">Sessão GDIS ativa</StatusBadge>
          </p>
        ) : (
          <div className="linha">
            <button
              type="button"
              className={aguardandoLogin ? 'botao secundario' : 'botao'}
              disabled={ocupado || rodando}
              onClick={() => void acao(() => chamarConector('/sessao/iniciar'))}
            >
              Abrir login do GDIS
            </button>
            {aguardandoLogin && (
              <button
                type="button"
                className="botao"
                disabled={ocupado}
                onClick={() =>
                  void acao(async () => {
                    await chamarConector('/sessao/confirmar')
                    setConector((c) => (c ? { ...c, sessaoOk: true } : c))
                  })
                }
              >
                Já entrei
              </button>
            )}
            {aguardandoLogin && <span className="sec peq">Entre no GDIS no Edge (senha e reCAPTCHA) e depois clique em “Já entrei”.</span>}
          </div>
        )}
      </Regiao>

      <Aviso tipo={mensagem?.tipo ?? 'info'}>{mensagem?.texto}</Aviso>

      <Regiao titulo="Dados da nota">
        <div className="linha">
          <Campo rotulo="Mês da requisição">
            <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
          </Campo>
          <Campo rotulo="P. de Instalação" erro={/^\d{10}$/.test(instalacao) ? null : 'Use os 10 dígitos.'}>
            <input inputMode="numeric" maxLength={10} value={instalacao} onChange={(e) => setInstalacao(e.target.value.trim())} />
          </Campo>
        </div>
        <Campo rotulo="Outras informações (vai assim para o GDIS)">
          <output className="mono">{frase || '—'}</output>
        </Campo>
        <p className="sec peq">Motivo/Causa 22 · Rede BT/MT · Serviço 291 · Componente Material.</p>
      </Regiao>

      <Regiao
        titulo="Materiais"
        sub="O código vai para o GDIS como está: é o código SAP do catálogo."
        acoes={
          <>
            <button type="button" className="botao secundario" onClick={() => setColando(!colando)}>
              Colar lista
            </button>
            {itens.length > 0 && (
              <button type="button" className="botao secundario" disabled={rodando} onClick={() => setItens([])}>
                Limpar
              </button>
            )}
          </>
        }
      >
        {colando && (
          <div className="pilha">
            <Campo rotulo="Lista de materiais" ajuda="Uma linha por item: código e quantidade, separados por ; tab ou espaço.">
              <textarea rows={6} value={textoLista} onChange={(e) => setTextoLista(e.target.value)} />
            </Campo>
            <div className="linha">
              <button type="button" className="botao" onClick={adicionarColados}>
                Adicionar à lista
              </button>
            </div>
            {errosLista.length > 0 && (
              <Aviso tipo="erro">
                {errosLista.map((e) => (
                  <div key={e}>{e}</div>
                ))}
              </Aviso>
            )}
          </div>
        )}
        <MaterialBusca
          excluir={new Set(itens.map((i) => i.materialId).filter((x): x is string => !!x))}
          onEscolher={(m) =>
            itens.some((i) => i.codigo === m.codigo_sap)
              ? undefined
              : setItens([...itens, { codigo: m.codigo_sap, quantidade: '', materialId: m.id }])
          }
        />
        {itens.length === 0 ? (
          <Vazio>Busque no catálogo ou cole uma lista para montar a requisição.</Vazio>
        ) : (
          <div className="tabela-envoltorio">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Material</th>
                  <th>Quantidade</th>
                  <th>No GDIS</th>
                  <th>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item, i) => {
                  const m = material(item.materialId)
                  const estado = andamento.itens[item.codigo]
                  return (
                    <tr key={item.codigo}>
                      <td className="mono">{item.codigo}</td>
                      <td>{m ? m.descricao : <span className="sec">fora do catálogo</span>}</td>
                      <td>
                        <input
                          aria-label={`Quantidade de ${item.codigo}`}
                          inputMode="numeric"
                          maxLength={3}
                          style={{ width: '6em' }}
                          value={item.quantidade}
                          disabled={rodando}
                          onChange={(e) =>
                            setItens(itens.map((x, j) => (j === i ? { ...x, quantidade: e.target.value.trim() } : x)))
                          }
                        />
                      </td>
                      <td>
                        {estado ? (
                          <>
                            <StatusBadge tom={TOM[estado.estado]}>{ROTULO[estado.estado]}</StatusBadge>
                            {estado.msg && <div className="sec peq">{estado.msg}</div>}
                          </>
                        ) : (
                          <span className="sec">—</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="botao-mini"
                          disabled={rodando}
                          aria-label={`Remover ${item.codigo}`}
                          onClick={() => setItens(itens.filter((_, j) => j !== i))}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Regiao>

      {erros.length > 0 && itens.length > 0 && (
        <Aviso tipo="atencao">
          {erros.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </Aviso>
      )}

      <div className="linha">
        <button type="button" className="botao" disabled={!podeMontar} onClick={montar}>
          Montar nota no GDIS
        </button>
        {rodando && (
          <button type="button" className="botao secundario" onClick={() => void acao(() => chamarConector('/cancelar'))}>
            Cancelar
          </button>
        )}
        {!conector?.sessaoOk && <span className="sec peq">Confirme a sessão do GDIS para montar a nota.</span>}
      </div>

      {(andamento.etapas.length > 0 || andamento.fim) && (
        <Regiao titulo="Andamento">
          <ol className="pilha">
            {andamento.etapas.map((e) => (
              <li key={e.id}>
                <StatusBadge tom={TOM[e.estado]}>{ROTULO[e.estado]}</StatusBadge> {e.msg}
              </li>
            ))}
          </ol>
          {andamento.fim && <Aviso tipo={andamento.fim.ok ? 'sucesso' : 'erro'}>{andamento.fim.msg}</Aviso>}
        </Regiao>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Verificar** — `cd app && npm run typecheck && npm run lint && npm test`; e2e: `npx playwright test e2e/05-automacao.spec.ts` (precisa do Supabase local com `supabase start`; o setup roda `01-cadastros` antes — rodar a suíte inteira `npx playwright test` se o material 900001 não existir).

- [ ] **Step 6: Commit** — `feat(app): aba Automação com requisição de material no GDIS`

---

### Task 6: Teste manual com o GDIS real (com o usuário)

- [ ] `cd conector && npm install && npm start`
- [ ] No Warefly local (`cd app && npm run dev`), admin → Automação → **Abrir login do GDIS** → entrar → **Já entrei**.
- [ ] Um material real, quantidade 1 → **Montar nota no GDIS**. Conferir cada etapa no Edge e a linha em `tmateriais_291_1`. Excluir/abandonar a nota sem salvar.
- [ ] Lista com um código inexistente e um repetido (adicionado à mão no GDIS antes) → os dois dão erro, os demais entram.
- [ ] Anotar a URL que aparece depois de **Novo**; se abrir direto, trocar `notaCorretivaUrl` por ela.
