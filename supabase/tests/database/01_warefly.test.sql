-- =====================================================================
-- Warefly · Passo 1.7 — Teste simulando cada papel (via request.jwt.claims)
-- Roda com: supabase test db   (tudo em transação, desfeito no fim)
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select * from no_plan();

-- ---------------------------------------------------------------------
-- Apoio ao teste
-- ---------------------------------------------------------------------
create schema tests;
grant usage on schema tests to authenticated, anon;

create table tests.ctx (chave text primary key, valor uuid not null);
grant all on tests.ctx to authenticated;

create function tests.u(p_nome text) returns uuid language sql immutable as $$
  select case p_nome
    when 'ADMIN'  then '00000000-0000-4000-a000-000000000001'
    when 'GESTAO' then '00000000-0000-4000-a000-000000000002'
    when 'C211'   then '00000000-0000-4000-a000-000000000003'
    when 'VINI'   then '00000000-0000-4000-a000-000000000004'
    when 'VICTOR' then '00000000-0000-4000-a000-000000000005'
    when 'OPER'   then '00000000-0000-4000-a000-000000000006'
  end::uuid
$$;

create function tests.m(p_nome text) returns uuid language sql immutable as $$
  select case p_nome
    when 'PARAF'   then '10000000-0000-4000-a000-000000000001'
    when 'CONEC'   then '10000000-0000-4000-a000-000000000002'
    when 'CABO'    then '10000000-0000-4000-a000-000000000003'
    when 'INATIVO' then '10000000-0000-4000-a000-000000000004'
  end::uuid
$$;

-- '[{"material_id":"PARAF",...}]' → troca os apelidos pelos uuids
create function tests.j(p text) returns jsonb language sql immutable as $$
  select replace(replace(replace(replace(p,
    '"PARAF"', '"' || tests.m('PARAF') || '"'),
    '"CONEC"', '"' || tests.m('CONEC') || '"'),
    '"CABO"', '"' || tests.m('CABO') || '"'),
    '"INATIVO"', '"' || tests.m('INATIVO') || '"')::jsonb
$$;

create function tests.a(p_codigo text) returns uuid language sql stable security definer as $$
  select id from public.almoxarifados where codigo = p_codigo
$$;

create function tests.id(p_chave text) returns uuid language sql stable security definer as $$
  select valor from tests.ctx where chave = p_chave
$$;

create function tests.item(p_remessa text, p_material text) returns uuid language sql stable security definer as $$
  select id from public.remessa_itens where remessa_id = tests.id(p_remessa) and material_id = tests.m(p_material)
$$;

create function tests.saldo(p_almox text, p_material text) returns numeric language sql stable security definer as $$
  select coalesce(sum(quantidade), 0) from public.movimentacoes
   where almox_id = tests.a(p_almox) and material_id = tests.m(p_material)
$$;

-- Simula o upload da foto (como faria a API do Storage) e devolve o caminho
create function tests.foto(p_remessa uuid, p_dono text) returns text language plpgsql security definer as $$
declare v_nome text := p_remessa || '/' || gen_random_uuid() || '.jpg';
begin
  insert into storage.objects (bucket_id, name, owner_id) values ('recebimentos', v_nome, tests.u(p_dono)::text);
  return v_nome;
end $$;

create function tests.como(p_nome text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', tests.u(p_nome), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

grant execute on all functions in schema tests to authenticated, anon;

-- ---------------------------------------------------------------------
-- Dados: usuários (o trigger cria os perfis), papéis, atribuições, materiais
-- ---------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data, aud, role)
select tests.u(n), lower(n) || '@warefly.test', json_build_object('nome', nome)::jsonb, 'authenticated', 'authenticated'
  from (values ('ADMIN', 'Admin'), ('GESTAO', 'Gestão'), ('C211', 'Carlos 211'),
               ('VINI', 'Vinícius'), ('VICTOR', 'Victor'), ('OPER', 'Operador')) as v (n, nome);

select is((select count(*) from perfis)::int, 6, 'trigger cria um perfil por usuário');
select is((select nome from perfis where id = tests.u('VICTOR')), 'Victor', 'nome do perfil vem do metadata');

update perfis set papel = 'admin'  where id = tests.u('ADMIN');
-- A gerência deixou de existir (15/10): este usuário passa a ser o operador do 211
insert into atribuicoes (almox_id, usuario_id, funcao) values (tests.a('211'), tests.u('GESTAO'), 'operador');

insert into atribuicoes (almox_id, usuario_id, funcao)
select tests.a(c), tests.u(u), f::funcao_atribuicao
  from (values ('211', 'C211', 'responsavel'),
               ('RSP', 'VINI', 'responsavel'), ('RSP', 'VINI', 'supervisor'),
               ('AIM', 'VINI', 'responsavel'), ('AIM', 'VINI', 'supervisor'),
               ('CPN', 'VINI', 'responsavel'), ('CPN', 'VINI', 'supervisor'),
               ('MNT', 'VICTOR', 'responsavel'), ('MNT', 'VICTOR', 'supervisor'),
               ('ITB', 'VICTOR', 'responsavel'), ('ITB', 'VICTOR', 'supervisor'),
               ('CRC', 'VICTOR', 'responsavel'), ('CRC', 'VICTOR', 'supervisor')) as v (c, u, f);

