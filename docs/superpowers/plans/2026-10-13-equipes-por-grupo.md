# Plano: equipes por grupo e locais liberados por equipe

> Spec: [2026-10-13-equipes-por-grupo-design.md](../specs/2026-10-13-equipes-por-grupo-design.md)
> Um passo por vez; validação do Matheus ao fim de cada passo.

## Passo 1 · Banco (feito e validado em 14/10)

Arquivos:
- `supabase/migrations/20261013100000_equipes_grupos.sql`: grupos, locais padrão, locais por equipe, cadastro completo e RPCs.
- `supabase/migrations/20261013100100_equipes_carga_inicial.sql`: as 94 equipes da planilha, com nomes, geradas da aba META ATUALIZADA.
- `supabase/tests/database/05_equipes_grupos.test.sql`: suíte nova.
- `supabase/tests/database/01` a `04`: os fixtures de equipe passam para o modelo novo, e a parte de equipes da 04 é reescrita.
- `app/src/visual/exemplo.ts`: o mapa mostra o nome do supervisor no lugar de "Grupo 1…4".

Verificação feita (Postgres 16 + pgTAP, com esqueleto do Supabase):
- 01: 148 · 02: 14 · 03: 31 · 04: 80 · 05: 73. Total de 346 asserções passando.

Validado na máquina do Matheus em 14/10: `supabase test db` com 346 asserções passando.

## Passo 2 · Telas de equipes e grupos (feito, aguardando validação)

Arquivos:
- `app/src/lib/database.types.ts`: tabelas `grupos`, `grupo_locais`, `equipe_locais`, colunas novas de `equipes`, enum `tipo_equipe` e as RPCs novas. Escrito à mão no formato do gerador; confira com `supabase gen types`.
- `app/src/lib/equipes.ts` (+ teste): validação do cadastro e do grupo (mesmas mensagens do banco), busca, agrupamento e locais.
- `app/src/lib/equipesPlanilha.ts` (+ teste): leitura da aba META ATUALIZADA, linhas com problema, Zeus repetido, linha de totais e o que muda em cada equipe.
- `app/src/lib/planilha.ts`: `lerAbas` (escolhe a aba; #N/A vem como texto).
- `app/src/pages/cadastros/Equipes.tsx`: lista por grupo; cadastro e edição com tudo obrigatório; locais liberados; ativar/inativar. Só a gestão do almoxarifado e o admin editam; os outros só veem.
- `app/src/pages/cadastros/ImportarEquipes.tsx`: arquivo → colunas → conferência → simulação (cinco blocos) → gravação.
- `app/src/pages/cadastros/Grupos.tsx` (admin): nome, tipo, chave da planilha, locais padrão.
- `app/src/components/SeletorLocais.tsx` e `index.css` (`.chip.local`).
- Sessão e menu: `basesEquipes` sai; entram `mantemEquipes` e `veEquipes`. Menu ganha "Grupos de equipes" (admin).
- `app/src/pages/movimentar/Movimentar.tsx`: a lista de equipes da saída passa a vir de `equipe_locais` (adiantado do passo 3 para o app compilar).

Verificação feita: `tsc -b` sem erro, Vitest 161 testes, oxlint sem aviso novo. Telas abertas no navegador contra o banco local (PostgREST): cadastro com campo faltando, Zeus repetido, locais da moto, visão do supervisor e importação da planilha real (94 lidas, 3 inativas, 21435 uma vez; reimportar dá 94 sem mudança).

Para conferir na máquina:
```powershell
cd C:\APPWEB\warefly
supabase db reset --local
supabase gen types typescript --local > app\src\lib\database.types.ts
cd app; npx tsc -b; npm test; npm run dev
```

**Atenção:** `e2e/03-movimentar.spec.ts` ainda cadastra equipe pelo modelo antigo e vai falhar até o passo 3.

## Passo 3 · Saída e E2E

- `Movimentar.tsx`: lista de equipes separada por grupo (as do supervisor primeiro), aviso quando a equipe não está liberada no local.
- E2E: reescrever `03-movimentar.spec.ts` (cadastro de equipe, liberação de local para moto, saída com equipe) e um spec da importação.

## Passo 4 · Remoto

- Aplicar no Supabase remoto só com autorização, junto com as migrations da fundação que ainda estão pendentes.
