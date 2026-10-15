-- =====================================================================
-- Warefly · Perfis e permissões (spec de 14/10/2026)
-- Equipe · operador de base · supervisor · operador do 211 · gestora · admin
-- Roda com: supabase test db   (tudo em transação, desfeito no fim)
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select * from no_plan();

-- ---------------------------------------------------------------------
-- Apoio
-- ---------------------------------------------------------------------
create schema tests;
grant usage on schema tests to authenticated, anon;

create table tests.ctx (chave text primary key, valor uuid not null);
grant all on tests.ctx to authenticated;

create function tests.u(p text) returns uuid language sql immutable as $$
  select case p
    when 'ADMIN'   then '00000000-0000-4000-a000-0000000007a1'
    when 'GESTORA' then '00000000-0000-4000-a000-0000000007a2'
    when 'OP211'   then '00000000-0000-4000-a000-0000000007a3'
    when 'VICTOR'  then '00000000-0000-4000-a000-0000000007a4'
    when 'OPBV'    then '00000000-0000-4000-a000-0000000007a5'
    when 'VINI'    then '00000000-0000-4000-a000-0000000007a6'
    when 'E1'      then '00000000-0000-4000-a000-0000000007a7'
    when 'E2'      then '00000000-0000-4000-a000-0000000007a8'
    when 'SOLTO'   then '00000000-0000-4000-a000-0000000007a9'
  end::uuid
$$;

create function tests.m(p text) returns uuid language sql immutable as $$
  select case p
    when 'PARAF' then '10000000-0000-4000-a000-0000000007b1'
    when 'CONEC' then '10000000-0000-4000-a000-0000000007b2'
  end::uuid
$$;

create function tests.j(p text) returns jsonb language sql immutable as $$
  select replace(replace(p, '"PARAF"', '"' || tests.m('PARAF') || '"'),
                            '"CONEC"', '"' || tests.m('CONEC') || '"')::jsonb
$$;

create function tests.a(c text) returns uuid language sql stable security definer as $$
  select id from public.almoxarifados where codigo = c
$$;
create function tests.g(n text) returns uuid language sql stable security definer as $$
  select id from public.grupos where nome = n
$$;
create function tests.eq(z integer) returns uuid language sql stable security definer as $$
  select id from public.equipes where codigo_zeus = z
$$;
create function tests.id(k text) returns uuid language sql stable security definer as $$
  select valor from tests.ctx where chave = k
$$;
create function tests.saldo(c text, m text) returns numeric language sql stable security definer as $$
  select coalesce(sum(quantidade), 0) from public.movimentacoes where almox_id = tests.a(c) and material_id = tests.m(m)
$$;
create function tests.foto(r uuid, dono text) returns text language plpgsql security definer as $$
declare n text := r || '/' || gen_random_uuid() || '.jpg';
begin
  insert into storage.objects (bucket_id, name, owner_id) values ('recebimentos', n, tests.u(dono)::text);
  return n;
end $$;
create function tests.como(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', tests.u(p), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
grant execute on all functions in schema tests to authenticated, anon;

-- ---------------------------------------------------------------------
-- Dados
--   Victor supervisiona MNT, ITB e CRC; o operador de base do grupo dele
--   é OPBV. Vinícius supervisiona RSP, AIM e CPN. E1 é da equipe do
--   Victor; E2, da equipe do Vinícius. SOLTO não tem atribuição.
-- ---------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data, aud, role)
select tests.u(n), lower(n) || '@warefly.test', json_build_object('nome', n)::jsonb, 'authenticated', 'authenticated'
  from unnest(array['ADMIN', 'GESTORA', 'OP211', 'VICTOR', 'OPBV', 'VINI', 'E1', 'E2', 'SOLTO']) as n;
update perfis set papel = 'admin' where id = tests.u('ADMIN');
update perfis set matricula_cemig = 'e7001' where id = tests.u('E1');
update perfis set matricula_cemig = 'e7002' where id = tests.u('E2');

