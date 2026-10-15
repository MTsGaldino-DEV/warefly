-- =====================================================================
-- Warefly · Equipes por grupo de supervisor e locais liberados por equipe
-- Spec: docs/superpowers/specs/2026-10-13-equipes-por-grupo-design.md
--
-- Grupo = supervisor responsável (ou a moto). Dá o dono da equipe e os
-- locais padrão. Cada equipe tem a própria lista de locais liberados
-- (equipe_locais), que nasce igual à do grupo e a gestão do almoxarifado
-- pode editar. Todas as equipes retiram no 211 Geral, mas só a gestão vê
-- o estoque dele.
-- Toda escrita em equipes, grupos e locais passa por RPC.
-- =====================================================================

create type public.tipo_equipe as enum ('multifuncional', 'moto');

-- ---------------------------------------------------------------------
-- grupos
-- ---------------------------------------------------------------------
create table public.grupos (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  tipo_equipe     public.tipo_equipe not null default 'multifuncional',
  chave_planilha  text,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  constraint grupos_nome_ck check (nome = btrim(nome) and nome <> ''),
  constraint grupos_chave_ck check (chave_planilha is null or (chave_planilha = btrim(chave_planilha) and chave_planilha <> ''))
);

create unique index grupos_nome_uk on public.grupos (lower(nome));
create unique index grupos_chave_uk on public.grupos (lower(chave_planilha));

comment on column public.grupos.chave_planilha is
  'Texto da coluna "supervisor" da planilha de equipes que cai neste grupo.';

-- Locais padrão do grupo: a equipe nova nasce liberada neles
create table public.grupo_locais (
  grupo_id  uuid not null references public.grupos (id),
  almox_id  uuid not null references public.almoxarifados (id),
  primary key (grupo_id, almox_id)
);

create index grupo_locais_almox_idx on public.grupo_locais (almox_id);

-- Local de retirada nunca é o externo
create or replace function interno.tg_local_retirada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.almoxarifados where id = new.almox_id and tipo = 'externo') then
    raise exception 'O almoxarifado externo não é local de retirada de equipe. Escolha o 211 Geral ou as bases.';
  end if;
  return new;
end;
$$;

create trigger grupo_locais_regras
  before insert or update on public.grupo_locais
  for each row execute function interno.tg_local_retirada();

-- ---------------------------------------------------------------------
-- equipes: sai a base fixa, entram grupo, Zeus, frota e integrantes
-- ---------------------------------------------------------------------
drop policy equipes_select on public.equipes;
drop policy equipes_insert on public.equipes;
drop policy equipes_update on public.equipes;

alter table public.equipes
  add column grupo_id     uuid references public.grupos (id),
  add column codigo_zeus  integer,
  add column frota        text,
  add column integrantes  text,
  add constraint equipes_zeus_ck check (codigo_zeus is null or codigo_zeus > 0),
  add constraint equipes_frota_ck check (frota is null or (frota = btrim(frota) and frota <> '')),
  add constraint equipes_integrantes_ck check (integrantes is null or (integrantes = btrim(integrantes) and integrantes <> ''));

create unique index equipes_zeus_uk on public.equipes (codigo_zeus);
create index equipes_grupo_idx on public.equipes (grupo_id);

-- Locais liberados por equipe
create table public.equipe_locais (
  equipe_id     uuid not null references public.equipes (id),
  almox_id      uuid not null references public.almoxarifados (id),
  liberado_por  uuid default auth.uid() references public.perfis (id),
  liberado_em   timestamptz not null default now(),
  primary key (equipe_id, almox_id)
);

create index equipe_locais_almox_idx on public.equipe_locais (almox_id);

create trigger equipe_locais_regras
  before insert or update on public.equipe_locais
  for each row execute function interno.tg_local_retirada();

