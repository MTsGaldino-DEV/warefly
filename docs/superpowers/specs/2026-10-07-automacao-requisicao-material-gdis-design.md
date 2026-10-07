# Warefly: automação de requisição de material no GDIS

> Especificação de design · 07/10/2026 · Status: aguardando revisão
> Cria a aba **Automação** no Warefly e transforma a pasta `conector/` (cópia do conector do TraceOne) num conector próprio do Warefly.

---

## 1. Objetivo

Todo mês o admin monta à mão, no GDIS, uma nota de manutenção corretiva só para requisitar material: mesma instalação, mesmos campos, um serviço 291 e uma lista de materiais digitados um a um na janela de materiais. A automação faz esse preenchimento a partir de uma lista montada no Warefly e **para antes de salvar**, para o admin revisar e clicar em Salvar no GDIS.

Critério de sucesso: a partir do mês e da lista de itens, o robô deixa a nota preenchida no GDIS com todos os materiais válidos incluídos na quantidade certa, e diz exatamente quais itens não entraram e por quê.

## 2. Decisões tomadas

| Tema | Decisão |
|---|---|
| Quem usa | Só o **admin**. |
| Salvar a nota | **Nunca** automático. O robô para com tudo preenchido; o admin salva. |
| Escolha dos materiais | Busca no catálogo do Warefly **e** colar lista (`código; quantidade`). As duas alimentam a mesma tabela. Código fora do catálogo é aceito, marcado. |
| Histórico | Nenhum registro no banco. O navegador lembra a última lista (`localStorage`). |
| Conector | A pasta `conector/` vira o conector do Warefly: porta **3335**, GDIS em **192.168.1.110**, consulta de seriais do TraceOne removida, versionada no git do Warefly. |
| Navegador | Edge normal (Chromium) via Playwright, como o conector atual. A tela de nota abre fora do modo IE. |
| Período | Sempre do dia 01 ao dia 30 do mês escolhido, sem barras: maio → `0105 3005`, outubro → `0110 3010`. |

## 3. Conector

### 3.1 Arquivos

```
conector/
  servidor.js               Express na porta 3335, SSE, sessão GDIS, uma tarefa por vez
  gdis.js                   CONFIG (URLs em 192.168.1.110), abrir o Edge, login, checar sessão
  fluxos/
    requisicaoMaterial.js   passo a passo da nota corretiva
  periodo.js                mês "AAAA-MM" → "01MM 30MM" (função pura)
  validacao.js              validação do pedido (função pura)
  *.test.js                 testes com node --test
  package.json, README.md
```

O `gdis.js` mantém o que o conector atual já resolve: Edge visível, `--disable-popup-blocking` e o script que faz `document.getElementById` achar elementos pelo atributo `name`, como no IE.

### 3.2 Endereços

| Método | Endereço | Uso |
|---|---|---|
| GET | `/ping` | `{ ok, sessaoOk, tarefaAtiva }` |
| GET | `/eventos` | SSE com o andamento |
| POST | `/sessao/iniciar` | Abre o Edge na tela de login do GDIS |
| POST | `/sessao/confirmar` | Vai ao `menu.jsp`; se não caiu no login, a sessão está ok |
| POST | `/requisicao-material` | Corpo `{ periodo: "AAAA-MM", instalacao, itens: [{ codigo, quantidade }] }`. Valida, responde na hora e roda em segundo plano |
| POST | `/cancelar` | Para no próximo ponto seguro |

### 3.3 Regras

- Uma tarefa por vez; uma segunda é recusada com erro.
- CORS só para as origens do Warefly (Vite local e o domínio de produção, configuráveis numa lista no `servidor.js`).
- Responde `Access-Control-Allow-Private-Network: true` nos preflights, porque a página em produção é HTTPS e chama `http://localhost`.
- O Edge fica aberto ao fim da tarefa.

### 3.4 Eventos SSE

| `tipo` | Campos | Quando |
|---|---|---|
| `aguardando_login` | `msg` | Edge aberto no login |
| `sessao_ok` | `msg` | Login confirmado |
| `sessao_perdida` | `msg` | Redirecionado ao login durante a tarefa |
| `etapa` | `id`, `msg`, `estado` (`andamento` \| `ok` \| `erro`) | Passos 1 a 5 e 7 |
| `item` | `codigo`, `estado` (`andamento` \| `ok` \| `erro`), `msg?` | Cada material do passo 6 |
| `fim` | `incluidos`, `total`, `msg` | Tarefa encerrada (concluída, com falha ou cancelada) |
| `debug` | `msg` | Detalhes para diagnóstico |

## 4. Fluxo do robô

Telas do GDIS (fontes copiadas em `nota_corretiva.jsp`, `ns_corretiva.jsp`, `Incluir_material.jsp`):

