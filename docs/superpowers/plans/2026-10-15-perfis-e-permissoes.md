# Plano: perfis e permissões

> Spec: [2026-10-14-perfis-e-permissoes-design.md](../specs/2026-10-14-perfis-e-permissoes-design.md)
> Um passo por vez; validação do Matheus ao fim de cada passo.

## Passo 1 · Banco (feito, aguardando validação)

Arquivos:
- `supabase/migrations/20261015100000_perfis_funcao_operador.sql`: valor `operador` em `funcao_atribuicao` (sozinho, porque valor novo de enum só vale depois do commit).
- `supabase/migrations/20261015100100_perfis_permissoes.sql`: perfis, escopo e checagens.
- `supabase/tests/database/07_perfis_permissoes.test.sql`: suíte nova.
- `supabase/tests/database/01`, `02` e `06`: o usuário que era gerência passa a ser operador do 211 nos fixtures (a gerência não existe mais).

O que a migration faz:

| Parte | Detalhe |
|---|---|
| Gerência | Para com erro se houver usuário com papel `gestao` (lista os nomes). Restrição `perfis_sem_gerencia_ck`. `fn_eh_gestao()` passa a devolver sempre falso. `fn_checar_colaborador` recusa o papel. |
| Operador do 211 | Atribuição `operador`, só em almoxarifado regional (trigger). `fn_eh_operador_regional()`. |
| Operador de base | `grupos.operador_base_id` + `rpc_definir_operador_base_grupo` (admin; não aceita o supervisor do próprio grupo nem pessoa inativa). `fn_eh_operador_base(almox)`: bases em que o supervisor do grupo tem a atribuição `supervisor`. |
| Gestão × operação do local | `fn_eh_responsavel` = responsável ou operador de base. `fn_opera_local` = o anterior ou o operador do 211 no 211. `fn_exigir_responsavel` (usada em aprovar, enviar remessa, remessa avulsa, receber, saída) passa a usar `fn_opera_local`. Nova `fn_exigir_gestao_do_local`, usada em `rpc_enviar_pedido`, `rpc_registrar_recebimento_externo` e `rpc_tratar_divergencia`. `rpc_cancelar_pedido`: o lado de quem atende usa `fn_opera_local`. |
| Visão | `fn_pode_ver`: sai a gerência; operador do 211 vê o 211 e as bases; operador de base vê as bases do grupo. `fn_disponivel_211()` para supervisor, operador de base, operador do 211, gestora e admin (equipe recebe `42501`). |
| Equipes | `fn_supervisiona_equipe` e `fn_eh_supervisor_de_grupo` incluem o operador de base (membros, visão das equipes e dos colaboradores). `rpc_definir_locais_equipe` aceita o operador do 211; `fn_libera_local` limita aos locais do regional dele. |
| Colaboradores | `fn_pode_ver_colaborador`: operador do 211 vê todos; sai a gerência. `fn_redefine_acesso` + `rpc_preparar_redefinicao_senha`: admin e gestora como antes; operador do 211, qualquer membro atual de equipe; supervisor e operador de base, membros das equipes do grupo. |

As RPCs alteradas são cópias da última versão, com só a checagem trocada. Foram geradas por script a partir das migrations anteriores, para não mudar mais nada.

Verificação feita (Postgres 16 + pgTAP, com esqueleto do Supabase):
- 01: 148 · 02: 14 · 03: 31 · 04: 80 · 05: 73 · 06: 85 · 07: 69. Total de 500 asserções passando.
- Com um usuário `gestao` no banco, a migration para e mostra o nome.
- As duas partes também aplicam numa transação só.

Para conferir na máquina:
```powershell
cd C:\APPWEB\warefly
supabase db reset --local
supabase test db
```

**Atenção:** a tela de Usuários ainda oferece "Gerência (só consulta)". Com a migration, o banco recusa esse papel. Isso é corrigido no passo 2.

## Passo 1b · Divergência pela gestão (feito, aguardando validação)

Decisão de 15/10 (opção B): a base justifica; a gestão aplica o tratamento.

Arquivos:
- `supabase/migrations/20261015100200_divergencia_gestora.sql`.
- `supabase/tests/database/01`, `03` e `07`: tratamentos que eram do supervisor passam para a gestão; a base justifica antes.

O que a migration faz:

| Parte | Detalhe |
|---|---|
| `divergencia_justificativas` | Histórico do que a base explica sobre cada item (texto, quem, quando). Não mexe no saldo. Leitura para quem vê a remessa; escrita só por RPC. |
| `rpc_justificar_divergencia` | Quem responde pela origem ou pelo destino (supervisor, operador de base, gestora), com divergência em aberto e texto obrigatório. O operador do 211 recebe `42501`. |
| `rpc_tratar_divergencia` | Só a gestão do almoxarifado do lado afetado (`fn_gere_local`) ou o admin. Regras de falta, sobra e quantidade sem mudança. |
| `v_divergencias_abertas` | Colunas novas no fim: `justificativa_base`, `justificado_por`, `justificado_em` (a última). |
| `fn_pode_ver_equipe` | O operador do 211 vê todas as equipes, mesmo sem local liberado (ponto 5 da revisão). |

Verificação feita: 01: 150 · 02: 14 · 03: 32 · 04: 80 · 05: 73 · 06: 85 · 07: 77. Total de 511 asserções passando.

## Passo 2 · Web

- `lib/perfis.ts` (+ teste): rótulos "Operador do 211" e "Operador de base"; sai "Gerência".
- `SessaoContext.tsx`: `ehOperador211`, `ehOperadorBase` (pelo grupo); sai `ehGestao`.
- `Usuarios.tsx`: sai a opção Gerência; a atribuição ganha "Operador" no 211.
- `Grupos.tsx` (admin): escolher o operador de base.
- Pedido da base: mostrar o disponível do 211 (`fn_disponivel_211`).
- `Equipes.tsx`: operador do 211 edita os locais liberados; não cria nem inativa.
- Divergências: a base vê o botão "Justificar"; a gestora vê a justificativa e os botões de tratamento. O supervisor deixa de ver os botões de tratamento.
- Menu: o operador do 211 vê aprovação, remessas, devoluções e equipes; não vê ajuste, entrada do 3256 nem divergências.
- `database.types.ts`: gerar com `supabase gen types`.

## Passo 3 · Retirada no 211 pelo supervisor ou operador de base (seção 4.1)

RPC nova sobre remessas: o operador do 211 lança a remessa para uma base do grupo de quem retira, com essa pessoa como portador e a foto da guia assinada. Saída do 211 e entrada na base na mesma transação, sem trânsito e sem etapa de recebimento. Precisa de validação antes, porque mexe na regra "quem envia não recebe".

## Passo 4 · E2E e remoto

- Playwright: operador do 211 aprova e envia; operador de base recebe; supervisor vê o disponível do 211.
- Antes de aplicar no remoto:
  ```sql
  select nome from perfis where papel = 'gestao';
  ```
  Trocar o papel de quem aparecer.
- Aplicar no remoto só com autorização, junto com as migrations pendentes da fundação, de equipes por grupo e de colaboradores.

## O que depende de módulos ainda não feitos

Estas linhas da matriz entram junto com o módulo, já com o perfil certo:
- Solicitação ao 211 (SOL-) e separado: fase Solicitações.
- Reservas CEMIG, retirada do 3256 e importação SAP: fases 4 e 5.
- Inventário por local: fase Estoque e inventário.
- Estoque do carro e transferência entre equipes: Android fase B.