insert into materiais (id, codigo_sap, descricao, unidade, preco, ativo) values
  (tests.m('PARAF'),   '9001', 'PARAFUSO TESTE',  'PC', 2.50,  true),
  (tests.m('CONEC'),   '9002', 'CONECTOR TESTE',  'PC', 10.00, true),
  (tests.m('CABO'),    '9003', 'CABO TESTE',      'M',  4.00,  true),
  (tests.m('INATIVO'), '9004', 'MATERIAL INATIVO', 'PC', null,  false);
-- Equipe do grupo do supervisor de Mantena, liberada em Mantena
insert into equipes (id, codigo_zeus, nome, integrantes, frota, grupo_id)
values ('20000000-0000-4000-a000-000000000001', 90012, 'Equipe 12', 'Integrante A/Integrante B', '1000', (select id from grupos where nome = 'Victor'));
insert into equipe_locais (equipe_id, almox_id) values ('20000000-0000-4000-a000-000000000001', tests.a('MNT'));

select throws_ok(
  $$ insert into atribuicoes (almox_id, usuario_id, funcao) values (tests.a('3256'), tests.u('C211'), 'responsavel') $$,
  'P0001', null, 'almox externo não recebe atribuição');

select throws_ok(
  $$ insert into almoxarifados (codigo, nome, tipo, pai_id) values ('XXX', 'Base errada', 'base', tests.a('3256')) $$,
  'P0001', null, 'base não pode ficar sob o externo');

-- ---------------------------------------------------------------------
-- A. Cadastros e visibilidade básica
-- ---------------------------------------------------------------------
set local role anon;
select throws_ok($$ select * from almoxarifados $$, '42501', null, 'anon não lê nada');
select throws_ok($$ select rpc_enviar_pedido(gen_random_uuid()) $$, '42501', null, 'anon não chama RPC');
reset role;

select tests.como('VICTOR');
select is((select count(*) from almoxarifados)::int, 13, 'autenticado vê os 13 almoxarifados');
select is((select count(*) from unidades)::int, 10, 'autenticado vê as unidades');
select is((select count(*) from perfis)::int, 1, 'operador lê só o próprio perfil');
select is((select count(*) from v_usuarios)::int, 6, 'todos leem id e nome dos usuários');
select is((select count(*) from atribuicoes)::int, 6, 'operador lê só as próprias atribuições');
select lives_ok($$ update perfis set papel = 'admin' where id = tests.u('VICTOR') $$, 'update do próprio papel não dá erro...');
reset role;
select is((select papel from perfis where id = tests.u('VICTOR')), 'operador'::papel_usuario, '...mas não altera nada');

select tests.como('VICTOR');
select throws_ok($$ insert into materiais (codigo_sap, descricao, unidade) values ('X1', 'X', 'PC') $$,
  '42501', null, 'operador não cadastra material');
select throws_ok($$ insert into atribuicoes (almox_id, usuario_id, funcao) values (tests.a('RSP'), tests.u('VICTOR'), 'responsavel') $$,
  '42501', null, 'operador não se atribui a outra base');
reset role;

select tests.como('ADMIN');
select lives_ok($$ insert into materiais (codigo_sap, descricao, unidade) values ('9999', 'MATERIAL ADMIN', 'PC') $$,
  'admin cadastra material');
select throws_ok($$ insert into materiais (codigo_sap, descricao, unidade) values ('9998', 'UNIDADE RUIM', 'XX') $$,
  '23503', null, 'unidade fora da lista é bloqueada');
select is((select count(*) from perfis)::int, 6, 'admin lê todos os perfis');
reset role;

-- ---------------------------------------------------------------------
-- B. Implantação do saldo inicial (só admin)
-- ---------------------------------------------------------------------
select tests.como('VICTOR');
select throws_ok(
  $$ select rpc_registrar_ajuste(tests.a('MNT'), 'implantacao', 'Dia D', tests.j('[{"material_id":"PARAF","qtd_contada":10}]')) $$,
  '42501', null, 'operador não carrega saldo inicial');
reset role;

select tests.como('ADMIN');
select throws_ok(
  $$ select rpc_registrar_ajuste(tests.a('211'), 'implantacao', 'Dia D', tests.j('[{"material_id":"PARAF","qtd_contada":1.5}]')) $$,
  '22023', null, 'quantidade fracionada em unidade PC é bloqueada');
select throws_ok(
  $$ select rpc_registrar_ajuste(tests.a('3256'), 'implantacao', 'Dia D', tests.j('[{"material_id":"PARAF","qtd_contada":1}]')) $$,
  'P0001', 'O almoxarifado externo não tem saldo no sistema.', '3256 não tem saldo');
select lives_ok(
  $$ select rpc_registrar_ajuste(tests.a('211'), 'implantacao', 'Contagem do dia D',
       tests.j('[{"material_id":"PARAF","qtd_contada":50},{"material_id":"CONEC","qtd_contada":10},{"material_id":"CABO","qtd_contada":100.5}]')) $$,
  'admin implanta saldo do 211');
select lives_ok(
  $$ select rpc_registrar_ajuste(tests.a('RSP'), 'implantacao', 'Contagem do dia D', tests.j('[{"material_id":"PARAF","qtd_contada":7}]')) $$,
  'admin implanta saldo de Resplendor');
