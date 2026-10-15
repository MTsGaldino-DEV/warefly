-- =====================================================================
-- Warefly · Equipes por grupo e locais liberados por equipe
-- Roda com: supabase test db   (tudo em transação, desfeito no fim)
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select * from no_plan();

create schema tests;
grant usage on schema tests to authenticated;

create function tests.u(p text) returns uuid language sql immutable as $$
  select case p
    when 'ADMIN'   then '00000000-0000-4000-a000-0000000000a1'
    when 'GESTORA' then '00000000-0000-4000-a000-0000000000a2'
    when 'PEDRO'   then '00000000-0000-4000-a000-0000000000a3'
    when 'VICTOR'  then '00000000-0000-4000-a000-0000000000a4'
  end::uuid
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
create function tests.locais_grupo(n text) returns text[] language sql stable security definer as $$
  select array_agg(a.codigo order by a.codigo)
    from public.grupo_locais gl join public.almoxarifados a on a.id = gl.almox_id
   where gl.grupo_id = tests.g(n)
$$;
create function tests.locais(z integer) returns text[] language sql stable security definer as $$
  select array_agg(a.codigo order by a.codigo)
    from public.equipe_locais el join public.almoxarifados a on a.id = el.almox_id
   where el.equipe_id = tests.eq(z)
