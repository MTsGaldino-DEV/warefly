-- =====================================================================
-- Warefly · Guias assinadas e inventário (15/10/2026)
--
-- 1. Bucket "guias": foto ou PDF da guia assinada (até 10 MB), privado.
--    Serve ao despacho (remessa) e à retirada (saída com equipe).
--    O documento só fecha quando tem guia anexada (decisão de 15/10:
--    a regra vale para a retirada e para o despacho para base).
-- 2. guias_assinadas: registro de cada anexo (quem, quando, formato).
--    Nada é trocado nem apagado: se a foto saiu ruim, anexa outra e a
--    mais recente vale.
-- 3. Inventário: cadastro rápido de material pela gestora ou admin
--    (rpc_cadastrar_material_rapido) e fn_em_implantacao, que diz se o
--    local ainda aceita saldo inicial. A contagem continua passando por
--    rpc_registrar_ajuste.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Bucket
-- Caminho: {remessa|saida}/{id do documento}/{uuid}.{jpg|jpeg|png|webp|pdf}
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guias', 'guias', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Caminho no formato esperado: devolve (tipo, documento) ou nulos.
create or replace function public.fn_caminho_guia(p_nome text, out tipo text, out documento_id uuid)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_partes text[];
begin
  if p_nome !~ '^(remessa|saida)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|pdf)$' then
    return;
  end if;
  v_partes := string_to_array(p_nome, '/');
  tipo := v_partes[1];
  documento_id := v_partes[2]::uuid;
end;
$$;

-- Quem anexa a guia de um documento:
--   remessa: quem opera a origem ou o destino (quem emite ou quem recebe);
--   saída:   quem opera o local da retirada.
-- Gestora e admin sempre.
create or replace function public.fn_pode_anexar_guia(p_tipo text, p_documento_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.fn_eh_admin() or public.fn_eh_gestora()
      or case p_tipo
           when 'remessa' then exists (
             select 1 from public.remessas r
              where r.id = p_documento_id
                and (public.fn_opera_local(r.origem_id) or public.fn_opera_local(r.destino_id)))
           when 'saida' then exists (
             select 1 from public.saidas s
              where s.id = p_documento_id and public.fn_opera_local(s.almox_id))
           else false
         end
$$;

-- Quem vê a guia: quem vê o documento.
create or replace function public.fn_pode_ver_guia(p_tipo text, p_documento_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_tipo
           when 'remessa' then public.fn_pode_ver_remessa(p_documento_id)
           when 'saida' then exists (
             select 1 from public.saidas s
              where s.id = p_documento_id and public.fn_pode_ver(s.almox_id))
           else false
         end
$$;

-- Upload só no formato do caminho e por quem pode anexar. Sem update e
-- sem delete: a guia não é trocada depois.
create policy guias_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'guias'
    and (public.fn_caminho_guia(name)).tipo is not null
    and public.fn_pode_anexar_guia((public.fn_caminho_guia(name)).tipo,
                                   (public.fn_caminho_guia(name)).documento_id)
  );

create policy guias_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'guias'
    and (public.fn_caminho_guia(name)).tipo is not null
    and public.fn_pode_ver_guia((public.fn_caminho_guia(name)).tipo,
                                (public.fn_caminho_guia(name)).documento_id)
  );

-- ---------------------------------------------------------------------
-- 2. guias_assinadas
-- ---------------------------------------------------------------------
create table public.guias_assinadas (
  id            uuid primary key default gen_random_uuid(),
  remessa_id    uuid references public.remessas (id),
  saida_id      uuid references public.saidas (id),
  caminho       text not null unique,
  formato       text not null,
  anexado_por   uuid not null references public.perfis (id),
  anexado_em    timestamptz not null default now(),
  constraint guias_documento_ck check (num_nonnulls(remessa_id, saida_id) = 1),
  constraint guias_formato_ck check (formato in ('foto', 'pdf'))
);

create index guias_remessa_idx on public.guias_assinadas (remessa_id) where remessa_id is not null;
create index guias_saida_idx on public.guias_assinadas (saida_id) where saida_id is not null;

comment on table public.guias_assinadas is
  'Foto ou PDF da guia assinada de um despacho (remessa) ou retirada (saída). Só inserção, por RPC. A mais recente vale.';