reset role;

select is(tests.saldo('211', 'CABO'), 100.5, 'saldo inicial com fração em metro');
select is((select count(*) from movimentacoes where tipo = 'saldo_inicial')::int, 4, 'implantação gera movimentações saldo_inicial');

-- Visibilidade por atribuição
select tests.como('VICTOR');
select is((select count(*) from v_saldo where almox_codigo = 'RSP')::int, 0, 'supervisor não vê base de outro supervisor');
select is((select count(*) from movimentacoes where almox_id = tests.a('RSP'))::int, 0, 'nem as movimentações dela');
reset role;
select tests.como('VINI');
select is((select saldo from v_saldo where almox_codigo = 'RSP' and codigo_sap = '9001'), 7.000, 'supervisor vê a própria base');
select is((select count(*) from v_saldo where almox_codigo = '211')::int, 0, 'supervisor de base não vê o 211');
reset role;
select tests.como('C211');
select is((select count(*) from v_saldo)::int, 4, 'responsável do 211 vê 211 e bases');
reset role;
select tests.como('GESTAO');
select is((select count(*) from v_saldo)::int, 4, 'operador do 211 vê o 211 e as bases');
reset role;
select tests.como('OPER');
select is((select count(*) from v_saldo)::int, 0, 'usuário sem atribuição não vê saldo');
reset role;

-- ---------------------------------------------------------------------
-- C. Livro-razão protegido
-- ---------------------------------------------------------------------
select tests.como('VICTOR');
select throws_ok(
  $$ insert into movimentacoes (almox_id, material_id, quantidade, tipo, data_ocorrencia, ajuste_id, criado_por)
     values (tests.a('MNT'), tests.m('PARAF'), 1000, 'ajuste_inventario', current_date, gen_random_uuid(), tests.u('VICTOR')) $$,
  '42501', null, 'escrita direta em movimentacoes é bloqueada');
select throws_ok($$ select interno.fn_saldo(tests.a('MNT'), tests.m('PARAF')) $$,
  '42501', null, 'cliente não acessa funções internas');
select throws_ok($$ insert into saidas (almox_id, data_ocorrencia, registrado_por) values (tests.a('MNT'), current_date, tests.u('VICTOR')) $$,
  '42501', null, 'escrita direta em saidas é bloqueada');
reset role;
select throws_ok($$ update movimentacoes set quantidade = 999 $$, '42501', null, 'nem o dono do banco altera movimentação');
select throws_ok($$ delete from movimentacoes $$, '42501', null, 'nem apaga');

-- ---------------------------------------------------------------------
-- D. Pedido de Mantena: corte no 211 e falta na conferência
-- ---------------------------------------------------------------------
select tests.como('VICTOR');
select lives_ok(
  $$ with p as (insert into pedidos (solicitante_id, observacao) values (tests.a('MNT'), 'Reposição') returning id)
     insert into tests.ctx select 'ped1', id from p $$,
  'responsável da base cria pedido em rascunho');
select is((select atendente_id from pedidos where id = tests.id('ped1')), tests.a('211'), 'atendente é o pai (211)');
select is((select externo from pedidos where id = tests.id('ped1')), false, 'pedido da base não é externo');
select throws_ok($$ insert into pedidos (solicitante_id) values (tests.a('RSP')) $$,
  '42501', null, 'não cria pedido para base de outro');
select throws_ok($$ update pedidos set status = 'aprovado' where id = tests.id('ped1') $$,
  '42501', null, 'cliente não muda status direto');
select lives_ok(
  $$ insert into pedido_itens (pedido_id, material_id, qtd_solicitada) values
       (tests.id('ped1'), tests.m('PARAF'), 20), (tests.id('ped1'), tests.m('CONEC'), 5), (tests.id('ped1'), tests.m('CABO'), 10) $$,
  'adiciona itens ao rascunho');
select throws_ok($$ insert into pedido_itens (pedido_id, material_id, qtd_solicitada) values (tests.id('ped1'), tests.m('INATIVO'), 1) $$,
  '42501', null, 'material inativo não entra no pedido');
select throws_ok($$ update pedido_itens set qtd_solicitada = 2.5 where pedido_id = tests.id('ped1') and material_id = tests.m('PARAF') $$,
  '22023', null, 'quantidade fracionada em PC é bloqueada no item');
select throws_ok($$ update pedido_itens set qtd_aprovada = 20 where pedido_id = tests.id('ped1') $$,
  '42501', null, 'cliente não grava quantidade aprovada');
reset role;

select tests.como('VINI');
select is((select count(*) from pedidos)::int, 0, 'outro supervisor não vê o pedido');
select throws_ok($$ select rpc_enviar_pedido(tests.id('ped1')) $$, '42501', null, 'outro supervisor não envia o pedido');
reset role;

select tests.como('VICTOR');
select lives_ok($$ select rpc_enviar_pedido(tests.id('ped1')) $$, 'responsável envia o pedido');
select is((select status from pedidos where id = tests.id('ped1')), 'solicitado'::status_pedido, 'pedido solicitado');
select throws_ok($$ insert into pedido_itens (pedido_id, material_id, qtd_solicitada) values (tests.id('ped1'), tests.m('INATIVO'), 1) $$,
  '42501', null, 'pedido enviado não aceita itens');
