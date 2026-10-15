-- =====================================================================
-- Warefly · Guias assinadas e inventário (15/10/2026)
-- Bucket guias, guias_assinadas, cadastro rápido de material e implantação
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

-- Arquivo no bucket guias (como o upload do app deixaria)
create function tests.guia(t text, doc uuid, ext text default 'jpg') returns text language plpgsql security definer as $$
declare n text := t || '/' || doc || '/' || gen_random_uuid() || '.' || ext;
begin
  insert into storage.objects (bucket_id, name) values ('guias', n);
  return n;
end $$;
grant execute on function tests.guia(text, uuid, text) to authenticated;

-- Remessa de MNT para ITB (mesmo grupo) e retirada da equipe em MNT
select tests.como('VICTOR');
with r as (select rpc_criar_remessa_avulsa('transferencia', tests.a('MNT'), tests.a('ITB'), tests.j('[{"material_id":"PARAF","qtd_enviada":5}]')) as id)
insert into tests.ctx select 'rem', id from r;
with s as (select rpc_registrar_saida(tests.a('MNT'), tests.j('[{"material_id":"PARAF","quantidade":2}]'), 'aplicacao', null, null, null, null,
                                       tests.eq(970001), 'Integrante A') as id)
insert into tests.ctx select 'sai', id from s;
reset role;

-- ---------------------------------------------------------------------
-- A. Bucket
-- ---------------------------------------------------------------------
select is((select file_size_limit from storage.buckets where id = 'guias'), 10485760::bigint, 'bucket guias aceita até 10 MB');
select ok((select not public from storage.buckets where id = 'guias'), 'bucket guias é privado');
select ok((select allowed_mime_types @> array['image/jpeg', 'application/pdf'] from storage.buckets where id = 'guias'),
  'bucket guias aceita foto e PDF');

select is((fn_caminho_guia('saida/' || gen_random_uuid() || '/' || gen_random_uuid() || '.pdf')).tipo, 'saida', 'caminho válido de saída');
select is((fn_caminho_guia('remessa/' || gen_random_uuid() || '/' || gen_random_uuid() || '.jpg')).tipo, 'remessa', 'caminho válido de remessa');
select ok((fn_caminho_guia('outro/' || gen_random_uuid() || '/x.jpg')).tipo is null, 'caminho fora do padrão é recusado');
select ok((fn_caminho_guia('saida/' || gen_random_uuid() || '/' || gen_random_uuid() || '.exe')).tipo is null, 'extensão fora da lista é recusada');

-- Upload pela política
select tests.como('VICTOR');
select lives_ok(format($$ insert into storage.objects (bucket_id, name) values ('guias', 'saida/%s/%s.jpg') $$, tests.id('sai'), gen_random_uuid()),
  'supervisor envia a guia da retirada da base dele');
select lives_ok(format($$ insert into storage.objects (bucket_id, name) values ('guias', 'remessa/%s/%s.pdf') $$, tests.id('rem'), gen_random_uuid()),
  'supervisor envia a guia do despacho entre as bases dele');
reset role;
select tests.como('VINI');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('guias', 'saida/%s/%s.jpg') $$, tests.id('sai'), gen_random_uuid()),
  '42501', null, 'supervisor de outro grupo não envia guia');
select is((select count(*) from storage.objects where bucket_id = 'guias')::int, 0, 'supervisor de outro grupo não vê as guias');
reset role;
select tests.como('E1');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('guias', 'saida/%s/%s.jpg') $$, tests.id('sai'), gen_random_uuid()),
  '42501', null, 'equipe não envia guia');
reset role;
select tests.como('OP211');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('guias', 'saida/%s/%s.jpg') $$, tests.id('sai'), gen_random_uuid()),
  '42501', null, 'operador do 211 não envia guia de retirada na base');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('guias', 'remessa/%s/%s.jpg') $$, tests.id('rem'), gen_random_uuid()),
  '42501', null, 'operador do 211 não envia guia de despacho entre bases');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('guias', 'remessa/%s/foto.jpg') $$, tests.id('rem')),
  '42501', null, 'nome de arquivo fora do padrão é recusado');
reset role;
select tests.como('GESTORA');
select lives_ok(format($$ insert into storage.objects (bucket_id, name) values ('guias', 'remessa/%s/%s.jpg') $$, tests.id('rem'), gen_random_uuid()),
  'gestora envia guia de qualquer documento');
reset role;
select tests.como('VICTOR');
select is((select count(*) from storage.objects where bucket_id = 'guias')::int, 3, 'supervisor vê as guias dos documentos dele');
reset role;

-- ---------------------------------------------------------------------
-- B. rpc_registrar_guia
-- ---------------------------------------------------------------------
insert into tests.ctx values ('x', gen_random_uuid());
select tests.como('VICTOR');
select lives_ok(format($$ select rpc_registrar_guia('saida', %L, %L) $$, tests.id('sai'), tests.guia('saida', tests.id('sai'))),
  'supervisor registra a guia da retirada');
select lives_ok(format($$ select rpc_registrar_guia('remessa', %L, %L) $$, tests.id('rem'), tests.guia('remessa', tests.id('rem'), 'pdf')),
  'supervisor registra a guia do despacho');
