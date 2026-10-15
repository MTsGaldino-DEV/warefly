# Perfis e permissões — Warefly web e Android

Data: 14/10/2026. Status: validada em 14/10; banco feito em 15/10, aguardando validação ([plano](../plans/2026-10-15-perfis-e-permissoes.md)).

## 1. Objetivo

Definir os perfis de acesso do Warefly (web e app Android), o escopo de cada um e o que cada um pode ver e fazer. Esta spec substitui a tabela de perfis do contexto atual (gestora, supervisor, gerência, admin).

## 2. Perfis

| Perfil | Onde acessa | Escopo |
|---|---|---|
| Equipe | Android | o próprio carro e as bases liberadas para a equipe |
| Operador de base | Android e web | as bases e as equipes do grupo dele (uma pessoa por grupo de supervisor) |
| Supervisor | Android e web | as bases e as equipes do grupo dele |
| Operador do 211 | web (Android compacto depois) | 211 Geral; consulta todas as bases e equipes |
| Gestora do almoxarifado | web | todos os locais |
| Admin | web | tudo |

- O operador de base é o braço direito do supervisor e tem o mesmo acesso dele dentro do grupo, inclusive solicitar e aprovar.
- O perfil Gerência deixa de existir.
- Grupo = conjunto de bases de um supervisor (hoje 4 grupos).

## 3. Matriz de permissões

"Grupo" = bases e equipes do grupo do usuário.

| Ação | Equipe | Supervisor e Op. base | Op. 211 | Gestora | Admin |
|---|---|---|---|---|---|
| **Consulta** | | | | | |
| Estoque do 211 Geral | — | ver disponível | ✓ | ✓ | ✓ |
| Estoque das bases | só liberadas | as do grupo | todas | todas | todas |
| Estoque do carro | o próprio | equipes do grupo | todas | todas | todas |
| Reservas CEMIG | — | — | ver | ✓ | ✓ |
| **Solicitações** | | | | | |
| Requisição da equipe | cria | aprova, nega, atende pela base | ver | ver | ✓ |
| Solicitação ao 211 (SOL-) | — | cria e anexa requisições | aprova, reduz, cancela | aprova, reduz, cancela | ✓ |
| **Saída de material** | | | | | |
| Despacho para base | — | recebe com foto da guia | monta e emite guia | ✓ | ✓ |
| Retirada no 211 Geral pela equipe | retira | — | lança e anexa termo | ✓ | ✓ |
| Retirada no 211 Geral pelo supervisor ou op. base | — | retira para uma base do grupo (seção 4.1) | lança e anexa guia | ✓ | ✓ |
| Retirada na base | retira | lança e anexa termo | — | ✓ | ✓ |
| **Movimentação** | | | | | |
| Transferência entre bases | — | entre as do grupo | — | ✓ | ✓ |
| Devolução ao 211 | — | envia | confirma | ✓ | ✓ |
| Transferência entre equipes | envia e confirma (dois lados) | ver | ver | ver | ✓ |
| Devolução da equipe à base | envia | confirma | — | ✓ | ✓ |
| **Entradas do 3256** | | | | | |
| Reservas CEMIG, retirada do 3256, importação SAP | — | — | — | ✓ | ✓ |
| **Controle** | | | | | |
| Inventário do 211 | — | — | — | ✓ | ✓ |
| Contagem de inventário nas bases | — | conta nas bases do grupo | — | abre, fecha, aprova | ✓ |
| Ajuste de saldo | — | — | — | ✓ | ✓ |
| Divergência | — | registra no recebimento e justifica | — | aplica o tratamento (fecha) | ✓ |
| **Cadastros** | | | | | |
| Integrantes das equipes | — | equipes do grupo | — | ✓ | ✓ |
| Bases liberadas da equipe | — | — | ✓ | ✓ | ✓ |
| Reset de senha de colaborador | — | equipes do grupo | todas | todas | todas |
| Criar equipe e colaborador | — | — | — | ✓ | ✓ |
| Mínimos e motivos de redução | — | — | — | ✓ | ✓ |
| Materiais e locais | — | — | — | — | ✓ |
| Usuários e perfis da web, automações (GDIS e consumo diário) | — | — | — | — | ✓ |