select throws_ok(
  $$ select rpc_aprovar_pedido(tests.id('ped1'), tests.j('[{"material_id":"PARAF","qtd_aprovada":20}]')) $$,
  '42501', null, 'base não aprova o próprio pedido');
reset role;

select tests.como('C211');
select is((select count(*) from pedidos)::int, 1, '211 vê o pedido da base');
select throws_like(
  $$ select rpc_aprovar_pedido(tests.id('ped1'), tests.j('[{"material_id":"PARAF","qtd_aprovada":20},{"material_id":"CONEC","qtd_aprovada":3},{"material_id":"CABO","qtd_aprovada":10}]')) $$,
  'Informe o motivo do corte%', 'corte exige motivo');
select throws_like(
  $$ select rpc_aprovar_pedido(tests.id('ped1'), tests.j('[{"material_id":"PARAF","qtd_aprovada":20}]')) $$,
  'Informe a quantidade aprovada%', 'aprovação cobre todos os itens');
select lives_ok(
  $$ select rpc_aprovar_pedido(tests.id('ped1'), tests.j('[{"material_id":"PARAF","qtd_aprovada":20},{"material_id":"CONEC","qtd_aprovada":3,"motivo_corte":"Estoque baixo no 211"},{"material_id":"CABO","qtd_aprovada":10}]')) $$,
  '211 aprova com corte');
select is((select status from pedidos where id = tests.id('ped1')), 'aprovado'::status_pedido, 'pedido aprovado');
select throws_like(
  $$ select rpc_enviar_remessa_pedido(tests.id('ped1'), tests.j('[{"material_id":"PARAF","qtd_enviada":25}]')) $$,
  'Quantidade enviada%maior que a aprovada%', 'não envia acima do aprovado');
select lives_ok(
  $$ with r as (select rpc_enviar_remessa_pedido(tests.id('ped1'),
       tests.j('[{"material_id":"PARAF","qtd_enviada":20},{"material_id":"CONEC","qtd_enviada":3},{"material_id":"CABO","qtd_enviada":10}]'),
       null, 'GUIA-1') as id)
     insert into tests.ctx select 'rem1', id from r $$,
  '211 envia a remessa');
reset role;

select is((select status from pedidos where id = tests.id('ped1')), 'em_transito'::status_pedido, 'pedido em trânsito');
select is(tests.saldo('211', 'PARAF'), 30.000, 'envio baixa o saldo do 211');
select is(tests.saldo('211', 'CABO'), 90.500, 'envio baixa o cabo do 211');

select tests.como('VICTOR');
select is((select count(*) from v_em_transito where remessa_id = tests.id('rem1'))::int, 3, 'base vê os itens a caminho');
reset role;

-- Regra 3: quem enviou não recebe (mesmo que seja responsável do destino)
insert into atribuicoes (almox_id, usuario_id, funcao) values (tests.a('MNT'), tests.u('C211'), 'responsavel');
select tests.como('C211');
select throws_like(
  format($$ select rpc_registrar_recebimento(tests.id('rem1'), fn_hoje(), 'João', %L,
       tests.j('[{"material_id":"PARAF","qtd_recebida":20},{"material_id":"CONEC","qtd_recebida":3},{"material_id":"CABO","qtd_recebida":10}]')) $$,
       tests.foto(tests.id('rem1'), 'C211')),
  'Quem registrou o envio%', 'quem enviou não confirma o recebimento');
reset role;
delete from atribuicoes where almox_id = tests.a('MNT') and usuario_id = tests.u('C211');

-- Storage: formato do caminho e leitura
select tests.como('VICTOR');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values ('recebimentos', 'foto-solta.jpg', tests.u('VICTOR')::text) $$,
  '42501', null, 'upload fora do padrão {remessa}/{uuid}.jpg é bloqueado');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('recebimentos', tests.id('rem1') || '/' || gen_random_uuid() || '.jpg', tests.u('VICTOR')::text) $$,
  'upload no padrão é aceito');
select throws_like(
  $$ select rpc_registrar_recebimento(tests.id('rem1'), fn_hoje(), 'João', tests.id('rem1') || '/00000000-0000-4000-a000-000000000000.jpg',
       tests.j('[{"material_id":"PARAF","qtd_recebida":20},{"material_id":"CONEC","qtd_recebida":3},{"material_id":"CABO","qtd_recebida":10}]')) $$,
  'Foto não encontrada%', 'recebimento exige foto existente');
select throws_like(
  $$ select rpc_registrar_recebimento(tests.id('rem1'), fn_hoje(), 'João',
       (select name from storage.objects where name like tests.id('rem1') || '/%' and owner_id = tests.u('VICTOR')::text),
       tests.j('[{"material_id":"PARAF","qtd_recebida":18},{"material_id":"CONEC","qtd_recebida":3}]')) $$,
  'Informe a contagem de todos os itens da guia%', 'recebimento cobre todos os itens da guia');
