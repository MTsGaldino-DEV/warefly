-- =====================================================================
-- Warefly · Fase A (app Android) — Colaboradores, matrícula e equipes
-- Spec: docs/superpowers/specs/2026-10-13-warefly-android-design.md
--
-- O que entra:
--   - configuracoes: valores ajustáveis sem mudar código (limite de membros
--     por equipe, prazo da senha inicial).
--   - perfis: matrícula CEMIG, senha inicial com prazo e troca obrigatória.
--     "matricula" (que já existia) passa a ser a matrícula Engelmig.
--   - v_colaboradores: o que a gestão e o supervisor veem de cada pessoa
--     (sem e-mail).
--   - grupos.supervisor_id: quem supervisiona as equipes do grupo.
--   - equipe_membros: quem está em qual equipe, com histórico (o consumo
--     diário procura a equipe vigente na data do serviço).
--   - RPCs da gestão de colaboradores (as partes que mexem no Auth ficam na
--     Edge Function "colaboradores") e do vínculo de membros.
--   - Login por matrícula: rpc_email_para_login, só para a Edge Function
--     "entrar".
--   - Hook de token: bloqueia o login de quem está inativo ou com a senha
--     inicial vencida.
-- =====================================================================

-- ---------------------------------------------------------------------
-- configuracoes
-- ---------------------------------------------------------------------
create table public.configuracoes (
  chave           text primary key,
  valor           numeric not null,
  descricao       text not null,
  atualizado_por  uuid references public.perfis (id),
  atualizado_em   timestamptz not null default now(),
  constraint configuracoes_valor_ck check (valor > 0)
);

insert into public.configuracoes (chave, valor, descricao) values
  ('limite_membros_equipe', 2, 'Quantos membros uma equipe tem sem gerar alerta. O padrão de trabalho é dupla.'),
  ('prazo_senha_inicial_dias', 7, 'Dias que a senha inicial vale depois de criada ou redefinida.');

alter table public.configuracoes enable row level security;
create policy configuracoes_select on public.configuracoes
  for select to authenticated using (true);
revoke all on public.configuracoes from anon, authenticated;
grant select on public.configuracoes to authenticated;

create or replace function interno.fn_config(p_chave text)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$ select valor from public.configuracoes where chave = p_chave $$;