insert into atribuicoes (almox_id, usuario_id, funcao)
select tests.a(v.c), tests.u(v.u), v.f::funcao_atribuicao
  from (values ('211', 'GESTORA', 'responsavel'),
               ('211', 'OP211', 'operador'),
               ('MNT', 'VICTOR', 'responsavel'), ('MNT', 'VICTOR', 'supervisor'),
               ('ITB', 'VICTOR', 'responsavel'), ('ITB', 'VICTOR', 'supervisor'),
               ('CRC', 'VICTOR', 'responsavel'), ('CRC', 'VICTOR', 'supervisor'),
               ('RSP', 'VINI', 'responsavel'), ('RSP', 'VINI', 'supervisor'),
               ('AIM', 'VINI', 'responsavel'), ('AIM', 'VINI', 'supervisor'),
               ('CPN', 'VINI', 'responsavel'), ('CPN', 'VINI', 'supervisor')) as v (c, u, f);

update grupos set supervisor_id = tests.u('VICTOR') where nome = 'Victor';
update grupos set supervisor_id = tests.u('VINI') where nome = 'Vinícius';

insert into materiais (id, codigo_sap, descricao, unidade, preco) values
  (tests.m('PARAF'), '7001', 'PARAFUSO PERFIS', 'PC', 2.00),
  (tests.m('CONEC'), '7002', 'CONECTOR PERFIS', 'PC', 10.00);

insert into equipes (codigo_zeus, nome, integrantes, frota, grupo_id) values
  (970001, 'MNT-01', 'Integrante A/Integrante B', 'F-1', tests.g('Victor')),
  (970002, 'RSP-01', 'Integrante C/Integrante D', 'F-2', tests.g('Vinícius'));
insert into equipe_locais (equipe_id, almox_id) values
  (tests.eq(970001), tests.a('MNT')), (tests.eq(970001), tests.a('211')),
  (tests.eq(970002), tests.a('RSP'));
insert into equipe_membros (equipe_id, colaborador_id) values
  (tests.eq(970001), tests.u('E1')), (tests.eq(970002), tests.u('E2'));

select tests.como('ADMIN');
select rpc_registrar_ajuste(tests.a('211'), 'implantacao', 'Dia D', tests.j('[{"material_id":"PARAF","qtd_contada":100},{"material_id":"CONEC","qtd_contada":40}]'));
select rpc_registrar_ajuste(tests.a('MNT'), 'implantacao', 'Dia D', tests.j('[{"material_id":"PARAF","qtd_contada":20}]'));
select rpc_registrar_ajuste(tests.a('RSP'), 'implantacao', 'Dia D', tests.j('[{"material_id":"PARAF","qtd_contada":5}]'));
reset role;

-- ---------------------------------------------------------------------
-- A. Cadastro dos perfis
-- ---------------------------------------------------------------------
select throws_ok($$ update perfis set papel = 'gestao' where id = tests.u('SOLTO') $$,
  '23514', null, 'gerência não existe mais');
select throws_like(
  $$ insert into atribuicoes (almox_id, usuario_id, funcao) values (tests.a('MNT'), tests.u('SOLTO'), 'operador') $$,
  '%vale só no almoxarifado regional%', 'operador por atribuição só no 211');

select tests.como('GESTORA');
select throws_ok($$ select rpc_definir_operador_base_grupo(tests.g('Victor'), tests.u('OPBV')) $$,
  '42501', null, 'gestora não define operador de base');
reset role;
select tests.como('ADMIN');
select throws_like($$ select rpc_definir_operador_base_grupo(tests.g('Victor'), tests.u('VICTOR')) $$,
  '%não pode ser também o operador de base%', 'supervisor não é operador de base do próprio grupo');
select lives_ok($$ select rpc_definir_operador_base_grupo(tests.g('Victor'), tests.u('OPBV')) $$,
  'admin define o operador de base do grupo');