$$;
create function tests.como(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', tests.u(p), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
grant execute on all functions in schema tests to authenticated;

-- ---------------------------------------------------------------------
-- A. Carga inicial (planilha de 13/10) e grupos
-- ---------------------------------------------------------------------
select is((select count(*) from equipes)::int, 94, 'carga inicial: 94 equipes');
select is((select count(*) from equipes where ativa)::int, 91, '91 ativas');
select set_eq($$ select codigo_zeus from equipes where not ativa $$, array[21142, 21424, 21619],
  'inativas: sobreaviso, #N/A e "Não lançar"');
select is((select count(*) from equipes where codigo_zeus = 21435)::int, 1, 'Zeus repetido na planilha entra uma vez');
select is((select count(*) from equipes e join grupos g on g.id = e.grupo_id where g.nome = 'Kesia' and e.ativa)::int, 29, '29 motos');
select is((select count(*) from equipes e where e.ativa and not exists (select 1 from equipe_locais where equipe_id = e.id))::int, 0,
  'toda equipe ativa tem local liberado');

select is((select count(*) from grupos)::int, 5, 'um grupo por supervisor e o da moto');
select is((select tipo_equipe from grupos where nome = 'Kesia'), 'moto'::tipo_equipe, 'grupo da Kesia é moto');
select is((select chave_planilha from grupos where nome = 'Vinícius'), 'Vinicius', 'chave da planilha como vem na planilha');
select is(tests.locais_grupo('Pedro'), array['211', 'ITN', 'TRM'], 'Pedro: 211 Geral, Itanhomi e Tarumirim');
select is(tests.locais_grupo('Victor'), array['211', 'CRC', 'ITB', 'MNT'], 'Victor: 211 Geral e as três bases');
select ok((select bool_and('211' = any (tests.locais_grupo(nome))) from grupos), 'todo grupo retira no 211 Geral');
select is(cardinality(tests.locais_grupo('Kesia')), 12, 'moto: 211 Geral e as 11 bases');

-- O resto da suíte trabalha com dados próprios
delete from equipe_locais;
delete from equipes;

-- Usuários: admin, gestora (responsável do 211), Pedro (ITN e TRM) e
-- Victor (MNT, ITB e CRC)
insert into auth.users (id, email, raw_user_meta_data, aud, role)
select tests.u(n), lower(n) || '@warefly.test', json_build_object('nome', n)::jsonb, 'authenticated', 'authenticated'
  from unnest(array['ADMIN', 'GESTORA', 'PEDRO', 'VICTOR']) as n;
update perfis set papel = 'admin' where id = tests.u('ADMIN');

insert into atribuicoes (almox_id, usuario_id, funcao)
select tests.a(v.c), tests.u(v.u), v.f::funcao_atribuicao
  from (values ('211', 'GESTORA', 'responsavel'),
               ('ITN', 'PEDRO', 'responsavel'), ('ITN', 'PEDRO', 'supervisor'),
               ('TRM', 'PEDRO', 'responsavel'), ('TRM', 'PEDRO', 'supervisor'),
               ('MNT', 'VICTOR', 'responsavel'), ('MNT', 'VICTOR', 'supervisor'),
               ('ITB', 'VICTOR', 'responsavel'), ('ITB', 'VICTOR', 'supervisor'),
               ('CRC', 'VICTOR', 'responsavel'), ('CRC', 'VICTOR', 'supervisor')) as v (c, u, f);

insert into materiais (id, codigo_sap, descricao, unidade) values
  ('10000000-0000-4000-a000-0000000000e1', '7001', 'PARAFUSO', 'PC');

select tests.como('GESTORA');
select rpc_registrar_ajuste(tests.a(c), 'implantacao', 'Contagem inicial',
       '[{"material_id":"10000000-0000-4000-a000-0000000000e1","qtd_contada":50}]')
  from unnest(array['211', 'ITN', 'MNT']) as c;
reset role;

-- ---------------------------------------------------------------------
-- B. Manter grupos: só o admin
-- ---------------------------------------------------------------------
select tests.como('GESTORA');
select throws_ok($$ select rpc_salvar_grupo('Pedro', 'multifuncional', array[tests.a('211')], 'Pedro', true, tests.g('Pedro')) $$,
  '42501', null, 'gestora não mantém grupos');
select throws_ok($$ insert into grupos (nome) values ('Grupo X') $$, '42501', null, 'grupo não é gravado direto na tabela');
reset role;

select tests.como('ADMIN');
select lives_ok($$ select rpc_salvar_grupo('Comercial', 'multifuncional', array[tests.a('211')], ' Comercial ') $$,
  'admin cria um grupo');
select throws_like($$ select rpc_salvar_grupo('Outro', 'multifuncional', array[tests.a('211')], 'PEDRO') $$,
  'Já existe um grupo com este nome ou com esta chave%', 'chave repetida, mesmo com outra caixa');
select throws_like($$ select rpc_salvar_grupo('Outro', 'multifuncional', array[]::uuid[]) $$,
  'Escolha ao menos um local%', 'grupo ativo precisa de local');
select throws_like($$ select rpc_salvar_grupo('Outro', 'multifuncional', array[tests.a('3256')]) $$,
  'O almoxarifado externo não é local de retirada%', 'o 3256 não entra em grupo');
reset role;
select is((select chave_planilha from grupos where nome = 'Comercial'), 'Comercial', 'chave gravada sem espaços sobrando');

-- ---------------------------------------------------------------------
-- C. Importação: conciliação, simulação e permissões
-- ---------------------------------------------------------------------
create function tests.planilha() returns jsonb language sql immutable as $$
  select '[
    {"zeus": 30001, "descricao": " EQUIPE ALFA ", "supervisor": "Pedro",  "integrantes": "Integrante A/ Integrante B", "frota": "4822"},
    {"zeus": 30002, "descricao": "EQUIPE BETA",    "supervisor": "victor", "integrantes": "Integrante C", "frota": "9641"},
    {"zeus": 30003, "descricao": "EQUIPE GAMA",    "supervisor": "Kesia",  "integrantes": "Integrante D", "frota": "2289"},
    {"zeus": 30004, "descricao": "SOBREAVISO",     "supervisor": null,     "integrantes": null, "frota": null},
    {"zeus": 30005, "descricao": "EQUIPE DELTA",   "supervisor": "Pedro",  "integrantes": "Integrante E", "frota": "9475", "problema": "Não lançar"}
  ]'::jsonb
$$;
grant execute on function tests.planilha() to authenticated;

select tests.como('PEDRO');
select throws_ok($$ select rpc_importar_equipes(tests.planilha()) $$, '42501', null, 'supervisor não importa equipes');
reset role;

