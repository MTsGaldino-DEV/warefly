-- =====================================================================
-- Warefly · Fase A — Colaboradores, matrícula, senha inicial e membros
-- Roda com: supabase test db   (tudo em transação, desfeito no fim)
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select * from no_plan();

create schema tests;
grant usage on schema tests to authenticated, service_role;

create function tests.u(p text) returns uuid language sql immutable as $$
  select case p
    when 'ADMIN'   then '00000000-0000-4000-a000-0000000000b1'
    when 'GESTORA' then '00000000-0000-4000-a000-0000000000b2'
    when 'PEDRO'   then '00000000-0000-4000-a000-0000000000b3'
    when 'VICTOR'  then '00000000-0000-4000-a000-0000000000b4'
    when 'E1'      then '00000000-0000-4000-a000-0000000000c1'
    when 'E2'      then '00000000-0000-4000-a000-0000000000c2'
    when 'E3'      then '00000000-0000-4000-a000-0000000000c3'
    when 'E4'      then '00000000-0000-4000-a000-0000000000c4'
    when 'SEMCEMIG' then '00000000-0000-4000-a000-0000000000c5'
    when 'GERENCIA' then '00000000-0000-4000-a000-0000000000c6'
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
create function tests.perfil(p text) returns public.perfis language sql stable security definer as $$
  select * from public.perfis where id = tests.u(p)
$$;
create function tests.equipe_de(p text) returns integer language sql stable security definer as $$
  select e.codigo_zeus from public.equipe_membros m join public.equipes e on e.id = m.equipe_id
   where m.colaborador_id = tests.u(p) and m.fim is null
