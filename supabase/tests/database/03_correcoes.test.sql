-- =====================================================================
-- Warefly · Correções da revisão final
--   I1 idempotência (reenvio da mesma chamada não duplica)
--   I2 erro_contagem: sobra por erro de contagem corrigida no destino
--   I3 estorno_origem: falta que nunca saiu da origem volta ao saldo dela
--   I4 implantação só antes de a operação começar
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select * from no_plan();

create schema tests;
grant usage on schema tests to authenticated;
create table tests.ctx (chave text primary key, valor uuid not null);
grant all on tests.ctx to authenticated;
create function tests.a(c text) returns uuid language sql stable security definer as $$ select id from public.almoxarifados where codigo = c $$;
create function tests.id(c text) returns uuid language sql stable security definer as $$ select valor from tests.ctx where chave = c $$;
create function tests.como(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function tests.foto(r uuid) returns text language plpgsql security definer as $$
declare n text := r || '/' || gen_random_uuid() || '.jpg';
begin insert into storage.objects (bucket_id, name) values ('recebimentos', n); return n; end $$;
create function tests.saldo(c text, m uuid) returns numeric language sql stable security definer as $$
  select coalesce(sum(quantidade), 0) from public.movimentacoes where almox_id = tests.a(c) and material_id = m $$;
create function tests.item(r text, m uuid) returns uuid language sql stable security definer as $$
  select id from public.remessa_itens where remessa_id = tests.id(r) and material_id = m $$;
grant execute on all functions in schema tests to authenticated;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-a000-0000000000c1', 'adm@t', '{"nome":"Adm"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-0000000000c3', 'c211@t', '{"nome":"C211"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-0000000000c4', 'vic@t', '{"nome":"Vic"}', 'authenticated', 'authenticated');
update perfis set papel = 'admin' where id = '00000000-0000-4000-a000-0000000000c1';
insert into atribuicoes (almox_id, usuario_id, funcao) values
  (tests.a('211'), '00000000-0000-4000-a000-0000000000c3', 'responsavel'),
  (tests.a('MNT'), '00000000-0000-4000-a000-0000000000c4', 'responsavel'),
  (tests.a('MNT'), '00000000-0000-4000-a000-0000000000c4', 'supervisor'),
  (tests.a('ITB'), '00000000-0000-4000-a000-0000000000c4', 'responsavel'),
  (tests.a('ITB'), '00000000-0000-4000-a000-0000000000c4', 'supervisor');
insert into materiais (id, codigo_sap, descricao, unidade) values
  ('10000000-0000-4000-a000-0000000000d1', '7001', 'PARAFUSO', 'PC'),
  ('10000000-0000-4000-a000-0000000000d2', '7002', 'CONECTOR', 'PC');
-- Equipe do grupo do supervisor de Mantena, liberada em Mantena
insert into equipes (id, codigo_zeus, nome, integrantes, frota, grupo_id)
values ('20000000-0000-4000-a000-0000000000f1', 90001, 'Equipe 1', 'Integrante A/Integrante B', '1000', (select id from grupos where nome = 'Victor'));
insert into equipe_locais (equipe_id, almox_id) values ('20000000-0000-4000-a000-0000000000f1', tests.a('MNT'));

-- ---------------------------------------------------------------------
-- I4: implantação (re)carregável até a operação começar
-- ---------------------------------------------------------------------
select tests.como('00000000-0000-4000-a000-0000000000c1');
select lives_ok($$ select rpc_registrar_ajuste(tests.a('211'), 'implantacao', 'Dia D',
  '[{"material_id":"10000000-0000-4000-a000-0000000000d1","qtd_contada":100},{"material_id":"10000000-0000-4000-a000-0000000000d2","qtd_contada":100}]') $$,
  'implantação no 211');
select lives_ok($$ select rpc_registrar_ajuste(tests.a('211'), 'implantacao', 'Dia D corrigido',
  '[{"material_id":"10000000-0000-4000-a000-0000000000d1","qtd_contada":50}]') $$,
  'reimportar antes de operar corrige o saldo inicial');
select is(tests.saldo('211', '10000000-0000-4000-a000-0000000000d1'), 50.000, 'saldo inicial corrigido');
select lives_ok($$ select rpc_registrar_ajuste(tests.a('MNT'), 'implantacao', 'Dia D',
  '[{"material_id":"10000000-0000-4000-a000-0000000000d1","qtd_contada":30}]') $$,
  'implantação em Mantena');
reset role;

-- ---------------------------------------------------------------------
-- I1: a mesma chamada repetida (resposta perdida) não duplica
-- ---------------------------------------------------------------------
insert into tests.ctx values ('sai', gen_random_uuid()), ('tra', gen_random_uuid()), ('aju', gen_random_uuid());
select tests.como('00000000-0000-4000-a000-0000000000c4');
select is(rpc_registrar_saida(tests.a('MNT'), '[{"material_id":"10000000-0000-4000-a000-0000000000d1","quantidade":5}]',
  'aplicacao', null, null, null, tests.id('sai'), '20000000-0000-4000-a000-0000000000f1', 'João'), tests.id('sai'),
  'saída usa o id gerado pelo app');
select is(rpc_registrar_saida(tests.a('MNT'), '[{"material_id":"10000000-0000-4000-a000-0000000000d1","quantidade":5}]',
  'aplicacao', null, null, null, tests.id('sai'), '20000000-0000-4000-a000-0000000000f1', 'João'), tests.id('sai'),
  'repetir a saída devolve o mesmo registro');
select is(tests.saldo('MNT', '10000000-0000-4000-a000-0000000000d1'), 25.000, 'saldo baixou uma vez só');

select is(rpc_criar_remessa_avulsa('transferencia', tests.a('MNT'), tests.a('ITB'),
  '[{"material_id":"10000000-0000-4000-a000-0000000000d1","qtd_enviada":3}]', null, null, null, tests.id('tra')), tests.id('tra'),
  'transferência usa o id gerado pelo app');
select is(rpc_criar_remessa_avulsa('transferencia', tests.a('MNT'), tests.a('ITB'),
  '[{"material_id":"10000000-0000-4000-a000-0000000000d1","qtd_enviada":3}]', null, null, null, tests.id('tra')), tests.id('tra'),
  'repetir a transferência devolve a mesma remessa');
select is((select count(*) from remessas where tipo = 'transferencia')::int, 1, 'uma remessa só');
select is(tests.saldo('MNT', '10000000-0000-4000-a000-0000000000d1'), 22.000, 'envio baixou uma vez só');
reset role;

-- O ajuste é da gestão do 211
select tests.como('00000000-0000-4000-a000-0000000000c3');
select is(rpc_registrar_ajuste(tests.a('MNT'), 'inventario', 'Contagem',
  '[{"material_id":"10000000-0000-4000-a000-0000000000d1","qtd_contada":20}]', null, tests.id('aju')), tests.id('aju'),
  'ajuste usa o id gerado pelo app');
select is(rpc_registrar_ajuste(tests.a('MNT'), 'inventario', 'Contagem',
  '[{"material_id":"10000000-0000-4000-a000-0000000000d1","qtd_contada":20}]', null, tests.id('aju')), tests.id('aju'),
  'repetir o ajuste devolve o mesmo registro');
select is(tests.saldo('MNT', '10000000-0000-4000-a000-0000000000d1'), 20.000, 'ajuste aplicado uma vez só');
reset role;

select tests.como('00000000-0000-4000-a000-0000000000c3');
select throws_ok($$ select rpc_registrar_saida(tests.a('211'), '[{"material_id":"10000000-0000-4000-a000-0000000000d1","quantidade":1}]',
  'aplicacao', null, null, null, tests.id('sai')) $$, 'P0001', 'Este identificador já foi usado em outro registro.',
  'id de outro registro não é reaproveitado');
reset role;

-- I4: depois de operar, implantação é recusada
select tests.como('00000000-0000-4000-a000-0000000000c1');
select throws_like($$ select rpc_registrar_ajuste(tests.a('MNT'), 'implantacao', 'De novo',
  '[{"material_id":"10000000-0000-4000-a000-0000000000d1","qtd_contada":99}]') $$,
  '%já está em operação%', 'implantação recusada depois que a base operou');
reset role;

-- ---------------------------------------------------------------------
-- I3: 211 registrou 10 mas separou 8; a base contou 8 (falta)
-- ---------------------------------------------------------------------
select tests.como('00000000-0000-4000-a000-0000000000c4');
with p as (insert into pedidos (solicitante_id) values (tests.a('MNT')) returning id) insert into tests.ctx select 'ped', id from p;
insert into pedido_itens (pedido_id, material_id, qtd_solicitada) values
  (tests.id('ped'), '10000000-0000-4000-a000-0000000000d1', 10),
  (tests.id('ped'), '10000000-0000-4000-a000-0000000000d2', 10);
select rpc_enviar_pedido(tests.id('ped'));
reset role;
select tests.como('00000000-0000-4000-a000-0000000000c3');
select rpc_aprovar_pedido(tests.id('ped'),
  '[{"material_id":"10000000-0000-4000-a000-0000000000d1","qtd_aprovada":10},{"material_id":"10000000-0000-4000-a000-0000000000d2","qtd_aprovada":10}]');
with r as (select rpc_enviar_remessa_pedido(tests.id('ped'),
  '[{"material_id":"10000000-0000-4000-a000-0000000000d1","qtd_enviada":10},{"material_id":"10000000-0000-4000-a000-0000000000d2","qtd_enviada":10}]') as id)
  insert into tests.ctx select 'rem', id from r;
reset role;
select is(tests.saldo('211', '10000000-0000-4000-a000-0000000000d1'), 40.000, '211 baixou 10');

-- Base contou 8 parafusos (falta) e digitou 12 conectores por engano (sobra)
select tests.como('00000000-0000-4000-a000-0000000000c4');
select is(rpc_registrar_recebimento(tests.id('rem'), fn_hoje(), 'João', tests.foto(tests.id('rem')),
  '[{"material_id":"10000000-0000-4000-a000-0000000000d1","qtd_recebida":8,"motivo_divergencia":"falta"},{"material_id":"10000000-0000-4000-a000-0000000000d2","qtd_recebida":12}]'),
  'com_divergencia'::status_remessa, 'recebimento com falta e sobra');
select throws_ok($$ select rpc_tratar_divergencia(tests.item('rem', '10000000-0000-4000-a000-0000000000d1'), 'estorno_origem', 2, 'x') $$,
  '42501', null, 'destino não estorna na origem');
select throws_like($$ select rpc_tratar_divergencia(tests.item('rem', '10000000-0000-4000-a000-0000000000d1'), 'erro_contagem', 2, 'x') $$,
  '%só vale para sobra%', 'erro de contagem não vale para falta');
reset role;

select tests.como('00000000-0000-4000-a000-0000000000c3');
select throws_like($$ select rpc_tratar_divergencia(tests.item('rem', '10000000-0000-4000-a000-0000000000d2'), 'estorno_origem', 2, 'x') $$,
  '%só vale para falta%', 'estorno na origem não vale para sobra');
select throws_ok($$ select rpc_tratar_divergencia(tests.item('rem', '10000000-0000-4000-a000-0000000000d2'), 'erro_contagem', 2, 'x') $$,
  '42501', null, 'origem não corrige a contagem do destino');
select lives_ok($$ select rpc_tratar_divergencia(tests.item('rem', '10000000-0000-4000-a000-0000000000d1'), 'estorno_origem', 2,
  'Separação registrou 10, saíram 8') $$, 'origem estorna o que não saiu');
reset role;
select is(tests.saldo('211', '10000000-0000-4000-a000-0000000000d1'), 42.000, 'estorno devolve 2 ao saldo do 211');
select is((select tipo from movimentacoes where tratamento_id is not null and almox_id = tests.a('211') order by id desc limit 1),
  'ajuste_divergencia'::tipo_movimentacao, 'estorno lançado como ajuste de divergência');

-- ---------------------------------------------------------------------
-- I2: a base corrige o próprio erro de contagem da sobra
-- ---------------------------------------------------------------------
select is(tests.saldo('MNT', '10000000-0000-4000-a000-0000000000d2'), 12.000, 'Mantena recebeu 12 conectores no sistema');
select tests.como('00000000-0000-4000-a000-0000000000c4');
select lives_ok($$ select rpc_tratar_divergencia(tests.item('rem', '10000000-0000-4000-a000-0000000000d2'), 'erro_contagem', 2,
  'Digitei 12, eram 10') $$, 'destino corrige a contagem');
reset role;
select is(tests.saldo('MNT', '10000000-0000-4000-a000-0000000000d2'), 10.000, 'saldo da base volta ao físico');
select is(tests.saldo('211', '10000000-0000-4000-a000-0000000000d2'), 90.000, '211 não é tocado');
select is((select status from remessas where id = tests.id('rem')), 'encerrada'::status_remessa, 'remessa encerrada');
select is((select status from pedidos where id = tests.id('ped')), 'encerrado'::status_pedido, 'pedido encerrado');

select * from finish();
rollback;