select tests.como('GESTORA');
select is(
  (select rpc_importar_equipes(tests.planilha(), true)),
  '{"novas":[30001,30002,30003,30004,30005],"alteradas":[],"sem_mudanca":[],"inativadas":[],"com_problema":[30004,30005]}'::jsonb,
  'simulação mostra a conciliação');
reset role;
select is((select count(*) from equipes)::int, 0, 'simulação não grava nada');

select tests.como('GESTORA');
select throws_like($$ select rpc_importar_equipes('[{"zeus": 1, "descricao": "X", "supervisor": "Fulano", "integrantes": "A", "frota": "1"}]') $$,
  'O supervisor "Fulano" da planilha (Zeus 1) não está ligado a nenhum grupo%', 'supervisor sem grupo bloqueia');
select throws_like($$ select rpc_importar_equipes('[{"zeus": 1, "supervisor": "Pedro"}, {"zeus": 1, "supervisor": "Pedro"}]') $$,
  'O código Zeus 1 aparece mais de uma vez%', 'Zeus repetido bloqueia');
select throws_like($$ select rpc_importar_equipes('[{"descricao": "X", "supervisor": "Pedro"}]') $$,
  'Linha 1 da planilha sem código Zeus%', 'linha sem Zeus bloqueia');
select throws_like($$ select rpc_importar_equipes('[]') $$, 'A planilha não tem nenhuma equipe%', 'planilha vazia');
select lives_ok($$ select rpc_importar_equipes(tests.planilha()) $$, 'gestora importa a planilha');
reset role;

select is((select count(*) from equipes)::int, 5, 'cinco equipes gravadas');
select is((select nome from equipes where codigo_zeus = 30001), 'EQUIPE ALFA', 'descrição sem espaços sobrando');
select is((select grupo_id from equipes where codigo_zeus = 30002), tests.g('Victor'), 'supervisor casa com a chave sem diferenciar caixa');
select is(tests.locais(30001), array['211', 'ITN', 'TRM'], 'equipe nova nasce com os locais do grupo');
select is(cardinality(tests.locais(30003)), 12, 'moto nasce liberada no 211 e em todas as bases');
select ok(not (select ativa from equipes where codigo_zeus = 30004), 'linha sem supervisor entra inativa');
select ok(not (select ativa from equipes where codigo_zeus = 30005), '"Não lançar" entra inativa');

-- Liberação manual sobrevive à reimportação (grupo não mudou)
select tests.como('GESTORA');
select lives_ok($$ select rpc_definir_locais_equipe(tests.eq(30002), array[tests.a('211'), tests.a('MNT'), tests.a('ITB'), tests.a('CRC'), tests.a('ITN')]) $$,
  'gestora libera Itanhomi para uma equipe do Victor');
select is(
  (select rpc_importar_equipes(
     jsonb_set(tests.planilha() - 2, '{0,integrantes}', '"Integrante A/ Integrante F"'))),
  '{"novas":[],"alteradas":[30001],"sem_mudanca":[30002,30004,30005],"inativadas":[30003],"com_problema":[30004,30005]}'::jsonb,
  'reimportação concilia alteradas, iguais e as que saíram');
reset role;
select ok('ITN' = any (tests.locais(30002)), 'local liberado à mão continua depois da reimportação');
select ok(not (select ativa from equipes where codigo_zeus = 30003), 'equipe fora da planilha é inativada');
select is((select count(*) from equipes where codigo_zeus = 30003)::int, 1, 'e não é apagada');

-- Troca de grupo na planilha: locais voltam ao padrão do grupo novo
select tests.como('ADMIN');
select is(
  (select rpc_importar_equipes(jsonb_set(tests.planilha(), '{1,supervisor}', '"Pedro"')) -> 'alteradas'),
  '[30001, 30002, 30003]'::jsonb, 'admin também importa: integrantes e grupo mudam, a que voltou é reativada');
