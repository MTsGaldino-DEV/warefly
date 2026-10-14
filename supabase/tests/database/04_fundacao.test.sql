-- =====================================================================
-- Warefly · Fundação — gestora, ajuste, unidades, motivos, equipes
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
    when 'ADMIN'   then '00000000-0000-4000-a000-0000000000f1'
    when 'GESTORA' then '00000000-0000-4000-a000-0000000000f2'
    when 'VICTOR'  then '00000000-0000-4000-a000-0000000000f3'
    when 'INATIVA' then '00000000-0000-4000-a000-0000000000f4'
  end::uuid
$$;
create function tests.a(c text) returns uuid language sql stable security definer as $$
  select id from public.almoxarifados where codigo = c
$$;
create function tests.como(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', tests.u(p), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
-- Saldo do parafuso (material e1) num local
create function tests.saldo(c text) returns numeric language sql stable security definer as $$
  select coalesce(sum(quantidade), 0) from public.movimentacoes
   where almox_id = tests.a(c) and material_id = '10000000-0000-4000-a000-0000000000e1'
$$;
grant execute on all functions in schema tests to authenticated;

-- Usuários: admin, gestora (responsável do 211), Victor (MNT e ITB) e uma
-- responsável do 211 com o perfil inativado
insert into auth.users (id, email, raw_user_meta_data, aud, role)
select tests.u(n), lower(n) || '@warefly.test', json_build_object('nome', n)::jsonb, 'authenticated', 'authenticated'
  from unnest(array['ADMIN', 'GESTORA', 'VICTOR', 'INATIVA']) as n;
update perfis set papel = 'admin' where id = tests.u('ADMIN');
update perfis set ativo = false where id = tests.u('INATIVA');

-- Um segundo regional, com uma base, fora da gestão do 211
insert into almoxarifados (codigo, nome, tipo, pai_id) values ('R2', 'Regional dois', 'regional', tests.a('3256'));
insert into almoxarifados (codigo, nome, tipo, pai_id) values ('B2', 'Base dois', 'base', tests.a('R2'));

insert into atribuicoes (almox_id, usuario_id, funcao) values
  (tests.a('211'), tests.u('GESTORA'), 'responsavel'),
  (tests.a('211'), tests.u('INATIVA'), 'responsavel'),
  (tests.a('MNT'), tests.u('VICTOR'), 'responsavel'), (tests.a('MNT'), tests.u('VICTOR'), 'supervisor'),
  (tests.a('ITB'), tests.u('VICTOR'), 'responsavel'), (tests.a('ITB'), tests.u('VICTOR'), 'supervisor');

insert into materiais (id, codigo_sap, descricao, unidade) values
  ('10000000-0000-4000-a000-0000000000e1', '6001', 'PARAFUSO', 'PC'),
  ('10000000-0000-4000-a000-0000000000e2', '6002', 'CONECTOR', 'PC');

-- ---------------------------------------------------------------------
-- A. Gestora do almoxarifado = responsável de um regional
-- ---------------------------------------------------------------------
select tests.como('GESTORA');
select ok(fn_eh_gestora(), 'responsável do 211 é gestora');
select ok(fn_gere_local(tests.a('211')), 'gestora gere o 211');
select ok(fn_gere_local(tests.a('MNT')), 'gestora gere as bases do 211');
select ok(not fn_gere_local(tests.a('3256')), 'gestora não gere o 3256');
select ok(not fn_gere_local(tests.a('R2')), 'nem outro regional');
select ok(not fn_gere_local(tests.a('B2')), 'nem as bases de outro regional');
reset role;

select tests.como('VICTOR');
select ok(not fn_eh_gestora(), 'supervisor não é gestora');
select ok(not fn_gere_local(tests.a('MNT')), 'supervisor não gere a própria base');
reset role;

select tests.como('INATIVA');
select ok(not fn_eh_gestora(), 'perfil inativo perde a gestão');
select ok(not fn_gere_local(tests.a('211')), 'e deixa de gerir o 211');
reset role;

-- ---------------------------------------------------------------------
-- B. Ajuste de estoque: só a gestão do almoxarifado e o admin
-- ---------------------------------------------------------------------
select tests.como('VICTOR');
select throws_ok(
  $$ select rpc_registrar_ajuste(tests.a('MNT'), 'inventario', 'Contagem',
       '[{"material_id":"10000000-0000-4000-a000-0000000000e1","qtd_contada":5}]') $$,
  '42501', null, 'supervisor não ajusta a própria base');
reset role;

select tests.como('GESTORA');
select lives_ok(
  $$ select rpc_registrar_ajuste(tests.a('MNT'), 'inventario', 'Contagem',
       '[{"material_id":"10000000-0000-4000-a000-0000000000e1","qtd_contada":20}]') $$,
  'gestora ajusta uma base do 211');
select lives_ok(
  $$ select rpc_registrar_ajuste(tests.a('211'), 'inventario', 'Contagem',
       '[{"material_id":"10000000-0000-4000-a000-0000000000e1","qtd_contada":10}]') $$,
  'gestora ajusta o 211');
select lives_ok(
  $$ select rpc_registrar_ajuste(tests.a('ITB'), 'implantacao', 'Contagem inicial',
       '[{"material_id":"10000000-0000-4000-a000-0000000000e1","qtd_contada":5}]') $$,
  'gestora carrega o saldo inicial de uma base');
select throws_ok(
  $$ select rpc_registrar_ajuste(tests.a('B2'), 'inventario', 'Contagem',
       '[{"material_id":"10000000-0000-4000-a000-0000000000e1","qtd_contada":1}]') $$,
  '42501', null, 'gestora não ajusta base de outro regional');
reset role;

select tests.como('INATIVA');
select throws_ok(
  $$ select rpc_registrar_ajuste(tests.a('MNT'), 'inventario', 'Contagem',
       '[{"material_id":"10000000-0000-4000-a000-0000000000e1","qtd_contada":1}]') $$,
  '42501', null, 'perfil inativo não ajusta');
reset role;

select tests.como('ADMIN');
select lives_ok(
  $$ select rpc_registrar_ajuste(tests.a('B2'), 'implantacao', 'Contagem inicial',
       '[{"material_id":"10000000-0000-4000-a000-0000000000e1","qtd_contada":3}]') $$,
  'admin ajusta qualquer local');
reset role;

select is(tests.saldo('MNT'), 20.000, 'Mantena com 20 após o ajuste da gestora');
select is(tests.saldo('211'), 10.000, '211 com 10');
select is(tests.saldo('ITB'), 5.000, 'Itabirinha com 5');
select is(tests.saldo('B2'), 3.000, 'Base dois com 3');

-- ---------------------------------------------------------------------
-- C. Cadastros não são apagados: material e local só são inativados
-- ---------------------------------------------------------------------
select tests.como('ADMIN');
select throws_ok($$ delete from materiais where codigo_sap = '6002' $$, '42501', null, 'admin não apaga material');
select throws_ok($$ delete from almoxarifados where codigo = 'B2' $$, '42501', null, 'admin não apaga almoxarifado');
select lives_ok($$ update materiais set ativo = false where codigo_sap = '6002' $$, 'admin inativa material');
reset role;
select ok(not (select ativo from materiais where codigo_sap = '6002'), 'material inativado');

-- ---------------------------------------------------------------------
-- D. Sigla SAP das unidades (coluna UMB da planilha de reservas)
-- ---------------------------------------------------------------------
select is((select sigla_sap from unidades where codigo = 'PC'), 'PEÇ', 'PC aparece como PEÇ no SAP');
select is((select count(*) from unidades where sigla_sap is not null)::int, 4, 'PC, CJ, M e KG com sigla SAP');
select tests.como('ADMIN');
select throws_ok($$ update unidades set sigla_sap = 'PEÇ' where codigo = 'JG' $$, '23505', null, 'sigla SAP não se repete');
select throws_ok($$ update unidades set sigla_sap = ' ' where codigo = 'JG' $$, '23514', null, 'sigla SAP não fica em branco');
select lives_ok($$ update unidades set sigla_sap = 'JOGO' where codigo = 'JG' $$, 'admin define a sigla de JG');
reset role;
select tests.como('VICTOR');
select lives_ok($$ update unidades set sigla_sap = 'X' where codigo = 'PR' $$, 'supervisor tenta mudar a sigla...');
reset role;
select is((select sigla_sap from unidades where codigo = 'PR'), null, '...e nada muda');

-- ---------------------------------------------------------------------
-- E. Motivos de redução: todos leem; gestora e admin mantêm
-- ---------------------------------------------------------------------
select tests.como('VICTOR');
select is((select array_agg(descricao order by ordem) from motivos_reducao),
  array['Sem saldo no 211', 'Excede consumo histórico', 'Material de obras', 'Outro'],
  'todos leem os motivos, na ordem');
select throws_ok($$ insert into motivos_reducao (descricao) values ('Supervisor inventou') $$,
  '42501', null, 'supervisor não cadastra motivo');
select lives_ok($$ update motivos_reducao set ativo = false where descricao = 'Outro' $$, 'supervisor tenta inativar...');
reset role;
select ok((select ativo from motivos_reducao where descricao = 'Outro'), '...e nada muda');
select ok((select exige_texto from motivos_reducao where descricao = 'Outro'), '"Outro" exige texto');

select tests.como('GESTORA');
select lives_ok($$ insert into motivos_reducao (descricao, ordem) values ('Pedido em duplicidade', 50) $$, 'gestora cadastra motivo');
select lives_ok($$ update motivos_reducao set ativo = false where descricao = 'Pedido em duplicidade' $$, 'gestora inativa motivo');
select throws_ok($$ insert into motivos_reducao (descricao) values ('outro') $$, '23505', null, 'nome repetido, mesmo com outra caixa');
select throws_ok($$ insert into motivos_reducao (descricao) values (' Outro motivo') $$, '23514', null, 'nome com espaço sobrando é recusado');
select throws_ok($$ delete from motivos_reducao where descricao = 'Pedido em duplicidade' $$, '42501', null, 'motivo não é apagado');
reset role;
select ok(not (select ativo from motivos_reducao where descricao = 'Pedido em duplicidade'), 'motivo inativado');

select tests.como('ADMIN');
select lives_ok($$ insert into motivos_reducao (descricao, ordem) values ('Material descontinuado', 50) $$, 'admin cadastra motivo');
reset role;

-- ---------------------------------------------------------------------
-- F. Equipes: cadastro só pela gestão do almoxarifado, tudo obrigatório,
--    locais liberados por equipe; não são apagadas
-- ---------------------------------------------------------------------
-- Começa sem a carga inicial das equipes reais
delete from equipe_locais;
delete from equipes;

-- id da equipe pelo nome, sem passar pelo RLS de quem consulta
create function tests.equipe(p_nome text) returns uuid language sql stable security definer as $$
  select id from public.equipes where nome = p_nome
$$;
create function tests.grupo(p_nome text) returns uuid language sql stable security definer as $$
  select id from public.grupos where nome = p_nome
$$;
create function tests.locais(p_nome text) returns text[] language sql stable security definer as $$
  select array_agg(a.codigo order by a.codigo)
    from public.equipe_locais el join public.almoxarifados a on a.id = el.almox_id
   where el.equipe_id = tests.equipe(p_nome)
$$;
grant execute on all functions in schema tests to authenticated;

select tests.como('VICTOR');
select throws_ok($$ insert into equipes (nome) values ('Equipe 12') $$, '42501', null, 'equipe não é gravada direto na tabela');
select throws_ok($$ select rpc_salvar_equipe(90012, 'Equipe 12', 'Integrante A', '1000', tests.grupo('Victor')) $$,
  '42501', null, 'supervisor não cadastra equipe');
select throws_ok($$ delete from equipes $$, '42501', null, 'equipe não é apagada');
reset role;

select tests.como('GESTORA');
select lives_ok($$ select rpc_salvar_equipe(90012, '  Equipe   12 ', 'Integrante A/Integrante B', '1000', tests.grupo('Victor')) $$,
  'gestora cadastra equipe com tudo preenchido');
select throws_like($$ select rpc_salvar_equipe(null, 'Equipe 13', 'Integrante C', '1001', tests.grupo('Victor')) $$,
  'Informe o código Zeus da equipe.', 'Zeus obrigatório');
select throws_like($$ select rpc_salvar_equipe(90013, ' ', 'Integrante C', '1001', tests.grupo('Victor')) $$,
  'Informe a descrição da equipe.', 'descrição obrigatória');
select throws_like($$ select rpc_salvar_equipe(90013, 'Equipe 13', '  ', '1001', tests.grupo('Victor')) $$,
  'Informe os integrantes da equipe.', 'integrantes obrigatórios');
select throws_like($$ select rpc_salvar_equipe(90013, 'Equipe 13', 'Integrante C', null, tests.grupo('Victor')) $$,
  'Informe a frota da equipe.', 'frota obrigatória');
select throws_like($$ select rpc_salvar_equipe(90013, 'Equipe 13', 'Integrante C', '1001', null) $$,
  'Escolha o grupo (supervisor) da equipe.', 'grupo obrigatório');
select throws_like($$ select rpc_salvar_equipe(90012, 'Outra', 'Integrante C', '1001', tests.grupo('Victor')) $$,
  'Já existe uma equipe com o código Zeus 90012.', 'Zeus repetido');
select lives_ok($$ select rpc_salvar_equipe(90007, 'Equipe 7', 'Integrante D', '1007', tests.grupo('Victor'), array[tests.a('ITB')]) $$,
  'gestora escolhe os locais no cadastro');
select throws_ok($$ select rpc_salvar_equipe(90099, 'Equipe B', 'Integrante E', '1099', tests.grupo('Victor'), array[tests.a('B2')]) $$,
  '42501', null, 'gestora não libera base de outro regional');
reset role;

select is((select nome from equipes where codigo_zeus = 90012), 'Equipe 12', 'descrição sem espaços sobrando');
select is((select criado_por from equipes where nome = 'Equipe 12'), tests.u('GESTORA'), 'equipe guarda quem cadastrou');
select is(tests.locais('Equipe 12'), array['211', 'CRC', 'ITB', 'MNT'], 'equipe nova nasce com os locais do grupo');
select is(tests.locais('Equipe 7'), array['ITB'], 'ou com os locais escolhidos');

select tests.como('ADMIN');
select lives_ok($$ select rpc_salvar_equipe(90099, 'Equipe B', 'Integrante E', '1099', tests.grupo('Victor'), array[tests.a('B2')]) $$,
  'admin libera qualquer local');
reset role;

select tests.como('VICTOR');
select is((select count(*) from equipes)::int, 2, 'supervisor vê só as equipes liberadas nas bases dele');
reset role;

-- ---------------------------------------------------------------------
-- G. Saída com equipe e quem retirou
-- ---------------------------------------------------------------------
select tests.como('VICTOR');
select throws_like(
  $$ select rpc_registrar_saida(tests.a('MNT'), '[{"material_id":"10000000-0000-4000-a000-0000000000e1","quantidade":1}]') $$,
  'Informe a equipe que retirou o material.', 'aplicação na base exige equipe');
select throws_like(
  $$ select rpc_registrar_saida(tests.a('MNT'), '[{"material_id":"10000000-0000-4000-a000-0000000000e1","quantidade":1}]',
       'aplicacao', null, null, null, null, tests.equipe('Equipe 12'), '   ') $$,
  'Informe o nome de quem retirou o material.', 'e o nome de quem retirou');
select throws_like(
  $$ select rpc_registrar_saida(tests.a('MNT'), '[{"material_id":"10000000-0000-4000-a000-0000000000e1","quantidade":1}]',
       'aplicacao', null, null, null, null, tests.equipe('Equipe 7'), 'João') $$,
  'A equipe 90007 (Equipe 7) não está liberada para retirar em Mantena.%', 'equipe não liberada no local é recusada');
select lives_ok(
  $$ select rpc_registrar_saida(tests.a('MNT'), '[{"material_id":"10000000-0000-4000-a000-0000000000e1","quantidade":2}]',
       'aplicacao', null, null, 'NS 4455', null, tests.equipe('Equipe 12'), '  João Silva ') $$,
  'saída de aplicação com equipe e quem retirou');
select lives_ok(
  $$ select rpc_registrar_saida(tests.a('MNT'), '[{"material_id":"10000000-0000-4000-a000-0000000000e1","quantidade":1}]',
       'perda', null, 'Caiu do caminhão') $$,
  'perda não exige equipe');
select throws_ok($$ select rpc_ativar_equipe(tests.equipe('Equipe 12'), false) $$, '42501', null, 'supervisor não inativa equipe');
reset role;
select is((select retirado_por_nome from saidas where observacao = 'NS 4455'), 'João Silva', 'nome gravado sem espaços sobrando');
select is((select equipe_id from saidas where observacao = 'NS 4455'), tests.equipe('Equipe 12'), 'equipe gravada na saída');
select is(tests.saldo('MNT'), 17.000, 'saídas baixaram o saldo (20 − 2 − 1)');

select tests.como('GESTORA');
select lives_ok($$ select rpc_salvar_equipe(90012, 'Equipe 12 nova', 'Integrante A/Integrante B', '1000', tests.grupo('Victor'), null, true, tests.equipe('Equipe 12')) $$,
  'equipe usada pode mudar de descrição');
select throws_like($$ select rpc_salvar_equipe(90112, 'Equipe 12 nova', 'Integrante A/Integrante B', '1000', tests.grupo('Victor'), null, true, tests.equipe('Equipe 12 nova')) $$,
  'A equipe 90012 (Equipe 12 nova) já tem saídas registradas e não pode mudar de código Zeus.', 'mas não de código Zeus');
select lives_ok($$ select rpc_ativar_equipe(tests.equipe('Equipe 12 nova'), false) $$, 'gestora inativa equipe usada');
reset role;

select tests.como('VICTOR');
select throws_like(
  $$ select rpc_registrar_saida(tests.a('MNT'), '[{"material_id":"10000000-0000-4000-a000-0000000000e1","quantidade":1}]',
       'aplicacao', null, null, null, null, tests.equipe('Equipe 12 nova'), 'João') $$,
  'A equipe 90012 (Equipe 12 nova) está inativa%', 'equipe inativa é recusada');
reset role;

select tests.como('GESTORA');
select throws_like(
  $$ select rpc_registrar_saida(tests.a('211'), '[{"material_id":"10000000-0000-4000-a000-0000000000e1","quantidade":1}]',
       'aplicacao', null, null, null, null, tests.equipe('Equipe 7'), 'Pedro') $$,
  'A equipe 90007 (Equipe 7) não está liberada para retirar em Almoxarifado regional.%', 'equipe sem o 211 liberado não retira lá');
select lives_ok($$ select rpc_definir_locais_equipe(tests.equipe('Equipe 7'), array[tests.a('ITB'), tests.a('211')]) $$,
  'gestora libera o 211 para a equipe');
select lives_ok(
  $$ select rpc_registrar_saida(tests.a('211'), '[{"material_id":"10000000-0000-4000-a000-0000000000e1","quantidade":1}]',
       'aplicacao', null, null, null, null, tests.equipe('Equipe 7'), 'Pedro') $$,
  'e a equipe retira no 211');
select lives_ok(
  $$ select rpc_registrar_saida(tests.a('211'), '[{"material_id":"10000000-0000-4000-a000-0000000000e1","quantidade":1}]') $$,
  'no 211 a equipe é opcional');
select throws_like(
  $$ select rpc_registrar_saida(tests.a('211'), '[{"material_id":"10000000-0000-4000-a000-0000000000e1","quantidade":1}]',
       'aplicacao', null, null, null, null, tests.equipe('Equipe B'), 'Pedro') $$,
  'A equipe 90099 (Equipe B) não está liberada%', 'equipe liberada só em outro regional é recusada');
reset role;

select * from finish();
rollback;
