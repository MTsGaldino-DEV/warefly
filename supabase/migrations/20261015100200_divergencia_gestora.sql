-- =====================================================================
-- Warefly · Perfis e permissões — parte 3 (decisão de 15/10: opção B)
-- Divergência: a base registra a falta ou sobra no recebimento e escreve a
-- justificativa; quem aplica o tratamento (e mexe no saldo) é a gestão do
-- almoxarifado ou o admin. O operador do 211 não trata nem justifica.
-- Também: o operador do 211 vê todas as equipes, mesmo sem local liberado.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Justificativa da base
-- ---------------------------------------------------------------------
create table public.divergencia_justificativas (
  id               uuid primary key default gen_random_uuid(),
  remessa_item_id  uuid not null references public.remessa_itens (id),
  justificativa    text not null,
  justificado_por  uuid not null references public.perfis (id),
  justificado_em   timestamptz not null default now(),
  constraint divergencia_justificativas_texto_ck check (justificativa = btrim(justificativa) and justificativa <> '')
);

create index divergencia_justificativas_item_idx on public.divergencia_justificativas (remessa_item_id);

comment on table public.divergencia_justificativas is
  'O que a base explica sobre a falta ou sobra. Não mexe no saldo: a gestão lê e aplica o tratamento. Nada é apagado.';

alter table public.divergencia_justificativas enable row level security;
create policy divergencia_justificativas_select on public.divergencia_justificativas
  for select to authenticated
  using (exists (select 1 from public.remessa_itens ri where ri.id = remessa_item_id));
revoke all on public.divergencia_justificativas from anon, authenticated;
grant select on public.divergencia_justificativas to authenticated;

-- Quem responde pela origem ou pelo destino (supervisor, operador de base,
-- gestora) justifica. Só enquanto o item tem divergência em aberto.
create or replace function public.rpc_justificar_divergencia(p_remessa_item_id uuid, p_justificativa text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario   uuid := interno.fn_usuario();
  v_item      public.remessa_itens;
  v_remessa   public.remessas;
  v_em_aberto numeric;
  v_id        uuid;
begin
  select * into v_item from public.remessa_itens where id = p_remessa_item_id;
  if not found then
    raise exception 'Item de remessa não encontrado.';
  end if;
  select * into v_remessa from public.remessas where id = v_item.remessa_id;

  if not (public.fn_eh_responsavel(v_remessa.origem_id) or public.fn_eh_responsavel(v_remessa.destino_id)) then
    raise exception 'Você não responde pela origem nem pelo destino da %. Peça ao supervisor da base.',
      interno.fn_doc('REM', v_remessa.numero) using errcode = '42501';
  end if;
  if v_remessa.status <> 'com_divergencia' then
    raise exception 'A remessa % não tem divergência em aberto.', interno.fn_doc('REM', v_remessa.numero);
  end if;

  v_em_aberto := abs(v_item.qtd_enviada - coalesce(v_item.qtd_recebida, v_item.qtd_enviada)) - coalesce(
    (select sum(quantidade) from public.divergencia_tratamentos where remessa_item_id = p_remessa_item_id), 0);
  if v_em_aberto <= 0 then
    raise exception 'O item % não tem divergência em aberto.', interno.fn_material_rotulo(v_item.material_id);
  end if;
  if interno.fn_texto(p_justificativa) is null then
    raise exception 'Escreva a justificativa: o que aconteceu com %.', interno.fn_material_rotulo(v_item.material_id);
  end if;

  insert into public.divergencia_justificativas (remessa_item_id, justificativa, justificado_por)
  values (p_remessa_item_id, interno.fn_texto(p_justificativa), v_usuario)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Tratamento só pela gestão do almoxarifado e pelo admin
-- ---------------------------------------------------------------------

-- Cópia de 20261015100100_perfis_permissoes.sql; muda só a checagem de permissão.
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

  -- Quem aplica o tratamento é a gestão do almoxarifado do lado afetado, ou o
  -- admin. A base registra a justificativa (rpc_justificar_divergencia).
  if not (public.fn_eh_admin()
          or public.fn_gere_local(case when v_do_destino then v_remessa.destino_id else v_remessa.origem_id end)) then
    raise exception 'Só a gestão do almoxarifado trata divergência. Registre a justificativa da base para a gestão analisar.'
      using errcode = '42501';
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

-- ---------------------------------------------------------------------
-- 3. Divergências em aberto com a última justificativa da base
-- (colunas novas no fim; as anteriores não mudam)
-- ---------------------------------------------------------------------
create or replace view public.v_divergencias_abertas
with (security_invoker = true)
as
select
  ri.id              as remessa_item_id,
  r.id               as remessa_id,
  r.numero           as remessa_numero,
  r.tipo             as remessa_tipo,
  r.status           as remessa_status,
  r.pedido_id,
  r.origem_id,
  o.codigo           as origem_codigo,
  o.nome             as origem_nome,
  r.destino_id,
  d.codigo           as destino_codigo,
  d.nome             as destino_nome,
  r.data_envio,
  r.data_recebimento,
  (public.fn_hoje() - r.data_recebimento) as dias_em_aberto,
  ri.material_id,
  m.codigo_sap,
  m.descricao,
  m.unidade,
  ri.qtd_enviada,
  ri.qtd_recebida,
  ri.motivo_divergencia,
  (ri.qtd_enviada - ri.qtd_recebida)::numeric(12,3)                              as diferenca,
  coalesce(t.qtd_tratada, 0)::numeric(12,3)                                     as qtd_tratada,
  (abs(ri.qtd_enviada - ri.qtd_recebida) - coalesce(t.qtd_tratada, 0))::numeric(12,3) as qtd_em_aberto,
  j.justificativa    as justificativa_base,
  j.justificado_por,
  j.justificado_em
from public.remessa_itens ri
join public.remessas r on r.id = ri.remessa_id
join public.almoxarifados o on o.id = r.origem_id
join public.almoxarifados d on d.id = r.destino_id
join public.materiais m on m.id = ri.material_id
left join (
  select remessa_item_id, sum(quantidade) as qtd_tratada
    from public.divergencia_tratamentos
   group by remessa_item_id
) t on t.remessa_item_id = ri.id
left join lateral (
  select dj.justificativa, dj.justificado_por, dj.justificado_em
    from public.divergencia_justificativas dj
   where dj.remessa_item_id = ri.id
   order by dj.justificado_em desc, dj.id desc
   limit 1
) j on true
where ri.qtd_recebida is not null
  and ri.qtd_recebida <> ri.qtd_enviada
  and abs(ri.qtd_enviada - ri.qtd_recebida) - coalesce(t.qtd_tratada, 0) > 0;

-- ---------------------------------------------------------------------
-- 4. Operador do 211 vê todas as equipes (inclusive sem local liberado)
-- ---------------------------------------------------------------------

-- Cópia de 20261014100000_colaboradores_acesso.sql; troca a gerência (que não existe mais) pelo operador do 211.
create or replace function public.fn_pode_ver_equipe(p_equipe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.fn_eh_gestora() or public.fn_eh_admin() or public.fn_eh_operador_regional()
      or public.fn_supervisiona_equipe(p_equipe_id)
      or public.fn_membro_da_equipe(p_equipe_id)
      or exists (
        select 1 from public.equipe_locais el
         where el.equipe_id = p_equipe_id and public.fn_pode_ver(el.almox_id)
      )
$$;

-- ---------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on all functions in schema interno from public;
grant execute on function public.rpc_email_para_login(text) to service_role;
