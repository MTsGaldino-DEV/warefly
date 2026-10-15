-- =====================================================================
-- Warefly · Perfis e permissões (spec de 14/10/2026) — parte 2
--
-- Perfis: equipe · operador de base · supervisor · operador do 211 ·
-- gestora do almoxarifado · admin. A gerência (papel gestao) deixa de existir.
--
--   Operador do 211   = atribuição 'operador' no almoxarifado regional.
--   Operador de base  = grupos.operador_base_id. Tem o mesmo acesso do
--                       supervisor do grupo: as bases em que o supervisor
--                       (grupos.supervisor_id) tem a atribuição 'supervisor'
--                       e as equipes do grupo.
--   Supervisor e gestora continuam como antes (atribuições).
--
-- Comparações com o valor novo do enum ficam como texto (funcao::text) para
-- valer mesmo que esta migration rode na mesma transação da parte 1.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Gerência sai
-- ---------------------------------------------------------------------
do $$
declare
  v_nomes text;
begin
  select string_agg(nome, ', ' order by nome) into v_nomes from public.perfis where papel = 'gestao';
  if v_nomes is not null then
    raise exception 'O perfil Gerência não existe mais, mas estes usuários ainda o têm: %. Troque o papel deles para operador (ou admin) antes de aplicar esta migration.', v_nomes;
  end if;
end $$;

alter table public.perfis
  add constraint perfis_sem_gerencia_ck check (papel <> 'gestao');

comment on constraint perfis_sem_gerencia_ck on public.perfis is
  'O papel gestao (Gerência) deixou de existir em 15/10/2026. O valor continua no enum só porque o Postgres não remove valor de enum.';

-- Continua existindo porque políticas e funções antigas a chamam; nunca é verdadeira.
create or replace function public.fn_eh_gestao()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select false
$$;

-- ---------------------------------------------------------------------
-- 2. Atribuição 'operador' só no almoxarifado regional
-- ---------------------------------------------------------------------
create or replace function interno.tg_atribuicao_almox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo public.tipo_almox;
begin
  select tipo into v_tipo from public.almoxarifados where id = new.almox_id;
  if v_tipo = 'externo' then
    raise exception 'O almoxarifado externo não opera o sistema e não recebe atribuições.';
  end if;
  if new.funcao::text = 'operador' and v_tipo is distinct from 'regional' then
    raise exception 'A atribuição de operador vale só no almoxarifado regional. Para operar as bases, defina a pessoa como operador de base do grupo.';
  end if;
  return new;
end;
$$;

drop trigger if exists atribuicoes_almox on public.atribuicoes;
create trigger atribuicoes_almox
  before insert or update of almox_id, funcao on public.atribuicoes
  for each row execute function interno.tg_atribuicao_almox();

-- ---------------------------------------------------------------------
-- 3. Operador de base do grupo
-- ---------------------------------------------------------------------
alter table public.grupos
  add column operador_base_id uuid references public.perfis (id);

create index grupos_operador_base_idx on public.grupos (operador_base_id);

comment on column public.grupos.operador_base_id is
  'Braço direito do supervisor: opera as bases do supervisor do grupo e mantém as equipes do grupo, com o mesmo acesso dele.';