reset role;
select is((select operador_base_id from grupos where nome = 'Victor'), tests.u('OPBV'), 'grupo guarda o operador de base');

-- ---------------------------------------------------------------------
-- B. O que cada um vê
-- ---------------------------------------------------------------------
select tests.como('OPBV');
select ok(fn_pode_ver(tests.a('MNT')) and fn_pode_ver(tests.a('ITB')) and fn_pode_ver(tests.a('CRC')),
  'operador de base vê as bases do grupo');
select ok(not fn_pode_ver(tests.a('RSP')), 'operador de base não vê base de outro grupo');
select ok(not fn_pode_ver(tests.a('211')), 'operador de base não vê o 211 pelo saldo');
select set_eq($$ select almox_codigo from v_saldo $$, array['MNT'], 'saldo do operador de base: só o grupo');
select ok((select count(*) from fn_disponivel_211()) = 2, 'operador de base vê o disponível do 211');
reset role;

select tests.como('VICTOR');
select results_eq($$ select codigo_sap, disponivel from fn_disponivel_211() order by codigo_sap $$,
  $$ values ('7001'::text, 100.000::numeric), ('7002'::text, 40.000::numeric) $$,
  'supervisor vê o disponível do 211');
select ok(not fn_pode_ver(tests.a('211')), 'supervisor continua sem ver o 211 pelo saldo');
reset role;

select tests.como('OP211');
select set_eq($$ select almox_codigo from v_saldo $$, array['211', 'MNT', 'RSP'], 'operador do 211 vê o 211 e as bases');
reset role;

select tests.como('E1');
select is((select count(*) from v_saldo)::int, 0, 'equipe não vê saldo de local');
select throws_ok($$ select * from fn_disponivel_211() $$, '42501', null, 'equipe não vê o estoque do 211');
reset role;
select tests.como('SOLTO');
select throws_ok($$ select * from fn_disponivel_211() $$, '42501', null, 'quem não tem perfil de operação não vê o 211');
reset role;

-- ---------------------------------------------------------------------
-- C. Pedido da base ao 211
-- ---------------------------------------------------------------------
select tests.como('OPBV');
select lives_ok(
  $$ with p as (insert into pedidos (solicitante_id) values (tests.a('MNT')) returning id) insert into tests.ctx select 'ped1', id from p $$,
  'operador de base abre pedido da base');
insert into pedido_itens (pedido_id, material_id, qtd_solicitada) values (tests.id('ped1'), tests.m('PARAF'), 10);
select lives_ok($$ select rpc_enviar_pedido(tests.id('ped1')) $$, 'operador de base envia o pedido');
select throws_ok($$ insert into pedidos (solicitante_id) values (tests.a('RSP')) $$,
  '42501', null, 'operador de base não abre pedido de base de outro grupo');
reset role;

-- Pedido de outro grupo para o cancelamento
select tests.como('VINI');
with p as (insert into pedidos (solicitante_id) values (tests.a('RSP')) returning id) insert into tests.ctx select 'ped2', id from p;
insert into pedido_itens (pedido_id, material_id, qtd_solicitada) values (tests.id('ped2'), tests.m('PARAF'), 1);
select rpc_enviar_pedido(tests.id('ped2'));
reset role;

select tests.como('VICTOR');
select throws_ok($$ select rpc_aprovar_pedido(tests.id('ped1'), tests.j('[{"material_id":"PARAF","qtd_aprovada":10}]')) $$,
  '42501', null, 'supervisor não aprova o próprio pedido');
reset role;

select tests.como('OP211');
select lives_ok($$ select rpc_aprovar_pedido(tests.id('ped1'), tests.j('[{"material_id":"PARAF","qtd_aprovada":10}]')) $$,
  'operador do 211 aprova');
select lives_ok($$ select rpc_cancelar_pedido(tests.id('ped2'), 'Base pediu para cancelar') $$,
  'operador do 211 cancela pedido que o 211 atende');