select throws_like(
  $$ select rpc_registrar_recebimento(tests.id('rem1'), fn_hoje(), 'João',
       (select name from storage.objects where name like tests.id('rem1') || '/%' and owner_id = tests.u('VICTOR')::text),
       tests.j('[{"material_id":"PARAF","qtd_recebida":18},{"material_id":"CONEC","qtd_recebida":3},{"material_id":"CABO","qtd_recebida":10}]')) $$,
  'Informe o motivo da diferença%', 'diferença exige motivo');
select throws_like(
  $$ select rpc_registrar_recebimento(tests.id('rem1'), fn_hoje() + 1, 'João',
       (select name from storage.objects where name like tests.id('rem1') || '/%' and owner_id = tests.u('VICTOR')::text),
       tests.j('[{"material_id":"PARAF","qtd_recebida":20},{"material_id":"CONEC","qtd_recebida":3},{"material_id":"CABO","qtd_recebida":10}]')) $$,
  '%não pode ser no futuro%', 'data real não pode ser futura');
select is(
  rpc_registrar_recebimento(tests.id('rem1'), fn_hoje(), 'João da Silva',
    (select name from storage.objects where name like tests.id('rem1') || '/%' and owner_id = tests.u('VICTOR')::text),
    tests.j('[{"material_id":"PARAF","qtd_recebida":18,"motivo_divergencia":"falta"},{"material_id":"CONEC","qtd_recebida":3},{"material_id":"CABO","qtd_recebida":10}]')),
  'com_divergencia'::status_remessa, 'recebimento com falta → com divergência');
select is((select status from pedidos where id = tests.id('ped1')), 'com_divergencia'::status_pedido, 'pedido com divergência');

-- Aceite da fase 3: as duas diferenças separadas
select results_eq(
  $$ select codigo_sap, qtd_solicitada, qtd_aprovada, qtd_enviada, qtd_recebida, diferenca_atendimento, diferenca_conferencia
       from v_pedido_resumo where pedido_id = tests.id('ped1') order by codigo_sap $$,
  $$ values ('9001'::text, 20.000::numeric(12,3), 20.000::numeric(12,3), 20.000::numeric(12,3), 18.000::numeric(12,3), 0.000::numeric(12,3), 2.000::numeric(12,3)),
            ('9002'::text,  5.000::numeric(12,3),  3.000::numeric(12,3),  3.000::numeric(12,3),  3.000::numeric(12,3), 2.000::numeric(12,3), 0.000::numeric(12,3)),
            ('9003'::text, 10.000::numeric(12,3), 10.000::numeric(12,3), 10.000::numeric(12,3), 10.000::numeric(12,3), 0.000::numeric(12,3), 0.000::numeric(12,3)) $$,
  'resumo separa diferença de atendimento (corte) e de conferência (falta)');
select is((select qtd_em_aberto from v_divergencias_abertas where remessa_id = tests.id('rem1')), 2.000, 'divergência aberta de 2');
reset role;

select is(tests.saldo('MNT', 'PARAF'), 18.000, 'Mantena recebeu 18');
select is(tests.saldo('211', 'PARAF'), 30.000, '211 segue com 30 (2 em aberto no trânsito)');
select tests.como('VICTOR');
select is((select saldo from v_saldo where almox_codigo = 'MNT' and codigo_sap = '9001'), 18.000, 'v_saldo bate com as movimentações');
reset role;

-- Tratamento da divergência
select tests.como('VICTOR');
select throws_ok(
  $$ select rpc_tratar_divergencia(tests.item('rem1', 'PARAF'), 'baixa_transito', 1, 'Perdido') $$,
  '42501', null, 'destino não dá baixa em trânsito');
reset role;
select tests.como('C211');
select throws_like(
  $$ select rpc_tratar_divergencia(tests.item('rem1', 'PARAF'), 'ajuste_origem', 1, 'x') $$,
  '"Ajuste na origem" só vale para sobra%', 'ajuste na origem não vale para falta');
select throws_like(
  $$ select rpc_tratar_divergencia(tests.item('rem1', 'PARAF'), 'baixa_transito', 3, 'x') $$,
  'Quantidade maior que a divergência em aberto%', 'não trata mais que o aberto');
select throws_like(
  $$ select rpc_tratar_divergencia(tests.item('rem1', 'PARAF'), 'baixa_transito', 1, '  ') $$,
  'Informe a justificativa%', 'tratamento exige justificativa');
select lives_ok(
  $$ select rpc_tratar_divergencia(tests.item('rem1', 'PARAF'), 'baixa_transito', 1, 'Extraviado no caminhão') $$,
  'origem dá baixa em trânsito de 1');
select is((select status from remessas where id = tests.id('rem1')), 'com_divergencia'::status_remessa, 'ainda falta tratar 1');
reset role;
-- Opção B (15/10): a base justifica; a gestão aplica o tratamento
select tests.como('VICTOR');
select throws_ok(
  $$ select rpc_tratar_divergencia(tests.item('rem1', 'PARAF'), 'chegou_depois', 1, 'Achado na caixa do cabo') $$,
  '42501', null, 'supervisor não aplica o tratamento');
select lives_ok(
  $$ select rpc_justificar_divergencia(tests.item('rem1', 'PARAF'), 'Achado na caixa do cabo') $$,
  'supervisor justifica a falta');