1. **Abrir a nota nova.** Vai a `/contratadaweb/condis/concod/manutencao/nota_corretiva.jsp` e clica em **Novo** (`btoNovo`), procurando na página e nos frames. Se a URL da tela nova for confirmada no primeiro teste e abrir direto, o robô passa a ir direto a ela.
2. **Instalação.** Preenche `identificador`, clica em `BotaoIdentificador` e espera até 20 s o GDIS preencher `endereco` ou `subalim`. Se não preencher: erro "instalação não encontrada".
3. **Campos da nota.** `motivoCausa` = `22` (Problemas Operacionais no Sistema); `rede` = `3` (BT/MT); `infComplementares` = `REQUISICAO DE MATERIAIS DE MANUTENCAO PARA O PERIODO 01MM 30MM`.
4. **Serviço.** `selCodServico` = `291`; espera `componente` carregar e escolhe a opção cujo texto é `MATERIAL`; clica em `btoServicos` e espera uma linha em `tbody#tservicos`.
5. **Janela de materiais.** Clica em `a#btoIncluiMaterial` da linha e captura a janela `inclui_material_corretivo_ns.jsp?Serv=291 - REPOSICAO DE MATERIAL&poste=1`.
6. **Cada item.** Se não existe `option[value=código]` em `codMaterial`: erro "código não disponível para o serviço 291", segue. Senão escolhe o código (o `selMaterial` acompanha pelo evento `change`), preenche `txtQtdeMat`, clica em `btoMateriais` e confere na tela da nota que `tbody#tmateriais_291_1` tem uma linha com o código e a quantidade.
7. **Fim.** Fecha a janela de materiais e envia `fim` com "Pronto, N de M itens incluídos. Revise no GDIS e clique em Salvar." Não clica em Salvar.

### 4.1 Erros

- **Alertas do GDIS:** o robô aceita o diálogo e repassa o texto; durante um item, vira o erro do item (ex.: "Este material já existe na lista").
- **Falha nos passos 1 a 5:** encerra a tarefa; sem nota não há onde incluir material.
- **Falha num item:** registra e segue para o próximo.
- **Sessão expirada:** em qualquer passo, se a página for para o login, envia `sessao_perdida` e encerra.
- **Cancelar:** checado entre passos e entre itens. O que já foi preenchido fica no GDIS.

### 4.2 Validação do pedido (conector e aba)

- `periodo` no formato `AAAA-MM`, mês de 01 a 12.
- `instalacao` com exatamente 10 dígitos.
- Ao menos um item; `codigo` só com dígitos; `quantidade` inteira de 1 a 999 (o campo do GDIS tem 3 dígitos); nenhum código repetido.

## 5. Aba Automação no Warefly

### 5.1 Menu e acesso

- Grupo novo **Automação** no menu lateral, item **Solicitar material no GDIS**, rota `/automacao/requisicao-material`.
- Item só aparece para `ehAdmin`; a rota fica dentro de `SoAdmin`.

### 5.2 Arquivos

- `app/src/lib/conector.ts`: endereço do conector (`http://localhost:3335`), chamadas aos endereços, assinatura do SSE.
- `app/src/lib/requisicaoGdis.ts`: funções puras: frase do período, leitura da lista colada, validação.
- `app/src/pages/automacao/RequisicaoMaterial.tsx`: a tela.

### 5.3 Tela

1. **Conector.** Consulta `/ping` a cada poucos segundos enquanto a tela está aberta.
   - Desligado: "Conector desligado. Rode `npm start` na pasta conector."
   - Ligado sem sessão: **Abrir login do GDIS** → **Já entrei**.
   - Com sessão: "Sessão GDIS ativa ✓".
2. **Dados da nota.** Mês (`<input type="month">`, padrão o mês seguinte) com a frase final mostrada em monoespaçada; instalação com padrão `3013248220`, editável.
3. **Itens.** Tabela própria da tela (o `ItensQuantidade` existente exige `material_id` e não comporta códigos fora do catálogo), com o `MaterialBusca` existente para adicionar do catálogo (usa `codigo_sap` como código no GDIS) e o botão **Colar lista**: uma linha por item, código e quantidade separados por `;`, tab ou espaços. Códigos do catálogo viram itens normais; os demais entram marcados "fora do catálogo". Linhas inválidas são apontadas pelo número.
4. **Ações.** **Montar nota no GDIS**, ativo só com sessão ok e validação sem erro. **Cancelar** durante a tarefa.
5. **Andamento.** Lista de etapas e tabela de itens com estado (aguardando, ✓ incluído, ✗ motivo), alimentadas pelo SSE. No fim, aviso: "Revise no GDIS e clique em Salvar."

### 5.4 Memória

Mês, instalação e itens ficam no `localStorage`, com toda leitura e escrita dentro de `try/catch`. A tela funciona normalmente sem ele.

## 6. Testes

**Automáticos**

- Conector (`node --test`): `periodo.js` (maio → `0105 3005`, outubro → `0110 3010`, mês inválido → erro) e `validacao.js` (cada regra da seção 4.2).
- App (Vitest): leitura da lista colada (separadores, linhas vazias, linha inválida, fora do catálogo), frase do período e validação.
- App (Playwright e2e): admin abre a aba com o conector desligado e vê "Conector desligado"; usuário que não é admin não vê o item no menu.

**Manuais** (rede da Cemig e reCAPTCHA)

1. Um material, quantidade 1: conferir cada etapa e a linha em `tmateriais_291_1`; excluir a nota sem salvar.
2. Lista com um código inexistente e um repetido: os dois dão erro, os outros entram.

## 7. Fora do escopo

- Salvar a nota no GDIS.
- Histórico de requisições no banco.
- Outras automações (o grupo Automação fica pronto para recebê-las).
- A consulta de seriais do TraceOne, que continua no conector do TraceOne.
