# Warefly: equipes por grupo e locais liberados por equipe

> Especificação de design · 13/10/2026 · Status: banco validado; telas feitas, aguardando validação
> Altera a seção 10.1 (Saída com equipe) da [spec de 30/09](2026-09-30-warefly-reservas-solicitacoes-inventario-design.md). Onde as duas divergirem, vale esta.

---

## 1. Objetivo

Carregar no Warefly as equipes da planilha "Atualização PO x ZEUS" (aba META ATUALIZADA), ligar cada uma ao supervisor responsável e controlar em quais locais cada equipe pode retirar material.

## 2. Decisões tomadas

| Tema | Decisão |
|---|---|
| Grupo | Um por supervisor (Pedro, Vinícius, Victor, Elton) e um da moto (Kesia). O grupo é o dono da equipe e define os locais padrão. |
| Tipo da equipe | Vem do grupo: Kesia é **moto**; os outros, **multifuncional**. |
| Locais padrão | Todo grupo inclui o **211 Geral**. Pedro: ITN, TRM · Vinícius: RSP, AIM, CPN · Victor: MNT, ITB, CRC · Elton: SMS, SJE, SEF · Kesia: as 11 bases (por enquanto). |
| Locais por equipe | Cada equipe tem a própria lista (`equipe_locais`), que nasce igual à do grupo. A gestão do almoxarifado edita a lista (ex.: moto que chega numa localidade e pede acesso). A gestora só libera locais que ela gere; o admin, qualquer um. |
| Saída | A equipe só retira nos locais liberados para ela. Na base, equipe e quem retirou continuam obrigatórios; no 211 Geral a equipe é opcional. |
| Visão do estoque | Retirar no 211 Geral não dá acesso ao estoque dele: só a gestão vê. Quem é da base vê o estoque da base. |
| Visão das equipes | Gestão vê todas. O supervisor vê as equipes liberadas em alguma base dele (inclui as motos liberadas lá). |
| Cadastro | Só a gestão do almoxarifado e o admin. Obrigatório: código Zeus (único), descrição, integrantes, frota e grupo. Equipe ativa sempre tem o cadastro completo. |
| Nomes | Entram no código: nomes dos grupos, chave da planilha e a carga inicial das 94 equipes (decisão do Matheus em 13/10, no lugar da regra de não ter nome de pessoa no código). |
| Identificação | Zeus é a identidade. A descrição pode mudar; o Zeus não muda depois da primeira saída. |
| Linhas com problema | Sem supervisor, sem integrantes ou frota, #N/A ou "Não lançar": entram **inativas**. Zeus repetido entra uma vez. |
| Atualização | A planilha muda todo mês. Reimportação concilia pelo Zeus: novas, alteradas, sem mudança, inativadas (saíram da planilha) e com problema. Locais liberados à mão são mantidos; se a equipe troca de grupo, os locais voltam ao padrão do grupo novo. |
| Escrita | Equipes, grupos e locais só mudam por RPC. Nada é apagado. |

## 3. Modelo de dados

| Tabela | Campos |
|---|---|
| `grupos` | id, nome, tipo_equipe (`multifuncional` \| `moto`), chave_planilha, ativo |
| `grupo_locais` | grupo_id, almox_id (locais padrão) |
| `equipes` | id, codigo_zeus (único), nome (descrição), integrantes, frota, grupo_id, ativa, criado_por/em. Sai `almox_id`. |
| `equipe_locais` | equipe_id, almox_id, liberado_por, liberado_em |

RPCs: `rpc_salvar_grupo` (admin), `rpc_salvar_equipe`, `rpc_definir_locais_equipe`, `rpc_ativar_equipe`, `rpc_importar_equipes(p_linhas, p_simular)` (gestão e admin) e `rpc_registrar_saida` (mesma assinatura, regra nova).

## 4. Carga inicial (planilha de 13/10)

| Grupo | Ativas | Inativas |
|---|---|---|
| Pedro | 26 | 1 (21424, "Não lançar") |
| Vinícius | 12 | — |
| Victor | 10 | — |
| Elton | 14 | — |
| Kesia (moto) | 29 | — |
| Sem grupo | — | 2 (21142 Sobreaviso, 21619 #N/A) |

## 5. Interface

- **Cadastros › Equipes**: lista por grupo (Zeus · descrição · frota · integrantes · locais); cadastrar e editar com todos os campos obrigatórios; editar locais liberados; ativar/inativar.
- **Cadastros › Equipes › Importar planilha**: simula, mostra os cinco blocos e grava.
- **Cadastros › Grupos** (admin): nome, tipo, chave da planilha e locais padrão.
- **Movimentar**: a lista de equipes vem das liberadas no local escolhido.

## 6. Fora do escopo

- Login de equipe.
- Estoque por equipe (o controle continua indo até o local).
- Meta da equipe.