create or replace function public.rpc_definir_operador_base_grupo(p_grupo_id uuid, p_operador_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grupo public.grupos;
begin
  perform interno.fn_usuario();
  if not public.fn_eh_admin() then
    raise exception 'Só o administrador define o operador de base do grupo.' using errcode = '42501';
  end if;
  select * into v_grupo from public.grupos where id = p_grupo_id for update;
  if not found then
    raise exception 'Grupo não encontrado.';
  end if;
  if p_operador_id is not null then
    if not exists (select 1 from public.perfis where id = p_operador_id and ativo) then
      raise exception 'O operador escolhido não existe ou está inativo.';
    end if;
    if p_operador_id = v_grupo.supervisor_id then
      raise exception 'O supervisor do grupo % não pode ser também o operador de base dele. Escolha outra pessoa.', v_grupo.nome;
    end if;
  end if;
  update public.grupos set operador_base_id = p_operador_id where id = p_grupo_id;
end;
$$;

-- O usuário é operador de base do grupo cujo supervisor supervisiona esta base
create or replace function public.fn_eh_operador_base(p_almox_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.grupos g
      join public.perfis op on op.id = g.operador_base_id
      join public.atribuicoes s on s.usuario_id = g.supervisor_id
      join public.almoxarifados l on l.id = s.almox_id
     where g.operador_base_id = (select auth.uid())
       and g.ativo
       and op.ativo
       and s.funcao::text = 'supervisor'
       and s.almox_id = p_almox_id
       and l.tipo = 'base'
  )
$$;

-- O usuário é operador do almoxarifado regional (211)
create or replace function public.fn_eh_operador_regional()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.atribuicoes a
      join public.perfis p on p.id = a.usuario_id
     where a.usuario_id = (select auth.uid())
       and a.funcao::text = 'operador'
       and p.ativo
  )
$$;

-- ---------------------------------------------------------------------
-- 4. Quem responde pelo local e quem opera o local
--   fn_eh_responsavel: responsável (atribuição) ou operador de base. Decide
--     o que é da gestão do local: pedido do local, entrada do 3256,
--     tratamento de divergência.
--   fn_opera_local: o anterior ou o operador do 211 no 211. Decide o dia a
--     dia: aprovar e cancelar pedido, enviar remessa, receber devolução,
--     registrar saída.
-- ---------------------------------------------------------------------
create or replace function public.fn_eh_responsavel(p_almox_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.atribuicoes a
      join public.perfis p on p.id = a.usuario_id
     where a.usuario_id = (select auth.uid())
       and a.almox_id = p_almox_id
       and a.funcao::text = 'responsavel'
       and p.ativo
  )
  or public.fn_eh_operador_base(p_almox_id)
$$;