reset role;
select tests.como('C211');
select lives_ok(
  $$ select rpc_tratar_divergencia(tests.item('rem1', 'PARAF'), 'chegou_depois', 1, 'Achado na caixa do cabo') $$,
  'gestão registra que 1 chegou depois');
reset role;
select is((select status from remessas where id = tests.id('rem1')), 'encerrada'::status_remessa, 'remessa encerrada');
select is((select status from pedidos where id = tests.id('ped1')), 'encerrado'::status_pedido, 'pedido encerrado');
select is(tests.saldo('MNT', 'PARAF'), 19.000, 'chegou depois entra no destino');
select is((select count(*) from v_divergencias_abertas)::int, 0, 'nenhuma divergência aberta');

-- ---------------------------------------------------------------------
-- E. Saídas
-- ---------------------------------------------------------------------
select tests.como('VICTOR');
select throws_like(
  $$ select rpc_registrar_saida(tests.a('MNT'), tests.j('[{"material_id":"PARAF","quantidade":100}]'), 'aplicacao', null, null, null, null,
       '20000000-0000-4000-a000-000000000001', 'João') $$,
  'Saldo insuficiente em Mantena%Faça um ajuste de inventário%', 'saída acima do saldo é bloqueada');
select throws_like(
  $$ select rpc_registrar_saida(tests.a('MNT'), tests.j('[{"material_id":"PARAF","quantidade":1}]'), 'perda') $$,
  'Informe a justificativa%', 'perda exige justificativa');
select throws_ok(
  $$ select rpc_registrar_saida(tests.a('RSP'), tests.j('[{"material_id":"PARAF","quantidade":1}]')) $$,
  '42501', null, 'não registra saída em base de outro');
select lives_ok(
  $$ select rpc_registrar_saida(tests.a('MNT'), tests.j('[{"material_id":"PARAF","quantidade":4}]'), 'aplicacao', null, null, 'NS 4455', null,
       '20000000-0000-4000-a000-000000000001', 'João') $$,
  'saída de aplicação com equipe e quem retirou');
reset role;
select is(tests.saldo('MNT', 'PARAF'), 15.000, 'saída baixa o saldo');
select tests.como('C211');
select lives_ok(
  $$ select rpc_registrar_saida(tests.a('211'), tests.j('[{"material_id":"CONEC","quantidade":1}]'), 'avaria', null, 'Quebrou no manuseio') $$,
  '211 também registra saída');
reset role;

-- ---------------------------------------------------------------------
-- F. Transferência, reenvio e devolução
-- ---------------------------------------------------------------------
select tests.como('VICTOR');
select throws_like(
  $$ select rpc_criar_remessa_avulsa('transferencia', tests.a('MNT'), tests.a('RSP'), tests.j('[{"material_id":"PARAF","qtd_enviada":1}]')) $$,
  '%supervisores diferentes%', 'transferência entre supervisores diferentes é bloqueada');
select is((select count(*) from fn_destinos_transferencia(tests.a('MNT')))::int, 2, 'destinos possíveis: Itabirinha e Coroaci');
select lives_ok(
  $$ with r as (select rpc_criar_remessa_avulsa('transferencia', tests.a('MNT'), tests.a('ITB'),
       tests.j('[{"material_id":"PARAF","qtd_enviada":5},{"material_id":"CABO","qtd_enviada":2.5}]')) as id)
     insert into tests.ctx select 'rem2', id from r $$,
  'transferência Mantena → Itabirinha');
reset role;
select is(tests.saldo('MNT', 'CABO'), 7.500, 'transferência baixa a origem');

select tests.como('VICTOR');
select is(
  rpc_registrar_recebimento(tests.id('rem2'), fn_hoje(), 'Zé de Itabirinha', tests.foto(tests.id('rem2'), 'VICTOR'),
    tests.j('[{"material_id":"PARAF","qtd_recebida":5},{"material_id":"CABO","qtd_recebida":2,"motivo_divergencia":"avaria"}]')),
  'com_divergencia'::status_remessa, 'mesmo supervisor recebe a transferência (entre bases)');
reset role;
select tests.como('C211');
select lives_ok(
  $$ with t as (select rpc_tratar_divergencia(tests.item('rem2', 'CABO'), 'reenvio', 0.5, 'Pedaço avariado, mando outro') as id)
     insert into tests.ctx select 'trat1', id from t $$,
  'gestão reenvia o cabo avariado pela origem');
reset role;
insert into tests.ctx select 'rem3', remessa_gerada_id from divergencia_tratamentos where id = tests.id('trat1');
select is((select status from remessas where id = tests.id('rem2')), 'encerrada'::status_remessa, 'reenvio resolve a divergência original');
select is((select remessa_ref_id from remessas where id = tests.id('rem3')), tests.id('rem2'), 'reenvio aponta para a remessa original');
select is(tests.saldo('MNT', 'CABO'), 7.000, 'reenvio baixa a origem de novo');

select tests.como('VICTOR');
select is(
  rpc_registrar_recebimento(tests.id('rem3'), fn_hoje(), 'Zé de Itabirinha', tests.foto(tests.id('rem3'), 'VICTOR'),
    tests.j('[{"material_id":"CABO","qtd_recebida":0.5}]')),
  'encerrada'::status_remessa, 'reenvio recebido sem diferença');