reset role;
select is(tests.locais(30002), array['211', 'ITN', 'TRM'], 'equipe que trocou de grupo fica com os locais do grupo novo');
select ok((select ativa from equipes where codigo_zeus = 30003), 'moto ativa de novo');

-- Volta a equipe 30002 para o Victor
select tests.como('GESTORA');
select lives_ok($$ select rpc_importar_equipes(tests.planilha()) $$, 'reimporta a planilha original');
reset role;

-- Nada é gravado direto na tabela
select tests.como('GESTORA');
select throws_ok($$ update equipes set codigo_zeus = 39999 where codigo_zeus = 30001 $$, '42501', null, 'equipe só muda por RPC');
select throws_ok($$ insert into equipe_locais (equipe_id, almox_id) values (tests.eq(30001), tests.a('MNT')) $$, '42501', null,
  'local liberado só por RPC');
reset role;

-- ---------------------------------------------------------------------
-- D. Locais liberados: a gestão edita
-- ---------------------------------------------------------------------
select tests.como('VICTOR');
select throws_ok($$ select rpc_definir_locais_equipe(tests.eq(30002), array[tests.a('211')]) $$, '42501', null,
  'supervisor não muda os locais de uma equipe');
reset role;

select tests.como('GESTORA');
select lives_ok($$ select rpc_definir_locais_equipe(tests.eq(30003), array[tests.a('211'), tests.a('MNT')]) $$,
  'gestora restringe a moto ao 211 e a Mantena');
select throws_like($$ select rpc_definir_locais_equipe(tests.eq(30003), array[]::uuid[]) $$,
  'Libere ao menos um local%', 'equipe precisa de ao menos um local');
select throws_like($$ select rpc_definir_locais_equipe(tests.eq(30003), array[tests.a('3256')]) $$,
  'O almoxarifado externo não é local de retirada%', 'o 3256 não é liberado');
reset role;
select is(tests.locais(30003), array['211', 'MNT'], 'locais da moto gravados');
select is((select liberado_por from equipe_locais where equipe_id = tests.eq(30003) and almox_id = tests.a('MNT')), tests.u('GESTORA'),
  'guarda quem liberou');

-- ---------------------------------------------------------------------
-- E. Quem vê as equipes e o estoque
-- ---------------------------------------------------------------------
select tests.como('PEDRO');
select set_eq($$ select codigo_zeus from equipes $$, array[30001, 30005],
  'Pedro vê as equipes liberadas nas bases dele');
select is((select count(*) from v_saldo where almox_id = tests.a('211'))::int, 0, 'e não vê o estoque do 211 Geral');
select ok((select count(*) from v_saldo where almox_id = tests.a('ITN'))::int > 0, 'mas vê o estoque da própria base');
reset role;

select tests.como('VICTOR');
select set_eq($$ select codigo_zeus from equipes $$, array[30002, 30003],
  'Victor vê as do grupo dele e a moto liberada em Mantena');
reset role;

select tests.como('GESTORA');
select is((select count(*) from equipes)::int, 5, 'gestora vê todas, até as sem grupo');
reset role;

-- ---------------------------------------------------------------------
-- F. Saída: só nos locais liberados
-- ---------------------------------------------------------------------
select tests.como('VICTOR');
select lives_ok(
  $$ select rpc_registrar_saida(tests.a('MNT'), '[{"material_id":"10000000-0000-4000-a000-0000000000e1","quantidade":2}]',
       'aplicacao', null, null, 'NS 1', null, tests.eq(30002), 'Fulano') $$,
  'equipe do Victor retira em Mantena');
select lives_ok(
  $$ select rpc_registrar_saida(tests.a('MNT'), '[{"material_id":"10000000-0000-4000-a000-0000000000e1","quantidade":1}]',
       'aplicacao', null, null, 'NS 2', null, tests.eq(30003), 'Fulano') $$,
  'moto liberada em Mantena retira lá');
reset role;

