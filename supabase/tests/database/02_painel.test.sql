-- =====================================================================
-- Warefly · Fase 5 — Indicadores do painel da gestão
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
grant execute on all functions in schema tests to authenticated;

-- Usuários: admin, gestão, 211 e Victor (MNT, ITB)
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-a000-0000000000a1', 'adm@t', '{"nome":"Adm"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-0000000000a2', 'ges@t', '{"nome":"Ges"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-0000000000a3', 'c211@t', '{"nome":"C211"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-0000000000a4', 'vic@t', '{"nome":"Vic"}', 'authenticated', 'authenticated');
update perfis set papel = 'admin' where id = '00000000-0000-4000-a000-0000000000a1';
update perfis set papel = 'gestao' where id = '00000000-0000-4000-a000-0000000000a2';
insert into atribuicoes (almox_id, usuario_id, funcao) values
  (tests.a('211'), '00000000-0000-4000-a000-0000000000a3', 'responsavel'),
  (tests.a('MNT'), '00000000-0000-4000-a000-0000000000a4', 'responsavel'),
  (tests.a('MNT'), '00000000-0000-4000-a000-0000000000a4', 'supervisor'),
  (tests.a('ITB'), '00000000-0000-4000-a000-0000000000a4', 'responsavel'),
  (tests.a('ITB'), '00000000-0000-4000-a000-0000000000a4', 'supervisor');
insert into materiais (id, codigo_sap, descricao, unidade, preco) values
  ('10000000-0000-4000-a000-0000000000b1', '8001', 'PARAFUSO', 'PC', 2.00),
  ('10000000-0000-4000-a000-0000000000b2', '8002', 'CONECTOR', 'PC', 10.00);
-- Equipe do grupo do supervisor de Mantena, liberada em Mantena
insert into equipes (id, codigo_zeus, nome, integrantes, frota, grupo_id)
values ('20000000-0000-4000-a000-0000000000e1', 90001, 'Equipe 1', 'Integrante A/Integrante B', '1000', (select id from grupos where nome = 'Victor'));
insert into equipe_locais (equipe_id, almox_id) values ('20000000-0000-4000-a000-0000000000e1', tests.a('MNT'));

-- Saldo inicial no 211 e em Mantena
select tests.como('00000000-0000-4000-a000-0000000000a1');
select rpc_registrar_ajuste(tests.a('211'), 'implantacao', 'Dia D',
  '[{"material_id":"10000000-0000-4000-a000-0000000000b1","qtd_contada":100},{"material_id":"10000000-0000-4000-a000-0000000000b2","qtd_contada":50}]');
select rpc_registrar_ajuste(tests.a('MNT'), 'implantacao', 'Dia D',
  '[{"material_id":"10000000-0000-4000-a000-0000000000b1","qtd_contada":10}]');
reset role;

-- Pedido de Mantena: 20 + 10 solicitados; 211 corta o conector para 5 e envia 20 + 5
select tests.como('00000000-0000-4000-a000-0000000000a4');
with p as (insert into pedidos (solicitante_id) values (tests.a('MNT')) returning id) insert into tests.ctx select 'ped', id from p;
insert into pedido_itens (pedido_id, material_id, qtd_solicitada) values
  (tests.id('ped'), '10000000-0000-4000-a000-0000000000b1', 20),
  (tests.id('ped'), '10000000-0000-4000-a000-0000000000b2', 10);
select rpc_enviar_pedido(tests.id('ped'));
reset role;
select tests.como('00000000-0000-4000-a000-0000000000a3');
select rpc_aprovar_pedido(tests.id('ped'),
  '[{"material_id":"10000000-0000-4000-a000-0000000000b1","qtd_aprovada":20},{"material_id":"10000000-0000-4000-a000-0000000000b2","qtd_aprovada":5,"motivo_corte":"estoque"}]');
with r as (select rpc_enviar_remessa_pedido(tests.id('ped'),
  '[{"material_id":"10000000-0000-4000-a000-0000000000b1","qtd_enviada":20},{"material_id":"10000000-0000-4000-a000-0000000000b2","qtd_enviada":5}]',
  fn_hoje() - 4) as id) insert into tests.ctx select 'rem', id from r;
reset role;

-- Chega 2 dias depois com falta de 2 parafusos; 211 dá baixa em trânsito
select tests.como('00000000-0000-4000-a000-0000000000a4');
select rpc_registrar_recebimento(tests.id('rem'), fn_hoje() - 2, 'João', tests.foto(tests.id('rem')),
  '[{"material_id":"10000000-0000-4000-a000-0000000000b1","qtd_recebida":18,"motivo_divergencia":"falta"},{"material_id":"10000000-0000-4000-a000-0000000000b2","qtd_recebida":5}]');
reset role;
select tests.como('00000000-0000-4000-a000-0000000000a3');
select rpc_tratar_divergencia((select id from remessa_itens where remessa_id = tests.id('rem') and material_id = '10000000-0000-4000-a000-0000000000b1'),
  'baixa_transito', 2, 'Extraviado');
reset role;

-- Transferência MNT → ITB recebida sem diferença no mesmo dia (tempo 0); outra parada há 5 dias
select tests.como('00000000-0000-4000-a000-0000000000a4');
with r as (select rpc_criar_remessa_avulsa('transferencia', tests.a('MNT'), tests.a('ITB'),
  '[{"material_id":"10000000-0000-4000-a000-0000000000b1","qtd_enviada":3}]', fn_hoje()) as id) insert into tests.ctx select 'tra', id from r;
select rpc_registrar_recebimento(tests.id('tra'), fn_hoje(), 'Zé', tests.foto(tests.id('tra')),
  '[{"material_id":"10000000-0000-4000-a000-0000000000b1","qtd_recebida":3}]');
select rpc_criar_remessa_avulsa('transferencia', tests.a('MNT'), tests.a('ITB'),
  '[{"material_id":"10000000-0000-4000-a000-0000000000b1","qtd_enviada":1}]', fn_hoje() - 5);

-- Saídas: 4 parafusos e 1 conector; ajuste de inventário: conta 15 parafusos (saldo 10+18−3−1−4 = 20 → −5)
select rpc_registrar_saida(tests.a('MNT'),
  '[{"material_id":"10000000-0000-4000-a000-0000000000b1","quantidade":4},{"material_id":"10000000-0000-4000-a000-0000000000b2","quantidade":1}]',
  'aplicacao', null, null, null, null, '20000000-0000-4000-a000-0000000000e1', 'João');
reset role;
select tests.como('00000000-0000-4000-a000-0000000000a3');
select rpc_registrar_ajuste(tests.a('MNT'), 'inventario', 'Contagem',
  '[{"material_id":"10000000-0000-4000-a000-0000000000b1","qtd_contada":15}]');
reset role;

-- ---------------------------------------------------------------------
-- Indicadores por almoxarifado
-- ---------------------------------------------------------------------
select tests.como('00000000-0000-4000-a000-0000000000a2');

select results_eq(
  $$ select qtd_solicitada, qtd_enviada, taxa_atendimento
       from fn_indicadores(fn_hoje() - 30, fn_hoje()) where almox_codigo = 'MNT' $$,
  $$ values (30.000::numeric, 25.000::numeric, 0.8333::numeric) $$,
  'taxa de atendimento = Σ enviado ÷ Σ solicitado');

select results_eq(
  $$ select remessas_recebidas, remessas_com_divergencia, indice_divergencia
       from fn_indicadores(fn_hoje() - 30, fn_hoje()) where almox_codigo = 'MNT' $$,
  $$ values (1, 1, 1.0000::numeric) $$,
  'índice de divergência = remessas com divergência ÷ recebidas (destino MNT)');

select results_eq(
  $$ select remessas_recebidas, remessas_com_divergencia, tempo_transito_medio
       from fn_indicadores(fn_hoje() - 30, fn_hoje()) where almox_codigo = 'ITB' $$,
  $$ values (1, 0, 0.0::numeric) $$,
  'transferência recebida no mesmo dia: tempo 0, sem divergência');

select is((select tempo_transito_medio from fn_indicadores(fn_hoje() - 30, fn_hoje()) where almox_codigo = 'MNT'),
  2.0::numeric, 'tempo de trânsito = recebimento − envio');

select results_eq(
  $$ select perda_transito_qtd, perda_transito_valor from fn_indicadores(fn_hoje() - 30, fn_hoje()) where almox_codigo = 'MNT' $$,
  $$ values (2.000::numeric, 4.00::numeric) $$,
  'perda em trânsito (baixas) atribuída ao destino, com valor');

select results_eq(
  $$ select ajustes_qtd, ajustes_valor_abs from fn_indicadores(fn_hoje() - 30, fn_hoje()) where almox_codigo = 'MNT' $$,
  $$ values (1, 10.00::numeric) $$,
  'ajustes de inventário: quantidade e valor absoluto (5 × R$ 2)');

select is((select saidas_valor from fn_indicadores(fn_hoje() - 30, fn_hoje()) where almox_codigo = 'MNT'),
  18.00::numeric, 'valor das saídas (4 × 2 + 1 × 10)');

select is((select count(*) from fn_indicadores(fn_hoje() - 30, fn_hoje()))::int, 12, 'uma linha por almoxarifado operável (211 + 11 bases)');

select is((select qtd_solicitada from fn_indicadores(fn_hoje() - 1, fn_hoje()) where almox_codigo = 'MNT'),
  0.000::numeric, 'período sem envio não conta pedido');

select results_eq(
  $$ select codigo_sap, quantidade, valor from fn_consumo(fn_hoje() - 30, fn_hoje()) where almox_codigo = 'MNT' order by codigo_sap $$,
  $$ values ('8001'::text, 4.000::numeric, 8.00::numeric), ('8002'::text, 1.000::numeric, 10.00::numeric) $$,
  'consumo por base e material');
reset role;

-- RLS vale dentro das funções: supervisor vê só as próprias bases
select tests.como('00000000-0000-4000-a000-0000000000a4');
select is((select count(*) from fn_indicadores(fn_hoje() - 30, fn_hoje()) where qtd_solicitada > 0 or remessas_recebidas > 0)::int,
  2, 'supervisor vê indicadores só de MNT e ITB');
select is((select count(*) from fn_indicadores(fn_hoje() - 30, fn_hoje()) where almox_codigo = 'RSP' and (qtd_solicitada > 0 or saidas_valor > 0))::int,
  0, 'nada de outras bases');
reset role;

-- Realtime publicado para o painel do 211
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'pedidos'), 'pedidos no Realtime');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'remessas'), 'remessas no Realtime');

select * from finish();
rollback;
