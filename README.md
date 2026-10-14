# Warefly — Gestão de almoxarifado

Controle do almoxarifado regional **211** e das **11 bases**, em paralelo ao SAP e sem integração com ele. Registra o que cada base pediu, o que foi enviado e o que de fato chegou.

O sistema se chamava **SIA** (Sistema Integrado de Almoxarifado) até 30/09/2026. As migrations aplicadas antes da troca mantêm "SIA" nos comentários, como registro do que rodou no banco. O plano completo está em [WAREFLY_PLANO_IMPLEMENTAÇÃO.MD](WAREFLY_PLANO_IMPLEMENTAÇÃO.MD).

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `supabase/migrations` | Banco: enums, tabelas, views, RLS, RPCs, storage e indicadores (fases 1 e 5) |
| `supabase/tests/database` | Testes pgTAP que simulam cada papel (262 verificações) |
| `app/` | App React + Vite + TypeScript (fases 2 a 5) |
| `app/e2e` | Testes ponta a ponta (Playwright) contra o Supabase local |
| `conector/` | Conector local para automações no GDIS (Edge + Playwright, porta 3335) ([README](conector/README.md)) |
| `design-system/` | Design system Warefly: tokens (usados pelo app), fontes, componentes de referência, UI kits e lint de aderência ([README](design-system/README.md)) |
| `design-system/referencia` | Páginas HTML de referência visual, para abrir no navegador |

## Pré-requisitos

- Node 20 ou superior
- Docker Desktop (para o Supabase local e os testes)
- Supabase CLI (`npm i -g supabase`)

## Configuração

1. Copie `.env.example` para `.env` na raiz e preencha as credenciais do projeto Supabase (esse arquivo não vai para o git).
2. Copie `app/.env.example` para `app/.env` com a URL do projeto e a chave **anon/publishable**. Nunca coloque a `service_role` no app.

## Rodar localmente

```powershell
supabase start                 # sobe o Supabase local (Docker)
supabase db reset --local      # aplica as migrations
cd app
npm install
npm run dev                    # usa app/.env (projeto remoto)
npx vite --mode local-e2e      # ou: aponta para o Supabase local (app/.env.local-e2e)
```

Para o modo local, crie `app/.env.local-e2e` com `VITE_SUPABASE_URL=http://127.0.0.1:54321` e a `ANON_KEY` mostrada por `supabase status`.

## Testes

```powershell
supabase test db               # pgTAP no banco local (262 verificações)
cd app
npm test                       # testes unitários (Vitest)
npx tsc -b                     # checagem de tipos
npm run lint                   # oxlint + regras de aderência ao design system (só avisos)
npx playwright test            # E2E: ZERA o banco local e percorre todos os fluxos
```

Para rodar o pgTAP no projeto remoto, sem alterar dados (tudo roda em transação e é desfeito):

```powershell
supabase test db --db-url "postgresql://postgres.<ref>:<senha>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
```

## Design system

A identidade visual do app vem de `design-system/`:

- `app/src/index.css` importa os tokens de `design-system/tokens` (cores, tipografia, espaçamento). Para mudar uma cor, mude o token lá; não copie valores para o app. Por isso o build do app precisa da pasta `design-system` ao lado de `app/`: na Vercel, mantenha ligada a opção que inclui arquivos fora do Root Directory (vem ligada por padrão).
- Os componentes do app (`app/src/components`) seguem a API e o visual dos componentes de referência: marca, etiquetas com mini-gráfico, gráficos do painel, breadcrumb, busca ⌘K, menus de cartão.
- As páginas de `design-system/referencia/` abrem com duplo clique (precisam de internet para o React e o Babel do unpkg).
- `npm run lint` aplica as regras de aderência de `design-system/lint/` ao código do app, como avisos: cor ou px soltos em string e props fora da API dos componentes. Hoje não há nenhum.

Detalhes, triagem do export e pendências em [design-system/README.md](design-system/README.md).

## Aplicar migrations no projeto remoto

```powershell
supabase db push --db-url "postgresql://postgres.<ref>:<senha>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
```

As 8 primeiras migrations foram aplicadas no projeto `hkfbypwkjvhuuwbijlwy` em 28/09/2026. As da nova rodada (a partir de `20261001100000`) ainda não.

## Publicar o app

`npm run build` gera `app/dist`, um site estático. Qualquer hospedagem estática serve (Vercel, Netlify, Cloudflare Pages, Supabase Storage com CDN), desde que **toda rota caia no `index.html`**, porque o app usa rotas no navegador:

