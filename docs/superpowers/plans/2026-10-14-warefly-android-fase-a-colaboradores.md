# Plano: Warefly Android · Fase A — Colaboradores e acesso

> Spec: [2026-10-13-warefly-android-design.md](../specs/2026-10-13-warefly-android-design.md) (seções 4.1, 4.2 e 5)
> Um passo por vez; validação do Matheus ao fim de cada passo.

## Objetivo da fase

Cada colaborador entra com a própria matrícula (Engelmig ou CEMIG), troca a senha inicial no primeiro acesso e fica ligado a uma equipe. A gestão do almoxarifado cadastra os colaboradores; o supervisor mexe nos membros das equipes dele. Nada de estoque da equipe ainda (fase B).

## Antes de começar: o que já existe

A [spec de equipes por grupo](../specs/2026-10-13-equipes-por-grupo-design.md) já fez o banco de grupos, `equipe_locais` e cadastro completo da equipe. As telas dela (passos 2 e 3 do [plano](2026-10-13-equipes-por-grupo.md)) ainda não foram feitas, e a saída com equipe pelo app está parada até o passo 3.

Os passos A1 e A2 abaixo não dependem dessas telas. O passo A3 (telas web) sim: a aba de membros fica dentro de Cadastros › Equipes. **Ordem sugerida:** A1 → A2 → passos 2 e 3 de equipes por grupo → A3 → A4.

---

## Passo A1 · Banco (feito, aguardando validação)

Arquivos:

- `supabase/migrations/20261014100000_colaboradores_acesso.sql`
- `supabase/tests/database/06_colaboradores.test.sql`

O que a migration faz:

| Parte | Detalhe |
|---|---|
| `configuracoes` | `limite_membros_equipe` = 2, `prazo_senha_inicial_dias` = 7. Leitura para todos; `rpc_salvar_configuracao` só o admin. |
| `perfis` | `matricula` vira a Engelmig (só dígitos, restrição `NOT VALID` para não travar o que já está no remoto). Entram `matricula_cemig` (única, `e` + dígitos), `deve_trocar_senha` e `senha_inicial_ate`. Trigger normaliza: tira espaços e põe em minúsculo. |
| Perfil novo | O trigger de usuário novo lê nome, matrículas, papel e `senha_inicial` de `app_metadata` (só o servidor grava). Matrícula repetida desfaz a criação do usuário. |
| `fn_usuario` | Com a senha inicial pendente, nenhuma RPC roda: "Troque a senha inicial antes de continuar." |
| Gestão de colaboradores | `rpc_validar_colaborador`, `rpc_salvar_colaborador`, `rpc_preparar_redefinicao_senha`, `rpc_preparar_exclusao_colaborador`. Gestora mantém operadores que não são gestão; admin, todos. Exclusão só de quem nunca apareceu em nenhuma tabela ligada a `perfis` (menos atribuições). |
| Troca de senha | `rpc_concluir_troca_senha`: a própria pessoa, dentro do prazo. |
| Login | `rpc_email_para_login`: só `service_role`. Aceita a matrícula com espaço e `E` maiúsculo. |
| Hook de token | `interno.fn_hook_token`: barra inativo e senha inicial vencida. Execução só para `supabase_auth_admin`. |
| Supervisor do grupo | `grupos.supervisor_id` + `rpc_definir_supervisor_grupo` (admin). |
| `equipe_membros` | Histórico com `inicio`/`fim`; um vínculo atual por pessoa. `rpc_vincular_membro` (com `p_confirmar` para passar do limite; sem ele, erro `WF001`) e `rpc_desvincular_membro`. Supervisor só nas equipes do grupo dele; mudar para outro grupo, só a gestão. Equipe inativada e colaborador inativado saem da equipe. |
| Leitura | `v_colaboradores` (sem e-mail) filtrada por `fn_pode_ver_colaborador`; `v_equipes_membros` com `acima_do_limite`; `fn_pode_ver_equipe` passa a incluir o supervisor do grupo e os membros. |

Verificação feita (Postgres 16 + pgTAP, com esqueleto do Supabase):

- 01: 148 · 02: 14 · 03: 31 · 04: 80 · 05: 73 · 06: 85. Total de 431 asserções passando.

Para conferir na máquina:

```powershell
supabase db reset --local
supabase test db
```

---

## Passo A2 · Edge Functions e Auth

- `supabase/functions/entrar/index.ts`: recebe `{ matricula }`, chama `rpc_email_para_login` com a `service_role` e devolve `{ email }`. Para matrícula que não existe, devolve `<uuid v5 da matrícula>@colaborador.warefly.local`.
- `supabase/functions/colaboradores/index.ts`: ações `criar`, `redefinir_senha` e `excluir`, cada uma chamando antes a RPC com o token de quem pediu (tabela da seção 5 da spec). Senha padrão em `SENHA_INICIAL_PADRAO`.
- `supabase/functions/_compartilhado/`: cliente com `service_role`, cliente com o token de quem chama, resposta de erro no formato do app (`{ code, message }`).
- `supabase/config.toml`:
  - `[auth] enable_signup = false`;
  - `minimum_password_length = 8`;
  - `[auth.hook.custom_access_token]` apontando para `pg-functions://postgres/interno/fn_hook_token`;
  - `[functions.entrar] verify_jwt = false` (é chamada antes do login).
- Testes Deno (`deno test`) com o Supabase local: login por matrícula Engelmig e CEMIG; matrícula inexistente devolve e-mail no mesmo formato; gestora cria, redefine e exclui; supervisor recebe `42501`; criado com senha padrão entra e cai na troca; senha vencida é recusada pelo hook.
- Conferir no Supabase local se o Auth aceita o domínio `colaborador.warefly.local`. Se recusar, trocar o domínio nas duas funções e nos testes.

## Passo A3 · Web

Depende dos passos 2 e 3 de equipes por grupo.

- `lib/login.ts`: normaliza a matrícula (mesma regra do banco), com Vitest.
- `Login.tsx`: campo "Matrícula"; chama `entrar` e depois `signInWithPassword`. Mensagens do hook aparecem como vierem.
- `TrocarSenha.tsx`: obrigatória com `deve_trocar_senha`; mínimo 8, diferente da padrão, confirmação; grava no Auth e chama `rpc_concluir_troca_senha`.
- `Colaboradores.tsx` (gestora e admin): lista de `v_colaboradores` com busca por nome e matrícula; criar, editar, inativar, redefinir senha, excluir. Equipe atual de cada um.
- `Equipes.tsx`: aba de membros com vincular, desvincular e mudar de equipe; pergunta de confirmação no `WF001`; destaque para equipe acima do limite.
- `Grupos.tsx` (admin): escolher o supervisor do grupo.
- `Usuarios.tsx`: passa a gravar por `rpc_salvar_colaborador` (hoje grava direto em `perfis`).
- Gerar `database.types.ts`.

## Passo A4 · E2E e remoto

- Playwright: gestora cria colaborador; ele entra pela matrícula, troca a senha e vê a equipe; supervisor vincula o terceiro membro com confirmação.
- Antes de aplicar no remoto:
  ```sql
  select id, nome, matricula from perfis where matricula !~ '^[0-9]+$';
  ```
  Corrigir o que aparecer. Preencher a matrícula dos usuários atuais.
- Aplicar no remoto só com autorização, junto com as migrations pendentes da fundação e de equipes por grupo.
- No painel do Supabase: desligar o cadastro aberto, mínimo de senha 8, ligar o hook, publicar as funções e definir `SENHA_INICIAL_PADRAO`.
