-- =====================================================================
-- Warefly · Zerar o banco para a produção (15/10/2026)
--
-- Rodar UMA vez no SQL Editor do Supabase, depois do backup
-- (backup-estrutura-2026-10-15.sql e backup-dados-2026-10-15.sql).
-- Tudo roda numa transação: se algo falhar, nada é apagado.
--
-- Fica:  locais (211, bases, 3256), unidades, configurações e os
--        usuários com papel admin (com as atribuições deles).
-- Sai:   toda a operação (pedidos, remessas, saídas, ajustes,
--        movimentações, divergências), materiais, motivos de redução,
--        grupos, equipes (locais e membros) e todos os usuários que não
--        são admin.
--
-- Não é migration: é uma limpeza única antes de liberar o sistema.
-- As fotos do bucket "recebimentos" saem pelo painel (Storage), porque o
-- Supabase não deixa apagar arquivo do Storage por SQL.
-- =====================================================================

begin;

-- Trava: sem admin ativo, ninguém entraria no sistema depois da limpeza.
do $$
begin
  if not exists (select 1 from public.perfis where papel = 'admin' and ativo) then
    raise exception 'Nenhum usuário admin ativo. Nada foi apagado. Defina um admin e rode de novo.';
  end if;
end;
$$;

-- O livro-razão bloqueia truncate de propósito. Libera só dentro desta
-- transação e religa logo em seguida.
alter table public.movimentacoes disable trigger movimentacoes_imutavel_truncate;

-- Sem "cascade": se alguma tabela que depende destas ficar de fora da
-- lista, o truncate falha em vez de apagar algo sem aviso.
truncate table
  public.movimentacoes,
  public.divergencia_justificativas,
  public.divergencia_tratamentos,
  public.remessa_itens,
  public.remessas,
  public.pedido_itens,
  public.pedidos,
  public.saida_itens,
  public.saidas,
  public.ajuste_itens,
  public.ajustes,
  public.equipe_membros,
  public.equipe_locais,
  public.equipes,
  public.grupo_locais,
  public.grupos,
  public.motivos_reducao,
  public.materiais
  restart identity;

alter table public.movimentacoes enable trigger movimentacoes_imutavel_truncate;

-- Configurações alteradas por quem vai sair ficam sem autor.
update public.configuracoes
   set atualizado_por = null
 where atualizado_por is not null
   and atualizado_por not in (select id from public.perfis where papel = 'admin');

-- Usuários que não são admin. Perfis e atribuições saem junto
-- (on delete cascade a partir de auth.users).
delete from auth.users u
 where not exists (select 1 from public.perfis p where p.id = u.id and p.papel = 'admin');

commit;

-- Conferência: tudo zero, menos locais, unidades, configurações e admins.
select 'almoxarifados' as tabela, count(*) from public.almoxarifados
union all select 'unidades', count(*) from public.unidades
union all select 'configuracoes', count(*) from public.configuracoes
union all select 'usuarios (admin)', count(*) from public.perfis
union all select 'materiais', count(*) from public.materiais
union all select 'motivos_reducao', count(*) from public.motivos_reducao
union all select 'grupos', count(*) from public.grupos
union all select 'equipes', count(*) from public.equipes
union all select 'pedidos', count(*) from public.pedidos
union all select 'remessas', count(*) from public.remessas
union all select 'saidas', count(*) from public.saidas
union all select 'ajustes', count(*) from public.ajustes
union all select 'movimentacoes', count(*) from public.movimentacoes;
