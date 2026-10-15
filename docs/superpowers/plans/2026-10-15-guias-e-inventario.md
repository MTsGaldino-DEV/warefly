# Plano: guias assinadas e inventário

> Pedido do Matheus em 15/10/2026, para liberar o MVP. Um passo por vez; validação ao fim.

## Decisões (15/10)

- Banco zerado para a produção (script `supabase/snippets/2026-10-15_zerar_para_producao.sql`, já rodado).
- Inventário: admin e gestora. Aceita cadastro rápido de material fora do catálogo.
- Despacho para base também só fecha com a guia assinada anexada, igual à retirada.

## Passo 1 · Banco e aba Inventário (feito, aguardando validação)

`supabase/migrations/20261015100300_guias_inventario.sql`:

| Parte | Detalhe |
|---|---|
| Bucket `guias` | Privado, até 10 MB, JPEG, PNG, WebP e PDF. Caminho `{remessa\|saida}/{id do documento}/{uuid}.{ext}`. Sem update e sem delete. |
| Quem anexa | Remessa: quem opera a origem ou o destino. Saída: quem opera o local. Gestora e admin sempre. Operador do 211 só no que é do 211. |
| Quem vê | Quem vê o documento (`fn_pode_ver_remessa`, `fn_pode_ver` do local da saída). |
| `guias_assinadas` | Registro de cada anexo (formato, quem, quando). Só inserção, por `rpc_registrar_guia`. A mais recente vale. |
| `fn_em_implantacao` | Local só com saldo inicial: a contagem entra como implantação; depois, como inventário. |
| `rpc_cadastrar_material_rapido` | Gestora e admin. Código já cadastrado devolve o material existente. Descrição em maiúsculas. |

Web:
- Administração abre para a gestora, só com a sub-aba Inventário (`lib/admin.ts`, `Administracao.tsx`, menu da conta no Início).
- `pages/admin/Inventario.tsx`: local, data, justificativa padrão, busca de material, cadastro rápido, coluna "No sistema", rascunho no navegador, lança por `rpc_registrar_ajuste`.
- `database.types.ts`: entradas da migration nova acrescentadas à mão. Gerar de novo com `supabase gen types` quando possível.
- E2E: o usuário que era gerência passa a operador do 211 (`preparar.ts`); mensagens de acesso restrito atualizadas; spec nova `07-inventario.spec.ts`.

Verificação:
- pgTAP 01 a 08: 556 asserções passando (08: 45).
- Vitest: 153 testes passando. `tsc -b` sem erro. Lint sem aviso novo.
- E2E não rodado aqui (precisa do Supabase local no Docker).

## Próximo

Ligar o anexo da guia nas telas de retirada e despacho do Início, junto com a ligação do Início ao banco.
