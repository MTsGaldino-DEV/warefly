# Design system Warefly

Design system gerado no Claude Design e incorporado ao repositório em 30/09/2026. Reúne tokens, fontes, marca, 29 componentes React de referência, dois UI kits (desktop e celular), as páginas de referência visual e a config de lint de aderência.

> **Situação (v2, 13/10/2026).** Os valores dos tokens foram refeitos no estilo de painel operacional claro: fundo `#EEF1F4`, cartões `#F7F8FA` em camadas sobre painel `#E6E9ED`, azul `#2F6FE4` para ação, verde `#3DAA55` para operação, vermelho `#E5484D` para alerta, títulos quase pretos `#1F2328` em Manrope 400, menu em pílulas brancas. Os **nomes** dos tokens não mudaram e [app/src/index.css](../app/src/index.css) importa `tokens/colors.css`, `tokens/typography.css` e `tokens/spacing.css` direto desta pasta, então o app muda junto. Falta no app: trocar Barlow por Manrope no `<link>` do Google Fonts em `app/index.html`, e o layout novo (menu superior em pílulas, mapa do 211, cartões de solicitação expansíveis), que é código de tela. Referência visual da v2: canvas "Warefly — Painel do Almox" no Claude. Os `.jsx` de `components/`, as páginas de `referencia/` e o `_ds_bundle.js` ainda mostram a v1 até um novo export.

> **v1 (30/09/2026).** Paleta azul (`--cor-marca: #1E66C9`, marinho `#0B2447`, névoa `#F3F6FA`), Barlow, símbolo da asa, menu lateral claro, indicadores com mini-gráfico.

## Estrutura

```
design-system/
├── styles.css            ponto de entrada (só @import dos tokens)
├── tokens/               fonts, colors, typography, spacing, base — fonte da verdade dos valores
├── assets/               simbolo.svg, favicon.svg, fonts/*.ttf
├── components/<grupo>/   X.jsx (implementação), X.d.ts (props), X.prompt.md (quando e como usar)
├── ui_kits/              telas clicáveis: warefly-web (desktop) e warefly-movel (celular)
├── lint/                 regras de aderência usadas pelo lint do app
└── referencia/           páginas HTML para abrir no navegador (não são componentes)
```

Não existe `DESIGN.md` (formato Google Labs/Stitch) neste design system. O export não trazia nenhum, então os valores valem pelo que está em `tokens/*.css`.

## Tokens

| Arquivo | Conteúdo |
|---|---|
| `tokens/colors.css` | base (`--cor-marca`, `--cor-asa`, `--cor-estrutura`, `--cor-neutra`, `--cor-fundo`, séries `--cor-dado-2/3`), novos da v2 (`--cor-operacao`, `--cor-operacao-forte`, `--cor-confirmar`, `--superficie-painel`, `--superficie-elevada`, `--texto-3`, `--vidro`, `--cor-reserva`/`-forte` do 3256, `--cor-211`/`-forte`/`-suave` do 211 Geral no mapa), status `--st-{info,transito,atencao,ok,alerta,neutro}` (`atencao` = estoque próximo do mínimo) com `-fundo` e `-texto`, derivados (superfície, bordas, menu, sombra do cartão, véu) e aliases semânticos (`--acao`, `--foco`, `--texto-titulo`…) |
| `tokens/typography.css` | `--fonte` (Manrope), `--fonte-mono` (IBM Plex Mono), tamanhos `--tam-*` (inclui `--tam-display` e `--tam-kpi`), pesos (inclui `--peso-leve`), alturas de linha e `--espacamento-titulo` |
| `tokens/spacing.css` | escala `--esp-1` … `--esp-13` (2 a 48px), raios (10 controle, 6 badge, 16 cartão, 20 painel), sombras (`--sombra-suave`, `--sombra-flutuante`, `--sombra-objeto`), `--desfoque-vidro`, `--transicao`, medidas de layout (menu 232px, painel lateral 340px, barra 64px, conteúdo 1440px, controle 40/36px, quebra 900px) |
| `tokens/fonts.css` | `@font-face` de Manrope variável (200–800, woff2 latin e latin-ext) e IBM Plex Mono 400/500 apontando para `assets/fonts` |
| `tokens/base.css` | reset mínimo, títulos, `.mono`, `.num`, `.sec`, `.peq`, foco visível |