select lives_ok(
  $$ with r as (select rpc_enviar_remessa_pedido(tests.id('ped1'), tests.j('[{"material_id":"PARAF","qtd_enviada":10}]'), null, 'GUIA-7') as id)
     insert into tests.ctx select 'rem1', id from r $$,
  'operador do 211 envia a remessa');
reset role;
select is(tests.saldo('211', 'PARAF'), 90.000, 'envio baixa o 211');

-- Quem enviou não recebe; o operador de base recebe
select tests.como('OP211');
select throws_ok(
  format($$ select rpc_registrar_recebimento(tests.id('rem1'), fn_hoje(), 'Conferente', %L,
       tests.j('[{"material_id":"PARAF","qtd_recebida":10}]')) $$, tests.foto(tests.id('rem1'), 'OP211')),
  '42501', null, 'operador do 211 não recebe na base');
reset role;
select tests.como('OPBV');
select is(
  rpc_registrar_recebimento(tests.id('rem1'), fn_hoje(), 'Conferente', tests.foto(tests.id('rem1'), 'OPBV'),
    tests.j('[{"material_id":"PARAF","qtd_recebida":8,"motivo_divergencia":"falta"}]')),
  'com_divergencia'::status_remessa, 'operador de base recebe o despacho (com falta)');
reset role;

-- Divergência: tratamento é da gestão do local
select tests.como('OP211');
select throws_ok(
  $$ select rpc_tratar_divergencia((select id from remessa_itens where remessa_id = tests.id('rem1')), 'baixa_transito', 1, 'Perda') $$,
  '42501', null, 'operador do 211 não trata divergência');
reset role;
select tests.como('GESTORA');
select lives_ok(
  $$ select rpc_tratar_divergencia((select id from remessa_itens where remessa_id = tests.id('rem1')), 'baixa_transito', 1, 'Perda') $$,
  'gestora trata o lado do 211');
reset role;
select tests.como('OPBV');
select lives_ok(
  $$ select rpc_tratar_divergencia((select id from remessa_itens where remessa_id = tests.id('rem1')), 'chegou_depois', 1, 'Achado no carro') $$,
  'operador de base trata o lado da base');
reset role;
select is((select status from remessas where id = tests.id('rem1')), 'encerrada'::status_remessa, 'divergência resolvida');

-- Pedido ao 3256 e entrada do 3256: só a gestora
select tests.como('OP211');
select throws_ok($$ insert into pedidos (solicitante_id) values (tests.a('211')) $$,
  '42501', null, 'operador do 211 não abre pedido ao 3256');
reset role;
select tests.como('GESTORA');
with p as (insert into pedidos (solicitante_id) values (tests.a('211')) returning id) insert into tests.ctx select 'ext', id from p;
insert into pedido_itens (pedido_id, material_id, qtd_solicitada) values (tests.id('ext'), tests.m('CONEC'), 5);
reset role;
select tests.como('OP211');
select throws_ok($$ select rpc_enviar_pedido(tests.id('ext')) $$, '42501', null, 'operador do 211 não envia pedido ao 3256');
select throws_ok(
  $$ select rpc_registrar_recebimento_externo(gen_random_uuid(), tests.a('211'), 'DOC-1', fn_hoje(), 'Conferente', 'x',
       tests.j('[{"material_id":"CONEC","qtd_enviada":5,"qtd_recebida":5}]')) $$,
  '42501', null, 'operador do 211 não registra entrada do 3256');
select throws_ok(
  $$ select rpc_registrar_ajuste(tests.a('211'), 'inventario', 'Contagem', tests.j('[{"material_id":"PARAF","qtd_contada":1}]')) $$,
  '42501', null, 'operador do 211 não ajusta saldo');
reset role;
select tests.como('GESTORA');
select lives_ok($$ select rpc_enviar_pedido(tests.id('ext')) $$, 'gestora envia pedido ao 3256');
reset role;