-- Equipes cadastradas na mão numa base (só existem em banco local de
-- desenvolvimento): a base vira local liberado e a equipe fica inativa
-- até alguém completar o cadastro.
insert into public.equipe_locais (equipe_id, almox_id, liberado_por)
select id, almox_id, criado_por from public.equipes where almox_id is not null;

alter table public.equipes disable trigger equipes_regras;
update public.equipes set ativa = false where codigo_zeus is null and ativa;
alter table public.equipes enable trigger equipes_regras;

alter table public.equipes drop column almox_id;

-- Equipe ativa tem o cadastro completo
alter table public.equipes
  add constraint equipes_cadastro_completo_ck check (
    not ativa or num_nonnulls(grupo_id, codigo_zeus, frota, integrantes) = 4
  );

comment on column public.equipes.nome is 'Descrição da equipe no Zeus (coluna DESCRIÇÃO da planilha).';
comment on column public.equipes.integrantes is 'Quem compõe a equipe (coluna "equipe" da planilha).';

-- Rótulo usado nas mensagens: Zeus e descrição
create or replace function interno.fn_equipe_rotulo(p_equipe public.equipes)
returns text
language sql
immutable
set search_path = ''
as $$ select coalesce(p_equipe.codigo_zeus::text || ' (' || p_equipe.nome || ')', p_equipe.nome) $$;

-- Regras da equipe: ativa só com cadastro completo; Zeus fixo depois de
-- ter saída. A descrição pode mudar (a identidade é o Zeus).
create or replace function interno.tg_equipe()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.ativa and num_nonnulls(new.grupo_id, new.codigo_zeus, new.frota, new.integrantes) < 4 then
    raise exception 'Para ativar a equipe %, preencha código Zeus, descrição, integrantes, frota e grupo.', new.nome;
  end if;
  if tg_op = 'UPDATE' and new.codigo_zeus is distinct from old.codigo_zeus
     and exists (select 1 from public.saidas where equipe_id = old.id) then
    raise exception 'A equipe % já tem saídas registradas e não pode mudar de código Zeus.', interno.fn_equipe_rotulo(old);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Leitura: gestão vê todas; os outros, as equipes liberadas em algum
