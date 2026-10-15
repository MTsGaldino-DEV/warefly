-- =====================================================================
-- Warefly · Perfis e permissões (spec de 14/10/2026) — parte 1
-- Função nova de atribuição: operador do almoxarifado regional (211).
-- Fica sozinha neste arquivo porque um valor novo de enum só pode ser
-- usado depois que a transação que o criou termina.
-- =====================================================================

alter type public.funcao_atribuicao add value if not exists 'operador';