-- ---------------------------------------------------------------------
-- D. Saída, transferência e devolução
-- ---------------------------------------------------------------------
select tests.como('OP211');
select lives_ok(
  $$ select rpc_registrar_saida(tests.a('211'), tests.j('[{"material_id":"PARAF","quantidade":2}]'),
       'aplicacao', null, null, 'NS 70', null, tests.eq(970001), 'Integrante A') $$,
  'operador do 211 lança retirada da equipe no 211');
select throws_ok(
  $$ select rpc_registrar_saida(tests.a('MNT'), tests.j('[{"material_id":"PARAF","quantidade":1}]'),
       'aplicacao', null, null, 'NS 71', null, tests.eq(970001), 'Integrante A') $$,
  '42501', null, 'operador do 211 não lança retirada na base');
reset role;

select tests.como('OPBV');
select lives_ok(
  $$ select rpc_registrar_saida(tests.a('MNT'), tests.j('[{"material_id":"PARAF","quantidade":1}]'),
       'aplicacao', null, null, 'NS 72', null, tests.eq(970001), 'Integrante A') $$,
  'operador de base lança retirada na base do grupo');
select set_eq($$ select codigo from fn_destinos_transferencia(tests.a('MNT')) $$, array['ITB', 'CRC'],
  'operador de base transfere entre as bases do grupo');
select throws_like(
  $$ select rpc_criar_remessa_avulsa('transferencia', tests.a('MNT'), tests.a('RSP'), tests.j('[{"material_id":"PARAF","qtd_enviada":1}]')) $$,
  '%supervisores diferentes%', 'operador de base não transfere para outro grupo');
select lives_ok(
  $$ with r as (select rpc_criar_remessa_avulsa('devolucao', tests.a('MNT'), tests.a('211'), tests.j('[{"material_id":"PARAF","qtd_enviada":2}]')) as id)
     insert into tests.ctx select 'dev', id from r $$,
  'operador de base devolve ao 211');
reset role;

select tests.como('OP211');
select is(
  rpc_registrar_recebimento(tests.id('dev'), fn_hoje(), 'Conferente', tests.foto(tests.id('dev'), 'OP211'),
    tests.j('[{"material_id":"PARAF","qtd_recebida":2}]')),
  'encerrada'::status_remessa, 'operador do 211 confirma a devolução');
reset role;

-- ---------------------------------------------------------------------
-- E. Equipes
-- ---------------------------------------------------------------------
select tests.como('OPBV');
select throws_like($$ select rpc_vincular_membro(tests.eq(970001), tests.u('SOLTO')) $$,
  '%não tem matrícula CEMIG%', 'operador de base passa pela checagem de membros (não pela de permissão)');
select lives_ok($$ select rpc_desvincular_membro(tests.eq(970001), tests.u('E1')) $$,
  'operador de base desvincula membro da equipe do grupo');
select lives_ok($$ select rpc_vincular_membro(tests.eq(970001), tests.u('E1')) $$,
  'operador de base vincula membro na equipe do grupo');
select throws_ok($$ select rpc_desvincular_membro(tests.eq(970002), tests.u('E2')) $$,
  '42501', null, 'operador de base não mexe em equipe de outro grupo');
select throws_ok($$ select rpc_definir_locais_equipe(tests.eq(970001), array[tests.a('MNT'), tests.a('ITB')]) $$,
  '42501', null, 'operador de base não libera locais');
select set_eq($$ select nome from v_colaboradores where id in (tests.u('E1'), tests.u('E2')) $$, array['E1'],
  'operador de base vê os membros do grupo');
reset role;

select tests.como('OP211');
select throws_ok($$ select rpc_desvincular_membro(tests.eq(970001), tests.u('E1')) $$,
  '42501', null, 'operador do 211 não mexe nos membros');
select lives_ok($$ select rpc_definir_locais_equipe(tests.eq(970002), array[tests.a('RSP'), tests.a('MNT')]) $$,
  'operador do 211 libera local para a equipe');