- Vercel: `vercel.json` com `{ "rewrites": [{ "source": "/(.*)", "destination": "/" }] }`
- Netlify: arquivo `app/public/_redirects` com `/* /index.html 200`

Depois de publicar, cadastre a URL em **Authentication → URL Configuration** no painel do Supabase.

### No Docker Desktop (rede local)

O container compila o app com o `app/.env` (projeto remoto) e serve com o nginx. O `.dockerignore` deixa o `.env` da raiz, que tem a `service_role`, fora do build.

```powershell
docker compose up -d --build                         # porta 8090 (8080 já é de outro container)
$env:WAREFLY_PORTA=8095; docker compose up -d --build   # outra porta, se precisar
docker compose logs -f warefly                       # ver o nginx
docker compose down                                  # parar
```

Depois de mudar o código ou o `app/.env`, rode `docker compose up -d --build` de novo. O container volta sozinho quando o Docker Desktop abre (`restart: unless-stopped`).

- **Neste PC:** `http://localhost:8090`.
- **Outros PCs da rede:** `http://<IP-deste-PC>:8090` (o IP aparece em `ipconfig`, linha "Endereço IPv4"). Se não abrir, libere a porta no firewall do Windows, num PowerShell **como administrador**:

  ```powershell
  New-NetFirewallRule -DisplayName "Warefly 8090" -Direction Inbound -Protocol TCP -LocalPort 8090 -Action Allow
  ```

- O app funciona em HTTP pelo IP: os ids são gerados com `crypto.getRandomValues` (`app/src/lib/id.ts`), porque `crypto.randomUUID` só existe em HTTPS ou `localhost`.
- **Automação no GDIS:** o [conector](conector/README.md) não roda no Docker (precisa abrir o Edge na tela e da rede da Cemig). Rode `npm start` na pasta `conector` e abra o Warefly por `http://localhost:8090` neste PC: pelo IP, o Edge pode bloquear a chamada de um site HTTP para o `localhost`.

## Primeiro acesso (fase 6)

1. **Criar os usuários** no painel do Supabase (Authentication → Add user), com e-mail e senha. Em *User metadata*, use `{"nome": "Nome da pessoa"}`; o perfil é criado sozinho. No app, quem tem e-mail `@engelmig.com.br` entra digitando só o usuário (ex.: `matheus.galdino`); outros domínios entram com o e-mail completo.
2. **Promover o primeiro admin** no SQL Editor:
   ```sql
   update perfis set papel = 'admin' where email = 'seu-email@empresa.com';
   ```
3. No app, como admin:
   - **Usuários e atribuições**: marque as bases de cada supervisor com "Responsável e supervisor" e dê "Responsável" no 211 à gestão do almoxarifado (aprova, entrega, ajusta o estoque e inventaria). Papel "Gerência" (`gestao`) para quem só acompanha.
   - **Unidades**: confira a lista (já vem com as 10 unidades da planilha: PC, CJ, PR, JG, RL, US, CT, M, KG, M3).
   - **Equipes**: cadastre as equipes de cada base (o supervisor também pode). A saída de aplicação em serviço exige equipe e o nome de quem retirou.
   - **Materiais → Importar planilha**: envie o `ALMOXARIF 211.xlsx`. O cabeçalho é detectado sozinho (código, descrição, unidade e preço).
4. **Dia D**: após a contagem, em **Saldo inicial**, importe uma planilha por almoxarifado (`codigo_sap`, `quantidade`; o botão "Baixar modelo" gera o arquivo).
5. Acompanhe as duas primeiras semanas pelo **Painel da gestão** (divergências e ajustes).

## Regras que o sistema garante

- Saldo é sempre a soma das movimentações; ninguém edita saldo nem apaga movimentação.
- Saldo nunca fica negativo: saída ou envio acima do saldo é bloqueado.
- Toda mudança de estado passa por funções do banco (RPCs) com checagem de permissão.
- Quem registra o envio não registra o recebimento, exceto entre bases do mesmo supervisor.
- Recebimento exige foto da guia assinada e o nome de quem contou.
- Divergência só fecha com tratamento justificado.
- Ajuste de estoque e saldo inicial só pela gestão do almoxarifado (responsável do regional) ou pelo administrador.
- Saída de aplicação em serviço numa base registra a equipe e quem retirou.