## 4. Regras

### 4.1 Retirada no 211 pelo supervisor ou operador de base

- O destino é obrigatório e só pode ser uma base do grupo de quem retira.
- O operador do 211 lança como despacho (DSP-) com o supervisor ou operador de base como portador.
- O portador assina a guia no balcão do 211 e o operador anexa a foto ou o PDF.
- O fluxo fecha na mesma transação: saída do 211 e entrada na base, sem etapa de recebimento na base nem material em trânsito.
- Consequência aceita: não há conferência na chegada. Diferença nesse despacho só aparece na contagem de inventário da base.

### 4.2 Segregação

- Quem envia não confirma o recebimento, exceto entre bases do mesmo grupo e no caso 4.1.
- Quem cria a SOL- não aprova: a aprovação é do operador do 211 ou da gestora.
- Transferência entre equipes exige confirmação dos dois lados, cada uma pela matrícula de quem fez.

### 4.3 Equipe

- Nunca vê o estoque do 211 Geral. A regra vale no banco: dados da equipe só por RPC ou view filtrada, sem leitura direta das tabelas.
- Material é da equipe: todos os integrantes veem e operam, e cada movimento registra a matrícula de quem fez.

### 4.4 Termo e guia

- Termo de retirada e guia de despacho continuam em papel, assinados, com foto ou PDF anexado (até 10 MB).
- Evolução futura, fora desta spec: todos os perfis assinam pelo telefone.

## 5. Impacto técnico

| Tema | Decisão (15/10) |
|---|---|
| Gerência | Sai. A migration para se ainda houver usuário com papel `gestao`; uma restrição impede que volte. O valor continua no enum (o Postgres não remove valor de enum). |
| Operador do 211 | Atribuição nova `operador`, aceita só no almoxarifado regional. |
| Operador de base | `grupos.operador_base_id` (uma pessoa por grupo), definido pelo admin. Opera as bases em que o supervisor do grupo tem a atribuição `supervisor`, então acompanha o supervisor sem cadastro duplicado. Mantém as equipes do grupo como o supervisor. |
| Gestora e supervisor | Como antes: `responsavel` no 211; `responsavel` + `supervisor` nas bases. |
| Gestão do local × operação do local | `fn_eh_responsavel` (responsável ou operador de base) decide o que é da gestão do local: pedido do local, entrada do 3256, tratamento de divergência. `fn_opera_local` (o anterior ou o operador do 211) decide o dia a dia: aprovar e cancelar pedido, enviar remessa, receber devolução, registrar saída. |
| Divergência | Opção B (15/10): a base registra a falta ou sobra no recebimento e escreve a justificativa (`rpc_justificar_divergencia`); só a gestora e o admin aplicam o tratamento e mexem no saldo. O operador do 211 não trata nem justifica. |
| Disponível do 211 | `fn_disponivel_211()`: supervisor, operador de base, operador do 211, gestora e admin. Por enquanto disponível = físico; a fase de Solicitações desconta o separado. |
| Login da equipe | Segue o plano da fase A do Android (Edge Function `entrar`). |

- Toda permissão é checada nas RPCs (`42501`). A interface só esconde o que o banco já bloqueia.
- Migrations só arquivos novos. Aplicar no remoto só com autorização.
- Testes: pgTAP `07_perfis_permissoes`; Vitest para `lib/perfis`; E2E dos fluxos de retirada do supervisor e de aprovação pelo operador do 211.

## 6. Fora do escopo

- Assinatura pelo telefone.
- Automação de consumo diário por equipe.
- Divisão comercial/multifuncional.