reset role;
select is(tests.saldo('ITB', 'CABO'), 2.500, 'Itabirinha com 2,5 m de cabo');

-- Devolução com item a mais: a sobra só fecha com ajuste na origem
select tests.como('VICTOR');
select lives_ok(
  $$ with r as (select rpc_criar_remessa_avulsa('devolucao', tests.a('ITB'), null, tests.j('[{"material_id":"PARAF","qtd_enviada":2}]')) as id)
     insert into tests.ctx select 'rem4', id from r $$,
  'devolução Itabirinha → 211');
reset role;
select is((select destino_id from remessas where id = tests.id('rem4')), tests.a('211'), 'devolução vai para o pai');

select tests.como('C211');
select is(
  rpc_registrar_recebimento(tests.id('rem4'), fn_hoje(), 'Carlos', tests.foto(tests.id('rem4'), 'C211'),
    tests.j('[{"material_id":"PARAF","qtd_recebida":2},{"material_id":"CONEC","qtd_recebida":1}]')),
  'com_divergencia'::status_remessa, 'item fora da guia entra como sobra');
select is((select motivo_divergencia from remessa_itens where id = tests.item('rem4', 'CONEC')), 'sobra'::motivo_divergencia, 'motivo sobra');
reset role;
select tests.como('C211');
select throws_like(
  $$ select rpc_tratar_divergencia(tests.item('rem4', 'CONEC'), 'ajuste_origem', 1, 'Mandei a mais') $$,
  'Saldo insuficiente em Itabirinha%', 'ajuste na origem respeita o saldo');
reset role;
select tests.como('VICTOR');
select throws_ok(
  $$ select rpc_registrar_ajuste(tests.a('ITB'), 'inventario', 'Conector sem registro no sistema', tests.j('[{"material_id":"CONEC","qtd_contada":1}]')) $$,
  '42501', null, 'supervisor não ajusta o estoque da própria base');
reset role;
select tests.como('C211');
select throws_like(
  $$ select rpc_registrar_ajuste(tests.a('ITB'), 'inventario', ' ', tests.j('[{"material_id":"CONEC","qtd_contada":1}]')) $$,
  'Informe a justificativa%', 'ajuste de inventário exige justificativa');
select lives_ok(
  $$ select rpc_registrar_ajuste(tests.a('ITB'), 'inventario', 'Conector sem registro no sistema', tests.j('[{"material_id":"CONEC","qtd_contada":1}]')) $$,
  'gestão do 211 ajusta o estoque da base');
select lives_ok(
  $$ select rpc_tratar_divergencia(tests.item('rem4', 'CONEC'), 'ajuste_origem', 1, 'Mandei a mais sem registrar') $$,
  'ajuste na origem fecha a sobra');
reset role;
select is((select status from remessas where id = tests.id('rem4')), 'encerrada'::status_remessa, 'devolução encerrada');
select is(tests.saldo('ITB', 'CONEC'), 0.000, 'origem zerada após o ajuste');
select is(tests.saldo('211', 'CONEC'), 7.000, '211: 10 − 3 enviados − 1 avaria + 1 sobra');

-- ---------------------------------------------------------------------
-- G. Ajuste de inventário
-- ---------------------------------------------------------------------
select tests.como('C211');
select lives_ok(
  $$ with a as (select rpc_registrar_ajuste(tests.a('MNT'), 'inventario', 'Contagem mensal', tests.j('[{"material_id":"PARAF","qtd_contada":12}]')) as id)
     insert into tests.ctx select 'aju1', id from a $$,
  'gestão do 211 ajusta o inventário de Mantena');
select is((select diferenca from ajuste_itens where ajuste_id = tests.id('aju1')), 2.000, 'diferença calculada contra o saldo (10 → 12)');
reset role;
select is(tests.saldo('MNT', 'PARAF'), 12.000, 'saldo passa a ser o contado');

-- ---------------------------------------------------------------------
-- H. Pedido externo ao 3256 e entrada avulsa
-- ---------------------------------------------------------------------
select tests.como('C211');
select lives_ok(
  $$ with p as (insert into pedidos (solicitante_id) values (tests.a('211')) returning id)
     insert into tests.ctx select 'ped2', id from p $$,
  '211 cria pedido externo');
select is((select externo from pedidos where id = tests.id('ped2')), true, 'pedido ao 3256 é externo');
select lives_ok($$ insert into pedido_itens (pedido_id, material_id, qtd_solicitada) values (tests.id('ped2'), tests.m('PARAF'), 10) $$, 'item do pedido externo');
select lives_ok($$ select rpc_enviar_pedido(tests.id('ped2')) $$, 'pedido externo vai para solicitado');
select throws_like($$ select rpc_aprovar_pedido(tests.id('ped2'), tests.j('[{"material_id":"PARAF","qtd_aprovada":10}]')) $$,
  'Pedido externo não passa por aprovação%', 'pedido externo não passa por aprovação');
reset role;

insert into tests.ctx values ('rem5', gen_random_uuid()), ('rem6', gen_random_uuid());