As fontes são do [google/fonts](https://github.com/google/fonts), com licença SIL Open Font License. O app carrega as mesmas famílias pelo Google Fonts em `app/index.html`.

## Componentes

Cada componente tem três arquivos: `.jsx` com a implementação, `.d.ts` com as props e `.prompt.md` com uma linha sobre quando usar e um exemplo.

| Grupo | Componentes |
|---|---|
| `brand/` | Simbolo, Marca |
| `feedback/` | StatusBadge, Aviso, Vazio, Carregando, Fita |
| `data/` | Doc, Qtd, Etiqueta, Tabela, ItemLista, Dados |
| `forms/` | Botao, Campo, Entrada, Selecao, Abas, MaterialBusca |
| `layout/` | PaginaTopo, Cartao, MenuLateral, BarraInferior e CabecalhoMovel (mesmo arquivo), Breadcrumb, BuscaComando |
| `charts/` | Sparkline, Donut, GraficoLinha |

Os componentes daqui usam estilo inline e servem de referência visual; não são importados pelo app. Onde eles estão no app:

| Referência | No app |
|---|---|
| Simbolo, Marca, StatusBadge, Doc, Qtd, Etiqueta, PaginaTopo, Breadcrumb, Campo, Aviso, Carregando, Vazio | `app/src/components/ui.tsx` |
| Cartao | `Regiao` em `ui.tsx` (título com nível h2 ou h3, ações no cabeçalho, `fita`) |
| Cartao.periodo, Cartao.menu | `FiltroPeriodo` e `MenuAcoes` em `app/src/components/Menus.tsx` |
| Sparkline, Donut, GraficoLinha | `app/src/components/graficos.tsx` (o gráfico de linha mede a própria largura em vez de esticar o SVG, para os rótulos não deformarem) |
| BuscaComando | `app/src/components/BuscaGlobal.tsx`, com o diálogo de busca (Ctrl+K / ⌘K) |
| MenuLateral, BarraInferior, CabecalhoMovel | `app/src/components/Layout.tsx` |
| MaterialBusca | `app/src/components/MaterialBusca.tsx` |
| Botao, Entrada, Selecao, Abas, Tabela, ItemLista, Dados, Fita | classes CSS em `app/src/index.css` (`.botao`, `input`, `select`, `.abas`, `table`, `.item-lista`, `dl.dados`, `.fita`) |

As adições pedidas no brief (breadcrumb, busca ⌘K, filtro de período e menu "…" nos cartões, mini-gráfico nos indicadores, donut, gráfico de linha, contador no menu) estão todas no app.

## UI kits

- [`ui_kits/warefly-web`](ui_kits/warefly-web/README.md): desktop. Painel geral, pedidos, separação e envio, guia imprimível, saldo, remessas, divergências, importação XLSX, login.
- [`ui_kits/warefly-movel`](ui_kits/warefly-movel/README.md): celular. Início da base, receber remessa, confirmação.

Correspondência com o app:

| Tela do kit | Arquivos do app |
|---|---|
| tokens/*.css | app/src/index.css, app/index.html |
| components/* | app/src/components/ui.tsx, Layout.tsx, Conferencia.tsx, MaterialBusca.tsx, app/src/lib/formato.ts |
| warefly-web Painel | app/src/pages/Inicio.tsx, app/src/pages/Painel.tsx |
| warefly-web Pedidos / Separação e envio | app/src/pages/pedidos/Pedidos.tsx, PedidoDetalhe.tsx |
| warefly-web Guia | app/src/pages/remessas/Guia.tsx |
| warefly-web Saldo | app/src/pages/Saldo.tsx |
| warefly-web Divergências | app/src/pages/Divergencias.tsx |
| warefly-web Importar materiais | app/src/pages/admin/ImportarMateriais.tsx |
| warefly-web Login | app/src/pages/Login.tsx |
| warefly-movel Início / Receber | app/src/pages/Inicio.tsx, app/src/pages/remessas/Receber.tsx, app/src/components/Conferencia.tsx |

## Referência visual

As páginas de `referencia/` abrem com duplo clique, sem servidor. Precisam de internet porque carregam React 18 e Babel do unpkg.

| Página | O que mostra |
|---|---|
| [`guidelines/brand-marca.html`](referencia/guidelines/brand-marca.html) | Asa Warefly sobre marinho e branco, favicon |
| [`guidelines/brand-motivos.html`](referencia/guidelines/brand-motivos.html) | Indicador com ponto de status e faixa de atenção |
| [`guidelines/voz.html`](referencia/guidelines/voz.html) | Tom dos textos: direto, operacional, botões com verbo |
| [`guidelines/colors-base.html`](referencia/guidelines/colors-base.html) | Azul voo, marinho, cinza, névoa |
| [`guidelines/colors-derived.html`](referencia/guidelines/colors-derived.html) | Superfície, bordas, hover, menu |
| [`guidelines/colors-status.html`](referencia/guidelines/colors-status.html) | Base + fundo + texto por tom de status |
| [`guidelines/type-headings.html`](referencia/guidelines/type-headings.html) | Títulos: Barlow 600, lh 1.2 |
| [`guidelines/type-body.html`](referencia/guidelines/type-body.html) | Corpo: Barlow 400/500, 16px lh 1.45 |
| [`guidelines/type-labels.html`](referencia/guidelines/type-labels.html) | Rótulos em caixa-alta (tabela, grupo do menu) |
| [`guidelines/type-mono.html`](referencia/guidelines/type-mono.html) | IBM Plex Mono para códigos, documentos, quantidades |
| [`guidelines/spacing.html`](referencia/guidelines/spacing.html) | Escala `--esp-1` … `--esp-13` |
| [`guidelines/radii-borders.html`](referencia/guidelines/radii-borders.html) | Raios e bordas de marca |
| [`guidelines/shadow.html`](referencia/guidelines/shadow.html) | Sombra só em elementos flutuantes |
| [`components/brand.card.html`](referencia/components/brand.card.html) | Marca e Simbolo |
| [`components/feedback.card.html`](referencia/components/feedback.card.html) | Badges de status, avisos, vazio, carregando, fita |
| [`components/data.card.html`](referencia/components/data.card.html) | Etiquetas com mini-gráfico, tabela, item de lista, dados |
| [`components/forms.card.html`](referencia/components/forms.card.html) | Botões, abas, campos, seleção, busca de material |
| [`components/layout.card.html`](referencia/components/layout.card.html) | Menu lateral, topo de página, cartões, cabeçalho e barra do celular |
| [`components/charts.card.html`](referencia/components/charts.card.html) | Donut e gráfico de linha |
| [`ui_kits/warefly-web.html`](referencia/ui_kits/warefly-web.html) | UI kit desktop navegável |
| [`ui_kits/warefly-movel.html`](referencia/ui_kits/warefly-movel.html) | UI kit celular (duas telas lado a lado) |

**De onde vêm os componentes nas páginas.** Os cartões de componentes e os UI kits usam `referencia/_ds_bundle.js`, a compilação dos `.jsx` feita pelo Claude Design (namespace `window.WareflyDesignSystem_ad870b`). O cabeçalho do bundle guarda o hash sha256 de cada fonte, e hoje os 36 conferem com `components/` e `ui_kits/`. Consequências:

- Alterar um `.jsx` de `components/` **não** muda os cartões até o bundle ser gerado de novo, com um novo export do Claude Design.
- Os UI kits também pedem os `.jsx` de `ui_kits/` ao navegador. Por duplo clique (`file://`) o navegador bloqueia esses pedidos e as telas vêm do bundle; os avisos de CORS no console são esperados. Para ver alterações feitas nos `.jsx` dos kits, sirva a pasta por HTTP:

  ```powershell
  python -m http.server 8000 -d design-system
  # abra http://localhost:8000/referencia/ui_kits/warefly-web.html
  ```

## Lint de aderência

[`lint/aderencia.oxlintrc.json`](lint/aderencia.oxlintrc.json) entra no lint do app por `extends` em [app/.oxlintrc.json](../app/.oxlintrc.json), então `npm run lint` (em `app/`) já aplica as regras. Todas são avisos e não mudam o código de saída. Elas apontam:

- cor hexadecimal solta em string (use um token via `var()`);
- valor em px solto em string (use um token de espaçamento);
- `font-family` fora de Barlow e IBM Plex Mono;
- props que um componente do design system não declara, e valores fora da lista (`variante`, `tom`, `tipo`, `prefixo`…);
- import de arquivos internos de `components/` e `ui_kits/`.

O oxlint não implementa `no-restricted-syntax`, a regra que a config original usava para os seletores. O plugin local [`lint/restricted-syntax.mjs`](lint/restricted-syntax.mjs) faz o mesmo papel com as mesmas opções (regra `design-system/restricted-syntax`) e é carregado como `jsPlugins`, recurso ainda experimental do oxlint.

Limites conhecidos:
- As regras de props olham só o nome da tag. Um componente do app com o mesmo nome de um daqui precisa aceitar as mesmas props, senão o aviso aparece. Por isso os cartões do app se chamam `Regiao` e não `Cartao`: eles têm a prop `nivel` (h2 ou h3), que o `Cartao` daqui não declara.
- Os padrões de import (`components/brand/**` etc.) só casam com caminhos que começam por `components/` ou `ui_kits/`. Um import relativo do app, como `../../design-system/components/…`, não dispara o aviso.

Estado em 30/09/2026: nenhum aviso de aderência no app.

## Pendências herdadas do export

O export foi feito no meio da troca de identidade. Os `.jsx`, os tokens e a maior parte das páginas já estão na proposta Warefly, mas alguns textos ainda descrevem a identidade SIA (cobre/grafite):

- `.d.ts` e `.prompt.md`: Marca ("Sistema Integrado de Almoxarifado"), Simbolo ("tronco com três ramos", "cobre sobre grafite"), Botao ("primario = cobre"), Etiqueta ("Sem tom = cobre", "número grande em mono, borda esquerda colorida"), Abas ("sublinhado cobre"), Entrada ("foco cobre"), MenuLateral e BarraInferior ("grafite com borda cobre"), BuscaComando ("menu grafite").
- `Simbolo.d.ts` não declara a prop `cor2`, que o `Simbolo.jsx` aceita. Por isso o lint avisaria se alguém usasse `cor2`.
- Páginas `colors-derived.html` ("Borda 30%", "Borda forte 55%", "Cobre hover"), `radii-borders.html` (borda 6px da etiqueta e 4px do menu, que os componentes não usam mais) e `shadow.html` ("Cartão sem sombra").
- Comentários de `tokens/spacing.css` ("borda direita cobre") e partes de "Visual foundations" abaixo (hover, foco e gráficos em cobre/grafite).
- "Iconography" abaixo descreve o símbolo antigo (tronco com três ramos, quadrado grafite); os SVGs de `assets/` são a asa Warefly, e o favicon é um quadrado azul.
- Moldura de celular do kit móvel com `#1d2127` e `#d9d4ca` fixos.
- `tomStatus` do StatusBadge daqui trata `recebido`/`recebida`, que não existem no banco (remessa recebida sem diferença fica `encerrada`). O do app, em `app/src/lib/formato.ts`, segue os status reais.

## Triagem

O export bruto do Claude Design tinha 152 arquivos. Entraram 129, a maioria sem alteração; os ajustes estão na tabela. O `readme.md` virou este README e a config de lint virou os dois arquivos de `lint/`. Os outros 21 ficaram de fora.

| Item do export | Destino |
|---|---|
| `tokens/`, `styles.css`, `assets/` | copiados sem alteração |
| `components/*/*.{jsx,d.ts,prompt.md}` | copiados sem alteração |
| `ui_kits/*/*.jsx`, `dados.js`, `README.md` | copiados; nos READMEs, só o link para a página. `Shell.jsx`: lê o `MenuLateral` dentro da função (ver abaixo) |
| `guidelines/*.html`, `components/*/*.card.html`, `ui_kits/*/index.html` | movidos para `referencia/`, com os caminhos relativos corrigidos |
| `_ds_bundle.js` | derivado (compilação dos `.jsx`, hashes conferidos); mantido só em `referencia/` porque as páginas precisam dele para renderizar |
| `_adherence.oxlintrc.json` | virou `lint/aderencia.oxlintrc.json`: removido o bloco `x-omelette` (metadado da ferramenta que o oxlint recusa) e `no-restricted-syntax` virou `design-system/restricted-syntax`; seletores, mensagens, imports e overrides iguais |
| `readme.md` | virou este README; fundamentos copiados abaixo sem alteração |
| `github.md` | metadado de sincronização; o mapa de telas foi aproveitado acima |
| `SKILL.md` | invólucro de skill do Claude Design com resumo antigo (cobre/grafite); não incorporado |
| `_ds_manifest.json`, `.thumbnail`, `thumbnail.html` | internos da ferramenta; não incorporados (os títulos das páginas vieram do manifest) |
| `uploads/*.jpg` (16 imagens, 44 MB) | capturas de um dashboard financeiro de terceiros, usadas só como referência de layout; não incorporadas |

O export não tinha versões duplicadas de um mesmo componente em pastas diferentes. A única cópia era o bundle, que é derivado. Os conflitos reais foram com o app: StatusBadge, Doc, Qtd, Etiqueta, Campo, Aviso, Carregando, Vazio, PaginaTopo, Marca, Simbolo e MaterialBusca existem nos dois lados. Na adoção do Warefly, o app ganhou as variantes daqui que tinham uso: StatusBadge (`tom`, texto próprio), Etiqueta (`compacta`, `serie`, `href`/`onClick`) e PaginaTopo (`trilha`). Manteve os estados que só ele tinha: MaterialBusca (teclado, carregando, sem resultado, exclusão, ARIA de combobox) e Campo (`aria-describedby` ligando ajuda e erro). `Doc.forte`, `Qtd.sinal` e `Etiqueta.variacao` não entraram porque nenhuma tela usa.

**Correção no `Shell.jsx`.** No export, o kit desktop abria em branco por duplo clique: o `Shell` compilado lia `MenuLateral` do namespace no topo do arquivo, antes de o bundle registrar os componentes. Agora ele lê dentro da função, como as outras telas. A mesma mudança foi feita na cópia compilada do bundle, e o hash foi atualizado.

---

## CONTENT FUNDAMENTALS
- **Idioma:** pt-BR, sempre. Datas `dd/mm/aaaa`, hora 24h (`29/09/2026 08:14`), fuso America/Sao_Paulo. Números com vírgula decimal e ponto de milhar (`1.250,5`), até 3 casas. Moeda `R$ 1.234,56`. Diferenças com sinal tipográfico: `+2,5`, `−1` (menos real, U+2212).
- **Tom:** direto e operacional. Frases curtas que dizem a regra ou o próximo passo. Sem "por favor", sem exclamação, sem emoji, sem "Oops".
- **Botões com verbo + objeto:** "Enviar pedido", "Registrar recebimento", "Registrar envio", "Aprovar pedido", "Criar rascunho", "Salvar itens", "Tratar", "Imprimir", "Importar 1.282 materiais", "Tentar de novo". Destrutivo explícito: "Cancelar pedido" → "Confirmar cancelamento".
- **Pessoa:** fala com o usuário em "você" quando necessário ("Você ainda não tem almoxarifado atribuído. Fale com o administrador."); o sistema não fala de si em 1ª pessoa.
- **Subtítulo de página = a regra da tela:** "Saldo é sempre a soma das movimentações. Nunca é editado." · "Divergência não some sozinha: fica aberta até ser tratada com justificativa."
- **Erros dizem o que fazer:** "Informe o nome de quem contou o material." · "Anexe a foto da guia assinada ou da carga." · "10061204: Esta unidade não aceita fração." Código SAP no início quando o erro é de linha.
- **Vazios são fatos:** "Nenhuma divergência em aberto." "Nenhum pedido aguardando o 211."
- **Ajuda de campo explica o porquê:** "A data real, mesmo que o lançamento seja depois."
- **Casing:** frase (só a primeira maiúscula) em títulos, botões e rótulos. Caixa-alta só em cabeçalho de tabela e grupo do menu (via CSS).
- **Status:** sempre texto no badge: Rascunho, Solicitado, Aprovado, Em trânsito, Recebido/Encerrado, Com divergência, Cancelado. Motivos: Falta, Sobra, Avaria, Trocado. Tratamentos: Reenvio, Baixa em trânsito, Chegou depois, Ajuste na origem, Erro de contagem, Não saiu da origem.
- **Carregamento:** texto com reticência "Carregando…", "Abrindo o Warefly…", "Enviando foto…".

## VISUAL FOUNDATIONS (v2)
- **Vibe:** painel operacional claro, em camadas. Fundo cinza-azulado, painéis um tom abaixo, cartões um tom acima, e o branco puro reservado ao que está dentro do cartão ou selecionado. Muito respiro, nada de borda grossa.
- **Cores:** azul `#2F6FE4` (ação, seleção, foco, blocos do 211 no mapa), asa `#5B9AF2` (botão primário em repouso, realce), verde `#3DAA55` (fluxo normal: linhas do mapa, barras em destaque, tendência boa, bases), vermelho `#E5484D` (alerta: divergência, reserva vencendo, tendência ruim), âmbar `#F0B04A` (em trânsito, reduzido), cinza `#B9BEC4` (cancelado). Texto `#1F2328`, secundário `#646C73`, legenda decorativa `#8A9198`.
- **Tipografia:** Manrope para tudo. Título de página 30px 400 −0.02em; número de indicador 28px 400 −0.02em; título de cartão 14px 500; corpo 13–14px 400; legenda 11–12px. Números tabulares. IBM Plex Mono para código SAP e nº de documento (SOL-, REM-, RES-…).
- **Superfícies:** página `#EEF1F4`; painel lateral `#E6E9ED` com raio 20; cartão `#F7F8FA` raio 16 com brilho interno (`inset 0 1px 0 #fff`) e sombra difusa; tabela/campo dentro do cartão em branco raio 12.
- **Menu:** superior, em pílulas dentro de um trilho `#E2E6EA`; ativo = pílula branca com `--sombra-suave`. Botões de ícone quadrados 36px raio 11.
- **Indicadores:** número + quadradinho 14px verde/vermelho com seta + mini-gráfico de barras finas (2px, cinza com 1–2 barras na cor do tom).
- **Progresso:** trilho de 2px com marcador triangular embaixo do ponto atual; cor do tom.
- **Badges:** sólidos, raio 6, 11px 600, largura fixa na tabela; verde forte `#198C3E`, vermelho `#D93636`, âmbar com texto escuro, cinza com texto escuro.
- **Ação em etapas:** blocos de escolha (Aprovar / Reduzir / Separar) → campos "Rótulo: **valor**" em branco → botão azul largo; depois de confirmar, o botão vira preto `#111316` com ícone de check.
- **Mapa:** 3256 (almoxarifado geral) em armário amarelo; 211 Geral num bloco violeta `#7357D6` com o estoque central e os locais de GV (multifuncional, comercial, moto) em estantes azuis dentro; sub-bases em blocos agrupados por supervisor (um nó de junção por grupo). Cor da base pelo estoque: verde normal, amarelo `#F2B416` com material até 20% acima do mínimo, vermelho com material abaixo do mínimo. Nome da base pequeno em cinza claro embaixo do código. Linhas finas verdes (vermelhas com divergência); despachos como caminhões sobre as linhas, param com o mouse em cima; clique abre popover de vidro. A vista tem limite de arrasto e de zoom.
- **Vidro:** só para o que flutua sobre o mapa (cartões de gráfico, popover): `--vidro` + `--desfoque-vidro`.
- **Animação:** só `--transicao` (120ms) em cor, fundo e sombra. Nada se move ou cresce.
- **Foco:** contorno 2px azul com offset 2px. Desabilitado: opacidade 0.55.
- **Impressão (guia):** sem mudança — branco e preto, bordas 1px pretas, 12pt.

### v1 (histórico)
- **Vibe:** moderno e limpo. Superfícies brancas sobre névoa, bordas finas, muito respiro. Legível no galpão e no celular, sem enfeite.
- **Cores:** azul voo `#1E66C9` (ação, marca, foco, dado em destaque), asa `#5B9CF0` (realce, segunda pena do símbolo), marinho `#0B2447` (títulos, logotipo), cinza `#74808F` (bordas, texto secundário), névoa `#F3F6FA` (fundo). Cartão branco. Status: ciano `#0E8AA8` solicitado/aprovado, âmbar `#D49A1C` em trânsito, verde `#2F9E62` recebido, vermelho `#B3263E` divergência, cinza rascunho/cancelado; cada um com `-fundo` claro e `-texto` escuro. Séries de gráfico: azul voo, `#A9C3E8`, `#DCE6F4`.
- **Tipografia:** Barlow 400/500/600 para tudo, incluindo números de KPI (tabular); IBM Plex Mono para código SAP, nº de documento e quantidades em tabela. h1 1.5rem, h2 1.15rem, h3 1rem, todos 600 lh 1.2. Corpo 16px lh 1.45. Tabela 0.92rem; th 0.78rem caixa-alta 0.04em cinza. Logotipo "Warefly" 600 com −0.01em.
- **Espaçamento:** px exatos do app — 2,4,6,8,10,12,14,16,20,24,28,32,48. Pilhas com gap 16; grades 12; listas 8. Conteúdo 28px 32px no desktop, 16px no celular, largura máx. 1200px.
- **Fundos:** névoa lisa. Sem imagem, gradiente, textura ou padrão. Atenção = faixa âmbar de 3px com ponta arredondada sob o título.
- **Cartões:** branco, borda 1px cinza 20%, sombra mínima `0 1px 2px` marinho 6%, padding 16. Indicador (KPI) = cartão com raio 12px, legenda com ponto colorido do tom, número grande 600 e variação em pílula verde; hover eleva a sombra.
- **Menu:** lateral claro `#F8FAFC` com borda direita 1px; item ativo = cartão branco com borda fina. Celular: cabeçalho e barra inferior brancos, item ativo em azul voo. Abas com sublinhado 3px azul.
- **Raios:** 6px em controles; 12px em indicadores e folha móvel; 999px em badge, pílula e faixa de atenção.
- **Sombra:** só em flutuantes (resultados de busca, tooltip): `0 8px 24px` grafite 18%.
- **Hover:** primário escurece (cobre 85% + preto); secundário troca a borda para grafite; perigo ganha fundo vermelho claro; fantasma passa de aço a grafite; cartões/itens clicáveis passam a borda para aço 55%; linha de tabela clicável fica cobre 12%; menu ganha papel 8%.
- **Press/foco:** sem encolher. Foco = contorno 2px cobre com offset 1px. Desabilitado = opacidade 0.55, cursor not-allowed.
- **Animação:** nenhuma. Sem transições, fades ou bounces; mudança de estado é imediata.
- **Transparência/blur:** só `color-mix` para tons; véu grafite 55% atrás da folha móvel. Sem blur.
- **Layout fixo:** menu lateral sticky 232px (desktop); cabeçalho móvel sticky no topo e barra inferior fixa 64px (celular); ações primárias viram `sticky` acima da barra no celular e ocupam a largura.
- **Controles:** 42px de altura (32px no pequeno), borda aço 55%, raio 6px. Quantidade em campo = mono alinhado à direita, teclado decimal.
- **Tabelas:** cabeçalho papel 70% em caixa-alta; números à direita; valores críticos em vermelho 600 (diferença de conferência, índice de divergência).
- **Impressão (guia):** branco e preto, bordas 1px pretas, 12pt, coluna "Contagem" vazia de 110px, 3 linhas em branco, linhas de assinatura; margem 14mm.
- **Imagens:** não há imagem de marca. A única foto do sistema é a da guia assinada tirada pelo celular.
- **Gráficos (adição):** cores de status e cobre/grafite; grade tracejada aço; rótulos de eixo em mono; tooltip grafite com texto papel.

## ICONOGRAPHY
- **v2:** a referência nova usa ícones de traço fino (1.6px, 16px) em botões quadrados, sempre com `aria-label`. Use Lucide se for adotar no app.
- O app **não usa biblioteca de ícones**, fonte de ícones nem SVGs de interface. Menu, barra inferior e botões são só texto.
- Único SVG: o **símbolo** (tronco com três ramos — o 211 distribuindo para as bases), em `assets/simbolo.svg` e `assets/favicon.svg` (quadrado grafite, raio 6). Use o componente `Simbolo`/`Marca`.
- Unicode como ícone: `←` (voltar), `→` (origem → destino, e atalho do painel), `·` (separador), `…` (carregando e menu de cartão), `▾` (filtro de período), `/` (breadcrumb), `⌘K`.
- Ponto colorido de 7px antes do texto do badge de status.
- Sem emoji. Se uma tela nova precisar de ícones, pergunte antes; se aprovado, use um conjunto de traço fino (ex. Lucide, 1.5–2px) em aço/papel, sempre com rótulo.
- Logo: não existe logotipo além do símbolo + sigla "Warefly" em Barlow 600.