create or replace function public.rpc_salvar_configuracao(p_chave text, p_valor numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := interno.fn_usuario();
begin
  if not public.fn_eh_admin() then
    raise exception 'Só o administrador altera as configurações.' using errcode = '42501';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'Informe um valor maior que zero.';
  end if;
  update public.configuracoes
     set valor = p_valor, atualizado_por = v_usuario, atualizado_em = now()
   where chave = p_chave;
  if not found then
    raise exception 'Configuração % não existe.', coalesce(p_chave, '(vazia)');
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- perfis: matrículas e senha inicial
-- ---------------------------------------------------------------------
alter table public.perfis
  add column matricula_cemig    text,
  add column deve_trocar_senha  boolean not null default false,
  add column senha_inicial_ate  timestamptz;

comment on column public.perfis.matricula is
  'Matrícula Engelmig (só dígitos). Usada no login.';
comment on column public.perfis.matricula_cemig is
  'Matrícula CEMIG: "e" seguido de dígitos, sempre em minúsculo. Usada no login e para achar a equipe no consumo.';
comment on column public.perfis.senha_inicial_ate is
  'Até quando a senha inicial vale. Depois disso o login é recusado até a gestão redefinir o acesso.';

-- Matrícula como a pessoa digita: sem espaços e em minúsculo
create or replace function interno.fn_normalizar_matricula(p_matricula text)
returns text
language sql
immutable
set search_path = ''
as $$ select nullif(lower(regexp_replace(coalesce(p_matricula, ''), '\s+', '', 'g')), '') $$;

create or replace function interno.tg_perfil_matriculas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.matricula := interno.fn_normalizar_matricula(new.matricula);
  new.matricula_cemig := interno.fn_normalizar_matricula(new.matricula_cemig);
  return new;
end;
$$;

create trigger perfis_matriculas
  before insert or update of matricula, matricula_cemig on public.perfis
  for each row execute function interno.tg_perfil_matriculas();

-- NOT VALID: as matrículas já gravadas no remoto são conferidas antes de
-- aplicar (ver plano da fase A). As novas já entram no formato.
alter table public.perfis
  add constraint perfis_matricula_ck check (matricula ~ '^[0-9]+$') not valid,
  add constraint perfis_matricula_cemig_ck check (matricula_cemig ~ '^e[0-9]+$'),
  add constraint perfis_matricula_cemig_uk unique (matricula_cemig),
  add constraint perfis_senha_inicial_ck check (not deve_trocar_senha or senha_inicial_ate is not null);

-- Perfil criado junto com o usuário. A Edge Function "colaboradores" manda
-- nome, matrículas, papel e a marca de senha inicial em app_metadata, que só
-- o servidor grava. Matrícula repetida desfaz a criação do usuário.
create or replace function interno.tg_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app     jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  v_inicial boolean := coalesce((v_app ->> 'senha_inicial')::boolean, false);
begin
  insert into public.perfis (id, nome, email, matricula, matricula_cemig, papel,
                             deve_trocar_senha, senha_inicial_ate)
  values (
    new.id,
    coalesce(nullif(btrim(v_app ->> 'nome'), ''),
             nullif(btrim(new.raw_user_meta_data ->> 'nome'), ''),
             split_part(new.email, '@', 1), 'Sem nome'),
    new.email,
    v_app ->> 'matricula',
    v_app ->> 'matricula_cemig',
    coalesce((v_app ->> 'papel')::public.papel_usuario, 'operador'),
    v_inicial,
    case when v_inicial
         then now() + make_interval(days => interno.fn_config('prazo_senha_inicial_dias')::int) end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Com a senha inicial pendente, nenhuma RPC roda até a troca
create or replace function interno.fn_usuario()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id     uuid := auth.uid();
  v_perfil public.perfis;
begin
  if v_id is null then
    raise exception 'Sessão não identificada. Entre novamente no sistema.' using errcode = '28000';
  end if;
  select * into v_perfil from public.perfis where id = v_id;
  if not found or not v_perfil.ativo then
    raise exception 'Usuário sem perfil ativo. Fale com o administrador.' using errcode = '42501';
  end if;
  if v_perfil.deve_trocar_senha then
    raise exception 'Troque a senha inicial antes de continuar.' using errcode = '42501';
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Quem a gestão mantém
--   admin: qualquer pessoa.
--   gestora: operadores que não são gestão do almoxarifado (não mexe em
--   admin, gerência, outra gestora nem em si mesma).
-- ---------------------------------------------------------------------
create or replace function interno.fn_eh_gestora_de(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.atribuicoes a
      join public.almoxarifados g on g.id = a.almox_id
     where a.usuario_id = p_usuario and a.funcao = 'responsavel' and g.tipo = 'regional'
  )
$$;

create or replace function public.fn_gere_colaborador(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.fn_eh_admin()
      or (public.fn_eh_gestora()
          and p_usuario <> (select auth.uid())
          and exists (select 1 from public.perfis where id = p_usuario and papel = 'operador')
          and not interno.fn_eh_gestora_de(p_usuario))
$$;

create or replace function interno.fn_exigir_gestao_colaboradores()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := interno.fn_usuario();
begin
  if not (public.fn_eh_gestora() or public.fn_eh_admin()) then
    raise exception 'Só a gestão do almoxarifado e o administrador mantêm os colaboradores.' using errcode = '42501';
  end if;
  return v_usuario;
end;
$$;

-- Confere nome, matrículas e papel. Devolve os valores normalizados.
create or replace function interno.fn_checar_colaborador(
  p_id               uuid,
  p_nome             text,
  p_matricula        text,
  p_matricula_cemig  text,
  p_papel            public.papel_usuario
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_nome   text := interno.fn_texto(regexp_replace(p_nome, '\s+', ' ', 'g'));
  v_mat    text := interno.fn_normalizar_matricula(p_matricula);
  v_cemig  text := interno.fn_normalizar_matricula(p_matricula_cemig);
  v_outro  text;
begin
  if v_nome is null then
    raise exception 'Informe o nome do colaborador.';
  end if;
  if v_mat is null and v_cemig is null then
    raise exception 'Informe a matrícula Engelmig ou a matrícula CEMIG. Sem matrícula o colaborador não consegue entrar.';
  end if;
  if v_mat is not null and v_mat !~ '^[0-9]+$' then
    raise exception 'A matrícula Engelmig % tem letras ou símbolos. Use só os números (ex.: 27630).', p_matricula;
  end if;
  if v_cemig is not null and v_cemig !~ '^e[0-9]+$' then
    raise exception 'A matrícula CEMIG % não está no formato. Use "e" seguido dos números (ex.: e252135).', p_matricula_cemig;
  end if;
  if p_papel is not null and p_papel <> 'operador' and not public.fn_eh_admin() then
    raise exception 'Só o administrador dá o papel de administrador ou gerência.' using errcode = '42501';
  end if;

  select nome into v_outro from public.perfis
   where matricula = v_mat and id is distinct from p_id;
  if found then
    raise exception 'A matrícula Engelmig % já é de %.', v_mat, v_outro using errcode = '23505';
  end if;
  select nome into v_outro from public.perfis
   where matricula_cemig = v_cemig and id is distinct from p_id;
  if found then
    raise exception 'A matrícula CEMIG % já é de %.', v_cemig, v_outro using errcode = '23505';
  end if;

  return jsonb_build_object('nome', v_nome, 'matricula', v_mat, 'matricula_cemig', v_cemig,
                            'papel', coalesce(p_papel, 'operador'));
end;
$$;

-- ---------------------------------------------------------------------
-- rpc_validar_colaborador: a Edge Function chama com o token de quem está
-- cadastrando, antes de criar o usuário no Auth. Confere a permissão e os
-- dados; devolve o que vai em app_metadata.
-- ---------------------------------------------------------------------
create or replace function public.rpc_validar_colaborador(
  p_nome             text,
  p_matricula        text,
  p_matricula_cemig  text,
  p_papel            public.papel_usuario default 'operador'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform interno.fn_exigir_gestao_colaboradores();
  return interno.fn_checar_colaborador(null, p_nome, p_matricula, p_matricula_cemig, p_papel)
         || jsonb_build_object('senha_inicial', true);
end;
$$;

-- ---------------------------------------------------------------------
-- rpc_salvar_colaborador: edita nome, matrículas, situação e (só o admin)
-- o papel. Inativar tira a pessoa da equipe.
-- ---------------------------------------------------------------------
create or replace function public.rpc_salvar_colaborador(
  p_id               uuid,
  p_nome             text,
  p_matricula        text,
  p_matricula_cemig  text,
  p_ativo            boolean default true,
  p_papel            public.papel_usuario default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := interno.fn_exigir_gestao_colaboradores();
  v_atual   public.perfis;
  v_dados   jsonb;
begin
  select * into v_atual from public.perfis where id = p_id for update;
  if not found then
    raise exception 'Colaborador não encontrado.';
  end if;
  if not public.fn_gere_colaborador(p_id) then
    raise exception '% é mantido pelo administrador.', v_atual.nome using errcode = '42501';
  end if;
  if p_id = v_usuario and not coalesce(p_ativo, true) then
    raise exception 'Você não pode inativar o seu próprio acesso.';
  end if;

  v_dados := interno.fn_checar_colaborador(p_id, p_nome, p_matricula, p_matricula_cemig,
                                           coalesce(p_papel, v_atual.papel));

  update public.perfis
     set nome = v_dados ->> 'nome',
         matricula = v_dados ->> 'matricula',
         matricula_cemig = v_dados ->> 'matricula_cemig',
         papel = (v_dados ->> 'papel')::public.papel_usuario,
         ativo = coalesce(p_ativo, true)
   where id = p_id;

  if not coalesce(p_ativo, true) then
    update public.equipe_membros
       set fim = now(), desvinculado_por = v_usuario
     where colaborador_id = p_id and fim is null;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Senha inicial
-- ---------------------------------------------------------------------
-- A gestão redefine: a Edge Function chama esta RPC com o token de quem
-- pediu e depois volta a senha para a padrão no Auth.
create or replace function public.rpc_preparar_redefinicao_senha(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil public.perfis;
begin
  perform interno.fn_exigir_gestao_colaboradores();
  select * into v_perfil from public.perfis where id = p_id for update;
  if not found then
    raise exception 'Colaborador não encontrado.';
  end if;
  if not public.fn_gere_colaborador(p_id) then
    raise exception 'O acesso de % é redefinido pelo administrador.', v_perfil.nome using errcode = '42501';
  end if;
  if not v_perfil.ativo then
    raise exception '% está inativo. Reative o colaborador antes de redefinir o acesso.', v_perfil.nome;
  end if;
  update public.perfis
     set deve_trocar_senha = true,
         senha_inicial_ate = now() + make_interval(days => interno.fn_config('prazo_senha_inicial_dias')::int)
   where id = p_id;
end;
$$;

-- A própria pessoa conclui a troca depois de gravar a senha nova no Auth.
-- Não usa fn_usuario: ela ainda está com a senha inicial pendente.
create or replace function public.rpc_concluir_troca_senha()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil public.perfis;
begin
  select * into v_perfil from public.perfis where id = (select auth.uid()) for update;
  if not found or not v_perfil.ativo then
    raise exception 'Usuário sem perfil ativo. Fale com o administrador.' using errcode = '42501';
  end if;
  if not v_perfil.deve_trocar_senha then
    return;
  end if;
  if v_perfil.senha_inicial_ate < now() then
    raise exception 'Senha inicial expirada. Peça ao almoxarifado para redefinir o seu acesso.' using errcode = '42501';
  end if;
  update public.perfis set deve_trocar_senha = false, senha_inicial_ate = null where id = v_perfil.id;
end;
$$;

-- ---------------------------------------------------------------------
-- Exclusão: só quem nunca foi usado. "Usado" é aparecer em qualquer tabela
-- que aponte para perfis, menos atribuicoes (que somem junto).
-- ---------------------------------------------------------------------
create or replace function interno.fn_colaborador_usado(p_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ref record;
  v_tem boolean;
begin
  for v_ref in
    select c.conrelid::regclass as tabela, a.attname as coluna
      from pg_catalog.pg_constraint c
      join pg_catalog.pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f'
       and c.confrelid = 'public.perfis'::regclass
       and c.conrelid <> 'public.atribuicoes'::regclass
  loop
    execute format('select exists (select 1 from %s where %I = $1)', v_ref.tabela, v_ref.coluna)
      into v_tem using p_id;
    if v_tem then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

create or replace function public.rpc_preparar_exclusao_colaborador(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := interno.fn_exigir_gestao_colaboradores();
  v_perfil  public.perfis;
begin
  select * into v_perfil from public.perfis where id = p_id;
  if not found then
    raise exception 'Colaborador não encontrado.';
  end if;
  if p_id = v_usuario then
    raise exception 'Você não pode excluir o seu próprio acesso.';
  end if;
  if not public.fn_gere_colaborador(p_id) then
    raise exception '% é mantido pelo administrador.', v_perfil.nome using errcode = '42501';
  end if;
  if interno.fn_colaborador_usado(p_id) then
    raise exception '% já tem registros no sistema e não pode ser excluído. Inative o colaborador.', v_perfil.nome;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Login por matrícula (só a Edge Function "entrar", com a service_role)
-- Devolve o e-mail do Auth ou nulo. A função inventa um e-mail para a
-- matrícula que não existe, para a resposta não revelar quem existe.
-- ---------------------------------------------------------------------
create or replace function interno.fn_exigir_servico()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Função reservada ao servidor.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.rpc_email_para_login(p_matricula text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_mat   text := interno.fn_normalizar_matricula(p_matricula);
  v_email text;
begin
  perform interno.fn_exigir_servico();
  if v_mat is null then
    return null;
  end if;
  select u.email into v_email
    from public.perfis p
    join auth.users u on u.id = p.id
   where (v_mat ~ '^e[0-9]+$' and p.matricula_cemig = v_mat)
      or (v_mat ~ '^[0-9]+$' and p.matricula = v_mat);
  return v_email;
end;
$$;

-- ---------------------------------------------------------------------
-- Hook de token (Custom Access Token): roda a cada login e renovação de
-- sessão. Bloqueia inativo e senha inicial vencida.
-- Ligar em supabase/config.toml e no painel (Authentication → Hooks).
-- ---------------------------------------------------------------------
create or replace function interno.fn_hook_token(p_evento jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_perfil public.perfis;
begin
  select * into v_perfil from public.perfis where id = (p_evento ->> 'user_id')::uuid;
  if found and not v_perfil.ativo then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403, 'message', 'Acesso desativado. Procure o almoxarifado.'));
  end if;
  if found and v_perfil.deve_trocar_senha and v_perfil.senha_inicial_ate < now() then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403, 'message', 'Senha inicial expirada. Peça ao almoxarifado para redefinir o seu acesso.'));
  end if;
  return jsonb_build_object('claims', p_evento -> 'claims');
end;
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant usage on schema interno to supabase_auth_admin;
    grant execute on function interno.fn_hook_token(jsonb) to supabase_auth_admin;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Supervisor do grupo
-- ---------------------------------------------------------------------
alter table public.grupos
  add column supervisor_id uuid references public.perfis (id);

create index grupos_supervisor_idx on public.grupos (supervisor_id);

comment on column public.grupos.supervisor_id is
  'Quem supervisiona as equipes do grupo: vê o estoque e a movimentação delas e mexe nos membros.';

create or replace function public.rpc_definir_supervisor_grupo(p_grupo_id uuid, p_supervisor_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform interno.fn_usuario();
  if not public.fn_eh_admin() then
    raise exception 'Só o administrador define o supervisor do grupo.' using errcode = '42501';
  end if;
  if p_supervisor_id is not null
     and not exists (select 1 from public.perfis where id = p_supervisor_id and ativo) then
    raise exception 'O supervisor escolhido não existe ou está inativo.';
  end if;
  update public.grupos set supervisor_id = p_supervisor_id where id = p_grupo_id;
  if not found then
    raise exception 'Grupo não encontrado.';
  end if;
end;
$$;

create or replace function public.fn_supervisiona_equipe(p_equipe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.equipes e
      join public.grupos g on g.id = e.grupo_id
      join public.perfis p on p.id = g.supervisor_id
     where e.id = p_equipe_id
       and g.supervisor_id = (select auth.uid())
       and p.ativo
  )
$$;

create or replace function public.fn_eh_supervisor_de_grupo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.grupos g join public.perfis p on p.id = g.supervisor_id
     where g.supervisor_id = (select auth.uid()) and p.ativo
  )
$$;

-- ---------------------------------------------------------------------
-- equipe_membros
-- ---------------------------------------------------------------------
create table public.equipe_membros (
  id                uuid primary key default gen_random_uuid(),
  equipe_id         uuid not null references public.equipes (id),
  colaborador_id    uuid not null references public.perfis (id),
  inicio            timestamptz not null default now(),
  fim               timestamptz,
  vinculado_por     uuid references public.perfis (id),
  desvinculado_por  uuid references public.perfis (id),
  constraint equipe_membros_periodo_ck check (fim is null or fim >= inicio)
);

-- Uma equipe por vez
create unique index equipe_membros_atual_uk on public.equipe_membros (colaborador_id) where fim is null;
create index equipe_membros_equipe_idx on public.equipe_membros (equipe_id) where fim is null;

comment on table public.equipe_membros is
  'Quem está em qual equipe. fim nulo = membro atual. Nada é apagado: o histórico acha a equipe na data de um serviço.';

-- Membro atual da equipe
create or replace function public.fn_membro_da_equipe(p_equipe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.equipe_membros m join public.perfis p on p.id = m.colaborador_id
     where m.equipe_id = p_equipe_id and m.fim is null
       and m.colaborador_id = (select auth.uid()) and p.ativo
  )
$$;

-- Equipe visível também para o supervisor do grupo e para os membros
create or replace function public.fn_pode_ver_equipe(p_equipe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.fn_eh_gestora() or public.fn_eh_admin() or public.fn_eh_gestao()
      or public.fn_supervisiona_equipe(p_equipe_id)
      or public.fn_membro_da_equipe(p_equipe_id)
      or exists (
        select 1 from public.equipe_locais el
         where el.equipe_id = p_equipe_id and public.fn_pode_ver(el.almox_id)
      )
$$;

-- Quem mexe nos membros: gestão, admin e o supervisor do grupo
create or replace function public.fn_mantem_membros(p_equipe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.fn_eh_gestora() or public.fn_eh_admin() or public.fn_supervisiona_equipe(p_equipe_id)
$$;

alter table public.equipe_membros enable row level security;
create policy equipe_membros_select on public.equipe_membros
  for select to authenticated
  using (public.fn_eh_gestora() or public.fn_eh_admin() or public.fn_eh_gestao()
         or public.fn_supervisiona_equipe(equipe_id)
         or public.fn_membro_da_equipe(equipe_id)
         or colaborador_id = (select auth.uid()));
revoke all on public.equipe_membros from anon, authenticated;
grant select on public.equipe_membros to authenticated;

-- Equipe inativada (pela tela ou pela importação) fica sem membros
create or replace function interno.tg_equipe_inativada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.ativa and not new.ativa then
    update public.equipe_membros
       set fim = now(), desvinculado_por = (select auth.uid())
     where equipe_id = new.id and fim is null;
  end if;
  return new;
end;
$$;

create trigger equipes_inativada
  after update of ativa on public.equipes
  for each row execute function interno.tg_equipe_inativada();

-- ---------------------------------------------------------------------
-- rpc_vincular_membro: põe o colaborador na equipe. Se ele já está em
-- outra equipe que quem chama também mantém, muda de equipe; se a outra
-- é de outro grupo, só a gestão muda.
-- Passar do limite de membros pede confirmação (erro WF001).
-- ---------------------------------------------------------------------
create or replace function public.rpc_vincular_membro(
  p_equipe_id       uuid,
  p_colaborador_id  uuid,
  p_confirmar       boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario  uuid := interno.fn_usuario();
  v_equipe   public.equipes;
  v_pessoa   public.perfis;
  v_atual    public.equipe_membros;
  v_outra    public.equipes;
  v_limite   int := interno.fn_config('limite_membros_equipe')::int;
  v_membros  int;
begin
  select * into v_equipe from public.equipes where id = p_equipe_id for update;
  if not found then
    raise exception 'Equipe não encontrada.';
  end if;
  if not public.fn_mantem_membros(p_equipe_id) then
    raise exception 'Você não mantém os membros da equipe %. Peça ao supervisor do grupo ou à gestão do almoxarifado.',
      interno.fn_equipe_rotulo(v_equipe) using errcode = '42501';
  end if;
  if not v_equipe.ativa then
    raise exception 'A equipe % está inativa. Reative a equipe antes de vincular membros.', interno.fn_equipe_rotulo(v_equipe);
  end if;

  select * into v_pessoa from public.perfis where id = p_colaborador_id for update;
  if not found then
    raise exception 'Colaborador não encontrado.';
  end if;
  if not v_pessoa.ativo then
    raise exception '% está inativo e não pode entrar em equipe.', v_pessoa.nome;
  end if;
  if v_pessoa.matricula_cemig is null then
    raise exception '% não tem matrícula CEMIG. Peça à gestão do almoxarifado para completar o cadastro.', v_pessoa.nome;
  end if;

  select * into v_atual from public.equipe_membros where colaborador_id = p_colaborador_id and fim is null;
  if found then
    if v_atual.equipe_id = p_equipe_id then
      raise exception '% já está nesta equipe.', v_pessoa.nome;
    end if;
    select * into v_outra from public.equipes where id = v_atual.equipe_id;
    if not public.fn_mantem_membros(v_atual.equipe_id) then
      raise exception '% está na equipe %, de outro grupo. Peça à gestão do almoxarifado para mudar de equipe.',
        v_pessoa.nome, interno.fn_equipe_rotulo(v_outra) using errcode = '42501';
    end if;
  end if;

  select count(*) into v_membros from public.equipe_membros where equipe_id = p_equipe_id and fim is null;
  if v_membros + 1 > v_limite and not coalesce(p_confirmar, false) then
    raise exception 'Esta equipe vai ficar com % membros. O padrão é dupla. Confirme para continuar.', v_membros + 1
      using errcode = 'WF001';
  end if;

  if v_atual.id is not null then
    update public.equipe_membros set fim = now(), desvinculado_por = v_usuario where id = v_atual.id;
  end if;
  insert into public.equipe_membros (equipe_id, colaborador_id, vinculado_por)
  values (p_equipe_id, p_colaborador_id, v_usuario);
end;
$$;

create or replace function public.rpc_desvincular_membro(p_equipe_id uuid, p_colaborador_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := interno.fn_usuario();
  v_equipe  public.equipes;
begin
  select * into v_equipe from public.equipes where id = p_equipe_id;
  if not found then
    raise exception 'Equipe não encontrada.';
  end if;
  if not public.fn_mantem_membros(p_equipe_id) then
    raise exception 'Você não mantém os membros da equipe %. Peça ao supervisor do grupo ou à gestão do almoxarifado.',
      interno.fn_equipe_rotulo(v_equipe) using errcode = '42501';
  end if;
  update public.equipe_membros
     set fim = now(), desvinculado_por = v_usuario
   where equipe_id = p_equipe_id and colaborador_id = p_colaborador_id and fim is null;
  if not found then
    raise exception 'Este colaborador não está na equipe %.', interno.fn_equipe_rotulo(v_equipe);
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Leitura
-- ---------------------------------------------------------------------
-- Quem vê o cadastro de quem:
--   a própria pessoa; gestão, gerência e admin, todos;
--   supervisor: os membros das equipes dele e quem está ativo, com
--   matrícula CEMIG e sem equipe (para poder vincular);
--   membro de equipe: os colegas da equipe.
create or replace function public.fn_pode_ver_colaborador(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_usuario = (select auth.uid())
      or public.fn_eh_gestora() or public.fn_eh_admin() or public.fn_eh_gestao()
      or exists (
        select 1 from public.equipe_membros m
         where m.colaborador_id = p_usuario and m.fim is null
           and (public.fn_supervisiona_equipe(m.equipe_id) or public.fn_membro_da_equipe(m.equipe_id))
      )
      or (public.fn_eh_supervisor_de_grupo()
          and exists (select 1 from public.perfis p
                       where p.id = p_usuario and p.ativo and p.matricula_cemig is not null)
          and not exists (select 1 from public.equipe_membros m
                           where m.colaborador_id = p_usuario and m.fim is null))
$$;

-- Sem security_invoker de propósito: perfis continua restrito (o e-mail
-- não sai daqui); o filtro é fn_pode_ver_colaborador.
create view public.v_colaboradores as
select p.id, p.nome, p.matricula, p.matricula_cemig, p.papel, p.ativo,
       p.deve_trocar_senha, p.senha_inicial_ate,
       m.equipe_id, m.inicio as na_equipe_desde
  from public.perfis p
  left join public.equipe_membros m on m.colaborador_id = p.id and m.fim is null
 where public.fn_pode_ver_colaborador(p.id);

revoke all on public.v_colaboradores from anon, authenticated;
grant select on public.v_colaboradores to authenticated;

-- Quantos membros cada equipe tem e se passou do limite
create view public.v_equipes_membros
with (security_invoker = true) as
select e.id as equipe_id,
       count(m.id)::int as membros,
       c.valor::int as limite,
       count(m.id) > c.valor as acima_do_limite
  from public.equipes e
  cross join (select valor from public.configuracoes where chave = 'limite_membros_equipe') c
  left join public.equipe_membros m on m.equipe_id = e.id and m.fim is null
 where e.ativa
 group by e.id, c.valor;

revoke all on public.v_equipes_membros from anon, authenticated;
grant select on public.v_equipes_membros to authenticated;

-- ---------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on all functions in schema interno from public;
-- A Edge Function "entrar" chama com a service_role. O privilégio padrão do
-- Supabase local não garante execução para ela, então fica explícito.
grant execute on function public.rpc_email_para_login(text) to service_role;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function interno.fn_hook_token(jsonb) to supabase_auth_admin;
  end if;
end $$;