select throws_ok($$ select rpc_salvar_equipe(970003, 'NOVA', 'Integrantes', 'F-3', tests.g('Victor')) $$,
  '42501', null, 'operador do 211 não cria equipe');
select set_eq($$ select nome from v_colaboradores where id in (tests.u('E1'), tests.u('E2')) $$, array['E1', 'E2'],
  'operador do 211 vê os colaboradores');
reset role;
select set_eq($$ select a.codigo from equipe_locais el join almoxarifados a on a.id = el.almox_id where el.equipe_id = tests.eq(970002) $$,
  array['RSP', 'MNT'], 'locais da equipe gravados');

select tests.como('VICTOR');
select throws_ok($$ select rpc_definir_locais_equipe(tests.eq(970001), array[tests.a('MNT')]) $$,
  '42501', null, 'supervisor não libera locais');
reset role;

-- ---------------------------------------------------------------------
-- F. Redefinir acesso (senha)
-- ---------------------------------------------------------------------
select tests.como('VICTOR');
select lives_ok($$ select rpc_preparar_redefinicao_senha(tests.u('E1')) $$, 'supervisor redefine membro do grupo');
select throws_ok($$ select rpc_preparar_redefinicao_senha(tests.u('E2')) $$, '42501', null, 'supervisor não redefine membro de outro grupo');
reset role;
update perfis set deve_trocar_senha = false, senha_inicial_ate = null where id = tests.u('E1');

select tests.como('OPBV');
select lives_ok($$ select rpc_preparar_redefinicao_senha(tests.u('E1')) $$, 'operador de base redefine membro do grupo');
reset role;
update perfis set deve_trocar_senha = false, senha_inicial_ate = null where id = tests.u('E1');

select tests.como('OP211');
select lives_ok($$ select rpc_preparar_redefinicao_senha(tests.u('E2')) $$, 'operador do 211 redefine membro de equipe');
select throws_ok($$ select rpc_preparar_redefinicao_senha(tests.u('VICTOR')) $$, '42501', null, 'operador do 211 não redefine supervisor');
select throws_ok($$ select rpc_preparar_redefinicao_senha(tests.u('GESTORA')) $$, '42501', null, 'operador do 211 não redefine a gestora');
reset role;
update perfis set deve_trocar_senha = false, senha_inicial_ate = null where id = tests.u('E2');

select tests.como('E1');
select throws_ok($$ select rpc_preparar_redefinicao_senha(tests.u('E1')) $$, '42501', null, 'membro não redefine o próprio acesso por aqui');
select throws_ok($$ select rpc_preparar_redefinicao_senha(tests.u('E2')) $$, '42501', null, 'membro não redefine o de outro');
reset role;

select tests.como('GESTORA');
select lives_ok($$ select rpc_preparar_redefinicao_senha(tests.u('VICTOR')) $$, 'gestora redefine qualquer operador');
reset role;

-- ---------------------------------------------------------------------
-- G. Operador de base inativo ou trocado perde o acesso
-- ---------------------------------------------------------------------
update perfis set ativo = false where id = tests.u('OPBV');
select tests.como('OPBV');
select ok(not fn_pode_ver(tests.a('MNT')), 'operador de base inativo não vê as bases');
reset role;
update perfis set ativo = true where id = tests.u('OPBV');

select tests.como('ADMIN');
select lives_ok($$ select rpc_definir_operador_base_grupo(tests.g('Victor'), null) $$, 'admin tira o operador de base');
reset role;
select tests.como('OPBV');
select ok(not fn_pode_ver(tests.a('MNT')), 'sem grupo, o operador de base não vê as bases');
select ok(not fn_supervisiona_equipe(tests.eq(970001)), 'sem grupo, não mantém a equipe');
reset role;

-- Saldo nunca negativo
select is((select count(*) from v_saldo where saldo < 0)::int, 0, 'nenhum saldo negativo');

select * from finish();
rollback;