select throws_like(format($$ select rpc_registrar_guia('saida', %L, %L) $$, tests.id('sai'), 'saida/' || tests.id('sai') || '/' || gen_random_uuid() || '.jpg'),
  '%não encontrada no armazenamento%', 'arquivo que não subiu é recusado');
select throws_like(format($$ select rpc_registrar_guia('saida', %L, %L) $$, tests.id('sai'), tests.guia('remessa', tests.id('rem'))),
  '%pasta do documento%', 'arquivo de outro documento é recusado');
select throws_like($$ select rpc_registrar_guia('pedido', tests.id('sai'), 'x') $$, '%Tipo de documento inválido%', 'tipo inválido');
select throws_like($$ select rpc_registrar_guia('saida', tests.id('x'), 'x') $$, '%Retirada não encontrada%', 'retirada inexistente');
reset role;
select tests.como('VINI');
select throws_ok(format($$ select rpc_registrar_guia('saida', %L, %L) $$, tests.id('sai'), tests.guia('saida', tests.id('sai'))),
  '42501', null, 'supervisor de outro grupo não registra guia');
reset role;
select tests.como('GESTORA');
select lives_ok(format($$ select rpc_registrar_guia('saida', %L, %L) $$, tests.id('sai'), tests.guia('saida', tests.id('sai'), 'png')),
  'gestora registra outra guia (a mais recente vale)');
reset role;

select is((select formato from guias_assinadas where remessa_id = tests.id('rem')), 'pdf', 'formato pdf gravado');
select is((select count(*) from guias_assinadas where saida_id = tests.id('sai'))::int, 2, 'histórico guarda as duas guias da retirada');

select tests.como('VICTOR');
select is((select count(*) from guias_assinadas)::int, 3, 'supervisor vê as guias dos documentos dele');
select throws_ok($$ delete from guias_assinadas $$, '42501', null, 'guia não é apagada');
select throws_ok($$ insert into guias_assinadas (saida_id, caminho, formato, anexado_por) values (tests.id('sai'), 'x', 'foto', tests.u('VICTOR')) $$,
  '42501', null, 'guia só entra por RPC');
reset role;
select tests.como('VINI');
select is((select count(*) from guias_assinadas)::int, 0, 'supervisor de outro grupo não vê as guias');
reset role;

-- ---------------------------------------------------------------------
-- C. Inventário: implantação e cadastro rápido
-- ---------------------------------------------------------------------
select tests.como('GESTORA');
select ok(not fn_em_implantacao(tests.a('MNT')), 'base que já operou: contagem entra como inventário');
select ok(fn_em_implantacao(tests.a('CRC')), 'base sem movimento está em implantação');
select lives_ok($$ insert into tests.ctx select 'novo', rpc_cadastrar_material_rapido('  9001 ', 'luva isolante', 'PC') $$,
  'gestora cadastra material no inventário');
select is((select descricao from materiais where id = tests.id('novo')), 'LUVA ISOLANTE', 'descrição em maiúsculas');
select is(rpc_cadastrar_material_rapido('9001', 'Outra descrição', 'PC'), tests.id('novo'), 'mesmo código devolve o material existente');
select throws_like($$ select rpc_cadastrar_material_rapido('9002', 'Fita', 'XX') $$, '%unidade da lista%', 'unidade fora da lista');
select throws_like($$ select rpc_cadastrar_material_rapido('', 'Fita', 'PC') $$, '%código SAP%', 'código obrigatório');
select throws_like($$ select rpc_cadastrar_material_rapido('9003', ' ', 'PC') $$, '%descrição%', 'descrição obrigatória');
select lives_ok($$ select rpc_registrar_ajuste(tests.a('CRC'), 'implantacao', 'Dia D CRC', jsonb_build_array(jsonb_build_object('material_id', tests.id('novo'), 'qtd_contada', 12))) $$,
  'gestora lança a contagem do dia D na base com o material novo');
select lives_ok($$ select rpc_registrar_ajuste(tests.a('CRC'), 'implantacao', 'Dia D CRC, segunda parte', jsonb_build_array(jsonb_build_object('material_id', tests.id('novo'), 'qtd_contada', 15))) $$,
  'contagem em partes no mesmo local corrige o saldo inicial');
reset role;
select is((select coalesce(sum(quantidade), 0) from movimentacoes where almox_id = tests.a('CRC') and material_id = tests.id('novo')), 15.000, 'saldo é o da última contagem');

select tests.como('ADMIN');
select lives_ok($$ select rpc_cadastrar_material_rapido('9004', 'Fita isolante', 'PC') $$, 'admin cadastra material no inventário');
reset role;
select tests.como('OP211');
select throws_ok($$ select rpc_cadastrar_material_rapido('9005', 'Fita', 'PC') $$, '42501', null, 'operador do 211 não cadastra material');
reset role;
select tests.como('VICTOR');
select throws_ok($$ select rpc_cadastrar_material_rapido('9006', 'Fita', 'PC') $$, '42501', null, 'supervisor não cadastra material');
reset role;

select * from finish();
rollback;