-- local que eles veem (o supervisor não vê o 211, então vê as equipes
-- liberadas nas bases dele, inclusive motos)
-- ---------------------------------------------------------------------
create or replace function public.fn_pode_ver_equipe(p_equipe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.fn_eh_gestora() or public.fn_eh_admin() or public.fn_eh_gestao()
      or exists (
        select 1 from public.equipe_locais el
         where el.equipe_id = p_equipe_id and public.fn_pode_ver(el.almox_id)
      )
$$;

create policy equipes_select on public.equipes
  for select to authenticated using (public.fn_pode_ver_equipe(id));

alter table public.equipe_locais enable row level security;
create policy equipe_locais_select on public.equipe_locais
  for select to authenticated using (public.fn_pode_ver_equipe(equipe_id));

alter table public.grupos enable row level security;
alter table public.grupo_locais enable row level security;
create policy grupos_select on public.grupos for select to authenticated using (true);
create policy grupo_locais_select on public.grupo_locais for select to authenticated using (true);

revoke all on public.equipes, public.equipe_locais, public.grupos, public.grupo_locais from anon, authenticated;
grant select on public.equipes, public.equipe_locais, public.grupos, public.grupo_locais to authenticated;

-- ---------------------------------------------------------------------
-- Seed: um grupo por supervisor e o da moto. Todo grupo retira no 211
-- Geral; a moto, por enquanto, no 211 e em todas as bases.
-- ---------------------------------------------------------------------
insert into public.grupos (nome, tipo_equipe, chave_planilha) values
  ('Pedro',    'multifuncional', 'Pedro'),
  ('Vinícius', 'multifuncional', 'Vinicius'),
  ('Victor',   'multifuncional', 'Victor'),
  ('Elton',    'multifuncional', 'Elton'),
  ('Kesia',    'moto',           'Kesia');

insert into public.grupo_locais (grupo_id, almox_id)
select g.id, a.id
  from (values
    ('Pedro',    '211'), ('Pedro',    'ITN'), ('Pedro',    'TRM'),
    ('Vinícius', '211'), ('Vinícius', 'RSP'), ('Vinícius', 'AIM'), ('Vinícius', 'CPN'),
    ('Victor',   '211'), ('Victor',   'MNT'), ('Victor',   'ITB'), ('Victor',   'CRC'),
    ('Elton',    '211'), ('Elton',    'SMS'), ('Elton',    'SJE'), ('Elton',    'SEF')
  ) as v (grupo, codigo)
  join public.grupos g on g.nome = v.grupo
  join public.almoxarifados a on a.codigo = v.codigo;

insert into public.grupo_locais (grupo_id, almox_id)
select g.id, a.id
  from public.grupos g
  join public.almoxarifados a on a.codigo = '211' or a.tipo = 'base'
 where g.nome = 'Kesia'
   and (a.codigo = '211' or a.pai_id = (select id from public.almoxarifados where codigo = '211'));

-- ---------------------------------------------------------------------
-- Auxiliares das RPCs
-- ---------------------------------------------------------------------
create or replace function interno.fn_exigir_gestao_equipes()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform interno.fn_usuario();
  if not (public.fn_eh_gestora() or public.fn_eh_admin()) then
    raise exception 'Só a gestão do almoxarifado e o administrador mantêm as equipes.' using errcode = '42501';
  end if;
end;
$$;

-- Troca os locais liberados da equipe pela lista dada
create or replace function interno.fn_gravar_locais_equipe(p_equipe_id uuid, p_locais uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_local uuid;
begin
  if exists (select 1 from public.almoxarifados where id = any (p_locais) and tipo = 'externo') then
    raise exception 'O almoxarifado externo não é local de retirada de equipe. Escolha o 211 Geral ou as bases.';
  end if;
  -- A gestora só libera locais que ela gere; o admin, qualquer um
  if not public.fn_eh_admin() then
    for v_local in select l from unnest(p_locais) as l loop
      if not public.fn_gere_local(v_local) then
        raise exception 'Você não gere % e não pode liberar este local para a equipe.',
          coalesce(interno.fn_almox_nome(v_local), 'o local escolhido') using errcode = '42501';
      end if;
    end loop;
  end if;

  delete from public.equipe_locais
   where equipe_id = p_equipe_id and almox_id <> all (p_locais);
  insert into public.equipe_locais (equipe_id, almox_id)
  select p_equipe_id, l from unnest(p_locais) as l
  on conflict do nothing;
exception
  when foreign_key_violation then
    raise exception 'Um dos locais escolhidos não existe.';
end;
$$;

create or replace function interno.fn_locais_do_grupo(p_grupo_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$ select coalesce(array_agg(almox_id), '{}') from public.grupo_locais where grupo_id = p_grupo_id $$;

-- ---------------------------------------------------------------------
-- rpc_salvar_grupo: o admin cria ou altera um grupo e os locais padrão.
-- Não mexe nos locais das equipes já cadastradas.
-- ---------------------------------------------------------------------
create or replace function public.rpc_salvar_grupo(
  p_nome            text,
  p_tipo_equipe     public.tipo_equipe,
  p_locais          uuid[],
  p_chave_planilha  text default null,
  p_ativo           boolean default true,
  p_id              uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome  text := interno.fn_texto(p_nome);
  v_chave text := interno.fn_texto(p_chave_planilha);
  v_id    uuid;
begin
  perform interno.fn_usuario();
  if not public.fn_eh_admin() then
    raise exception 'Só o administrador mantém os grupos de equipes.' using errcode = '42501';
  end if;
  if v_nome is null then
    raise exception 'Informe o nome do grupo.';
  end if;
  if p_tipo_equipe is null then
    raise exception 'Informe o tipo das equipes do grupo (multifuncional ou moto).';
  end if;
  if coalesce(p_ativo, true) and coalesce(cardinality(p_locais), 0) = 0 then
    raise exception 'Escolha ao menos um local onde as equipes do grupo retiram material.';
  end if;

  if p_id is null then
    insert into public.grupos (nome, tipo_equipe, chave_planilha, ativo)
    values (v_nome, p_tipo_equipe, v_chave, coalesce(p_ativo, true))
    returning id into v_id;
  else
    update public.grupos
       set nome = v_nome, tipo_equipe = p_tipo_equipe, chave_planilha = v_chave, ativo = coalesce(p_ativo, true)
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Grupo não encontrado.';
    end if;
  end if;

  delete from public.grupo_locais
   where grupo_id = v_id and almox_id <> all (coalesce(p_locais, '{}'));
  insert into public.grupo_locais (grupo_id, almox_id)
  select v_id, l from unnest(coalesce(p_locais, '{}')) as l
  on conflict do nothing;

  return v_id;
exception
  when unique_violation then
    raise exception 'Já existe um grupo com este nome ou com esta chave da planilha.' using errcode = '23505';
  when foreign_key_violation then
    raise exception 'Um dos locais escolhidos não existe.';
end;
$$;

-- ---------------------------------------------------------------------
-- rpc_salvar_equipe: cadastro ou alteração pela tela. Tudo obrigatório.
-- p_locais nulo: equipe nova nasce com os locais do grupo; na alteração,
-- os locais ficam como estão, a não ser que o grupo mude (aí voltam ao
-- padrão do grupo novo).
-- ---------------------------------------------------------------------
create or replace function public.rpc_salvar_equipe(
  p_codigo_zeus  integer,
  p_nome         text,
  p_integrantes  text,
  p_frota        text,
  p_grupo_id     uuid,
  p_locais       uuid[] default null,
  p_ativa        boolean default true,
  p_id           uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome        text := interno.fn_texto(regexp_replace(p_nome, '\s+', ' ', 'g'));
  v_integrantes text := interno.fn_texto(regexp_replace(p_integrantes, '\s+', ' ', 'g'));
  v_frota       text := interno.fn_texto(p_frota);
  v_atual       public.equipes;
  v_id          uuid;
  v_locais      uuid[] := p_locais;
begin
  perform interno.fn_exigir_gestao_equipes();

  if p_codigo_zeus is null or p_codigo_zeus <= 0 then
    raise exception 'Informe o código Zeus da equipe.';
  end if;
  if v_nome is null then
    raise exception 'Informe a descrição da equipe.';
  end if;
  if v_integrantes is null then
    raise exception 'Informe os integrantes da equipe.';
  end if;
  if v_frota is null then
    raise exception 'Informe a frota da equipe.';
  end if;
  if p_grupo_id is null or not exists (select 1 from public.grupos where id = p_grupo_id and ativo) then
    raise exception 'Escolha o grupo (supervisor) da equipe.';
  end if;
  if v_locais is not null and cardinality(v_locais) = 0 then
    raise exception 'Libere ao menos um local para a equipe retirar material.';
  end if;

  if p_id is null then
    insert into public.equipes (codigo_zeus, nome, integrantes, frota, grupo_id, ativa)
    values (p_codigo_zeus, v_nome, v_integrantes, v_frota, p_grupo_id, coalesce(p_ativa, true))
    returning id into v_id;
    v_locais := coalesce(v_locais, interno.fn_locais_do_grupo(p_grupo_id));
  else
    select * into v_atual from public.equipes where id = p_id for update;
    if not found then
      raise exception 'Equipe não encontrada.';
    end if;
    update public.equipes
       set codigo_zeus = p_codigo_zeus, nome = v_nome, integrantes = v_integrantes,
           frota = v_frota, grupo_id = p_grupo_id, ativa = coalesce(p_ativa, true)
     where id = p_id
    returning id into v_id;
    if v_locais is null and v_atual.grupo_id is distinct from p_grupo_id then
      v_locais := interno.fn_locais_do_grupo(p_grupo_id);
    end if;
  end if;

  if v_locais is not null then
    perform interno.fn_gravar_locais_equipe(v_id, v_locais);
  end if;

  return v_id;
exception
  when unique_violation then
    raise exception 'Já existe uma equipe com o código Zeus %.', p_codigo_zeus using errcode = '23505';
end;
$$;

-- ---------------------------------------------------------------------
-- rpc_definir_locais_equipe: a gestão libera ou tira locais de uma equipe
-- (ex.: moto que passa a retirar numa base)
-- ---------------------------------------------------------------------
create or replace function public.rpc_definir_locais_equipe(p_equipe_id uuid, p_locais uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform interno.fn_exigir_gestao_equipes();
  if not exists (select 1 from public.equipes where id = p_equipe_id) then
    raise exception 'Equipe não encontrada.';
  end if;
  if coalesce(cardinality(p_locais), 0) = 0 then
    raise exception 'Libere ao menos um local para a equipe retirar material.';
  end if;
  perform interno.fn_gravar_locais_equipe(p_equipe_id, p_locais);
end;
$$;

-- ---------------------------------------------------------------------
-- rpc_ativar_equipe: ativa ou inativa sem mexer no resto
-- ---------------------------------------------------------------------
create or replace function public.rpc_ativar_equipe(p_equipe_id uuid, p_ativa boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform interno.fn_exigir_gestao_equipes();
  update public.equipes set ativa = coalesce(p_ativa, false) where id = p_equipe_id;
  if not found then
    raise exception 'Equipe não encontrada.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- rpc_importar_equipes: concilia a planilha pelo código Zeus
--
-- p_linhas: [{zeus, descricao, supervisor, integrantes, frota, problema}]
--   Linha com problema (informado pela tela ou cadastro incompleto) entra
--   ou fica inativa.
-- p_simular: só calcula a conciliação, sem gravar.
-- Equipe nova nasce com os locais do grupo. Equipe que troca de grupo
-- volta aos locais do grupo novo; nas outras, os locais liberados à mão
-- são mantidos.
-- Retorna {novas, alteradas, sem_mudanca, inativadas, com_problema}.
-- ---------------------------------------------------------------------
create or replace function public.rpc_importar_equipes(p_linhas jsonb, p_simular boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linha       record;
  v_grupo       uuid;
  v_atual       public.equipes;
  v_ativa       boolean;
  v_nome        text;
  v_integrantes text;
  v_frota       text;
  v_id          uuid;
  v_zeus        integer[] := '{}';
  v_novas       jsonb := '[]';
  v_alteradas   jsonb := '[]';
  v_iguais      jsonb := '[]';
  v_inativadas  jsonb := '[]';
  v_problema    jsonb := '[]';
begin
  perform interno.fn_exigir_gestao_equipes();
  if p_linhas is null or jsonb_typeof(p_linhas) <> 'array' or jsonb_array_length(p_linhas) = 0 then
    raise exception 'A planilha não tem nenhuma equipe. Confira a aba e as colunas e importe de novo.';
  end if;

  perform pg_advisory_xact_lock(hashtext('warefly:importar_equipes'));

  for v_linha in
    select x.zeus, x.descricao, x.supervisor, x.integrantes, x.frota, x.problema, x.ordem
      from rows from (
             jsonb_to_recordset(p_linhas)
               as (zeus integer, descricao text, supervisor text, integrantes text, frota text, problema text)
           ) with ordinality as x (zeus, descricao, supervisor, integrantes, frota, problema, ordem)
     order by x.ordem
  loop
    if v_linha.zeus is null or v_linha.zeus <= 0 then
      raise exception 'Linha % da planilha sem código Zeus válido. Corrija a planilha e importe de novo.', v_linha.ordem;
    end if;
    if v_linha.zeus = any (v_zeus) then
      raise exception 'O código Zeus % aparece mais de uma vez na planilha. Deixe uma linha só e importe de novo.', v_linha.zeus;
    end if;
    v_zeus := v_zeus || v_linha.zeus;

    v_nome := coalesce(interno.fn_texto(regexp_replace(v_linha.descricao, '\s+', ' ', 'g')), 'Zeus ' || v_linha.zeus);
    v_integrantes := interno.fn_texto(regexp_replace(v_linha.integrantes, '\s+', ' ', 'g'));
    v_frota := interno.fn_texto(v_linha.frota);

    v_grupo := null;
    select g.id into v_grupo
      from public.grupos g
     where g.ativo and lower(g.chave_planilha) = lower(interno.fn_texto(v_linha.supervisor));

    if interno.fn_texto(v_linha.problema) is not null
       or interno.fn_texto(v_linha.supervisor) is null
       or v_integrantes is null or v_frota is null then
      v_ativa := false;
      v_problema := v_problema || to_jsonb(v_linha.zeus);
    elsif v_grupo is null then
      raise exception 'O supervisor "%" da planilha (Zeus %) não está ligado a nenhum grupo. Preencha a chave da planilha em Grupos e importe de novo.',
        interno.fn_texto(v_linha.supervisor), v_linha.zeus;
    else
      v_ativa := true;
    end if;

    select * into v_atual from public.equipes where codigo_zeus = v_linha.zeus;

    if not found then
      v_novas := v_novas || to_jsonb(v_linha.zeus);
      if not p_simular then
        insert into public.equipes (grupo_id, codigo_zeus, nome, integrantes, frota, ativa)
        values (v_grupo, v_linha.zeus, v_nome, v_integrantes, v_frota, v_ativa)
        returning id into v_id;
        if v_grupo is not null then
          perform interno.fn_gravar_locais_equipe(v_id, interno.fn_locais_do_grupo(v_grupo));
        end if;
      end if;
    elsif v_atual.nome is distinct from v_nome
       or v_atual.integrantes is distinct from v_integrantes
       or v_atual.frota is distinct from v_frota
       or v_atual.grupo_id is distinct from v_grupo
       or v_atual.ativa is distinct from v_ativa then
      v_alteradas := v_alteradas || to_jsonb(v_linha.zeus);
      if not p_simular then
        update public.equipes
           set nome = v_nome, integrantes = v_integrantes, frota = v_frota, grupo_id = v_grupo, ativa = v_ativa
         where id = v_atual.id;
        if v_grupo is not null and v_atual.grupo_id is distinct from v_grupo then
          perform interno.fn_gravar_locais_equipe(v_atual.id, interno.fn_locais_do_grupo(v_grupo));
        end if;
      end if;
    else
      v_iguais := v_iguais || to_jsonb(v_linha.zeus);
    end if;
  end loop;

  -- Equipe ativa que saiu da planilha: inativada, nunca apagada
  select coalesce(jsonb_agg(e.codigo_zeus order by e.codigo_zeus), '[]') into v_inativadas
    from public.equipes e
   where e.codigo_zeus is not null and e.ativa and e.codigo_zeus <> all (v_zeus);

  if not p_simular then
    update public.equipes e
       set ativa = false
     where e.codigo_zeus is not null and e.ativa and e.codigo_zeus <> all (v_zeus);
  end if;

  return jsonb_build_object(
    'novas', v_novas,
    'alteradas', v_alteradas,
    'sem_mudanca', v_iguais,
    'inativadas', v_inativadas,
    'com_problema', v_problema
  );
end;
$$;

-- ---------------------------------------------------------------------
-- rpc_registrar_saida: mesma assinatura; a equipe precisa estar liberada
-- no local
-- ---------------------------------------------------------------------
create or replace function public.rpc_registrar_saida(
  p_almox_id          uuid,
  p_itens             jsonb,
  p_motivo            public.motivo_saida default 'aplicacao',
  p_data_ocorrencia   date default null,
  p_justificativa     text default null,
  p_observacao        text default null,
  p_id                uuid default null,
  p_equipe_id         uuid default null,
  p_retirado_por_nome text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario  uuid;
  v_almox    public.almoxarifados;
  v_equipe   public.equipes;
  v_motivo   public.motivo_saida := coalesce(p_motivo, 'aplicacao');
  v_data     date := coalesce(p_data_ocorrencia, public.fn_hoje());
  v_nome     text := interno.fn_texto(p_retirado_por_nome);
  v_saida_id uuid;
  v_item     record;
begin
  v_usuario := interno.fn_usuario();

  if p_id is not null and interno.fn_id_repetido(
       exists (select 1 from public.saidas where id = p_id),
       exists (select 1 from public.saidas where id = p_id and registrado_por = v_usuario and almox_id = p_almox_id)) then
    return p_id;
  end if;

  select * into v_almox from public.almoxarifados where id = p_almox_id;
  if not found then
    raise exception 'Almoxarifado não encontrado.';
  end if;

  perform interno.fn_exigir_responsavel(p_almox_id);

  if v_almox.tipo = 'externo' then
    raise exception 'O almoxarifado externo não registra saídas no sistema.';
  end if;
  if v_motivo <> 'aplicacao' and interno.fn_texto(p_justificativa) is null then
    raise exception 'Informe a justificativa da %.', v_motivo;
  end if;

  -- Aplicação em serviço numa base: qual equipe e quem retirou
  if v_almox.tipo = 'base' and v_motivo = 'aplicacao' then
    if p_equipe_id is null then
      raise exception 'Informe a equipe que retirou o material.';
    end if;
    if v_nome is null then
      raise exception 'Informe o nome de quem retirou o material.';
    end if;
  end if;

  if p_equipe_id is not null then
    select * into v_equipe from public.equipes where id = p_equipe_id;
    if not found then
      raise exception 'Equipe não encontrada.';
    end if;
    if not v_equipe.ativa then
      raise exception 'A equipe % está inativa. Escolha outra ou peça à gestão do almoxarifado para reativar.', interno.fn_equipe_rotulo(v_equipe);
    end if;
    if not exists (select 1 from public.equipe_locais where equipe_id = v_equipe.id and almox_id = p_almox_id) then
      raise exception 'A equipe % não está liberada para retirar em %. Peça à gestão do almoxarifado para liberar este local.',
        interno.fn_equipe_rotulo(v_equipe), v_almox.nome;
    end if;
  end if;

  perform interno.fn_checar_data(v_data, 'data da saída');
  perform interno.fn_checar_itens(p_itens);

  insert into public.saidas (id, almox_id, motivo, data_ocorrencia, justificativa, observacao,
                             equipe_id, retirado_por_nome, registrado_por)
  values (coalesce(p_id, gen_random_uuid()), p_almox_id, v_motivo, v_data, interno.fn_texto(p_justificativa),
          interno.fn_texto(p_observacao), p_equipe_id, v_nome, v_usuario)
  returning id into v_saida_id;

  for v_item in
    select x.material_id, x.quantidade
      from jsonb_to_recordset(p_itens) as x (material_id uuid, quantidade numeric)
     order by x.material_id
  loop
    if v_item.quantidade is null or v_item.quantidade <= 0 then
      raise exception 'Informe uma quantidade maior que zero para %.', interno.fn_material_rotulo(v_item.material_id);
    end if;

    insert into public.saida_itens (saida_id, material_id, quantidade)
    values (v_saida_id, v_item.material_id, v_item.quantidade);

    perform interno.fn_lancar(p_almox_id, v_item.material_id, -v_item.quantidade,
                              'saida', v_data, p_saida_id => v_saida_id);
  end loop;

  return v_saida_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on all functions in schema interno from public;