$$;
create function tests.como(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', tests.u(p), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function tests.como_servidor() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  perform set_config('role', 'service_role', true);
end $$;
grant execute on all functions in schema tests to authenticated, service_role;

-- Usuários: admin, gestora (responsável do 211), supervisores Pedro (ITN,
-- TRM) e Victor (MNT, ITB, CRC), quatro eletricistas, um operador sem
-- matrícula CEMIG e o operador do 211 (antes, gerência). Os eletricistas nascem como a Edge
-- Function cria: dados em app_metadata e senha inicial.
insert into auth.users (id, email, raw_user_meta_data, aud, role)
select tests.u(n), lower(n) || '@warefly.test', json_build_object('nome', n)::jsonb, 'authenticated', 'authenticated'
  from unnest(array['ADMIN', 'GESTORA', 'PEDRO', 'VICTOR', 'GERENCIA']) as n;
update perfis set papel = 'admin' where id = tests.u('ADMIN');

insert into atribuicoes (almox_id, usuario_id, funcao)
select tests.a(v.c), tests.u(v.u), v.f::funcao_atribuicao
  from (values ('211', 'GESTORA', 'responsavel'), ('211', 'GERENCIA', 'operador'),
               ('ITN', 'PEDRO', 'responsavel'), ('ITN', 'PEDRO', 'supervisor'),
               ('TRM', 'PEDRO', 'responsavel'), ('TRM', 'PEDRO', 'supervisor'),
               ('MNT', 'VICTOR', 'responsavel'), ('MNT', 'VICTOR', 'supervisor')) as v (c, u, f);

-- ---------------------------------------------------------------------
-- A. Usuário criado pela Edge Function: perfil a partir de app_metadata
-- ---------------------------------------------------------------------
insert into auth.users (id, email, raw_app_meta_data, aud, role)
select tests.u(v.u), lower(v.u) || '@colaborador.warefly.local',
       jsonb_build_object('nome', v.nome, 'matricula', v.mat, 'matricula_cemig', v.cemig, 'senha_inicial', true),
       'authenticated', 'authenticated'
  from (values ('E1', 'Eletricista Um',     '27630', 'E252135'),
               ('E2', 'Eletricista Dois',   '27631', 'e252136'),
               ('E3', 'Eletricista Três',   null,    ' e 252137 '),
               ('E4', 'Eletricista Quatro', '27633', 'e252138')) as v (u, nome, mat, cemig);
insert into auth.users (id, email, raw_app_meta_data, aud, role)
values (tests.u('SEMCEMIG'), 'semcemig@colaborador.warefly.local',
        '{"nome": "Sem Cemig", "matricula": "27634"}', 'authenticated', 'authenticated');

select is((tests.perfil('E1')).nome, 'Eletricista Um', 'nome vem de app_metadata');
select is((tests.perfil('E1')).matricula_cemig, 'e252135', 'matrícula CEMIG gravada em minúsculo');
select is((tests.perfil('E3')).matricula_cemig, 'e252137', 'espaços somem da matrícula');
select is((tests.perfil('E1')).papel, 'operador'::papel_usuario, 'colaborador nasce operador');
select ok((tests.perfil('E1')).deve_trocar_senha, 'nasce com a senha inicial pendente');
select ok((tests.perfil('E1')).senha_inicial_ate between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour',
  'senha inicial vale 7 dias');
select ok(not (tests.perfil('SEMCEMIG')).deve_trocar_senha, 'sem a marca, não precisa trocar');
select ok(not (tests.perfil('ADMIN')).deve_trocar_senha, 'usuário criado no painel não precisa trocar');

select throws_ok($$ insert into auth.users (id, email, raw_app_meta_data, aud, role)
                    values (gen_random_uuid(), 'dup@colaborador.warefly.local',
                            '{"nome": "Dup", "matricula_cemig": "E252135"}', 'authenticated', 'authenticated') $$,
  '23505', null, 'matrícula CEMIG repetida desfaz a criação do usuário');
select throws_ok($$ update perfis set matricula_cemig = '252135x' where id = tests.u('SEMCEMIG') $$,
  '23514', null, 'banco recusa matrícula CEMIG fora do formato');
select throws_ok($$ update perfis set matricula = 'abc' where id = tests.u('SEMCEMIG') $$,
  '23514', null, 'banco recusa matrícula Engelmig com letras');

-- Os eletricistas trocam a senha para seguir no resto da suíte
update perfis set deve_trocar_senha = false, senha_inicial_ate = null where id in (tests.u('E2'), tests.u('E3'), tests.u('E4'));

-- ---------------------------------------------------------------------
-- B. Senha inicial
-- ---------------------------------------------------------------------
select tests.como('E1');
select throws_like($$ select rpc_definir_supervisor_grupo(tests.g('Pedro'), null) $$,
  'Troque a senha inicial antes de continuar.', 'com a senha inicial pendente, nenhuma RPC roda');
select lives_ok($$ select rpc_concluir_troca_senha() $$, 'a própria pessoa conclui a troca');
reset role;
select ok(not (tests.perfil('E1')).deve_trocar_senha, 'troca concluída tira a pendência');
select is((tests.perfil('E1')).senha_inicial_ate, null, 'e limpa o prazo');

-- Prazo vencido
update perfis set deve_trocar_senha = true, senha_inicial_ate = now() - interval '1 minute' where id = tests.u('E4');
select tests.como('E4');
select throws_like($$ select rpc_concluir_troca_senha() $$,
  'Senha inicial expirada.%', 'senha inicial vencida não pode ser trocada pela pessoa');
reset role;

select tests.como('E2');
select throws_ok($$ select rpc_preparar_redefinicao_senha(tests.u('E3')) $$,
  '42501', null, 'eletricista não redefine acesso');
reset role;

select tests.como('GESTORA');
select lives_ok($$ select rpc_preparar_redefinicao_senha(tests.u('E4')) $$, 'gestora redefine o acesso');
reset role;
select ok((tests.perfil('E4')).deve_trocar_senha and (tests.perfil('E4')).senha_inicial_ate > now() + interval '6 days',
  'redefinir volta a pendência e reinicia o prazo');
update perfis set deve_trocar_senha = false, senha_inicial_ate = null where id = tests.u('E4');

-- ---------------------------------------------------------------------
-- C. Hook de token
-- ---------------------------------------------------------------------
select is(interno.fn_hook_token(jsonb_build_object('user_id', tests.u('E2'), 'claims', '{"sub": "x"}'::jsonb)),
  '{"claims": {"sub": "x"}}'::jsonb, 'hook libera quem está em dia');
update perfis set deve_trocar_senha = true, senha_inicial_ate = now() - interval '1 day' where id = tests.u('E3');
select is(interno.fn_hook_token(jsonb_build_object('user_id', tests.u('E3'), 'claims', '{}'::jsonb)) -> 'error' ->> 'message',
  'Senha inicial expirada. Peça ao almoxarifado para redefinir o seu acesso.', 'hook barra senha inicial vencida');
update perfis set deve_trocar_senha = true, senha_inicial_ate = now() + interval '1 day' where id = tests.u('E3');
select ok(interno.fn_hook_token(jsonb_build_object('user_id', tests.u('E3'), 'claims', '{}'::jsonb)) ? 'claims',
  'hook libera senha inicial dentro do prazo (o app pede a troca)');
update perfis set deve_trocar_senha = false, senha_inicial_ate = null where id = tests.u('E3');
update perfis set ativo = false where id = tests.u('SEMCEMIG');
select is(interno.fn_hook_token(jsonb_build_object('user_id', tests.u('SEMCEMIG'), 'claims', '{}'::jsonb)) -> 'error' ->> 'message',
  'Acesso desativado. Procure o almoxarifado.', 'hook barra inativo');
update perfis set ativo = true where id = tests.u('SEMCEMIG');

-- ---------------------------------------------------------------------
-- D. Login por matrícula: só o servidor resolve
-- ---------------------------------------------------------------------
select tests.como('E2');
select throws_ok($$ select rpc_email_para_login('27630') $$, '42501', null, 'usuário comum não resolve matrícula');
reset role;

select tests.como_servidor();
select is(rpc_email_para_login(' E252135 '), 'e1@colaborador.warefly.local', 'matrícula CEMIG em maiúsculo e com espaço');
select is(rpc_email_para_login('27630'), 'e1@colaborador.warefly.local', 'matrícula Engelmig');
select is(rpc_email_para_login('99999'), null, 'matrícula que não existe');
select is(rpc_email_para_login('e99999'), null, 'matrícula CEMIG que não existe');
select is(rpc_email_para_login(''), null, 'matrícula vazia');
reset role;

-- ---------------------------------------------------------------------
-- E. Cadastro de colaboradores: gestora e admin
-- ---------------------------------------------------------------------
select tests.como('PEDRO');
select throws_ok($$ select rpc_validar_colaborador('Novo', '30000', 'e300000') $$,
  '42501', null, 'supervisor não cadastra colaborador');
reset role;

select tests.como('GESTORA');
select is(rpc_validar_colaborador('  Novo   Colaborador ', ' 30000 ', 'E300000'),
  '{"nome": "Novo Colaborador", "papel": "operador", "matricula": "30000", "senha_inicial": true, "matricula_cemig": "e300000"}'::jsonb,
  'validação devolve os dados normalizados para app_metadata');
select throws_like($$ select rpc_validar_colaborador('Novo', null, null) $$,
  'Informe a matrícula Engelmig ou a matrícula CEMIG.%', 'precisa de uma matrícula');
select throws_like($$ select rpc_validar_colaborador('Novo', '30A00', null) $$,
  'A matrícula Engelmig 30A00 tem letras%', 'Engelmig só com números');
select throws_like($$ select rpc_validar_colaborador('Novo', null, '252135') $$,
  'A matrícula CEMIG 252135 não está no formato%', 'CEMIG começa com e');
select throws_like($$ select rpc_validar_colaborador('Novo', null, 'E252135') $$,
  'A matrícula CEMIG e252135 já é de Eletricista Um.', 'CEMIG repetida, mesmo em maiúsculo');
select throws_like($$ select rpc_validar_colaborador('Novo', '27631', null) $$,
  'A matrícula Engelmig 27631 já é de Eletricista Dois.', 'Engelmig repetida');
select throws_ok($$ select rpc_validar_colaborador('Novo', '30000', null, 'admin') $$,
  '42501', null, 'gestora não cria administrador');

select lives_ok($$ select rpc_salvar_colaborador(tests.u('E2'), 'Eletricista 2', '27631', 'E252136') $$,
  'gestora edita colaborador');
select throws_ok($$ select rpc_salvar_colaborador(tests.u('ADMIN'), 'Admin', null, null) $$,
  '42501', null, 'gestora não edita o administrador');
select throws_ok($$ select rpc_salvar_colaborador(tests.u('GERENCIA'), 'Gerência', '40000', null, true, 'gestao') $$,
  'P0001', 'O perfil Gerência não existe mais. Use operador e defina o acesso pelas atribuições.', 'papel gerência não existe mais');
select throws_ok($$ select rpc_salvar_colaborador(tests.u('E2'), 'Eletricista 2', '27631', 'e252136', true, 'admin') $$,
  '42501', null, 'gestora não muda o papel');
select throws_ok($$ select rpc_salvar_colaborador(tests.u('GESTORA'), 'Gestora', '41000', null) $$,
  '42501', null, 'gestora não edita o próprio cadastro (o admin edita)');
reset role;
select is((tests.perfil('E2')).nome, 'Eletricista 2', 'nome alterado');

select tests.como('ADMIN');
select lives_ok($$ select rpc_salvar_colaborador(tests.u('GERENCIA'), 'Gerência', '40000', null, true, 'operador') $$,
  'admin edita o operador do 211');
reset role;

-- ---------------------------------------------------------------------
-- F. Supervisor do grupo
-- ---------------------------------------------------------------------
select tests.como('GESTORA');
select throws_ok($$ select rpc_definir_supervisor_grupo(tests.g('Pedro'), tests.u('PEDRO')) $$,
  '42501', null, 'só o admin define o supervisor do grupo');
reset role;

select tests.como('ADMIN');
select lives_ok($$ select rpc_definir_supervisor_grupo(tests.g('Pedro'), tests.u('PEDRO')) $$, 'admin define Pedro');
select lives_ok($$ select rpc_definir_supervisor_grupo(tests.g('Victor'), tests.u('VICTOR')) $$, 'admin define Victor');
-- Equipes próprias da suíte: duas do Pedro, uma do Victor
select rpc_salvar_equipe(990001, 'ITN-01', 'Integrantes', 'F-1', tests.g('Pedro'));
select rpc_salvar_equipe(990002, 'ITN-02', 'Integrantes', 'F-2', tests.g('Pedro'));
select rpc_salvar_equipe(990003, 'MNT-01', 'Integrantes', 'F-3', tests.g('Victor'));
reset role;

-- ---------------------------------------------------------------------
-- G. Membros
-- ---------------------------------------------------------------------
select tests.como('PEDRO');
select lives_ok($$ select rpc_vincular_membro(tests.eq(990001), tests.u('E1')) $$, 'supervisor vincula na equipe dele');
select lives_ok($$ select rpc_vincular_membro(tests.eq(990001), tests.u('E2')) $$, 'segundo membro: dupla');
select throws_ok($$ select rpc_vincular_membro(tests.eq(990001), tests.u('E3')) $$,
  'WF001', 'Esta equipe vai ficar com 3 membros. O padrão é dupla. Confirme para continuar.',
  'terceiro membro pede confirmação');
select lives_ok($$ select rpc_vincular_membro(tests.eq(990001), tests.u('E3'), true) $$, 'com confirmação, entra');
select throws_ok($$ select rpc_vincular_membro(tests.eq(990003), tests.u('E4')) $$,
  '42501', null, 'supervisor não mexe em equipe de outro grupo');
select throws_like($$ select rpc_vincular_membro(tests.eq(990002), tests.u('SEMCEMIG')) $$,
  'Sem Cemig não tem matrícula CEMIG.%', 'membro precisa de matrícula CEMIG');
select throws_like($$ select rpc_vincular_membro(tests.eq(990001), tests.u('E1')) $$,
  'Eletricista Um já está nesta equipe.', 'não vincula duas vezes');
reset role;

select is((select membros from v_equipes_membros where equipe_id = tests.eq(990001)), 3, 'equipe com 3 membros');
select ok((select acima_do_limite from v_equipes_membros where equipe_id = tests.eq(990001)), 'acima do limite: alerta');

-- Mudar de equipe dentro do grupo
select tests.como('PEDRO');
select lives_ok($$ select rpc_vincular_membro(tests.eq(990002), tests.u('E3')) $$, 'supervisor muda membro de equipe no grupo dele');
reset role;
select is(tests.equipe_de('E3'), 990002, 'E3 agora na outra equipe');
select is((select count(*) from equipe_membros where colaborador_id = tests.u('E3'))::int, 2, 'histórico guarda a equipe anterior');
select ok(not (select acima_do_limite from v_equipes_membros where equipe_id = tests.eq(990001)), 'voltou à dupla: sem alerta');

-- Entre grupos: só a gestão
select tests.como('VICTOR');
select throws_like($$ select rpc_vincular_membro(tests.eq(990003), tests.u('E1')) $$,
  'Eletricista Um está na equipe 990001 (ITN-01), de outro grupo.%', 'supervisor não puxa membro de outro grupo');
reset role;
select tests.como('GESTORA');
select lives_ok($$ select rpc_vincular_membro(tests.eq(990003), tests.u('E1')) $$, 'gestora muda entre grupos');
reset role;
select is(tests.equipe_de('E1'), 990003, 'E1 agora no grupo do Victor');

-- Desvincular
select tests.como('PEDRO');
select lives_ok($$ select rpc_desvincular_membro(tests.eq(990002), tests.u('E3')) $$, 'supervisor desvincula');
select throws_like($$ select rpc_desvincular_membro(tests.eq(990002), tests.u('E3')) $$,
  'Este colaborador não está na equipe%', 'desvincular quem não está');
reset role;

-- ---------------------------------------------------------------------
-- H. Visibilidade
-- ---------------------------------------------------------------------
-- Situação: 990001 = E2 · 990002 = ninguém · 990003 = E1 · livres: E3, E4
select tests.como('PEDRO');
select set_eq($$ select nome from v_colaboradores $$,
  array['PEDRO', 'Eletricista 2', 'Eletricista Três', 'Eletricista Quatro'],
  'supervisor vê a si, os membros das equipes dele e quem está livre com matrícula CEMIG');
select set_eq($$ select e.codigo_zeus from equipe_membros m join equipes e on e.id = m.equipe_id
                  where m.colaborador_id = tests.u('E1') $$, array[990001],
  'supervisor vê o histórico das equipes dele, não a equipe atual em outro grupo');
reset role;

select tests.como('E2');
select set_eq($$ select nome from v_colaboradores $$, array['Eletricista 2'], 'membro sozinho vê só a si');
select ok(fn_pode_ver_equipe(tests.eq(990001)), 'membro vê a própria equipe');
select ok(not fn_pode_ver_equipe(tests.eq(990003)), 'membro não vê equipe de outro grupo');
reset role;

select tests.como('GERENCIA');
select ok((select count(*) from v_colaboradores) >= 10, 'operador do 211 vê todos');
reset role;

select ok(not exists (select 1 from information_schema.columns
                       where table_name = 'v_colaboradores' and column_name = 'email'),
  'v_colaboradores não expõe e-mail');

-- ---------------------------------------------------------------------
-- I. Inativar: colaborador sai da equipe; equipe inativa fica sem membros
-- ---------------------------------------------------------------------
select tests.como('GESTORA');
select lives_ok($$ select rpc_salvar_colaborador(tests.u('E2'), 'Eletricista 2', '27631', 'e252136', false) $$,
  'gestora inativa colaborador');
reset role;
select is(tests.equipe_de('E2'), null, 'inativo sai da equipe');

select tests.como('ADMIN');
select rpc_vincular_membro(tests.eq(990002), tests.u('E4'));
select rpc_ativar_equipe(tests.eq(990002), false);
reset role;
select is(tests.equipe_de('E4'), null, 'equipe inativada fica sem membros');

select tests.como('PEDRO');
select throws_like($$ select rpc_vincular_membro(tests.eq(990002), tests.u('E3')) $$,
  'A equipe 990002 (ITN-02) está inativa.%', 'não vincula em equipe inativa');
reset role;

-- ---------------------------------------------------------------------
-- J. Exclusão
-- ---------------------------------------------------------------------
insert into auth.users (id, email, raw_app_meta_data, aud, role)
values ('00000000-0000-4000-a000-0000000000d1', 'novo@colaborador.warefly.local',
        '{"nome": "Nunca Usado", "matricula": "50000"}', 'authenticated', 'authenticated');

select tests.como('GESTORA');
select lives_ok($$ select rpc_preparar_exclusao_colaborador('00000000-0000-4000-a000-0000000000d1') $$,
  'quem nunca foi usado pode ser excluído');
select throws_like($$ select rpc_preparar_exclusao_colaborador(tests.u('E4')) $$,
  'Eletricista Quatro já tem registros no sistema e não pode ser excluído. Inative o colaborador.',
  'quem já esteve em equipe não é excluído');
select throws_like($$ select rpc_preparar_exclusao_colaborador(tests.u('GESTORA')) $$,
  'Você não pode excluir o seu próprio acesso.', 'ninguém exclui a si mesmo');
reset role;

-- ---------------------------------------------------------------------
-- K. Configurações
-- ---------------------------------------------------------------------
select tests.como('GESTORA');
select throws_ok($$ select rpc_salvar_configuracao('limite_membros_equipe', 3) $$, '42501', null, 'gestora não altera configuração');
reset role;
select tests.como('ADMIN');
select throws_like($$ select rpc_salvar_configuracao('limite_membros_equipe', 0) $$, 'Informe um valor maior que zero.', 'valor positivo');
select throws_like($$ select rpc_salvar_configuracao('nao_existe', 1) $$, 'Configuração nao_existe não existe.', 'chave desconhecida');
select lives_ok($$ select rpc_salvar_configuracao('limite_membros_equipe', 3) $$, 'admin muda o limite');
reset role;
select is((select limite from v_equipes_membros where equipe_id = tests.eq(990001)), 3, 'limite novo vale na hora');

select tests.como('ADMIN');
select throws_ok($$ insert into equipe_membros (equipe_id, colaborador_id) values (tests.eq(990001), tests.u('E3')) $$,
  '42501', null, 'membro não é gravado direto na tabela');
reset role;

select * from finish();
rollback;