alter table public.guias_assinadas enable row level security;
create policy guias_assinadas_select on public.guias_assinadas
  for select to authenticated
  using (case when remessa_id is not null then public.fn_pode_ver_guia('remessa', remessa_id)
              else public.fn_pode_ver_guia('saida', saida_id) end);
revoke all on public.guias_assinadas from anon, authenticated;
grant select on public.guias_assinadas to authenticated;

-- rpc_registrar_guia: grava o anexo que já foi enviado ao Storage.
-- p_tipo: 'remessa' ou 'saida'. Retorna o id do registro.
create or replace function public.rpc_registrar_guia(p_tipo text, p_documento_id uuid, p_caminho text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := interno.fn_usuario();
  v_caminho record;
  v_id      uuid;
begin
  if p_tipo not in ('remessa', 'saida') then
    raise exception 'Tipo de documento inválido. Use remessa ou saida.';
  end if;
  if p_tipo = 'remessa' and not exists (select 1 from public.remessas where id = p_documento_id) then
    raise exception 'Despacho não encontrado.';
  end if;
  if p_tipo = 'saida' and not exists (select 1 from public.saidas where id = p_documento_id) then
    raise exception 'Retirada não encontrada.';
  end if;
  if not public.fn_pode_anexar_guia(p_tipo, p_documento_id) then
    raise exception 'Você não opera o local deste documento e não pode anexar a guia.' using errcode = '42501';
  end if;

  select * into v_caminho from public.fn_caminho_guia(p_caminho);
  if v_caminho.tipo is null or v_caminho.tipo <> p_tipo or v_caminho.documento_id <> p_documento_id then
    raise exception 'O arquivo precisa estar na pasta do documento. Envie a guia novamente.';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'guias' and name = p_caminho) then
    raise exception 'Guia não encontrada no armazenamento. Envie o arquivo novamente.';
  end if;
  if exists (select 1 from public.guias_assinadas where caminho = p_caminho) then
    raise exception 'Este arquivo já está registrado.';
  end if;

  insert into public.guias_assinadas (remessa_id, saida_id, caminho, formato, anexado_por)
  values (case when p_tipo = 'remessa' then p_documento_id end,
          case when p_tipo = 'saida' then p_documento_id end,
          p_caminho,
          case when p_caminho like '%.pdf' then 'pdf' else 'foto' end,
          v_usuario)
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Inventário
-- ---------------------------------------------------------------------

-- O local ainda está em implantação (só tem saldo inicial)? Enquanto
-- estiver, a contagem entra como saldo inicial; depois, como inventário.
create or replace function public.fn_em_implantacao(p_almox_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.movimentacoes where almox_id = p_almox_id and tipo <> 'saldo_inicial'
  )
$$;

-- Cadastro rápido de material no dia do inventário (gestora ou admin).
-- Material já cadastrado com o mesmo código SAP: devolve o existente.
create or replace function public.rpc_cadastrar_material_rapido(
  p_codigo_sap text,
  p_descricao  text,
  p_unidade    text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo    text := interno.fn_texto(p_codigo_sap);
  v_descricao text := interno.fn_texto(p_descricao);
  v_unidade   text := interno.fn_texto(p_unidade);
  v_id        uuid;
begin
  perform interno.fn_usuario();
  if not (public.fn_eh_admin() or public.fn_eh_gestora()) then
    raise exception 'Só a gestão do almoxarifado e o administrador cadastram material.' using errcode = '42501';
  end if;
  if v_codigo is null then
    raise exception 'Informe o código SAP do material.';
  end if;
  if v_descricao is null then
    raise exception 'Informe a descrição do material.';
  end if;
  if v_unidade is null or not exists (select 1 from public.unidades where codigo = v_unidade) then
    raise exception 'Escolha uma unidade da lista.';
  end if;

  select id into v_id from public.materiais where codigo_sap = v_codigo;
  if found then
    return v_id;
  end if;

  insert into public.materiais (codigo_sap, descricao, unidade)
  values (v_codigo, upper(v_descricao), v_unidade)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on all functions in schema interno from public;
grant execute on function public.rpc_email_para_login(text) to service_role;