create or replace function public.fn_opera_local(p_almox_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.fn_eh_responsavel(p_almox_id)
      or exists (
        select 1
          from public.atribuicoes a
          join public.perfis p on p.id = a.usuario_id
         where a.usuario_id = (select auth.uid())
           and a.almox_id = p_almox_id
           and a.funcao::text = 'operador'
           and p.ativo
      )
$$;

-- Admin; quem tem atribuição no local; responsável ou operador do regional
-- vê as bases dele; operador de base vê as bases do grupo.
create or replace function public.fn_pode_ver(p_almox_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.fn_eh_admin()
  or exists (
    select 1
      from public.atribuicoes a
      join public.perfis p on p.id = a.usuario_id
     where a.usuario_id = (select auth.uid())
       and p.ativo
       and (
         a.almox_id = p_almox_id
         or (a.funcao::text in ('responsavel', 'operador')
             and a.almox_id = (select pai_id from public.almoxarifados where id = p_almox_id))
       )
  )
  or public.fn_eh_operador_base(p_almox_id)
$$;

create or replace function interno.fn_exigir_responsavel(p_almox_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.fn_opera_local(p_almox_id) then
    raise exception 'Você não opera %. Peça a atribuição ao administrador.',
      interno.fn_almox_nome(p_almox_id)
      using errcode = '42501';
  end if;
end;
$$;

create or replace function interno.fn_exigir_gestao_do_local(p_almox_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.fn_eh_responsavel(p_almox_id) then
    raise exception 'Só o responsável por % faz isso. Peça à gestão do almoxarifado.',
      interno.fn_almox_nome(p_almox_id)
      using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Equipes: supervisor e operador de base do grupo
-- ---------------------------------------------------------------------
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
      join public.perfis p on p.id = (select auth.uid())
     where e.id = p_equipe_id
       and (select auth.uid()) in (g.supervisor_id, g.operador_base_id)
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
    select 1
      from public.grupos g
      join public.perfis p on p.id = (select auth.uid())
     where (select auth.uid()) in (g.supervisor_id, g.operador_base_id)
       and p.ativo
  )
$$;

-- Quem libera locais para a equipe: o admin, qualquer um; a gestora e o
-- operador do regional, o regional e as bases dele.
create or replace function public.fn_libera_local(p_almox_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.fn_eh_admin()
      or public.fn_gere_local(p_almox_id)
      or exists (
        select 1
          from public.almoxarifados l
          join public.atribuicoes a on a.almox_id in (l.id, l.pai_id)
          join public.perfis p on p.id = a.usuario_id
         where l.id = p_almox_id
           and a.usuario_id = (select auth.uid())
           and a.funcao::text = 'operador'
           and p.ativo
      )
$$;

-- public.rpc_enviar_pedido: só a gestão do local (o operador do 211 não envia pedido ao 3256 nem registra entrada do 3256)
-- Cópia de 20260928130500_rpcs.sql; muda só a checagem de permissão.
create or replace function public.rpc_enviar_pedido(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos;
begin
  perform interno.fn_usuario();

  select * into v_pedido from public.pedidos where id = p_pedido_id for update;
  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  perform interno.fn_exigir_gestao_do_local(v_pedido.solicitante_id);

  if v_pedido.status <> 'rascunho' then
    raise exception 'O pedido % já foi enviado (status: %).', interno.fn_doc('PED', v_pedido.numero), v_pedido.status;
  end if;
  if not exists (select 1 from public.pedido_itens where pedido_id = p_pedido_id) then
    raise exception 'O pedido % não tem itens. Adicione ao menos um item antes de enviar.', interno.fn_doc('PED', v_pedido.numero);
  end if;

  update public.pedidos
     set status = 'solicitado', solicitado_em = now()
   where id = p_pedido_id;
end;
$$;

-- public.rpc_registrar_recebimento_externo: só a gestão do local (o operador do 211 não envia pedido ao 3256 nem registra entrada do 3256)
-- Cópia de 20260928130500_rpcs.sql; muda só a checagem de permissão.
create or replace function public.rpc_registrar_recebimento_externo(
  p_remessa_id         uuid,
  p_destino_id         uuid,
  p_documento_ref      text,
  p_data_recebimento   date,
  p_conferido_por_nome text,
  p_foto_path          text,
  p_itens              jsonb,
  p_pedido_id          uuid default null,
  p_data_envio         date default null,
  p_observacao         text default null
)
returns public.status_remessa
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario    uuid;
  v_destino    public.almoxarifados;
  v_pedido     public.pedidos;
  v_data_envio date := coalesce(p_data_envio, p_data_recebimento);
  v_divergente boolean;
  v_status     public.status_remessa;
begin
  v_usuario := interno.fn_usuario();

  if p_remessa_id is null then
    raise exception 'Informe o identificador da remessa gerado pelo app.';
  end if;
  if exists (select 1 from public.remessas where id = p_remessa_id) then
    raise exception 'Esta entrada já foi registrada.';
  end if;

  select * into v_destino from public.almoxarifados where id = p_destino_id;
  if not found then
    raise exception 'Almoxarifado de destino não encontrado.';
  end if;

  perform interno.fn_exigir_gestao_do_local(p_destino_id);

  if v_destino.tipo <> 'regional' then
    raise exception 'Entrada do almoxarifado externo só no almoxarifado regional.';
  end if;

  if p_pedido_id is not null then
    select * into v_pedido from public.pedidos where id = p_pedido_id for update;
    if not found then
      raise exception 'Pedido não encontrado.';
    end if;
    if not v_pedido.externo or v_pedido.solicitante_id <> p_destino_id then
      raise exception 'O pedido % não é um pedido externo de %.', interno.fn_doc('PED', v_pedido.numero), v_destino.nome;
    end if;
    if v_pedido.status <> 'solicitado' then
      raise exception 'O pedido % não está aguardando entrega (status: %).', interno.fn_doc('PED', v_pedido.numero), v_pedido.status;
    end if;
  end if;

  if interno.fn_texto(p_documento_ref) is null then
    raise exception 'Informe o número do documento SAP.';
  end if;
  perform interno.fn_checar_data(p_data_recebimento, 'data de recebimento');
  perform interno.fn_checar_data(v_data_envio, 'data do documento');
  if v_data_envio > p_data_recebimento then
    raise exception 'A data do documento (%) é posterior à data de recebimento (%).',
      to_char(v_data_envio, 'DD/MM/YYYY'), to_char(p_data_recebimento, 'DD/MM/YYYY');
  end if;
  if interno.fn_texto(p_conferido_por_nome) is null then
    raise exception 'Informe o nome de quem contou o material.';
  end if;
  perform interno.fn_checar_foto(p_remessa_id, p_foto_path);
  perform interno.fn_checar_itens(p_itens);

  if exists (
    select 1 from jsonb_to_recordset(p_itens) as x (qtd_enviada numeric)
     where x.qtd_enviada is null or x.qtd_enviada < 0
  ) then
    raise exception 'Informe a quantidade do documento SAP em todos os itens (0 se não constar).';
  end if;

  insert into public.remessas (id, tipo, origem_id, destino_id, pedido_id, documento_ref,
                               enviado_por, data_envio, observacao)
  values (p_remessa_id, 'externa', v_destino.pai_id, p_destino_id, p_pedido_id,
          interno.fn_texto(p_documento_ref), v_usuario, v_data_envio, interno.fn_texto(p_observacao));

  insert into public.remessa_itens (remessa_id, material_id, qtd_enviada)
  select p_remessa_id, x.material_id, x.qtd_enviada
    from jsonb_to_recordset(p_itens) as x (material_id uuid, qtd_enviada numeric)
   where x.qtd_enviada > 0
   order by x.material_id;

  v_divergente := interno.fn_processar_recebimento(p_remessa_id, p_destino_id, p_itens, p_data_recebimento);
  v_status := case when v_divergente then 'com_divergencia' else 'encerrada' end;

  update public.remessas
     set status = v_status,
         data_recebimento = p_data_recebimento,
         conferido_por_nome = interno.fn_texto(p_conferido_por_nome),
         foto_path = p_foto_path,
         recebido_registrado_por = v_usuario,
         recebido_registrado_em = now(),
         encerrada_em = case when v_divergente then null else now() end
   where id = p_remessa_id;

  if p_pedido_id is not null then
    update public.pedidos
       set status = case when v_divergente then 'com_divergencia'::public.status_pedido else 'encerrado' end,
           encerrado_em = case when v_divergente then null else now() end
     where id = p_pedido_id;
  end if;

  return v_status;
end;
$$;

-- rpc_tratar_divergencia: tratamento é da gestão do local (supervisor ou operador de base na base, gestora no 211)
-- Cópia de 20260928130800_correcoes_revisao.sql; muda só a checagem de permissão.
create or replace function public.rpc_tratar_divergencia(
  p_remessa_item_id uuid,
  p_tipo            public.tipo_tratamento,
  p_quantidade      numeric,
  p_justificativa   text,
  p_data_ocorrencia date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario       uuid;
  v_item          public.remessa_itens;
  v_remessa       public.remessas;
  v_diferenca     numeric;
  v_em_aberto     numeric;
  v_data          date := coalesce(p_data_ocorrencia, public.fn_hoje());
  v_nova_remessa  uuid;
  v_tratamento_id uuid;
  v_do_destino    boolean;
begin
  v_usuario := interno.fn_usuario();

  select r.* into v_remessa
    from public.remessas r
    join public.remessa_itens ri on ri.remessa_id = r.id
   where ri.id = p_remessa_item_id
     for update of r;
  if not found then
    raise exception 'Item de remessa não encontrado.';
  end if;

  select * into v_item from public.remessa_itens where id = p_remessa_item_id;

  if v_remessa.status <> 'com_divergencia' then
    raise exception 'A remessa % não tem divergência em aberto.', interno.fn_doc('REM', v_remessa.numero);
  end if;

  v_diferenca := v_item.qtd_enviada - coalesce(v_item.qtd_recebida, v_item.qtd_enviada);
  if v_diferenca = 0 then
    raise exception 'Este item não tem divergência.';
  end if;

  v_em_aberto := abs(v_diferenca) - coalesce(
    (select sum(quantidade) from public.divergencia_tratamentos where remessa_item_id = p_remessa_item_id), 0);
  if v_em_aberto <= 0 then
    raise exception 'A divergência de % já foi tratada.', interno.fn_material_rotulo(v_item.material_id);
  end if;

  if p_tipo is null then
    raise exception 'Informe o tipo de tratamento.';
  end if;

  -- Sentido da diferença
  if v_diferenca > 0 and p_tipo in ('ajuste_origem', 'erro_contagem') then
    raise exception '"%" só vale para sobra (chegou mais do que o enviado).',
      case p_tipo when 'ajuste_origem' then 'Ajuste na origem' else 'Erro de contagem' end;
  end if;
  if v_diferenca < 0 and p_tipo in ('reenvio', 'baixa_transito', 'chegou_depois', 'estorno_origem') then
    raise exception '"%" só vale para falta (chegou menos do que o enviado).',
      case p_tipo when 'reenvio' then 'Reenvio' when 'baixa_transito' then 'Baixa em trânsito'
                  when 'chegou_depois' then 'Chegou depois' else 'Não saiu da origem' end;
  end if;

  -- Tipo de remessa e quem registra
  if v_remessa.tipo = 'externa' then
    if p_tipo not in ('externo', 'chegou_depois', 'erro_contagem') then
      raise exception 'Divergência em remessa do almoxarifado externo: use "externo", "chegou depois" ou "erro de contagem".';
    end if;
    v_do_destino := true;
  else
    if p_tipo = 'externo' then
      raise exception '"Externo" só vale para remessas do almoxarifado externo.';
    end if;
    v_do_destino := p_tipo in ('chegou_depois', 'erro_contagem');
  end if;

  if v_do_destino then
    perform interno.fn_exigir_gestao_do_local(v_remessa.destino_id);
  else
    perform interno.fn_exigir_gestao_do_local(v_remessa.origem_id);
  end if;

  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Informe uma quantidade maior que zero.';
  end if;
  if p_quantidade > v_em_aberto then
    raise exception 'Quantidade maior que a divergência em aberto (%).', trim_scale(v_em_aberto);
  end if;
  perform interno.fn_checar_fracao(v_item.material_id, p_quantidade);

  if interno.fn_texto(p_justificativa) is null then
    raise exception 'Informe a justificativa do tratamento.';
  end if;

  perform interno.fn_checar_data(v_data, 'data do tratamento');
  if v_data < v_remessa.data_recebimento then
    raise exception 'A data do tratamento é anterior ao recebimento da remessa (%).',
      to_char(v_remessa.data_recebimento, 'DD/MM/YYYY');
  end if;

  if p_tipo = 'reenvio' then
    insert into public.remessas (tipo, origem_id, destino_id, remessa_ref_id, enviado_por, data_envio, observacao)
    values ('reenvio', v_remessa.origem_id, v_remessa.destino_id, v_remessa.id, v_usuario, v_data,
            'Reenvio da ' || interno.fn_doc('REM', v_remessa.numero) || ': ' || interno.fn_texto(p_justificativa))
    returning id into v_nova_remessa;

    insert into public.remessa_itens (remessa_id, material_id, qtd_enviada)
    values (v_nova_remessa, v_item.material_id, p_quantidade);

    perform interno.fn_lancar(v_remessa.origem_id, v_item.material_id, -p_quantidade,
                              'envio_remessa', v_data, p_remessa_id => v_nova_remessa);
  end if;

  insert into public.divergencia_tratamentos (remessa_item_id, tipo, quantidade, justificativa,
                                              data_ocorrencia, remessa_gerada_id, tratado_por)
  values (p_remessa_item_id, p_tipo, p_quantidade, interno.fn_texto(p_justificativa),
          v_data, v_nova_remessa, v_usuario)
  returning id into v_tratamento_id;

  if p_tipo = 'chegou_depois' then
    perform interno.fn_lancar(v_remessa.destino_id, v_item.material_id, p_quantidade,
                              'recebimento_remessa', v_data, p_tratamento_id => v_tratamento_id);
  elsif p_tipo = 'ajuste_origem' then
    perform interno.fn_lancar(v_remessa.origem_id, v_item.material_id, -p_quantidade,
                              'ajuste_divergencia', v_data, p_tratamento_id => v_tratamento_id);
  elsif p_tipo = 'estorno_origem' then
    perform interno.fn_lancar(v_remessa.origem_id, v_item.material_id, p_quantidade,
                              'ajuste_divergencia', v_data, p_tratamento_id => v_tratamento_id);
  elsif p_tipo = 'erro_contagem' then
    perform interno.fn_lancar(v_remessa.destino_id, v_item.material_id, -p_quantidade,
                              'ajuste_divergencia', v_data, p_tratamento_id => v_tratamento_id);
  end if;

  perform interno.fn_encerrar_se_resolvida(v_remessa.id);

  return v_tratamento_id;
end;
$$;

-- rpc_cancelar_pedido: o operador do 211 também cancela o que o 211 atende
-- Cópia de 20260928130500_rpcs.sql; muda só a checagem de permissão.
create or replace function public.rpc_cancelar_pedido(p_pedido_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid;
  v_pedido  public.pedidos;
  v_pode    boolean;
begin
  v_usuario := interno.fn_usuario();

  select * into v_pedido from public.pedidos where id = p_pedido_id for update;
  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  v_pode := case v_pedido.status
    when 'rascunho'   then public.fn_eh_responsavel(v_pedido.solicitante_id)
    when 'solicitado' then public.fn_eh_responsavel(v_pedido.solicitante_id) or public.fn_opera_local(v_pedido.atendente_id)
    when 'aprovado'   then public.fn_eh_responsavel(v_pedido.solicitante_id) or public.fn_opera_local(v_pedido.atendente_id)
  end;

  if v_pode is null then
    raise exception 'O pedido % não pode mais ser cancelado (status: %).', interno.fn_doc('PED', v_pedido.numero), v_pedido.status;
  end if;
  if not v_pode then
    raise exception 'Você não pode cancelar o pedido %.', interno.fn_doc('PED', v_pedido.numero) using errcode = '42501';
  end if;
  if interno.fn_texto(p_motivo) is null then
    raise exception 'Informe o motivo do cancelamento.';
  end if;

  update public.pedidos
     set status = 'cancelado',
         cancelado_por = v_usuario,
         cancelado_em = now(),
         motivo_cancelamento = interno.fn_texto(p_motivo)
   where id = p_pedido_id;
end;
$$;

-- Cópia de 20261013100000_equipes_grupos.sql; a gestora e o operador do regional liberam os locais do regional deles.
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
  -- A gestora e o operador do regional só liberam locais do regional deles; o admin, qualquer um
  if not public.fn_eh_admin() then
    for v_local in select l from unnest(p_locais) as l loop
      if not public.fn_libera_local(v_local) then
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

-- rpc_definir_locais_equipe: o operador do 211 também libera locais (ex.: moto que pede acesso numa base)
-- Cópia de 20261013100000_equipes_grupos.sql.
create or replace function public.rpc_definir_locais_equipe(p_equipe_id uuid, p_locais uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform interno.fn_usuario();
  if not (public.fn_eh_gestora() or public.fn_eh_admin() or public.fn_eh_operador_regional()) then
    raise exception 'Só a gestão e o operador do almoxarifado liberam locais para a equipe.' using errcode = '42501';
  end if;
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
-- 6. Colaboradores
-- ---------------------------------------------------------------------

-- Cópia de 20261014100000_colaboradores_acesso.sql; recusa o papel gestao.
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
  if p_papel = 'gestao' then
    raise exception 'O perfil Gerência não existe mais. Use operador e defina o acesso pelas atribuições.';
  end if;
  if p_papel is not null and p_papel <> 'operador' and not public.fn_eh_admin() then
    raise exception 'Só o administrador dá o papel de administrador.' using errcode = '42501';
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

-- fn_pode_ver_colaborador: o operador do 211 vê todos (para redefinir acesso e liberar locais); a gerência sai.
-- Cópia de 20261014100000_colaboradores_acesso.sql.
create or replace function public.fn_pode_ver_colaborador(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_usuario = (select auth.uid())
      or public.fn_eh_gestora() or public.fn_eh_admin() or public.fn_eh_operador_regional()
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

-- Quem redefine o acesso (senha) de quem:
--   admin e gestora: como em fn_gere_colaborador;
--   operador do 211: qualquer membro atual de equipe;
--   supervisor e operador de base: membros atuais das equipes do grupo.
-- Nunca o próprio acesso, e nunca de quem é administrador.
create or replace function public.fn_redefine_acesso(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.fn_gere_colaborador(p_usuario)
      or (p_usuario <> (select auth.uid())
          and exists (select 1 from public.perfis where id = p_usuario and papel = 'operador')
          and exists (
            select 1 from public.equipe_membros m
             where m.colaborador_id = p_usuario and m.fim is null
               and (public.fn_eh_operador_regional() or public.fn_supervisiona_equipe(m.equipe_id))
          ))
$$;


-- rpc_preparar_redefinicao_senha: supervisor, operador de base e operador do 211 também redefinem (seção 3 da spec)
-- Cópia de 20261014100000_colaboradores_acesso.sql.
create or replace function public.rpc_preparar_redefinicao_senha(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil public.perfis;
begin
  perform interno.fn_usuario();
  select * into v_perfil from public.perfis where id = p_id for update;
  if not found then
    raise exception 'Colaborador não encontrado.';
  end if;
  if not public.fn_redefine_acesso(p_id) then
    raise exception 'Você não redefine o acesso de %. Peça à gestão do almoxarifado.', v_perfil.nome using errcode = '42501';
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

-- ---------------------------------------------------------------------
-- 7. Disponível do 211 para quem monta pedido
-- A equipe não vê. Por enquanto disponível = físico; a fase de
-- Solicitações desconta o separado.
-- ---------------------------------------------------------------------
create or replace function public.fn_disponivel_211()
returns table (
  almox_id     uuid,
  material_id  uuid,
  codigo_sap   text,
  descricao    text,
  unidade      text,
  disponivel   numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform interno.fn_usuario();
  if not (public.fn_eh_admin() or public.fn_eh_gestora() or public.fn_eh_operador_regional()
          or public.fn_eh_supervisor_de_grupo()
          or exists (select 1
                       from public.atribuicoes a
                       join public.perfis p on p.id = a.usuario_id
                      where a.usuario_id = (select auth.uid()) and p.ativo
                        and a.funcao::text = 'supervisor')) then
    raise exception 'O estoque do 211 Geral aparece só para supervisor, operador e gestão do almoxarifado.'
      using errcode = '42501';
  end if;

  return query
  select mv.almox_id, mv.material_id, m.codigo_sap, m.descricao, m.unidade,
         sum(mv.quantidade)::numeric(12,3)
    from public.movimentacoes mv
    join public.almoxarifados a on a.id = mv.almox_id
    join public.materiais m on m.id = mv.material_id
   where a.tipo = 'regional'
   group by mv.almox_id, mv.material_id, m.codigo_sap, m.descricao, m.unidade
  having sum(mv.quantidade) > 0
   order by m.descricao;
end;
$$;

-- ---------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on all functions in schema interno from public;
grant execute on function public.rpc_email_para_login(text) to service_role;