select tests.como('VICTOR');
select throws_ok(
  $$ select rpc_registrar_recebimento_externo(tests.id('rem5'), tests.a('211'), 'SAP 4900001', fn_hoje(), 'Carlos',
       'x', tests.j('[{"material_id":"PARAF","qtd_enviada":10,"qtd_recebida":10}]'), tests.id('ped2')) $$,
  '42501', null, 'base não registra entrada do 3256');
reset role;

select tests.como('C211');
select throws_like(
  format($$ select rpc_registrar_recebimento_externo(tests.id('rem5'), tests.a('211'), ' ', fn_hoje(), 'Carlos', %L,
       tests.j('[{"material_id":"PARAF","qtd_enviada":10,"qtd_recebida":10}]'), tests.id('ped2')) $$,
       tests.foto(tests.id('rem5'), 'C211')),
  'Informe o número do documento SAP%', 'entrada externa exige documento SAP');
select is(
  rpc_registrar_recebimento_externo(tests.id('rem5'), tests.a('211'), 'SAP 4900001', fn_hoje(), 'Carlos',
    (select name from storage.objects where name like tests.id('rem5') || '/%' limit 1),
    tests.j('[{"material_id":"PARAF","qtd_enviada":10,"qtd_recebida":10}]'), tests.id('ped2')),
  'encerrada'::status_remessa, 'recebimento externo sem diferença');
select is((select status from pedidos where id = tests.id('ped2')), 'encerrado'::status_pedido, 'pedido externo encerrado');
select is(
  rpc_registrar_recebimento_externo(tests.id('rem6'), tests.a('211'), 'SAP 4900002', fn_hoje(), 'Carlos',
    tests.foto(tests.id('rem6'), 'C211'),
    tests.j('[{"material_id":"CONEC","qtd_enviada":5,"qtd_recebida":4,"motivo_divergencia":"falta"}]')),
  'com_divergencia'::status_remessa, 'entrada avulsa com falta');
select throws_like(
  $$ select rpc_tratar_divergencia(tests.item('rem6', 'CONEC'), 'baixa_transito', 1, 'x') $$,
  'Divergência em remessa do almoxarifado externo%', 'remessa externa só aceita externo ou chegou depois');
select lives_ok(
  $$ select rpc_tratar_divergencia(tests.item('rem6', 'CONEC'), 'externo', 1, 'Aberto chamado no SAP') $$,
  'divergência externa tratada fora do sistema');
reset role;
select is((select status from remessas where id = tests.id('rem6')), 'encerrada'::status_remessa, 'entrada avulsa encerrada');
select is(tests.saldo('211', 'PARAF'), 42.000, '211: 30 + 2 devolvidos + 10 do 3256');
select is(tests.saldo('211', 'CONEC'), 11.000, '211 recebeu 4 conectores avulsos');
select is((select count(*) from movimentacoes where almox_id = tests.a('3256'))::int, 0, '3256 nunca movimenta');

-- ---------------------------------------------------------------------
-- I. Cancelamento
-- ---------------------------------------------------------------------
select tests.como('VICTOR');
select lives_ok(
  $$ with p as (insert into pedidos (solicitante_id) values (tests.a('CRC')) returning id)
     insert into tests.ctx select 'ped3', id from p $$, 'pedido de Coroaci');
select lives_ok($$ insert into pedido_itens (pedido_id, material_id, qtd_solicitada) values (tests.id('ped3'), tests.m('CABO'), 3.5) $$, 'cabo com fração');
select throws_like($$ select rpc_enviar_pedido(gen_random_uuid()) $$, 'Pedido não encontrado%', 'pedido inexistente');
select lives_ok($$ select rpc_enviar_pedido(tests.id('ped3')) $$, 'envia');
reset role;
select tests.como('C211');
select lives_ok($$ select rpc_aprovar_pedido(tests.id('ped3'), tests.j('[{"material_id":"CABO","qtd_aprovada":5}]')) $$,
  '211 aprova acima do solicitado');
reset role;
select tests.como('VICTOR');
select throws_like($$ select rpc_cancelar_pedido(tests.id('ped3'), '') $$, 'Informe o motivo%', 'cancelamento exige motivo');
select lives_ok($$ select rpc_cancelar_pedido(tests.id('ped3'), 'Obra adiada') $$, 'base cancela após a aprovação');
select throws_like($$ select rpc_cancelar_pedido(tests.id('ped1'), 'x') $$, '%não pode mais ser cancelado%', 'pedido encerrado não cancela');
reset role;

-- ---------------------------------------------------------------------
-- J. Fotos: leitura só por quem vê a remessa
-- ---------------------------------------------------------------------
select tests.como('VINI');
select is((select count(*) from storage.objects where name like tests.id('rem1') || '/%')::int, 0, 'outro supervisor não vê a foto');
reset role;
select tests.como('VICTOR');
select ok((select count(*) from storage.objects where name like tests.id('rem1') || '/%') >= 1, 'destino vê a foto');
reset role;
select tests.como('GESTAO');
select ok((select count(*) from storage.objects where name like tests.id('rem1') || '/%') >= 1, 'operador do 211 vê a foto');
reset role;

-- ---------------------------------------------------------------------
-- Regra 7: nenhum saldo negativo em lugar nenhum
-- ---------------------------------------------------------------------
select is((select count(*) from v_saldo where saldo < 0)::int, 0, 'nenhum saldo negativo');

select * from finish();
rollback;