select tests.como('PEDRO');
select lives_ok(
  $$ select rpc_registrar_saida(tests.a('ITN'), '[{"material_id":"10000000-0000-4000-a000-0000000000e1","quantidade":1}]',
       'aplicacao', null, null, 'NS 3', null, tests.eq(30001), 'Fulano') $$,
  'equipe do Pedro retira em Itanhomi');
select throws_like(
  $$ select rpc_registrar_saida(tests.a('ITN'), '[{"material_id":"10000000-0000-4000-a000-0000000000e1","quantidade":1}]',
       'aplicacao', null, null, null, null, tests.eq(30002), 'Fulano') $$,
  'A equipe 30002 (EQUIPE BETA) não está liberada para retirar em Itanhomi. Peça à gestão do almoxarifado para liberar este local.',
  'equipe sem o local liberado é recusada');
select throws_like(
  $$ select rpc_registrar_saida(tests.a('ITN'), '[{"material_id":"10000000-0000-4000-a000-0000000000e1","quantidade":1}]',
       'aplicacao', null, null, null, null, tests.eq(30003), 'Fulano') $$,
  'A equipe 30003 (EQUIPE GAMA) não está liberada para retirar em Itanhomi%', 'moto restrita não retira em Itanhomi');
select throws_like(
  $$ select rpc_registrar_saida(tests.a('ITN'), '[{"material_id":"10000000-0000-4000-a000-0000000000e1","quantidade":1}]',
       'aplicacao', null, null, null, null, tests.eq(30005), 'Fulano') $$,
  'A equipe 30005 (EQUIPE DELTA) está inativa%', 'equipe inativa é recusada');
reset role;

select tests.como('GESTORA');
select lives_ok(
  $$ select rpc_registrar_saida(tests.a('211'), '[{"material_id":"10000000-0000-4000-a000-0000000000e1","quantidade":3}]',
       'aplicacao', null, null, 'NS 4', null, tests.eq(30003), 'Fulano') $$,
  'moto retira no 211 Geral');
select lives_ok(
  $$ select rpc_registrar_saida(tests.a('211'), '[{"material_id":"10000000-0000-4000-a000-0000000000e1","quantidade":1}]',
       'aplicacao', null, null, 'NS 5', null, tests.eq(30002), 'Fulano') $$,
  'equipe do Victor retira no 211 Geral');
reset role;

select is((select sum(quantidade) from movimentacoes where almox_id = tests.a('211')), 46.000, '211 Geral: 50 − 3 − 1');
select is((select equipe_id from saidas where observacao = 'NS 4'), tests.eq(30003), 'saída guarda a equipe');

-- Equipe com saída: descrição muda pela importação, Zeus não
select tests.como('GESTORA');
select lives_ok(
  $$ select rpc_importar_equipes(jsonb_set(tests.planilha(), '{1,descricao}', '"EQUIPE BETA NOVA"')) $$,
  'descrição de equipe com saída muda na reimportação');
reset role;
select is((select nome from equipes where codigo_zeus = 30002), 'EQUIPE BETA NOVA', 'nova descrição gravada');
select throws_like($$ update equipes set codigo_zeus = 39999 where codigo_zeus = 30002 $$,
  'A equipe 30002 (EQUIPE BETA NOVA) já tem saídas registradas e não pode mudar de código Zeus.', 'Zeus de equipe usada não muda');

-- ---------------------------------------------------------------------
-- G. Cadastro completo
-- ---------------------------------------------------------------------
select throws_like($$ update equipes set ativa = true where codigo_zeus = 30004 $$,
  'Para ativar a equipe SOBREAVISO, preencha código Zeus, descrição, integrantes, frota e grupo.',
  'equipe incompleta não é ativada');
select tests.como('GESTORA');
select lives_ok($$ select rpc_salvar_equipe(30004, 'SOBREAVISO', 'Integrante G', '5093', tests.g('Pedro'), null, true, tests.eq(30004)) $$,
  'completando o cadastro, a equipe é ativada');
reset role;
select is(tests.locais(30004), array['211', 'ITN', 'TRM'], 'e ganha os locais do grupo');

select * from finish();
rollback;
