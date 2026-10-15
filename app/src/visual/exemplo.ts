/**
 * Estrutura e regras do Início (modo foco visual).
 * Os dados de exemplo saíram em 15/10/2026: as listas abaixo começam vazias e
 * cada uma passa a vir do banco quando a parte dela for ligada (ver comentário em cada bloco).
 * Ficam aqui só a estrutura real (bases, grupos) e as regras puras.
 *
 * Hierarquia: 3256 (almoxarifado geral) → 211 Geral (GV, um estoque central só) → 4 grupos de sub-bases.
 * Comercial e moto retiram direto do estoque central do 211: não têm estoque próprio.
 */

export type Tom = 'ok' | 'alerta' | 'info' | 'transito' | 'neutro'

/** Bases (códigos e nomes reais das 11 bases). Real: almoxarifados tipo 'base'. */
export const BASES = [
  { codigo: 'ITN', nome: 'Itanhomi' },
  { codigo: 'TRM', nome: 'Tarumirim' },
  { codigo: 'RSP', nome: 'Resplendor' },
  { codigo: 'AIM', nome: 'Aimorés' },
  { codigo: 'CPN', nome: 'Conselheiro Pena' },
  { codigo: 'MNT', nome: 'Mantena' },
  { codigo: 'ITB', nome: 'Itabirinha' },
  { codigo: 'CRC', nome: 'Coroaci' },
  { codigo: 'SMS', nome: 'Santa Maria do Suaçuí' },
  { codigo: 'SJE', nome: 'São João Evangelista' },
  { codigo: 'SEF', nome: 'Santa Efigênia' },
] as const

export type CodigoBase = (typeof BASES)[number]['codigo']

/** Supervisores. Nomes no código a pedido do Matheus (13/10), para ficar visual; no banco vêm do cadastro. */
export const SUPERVISORES = ['Pedro', 'Vinícius', 'Victor', 'Elton'] as const
export type Supervisor = (typeof SUPERVISORES)[number]

/** Grupos de sub-bases, um por supervisor. Pedro também responde por GV. */
export const GRUPOS: { id: string; rotulo: Supervisor; bases: CodigoBase[] }[] = [
  { id: 'g1', rotulo: 'Pedro', bases: ['ITN', 'TRM'] },
  { id: 'g2', rotulo: 'Vinícius', bases: ['RSP', 'AIM', 'CPN'] },
  { id: 'g3', rotulo: 'Victor', bases: ['MNT', 'ITB', 'CRC'] },
  { id: 'g4', rotulo: 'Elton', bases: ['SMS', 'SJE', 'SEF'] },
]

export const basesDoSupervisor = (s: Supervisor): CodigoBase[] => GRUPOS.find((g) => g.rotulo === s)?.bases ?? []

// ---------------------------------------------------------------------------
// Colaboradores e equipes.

export type Colaborador = { matricula: string; nome: string; supervisor: Supervisor }
/** Real: v_colaboradores (lista passada pelo Matheus). Vazio até ligar ao banco. */
export const COLABORADORES: Colaborador[] = []

export const colaborador = (matricula: string, lista: Colaborador[] = COLABORADORES) => lista.find((c) => c.matricula === matricula.replace(/\D/g, ''))

export const TIPOS_EQUIPE = ['Moto', 'Moto/Multifuncional'] as const
export type TipoEquipe = (typeof TIPOS_EQUIPE)[number]

/**
 * Equipe que retira material. Retira no 211 Geral sempre; nas bases, só nas liberadas. Não consulta estoque.
 * Base de origem = onde a equipe inicia a jornada (uma base ou o 211 Geral). Escolhida no cadastro; é por ela que a equipe aparece no mapa da base.
 */
export type Equipe = { id: string; codigo: string; tipo: TipoEquipe; supervisor: Supervisor; integrantes: string[]; bases: CodigoBase[]; placa: string; origem: CodigoLocal }

/** Bases liberadas ao cadastrar: moto pode todas (por enquanto); as outras, as do grupo do supervisor. */
export const basesPadrao = (tipo: TipoEquipe, supervisor: Supervisor): CodigoBase[] => (tipo === 'Moto' ? BASES.map((b) => b.codigo) : basesDoSupervisor(supervisor))

/** Real: equipes + equipe_locais + equipe_membros. Vazio até ligar ao banco. */
export const EQUIPES: Equipe[] = []

/** Equipes que iniciam a jornada neste local: são as caixinhas do mapa da base. */
export const equipesDaOrigem = (local: CodigoLocal, equipes: Equipe[]) => equipes.filter((e) => e.origem === local)

export const equipeDe = (matricula: string, equipes: Equipe[]) => equipes.find((e) => e.integrantes.includes(matricula.replace(/\D/g, '')))

/** Retirar no 211 Geral todas podem; numa base, só se ela estiver liberada para a equipe. */
export const podeRetirar = (e: Equipe, local: CodigoLocal) => local === '211' || e.bases.includes(local)

const PLACA = /^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/
export const normalizarPlaca = (p: string) => p.trim().toUpperCase().replace(/\s/g, '')

/** Tudo obrigatório no cadastro, para não ficar errado. Devolve o que falta (vazio = pode salvar). */
export function validarEquipe(
  e: Omit<Equipe, 'id' | 'origem'> & { id?: string; origem: CodigoLocal | '' },
  equipes: Equipe[],
  colaboradores: Colaborador[] = COLABORADORES,
): string[] {
  const erros: string[] = []
  const codigo = e.codigo.trim().toUpperCase()
  if (!codigo) erros.push('Informe o nome ou código da equipe (ex.: MOTO 03).')
  else if (equipes.some((x) => x.id !== e.id && x.codigo.toUpperCase() === codigo)) erros.push(`Já existe uma equipe ${codigo}. Use outro código.`)
  if (!TIPOS_EQUIPE.includes(e.tipo)) erros.push('Escolha o tipo da equipe.')
  if (!SUPERVISORES.includes(e.supervisor)) erros.push('Escolha o supervisor.')
  if (!e.integrantes.length) erros.push('Adicione ao menos um integrante pela matrícula.')
  for (const m of e.integrantes) {
    if (!colaborador(m, colaboradores)) erros.push(`Matrícula ${m} não está na lista de colaboradores.`)
    const outra = equipes.find((x) => x.id !== e.id && x.integrantes.includes(m))
    if (outra) erros.push(`Matrícula ${m} já está na equipe ${outra.codigo}. Tire de lá antes.`)
  }
  if (!e.bases.length) erros.push('Libere ao menos uma base para retirada.')
  if (!e.origem) erros.push('Escolha a base de origem: onde a equipe inicia a jornada (ou o 211 Geral).')
  else if (e.origem !== '211' && e.bases.length && !e.bases.includes(e.origem)) erros.push(`A base de origem ${e.origem} precisa estar entre as bases liberadas. Marque ${e.origem} ou escolha outra base de origem.`)
  if (!PLACA.test(normalizarPlaca(e.placa))) erros.push('Placa inválida. Use o formato ABC1D23 ou ABC-1234.')
  return erros
}

/** Quem retira direto do estoque central do 211, sem estoque próprio. */
export const RETIRAM_DO_211 = ['Comercial', 'Moto'] as const

/** Qualquer local com estoque próprio no mapa: o estoque central do 211 e as bases. */
export type CodigoLocal = '211' | CodigoBase

export function nomeLocal(c: CodigoLocal): string {
  if (c === '211') return '211 Geral'
  return BASES.find((b) => b.codigo === c)?.nome ?? c
}

/** Bases com divergência aberta. Real: v_divergencias_abertas. */
export const BASES_COM_ALERTA: CodigoBase[] = []

/** Indicadores do topo. Real: contagens de pedidos, despachos e divergências. */
export const INDICADORES = [
  { id: 'fila', valor: 0, legenda: 'Solicitações na fila', subindo: false, tom: 'ok' as Tom, barras: [] as number[] },
  { id: 'transito', valor: 0, legenda: 'Despachos em trânsito', subindo: false, tom: 'ok' as Tom, barras: [] as number[] },
  { id: 'divergencias', valor: 0, legenda: 'Divergências abertas', subindo: false, tom: 'ok' as Tom, barras: [] as number[] },
]

// ---------------------------------------------------------------------------
// Solicitações das bases

export type Decisao = 'Aprovado' | 'Reduzido' | 'Sem saldo' | 'Cancelado'
export type ItemSolicitacao = {
  material: string
  codigo: string
  unidade: string
  solicitado: number
  /** Disponível no 211 (físico − separado). */
  disponivel: number
  /** Consumo da base nos últimos 90 dias. */
  consumo90: number
  /** Saldo atual na base que pediu. */
  saldoBase: number
  /** Sugestão (aguardando) ou decisão tomada (aprovada/enviada). */
  decisao: Decisao
  aprovado: number
}
export type SituacaoSolicitacao = 'aguardando' | 'aprovada' | 'divergencia' | 'enviada'
export type Solicitacao = {
  id: string
  numero: string
  base: CodigoBase
  situacao: SituacaoSolicitacao
  aberta: string
  /** Despacho gerado a partir dela, quando já saiu. */
  despacho?: string
  itens: ItemSolicitacao[]
}

/** Fila de solicitações. Real: pedidos + pedido_itens. As enviadas sem pendência vão para o histórico. */
export const SOLICITACOES: Solicitacao[] = []

export const MOTIVOS_REDUCAO = ['Saldo insuficiente no 211', 'Acima do consumo de 90 dias', 'Separado para outra base', 'Pedido em duplicidade', 'Outro'] as const

/** Com o estoque de hoje, dá para atender a solicitação por completo, em parte ou nada? (itens cancelados não contam) */
export type Capacidade = 'completo' | 'parcial' | 'nenhum'
export function capacidade(s: Pick<Solicitacao, 'itens'>): Capacidade {
  const itens = s.itens.filter((i) => i.decisao !== 'Cancelado')
  if (!itens.length) return 'nenhum'
  if (itens.every((i) => i.disponivel >= i.solicitado)) return 'completo'
  if (itens.some((i) => i.disponivel > 0)) return 'parcial'
  return 'nenhum'
}

/** Atendimento da solicitação: quanto do pedido foi (ou será) aprovado. */
export function atendimento(itens: Pick<ItemSolicitacao, 'solicitado' | 'aprovado'>[]): number {
  if (!itens.length) return 0
  const atendido = itens.reduce((t, i) => t + Math.min(1, i.aprovado / i.solicitado), 0)
  return Math.round((atendido / itens.length) * 100)
}

// ---------------------------------------------------------------------------
// Despachos: a caminhonete encosta no 211 Geral e leva material para uma base.
// ID único DSP-AAAA-NNNNN (ano + sequência) para rastrear o que foi, por quem, para onde e quem recebeu.

export type ItemDespacho = { material: string; codigo: string; unidade: string; qtd: number; recebido?: number; seriais?: string[] }
export type Despacho = {
  id: string
  numero: string
  base: CodigoBase
  solicitacao: string
  situacao: string
  conferido: number
  saida: string
  /** Quem despachou (usuário logado no almoxarifado). */
  enviadoPor: string
  veiculo: string
  /** Quem recebeu na base; vazio enquanto não chega. */
  recebidoPor?: string
  recebidoEm?: string
  itens: ItemDespacho[]
  alerta?: boolean
}

/** Despachos ativos (os caminhões no mapa). Real: remessas em_transito / com_divergencia, renomeadas para despacho. */
export const DESPACHOS: Despacho[] = []

/** Próximo número de despacho (no banco vem de uma sequence). */
export const PROXIMO_DESPACHO = 'DSP-2026-00001'

/** Monta o despacho que sai de uma solicitação: só o que foi aprovado (quantidade maior que zero). */
export function despachoDaSolicitacao(s: Solicitacao, aprovados?: Record<string, number>, numero?: string, enviadoPor = ''): Despacho {
  return {
    id: `novo-${s.id}`,
    numero: numero ?? s.despacho ?? PROXIMO_DESPACHO,
    base: s.base,
    solicitacao: s.numero,
    situacao: 'Aguardando carregamento',
    conferido: 0,
    saida: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ''),
    enviadoPor,
    veiculo: '',
    itens: s.itens
      .map((i) => ({ material: i.material, codigo: i.codigo, unidade: i.unidade, qtd: aprovados?.[i.codigo] ?? i.aprovado }))
      .filter((i) => i.qtd > 0),
  }
}

// ---------------------------------------------------------------------------
// Reservas CEMIG: autorização para retirar material no 3256 (uma "carteira").
// Não é estoque físico: o 3256 pode nem ter o material; é o saldo que a Engelmig pode retirar.

export type ItemReserva = { material: string; codigo: string; unidade: string; autorizado: number; retirado: number }
export type Reserva = { numero: string; aberta: string; dias: number; alerta?: boolean; itens: ItemReserva[] }

/** Real: tabela de reservas (fase 4); saldo a retirar = autorizado − retiradas. */
export const RESERVAS: Reserva[] = []

export const saldoReserva = (i: ItemReserva) => i.autorizado - i.retirado

/** Divergências abertas. Real: v_divergencias_abertas. */
export const DIVERGENCIAS: { despacho: string; base: CodigoBase; material: string; motivo: string; qtd: string; dias: number }[] = []

// ---------------------------------------------------------------------------
// Estoque e nível em relação ao mínimo

export type LinhaEstoque = { material: string; codigo: string; unidade: string; saldo: number; minimo: number }
export type NivelItem = 'ok' | 'proximo' | 'abaixo'
/** Nível do local; "sem" = local sem estoque lançado (antes do inventário do dia D). */
export type Nivel = NivelItem | 'sem'

/** Saldo até 20% acima do mínimo conta como "próximo do mínimo". A confirmar com a operação. */
export const MARGEM_PROXIMO = 1.2

export function nivelDoItem(l: LinhaEstoque): NivelItem {
  if (l.saldo < l.minimo) return 'abaixo'
  if (l.saldo <= l.minimo * MARGEM_PROXIMO) return 'proximo'
  return 'ok'
}

/** Nível do local: o pior entre os materiais. */
export function nivelDoLocal(linhas: LinhaEstoque[]): Nivel {
  if (!linhas.length) return 'sem'
  const niveis = linhas.map(nivelDoItem)
  if (niveis.includes('abaixo')) return 'abaixo'
  if (niveis.includes('proximo')) return 'proximo'
  return 'ok'
}

/** Estoque de um local (painel ao clicar no mapa). Real: v_saldo filtrado pelo almoxarifado. Vazio até ligar ao banco. */
export function estoqueDoLocal(_codigo: CodigoLocal): LinhaEstoque[] {
  return []
}

/** Quanto de cada material está a caminho de um local (despachos ainda não conferidos). */
export function aCaminho(codigo: CodigoLocal, material: string): number {
  return DESPACHOS.filter((d) => d.base === codigo && d.conferido < 100)
    .flatMap((d) => d.itens)
    .filter((i) => i.codigo === material)
    .reduce((t, i) => t + i.qtd, 0)
}

// ---------------------------------------------------------------------------
// Gráficos de baixo

/**
 * Cobertura de estoque: quantos dias o estoque de cada base aguenta pelo consumo dos últimos 90 dias.
 * Real: saldo da base ÷ (consumo 90 dias ÷ 90), pelo material mais crítico. Limites a confirmar com a operação.
 */
export const COBERTURA_BASES: { base: CodigoBase; dias: number }[] = []
/** Abaixo disso a base está crítica (vermelho); abaixo de COBERTURA_BOA, em atenção (amarelo). */
export const COBERTURA_CRITICA = 7
export const COBERTURA_BOA = 15

export const ENTREGAS: { solicitado: number[]; entregue: number[] } = { solicitado: [], entregue: [] }

// ---------------------------------------------------------------------------
// Retirada no local: alguém do Comercial ou da Moto chega no balcão do 211 e retira material.
// Também é um despacho (mesma numeração DSP-), só que sai direto para uma matrícula, sem ir para base.

export type ItemRetirada = { material: string; codigo: string; unidade: string; qtd: number; seriais?: string[] }
export type Retirada = {
  id: string
  numero: string
  /** Equipe que retirou (id). */
  equipe: string
  /** Onde retirou: no 211 Geral ou numa base liberada. */
  local: CodigoLocal
  /** Matrícula de quem retirou; nome e supervisão vêm da lista de colaboradores. */
  retiradoPor: string
  /** Nome de quem atendeu (usuário logado no almoxarifado). */
  atendidoPor: string
  data: string
  itens: ItemRetirada[]
  observacao?: string
  /** Foto ou PDF do termo assinado. Sem ele a retirada continua pendente na Saída de material. */
  guiaAssinada?: AnexoGuia
}

/** Termo assinado que volta para o sistema. No banco o arquivo vai para o Storage; aqui só fica na sessão. */
export type AnexoGuia = { arquivo: string; formato: 'foto' | 'pdf'; anexadoEm: string; anexadoPor: string; url?: string }

/** Pendente = ainda falta anexar o termo assinado. */
export const retiradaPendente = (r: Retirada) => !r.guiaAssinada

/** Todas as retiradas de uma matrícula, da mais recente para a mais antiga. */
export function retiradasDaMatricula(retiradas: Retirada[], matricula: string) {
  const m = matricula.replace(/\D/g, '')
  return retiradas.filter((r) => r.retiradoPor === m).sort((a, b) => dataOrdenavel(b.data).localeCompare(dataOrdenavel(a.data)))
}

/** "13/10/2026 14:05" → "2026-10-13 14:05", para ordenar como texto. */
export const dataOrdenavel = (d: string) => `${d.slice(6, 10)}-${d.slice(3, 5)}-${d.slice(0, 2)} ${d.slice(11)}`

/** Tamanho máximo do anexo (foto de celular cabe com folga). */
export const ANEXO_MAX_MB = 10

/** Foto ou PDF; qualquer outro tipo volta com a mensagem do que fazer. */
export function validarAnexo(arquivo: { name: string; type: string; size: number }): { formato: AnexoGuia['formato'] } | { erro: string } {
  const pdf = arquivo.type === 'application/pdf' || /\.pdf$/i.test(arquivo.name)
  const foto = arquivo.type.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(arquivo.name)
  if (!pdf && !foto) return { erro: `${arquivo.name} não é foto nem PDF. Anexe a foto da guia assinada (JPG ou PNG) ou o PDF escaneado.` }
  if (arquivo.size > ANEXO_MAX_MB * 1024 * 1024) return { erro: `${arquivo.name} passa de ${ANEXO_MAX_MB} MB. Tire a foto com resolução menor ou comprima o PDF e anexe de novo.` }
  return { formato: pdf ? 'pdf' : 'foto' }
}

/** Material controlado por serial (medidor): a quantidade é a contagem dos seriais bipados. */
export const MATERIAIS_SERIALIZADOS = new Set<string>()

/**
 * Caixas de medidor com os seriais dentro. Não há número fixo por caixa (umas vêm com 16, outras com menos):
 * a quantidade é a da própria caixa, contada pelos seriais. Real: cadastro das caixas recebidas (etiqueta com código de barras).
 */
export type Caixas = Record<string, { codigo: string; seriais: string[] }>
export const CAIXAS_MEDIDOR: Caixas = {}

/** Caixa de onde saiu um serial (ou nada, se for avulso). */
export const caixaDoSerial = (serial: string, caixas: Caixas = CAIXAS_MEDIDOR) => Object.keys(caixas).find((cx) => caixas[cx].seriais.includes(serial))

/** O que um código bipado representa: uma caixa inteira, um serial avulso ou nada conhecido. */
export function lerCodigo(bruto: string, caixas: Caixas = CAIXAS_MEDIDOR): { tipo: 'caixa'; caixa: string; codigo: string; seriais: string[] } | { tipo: 'serial'; codigo: string; serial: string } | { tipo: 'desconhecido' } {
  const codigo = bruto.trim().toUpperCase()
  const caixa = caixas[codigo]
  if (caixa) return { tipo: 'caixa', caixa: codigo, codigo: caixa.codigo, seriais: caixa.seriais }
  for (const c of Object.values(caixas)) if (c.seriais.includes(codigo)) return { tipo: 'serial', codigo: c.codigo, serial: codigo }
  return { tipo: 'desconhecido' }
}

/** Real: saídas com equipe + guias_assinadas. Vazio até ligar ao banco. */
export const RETIRADAS: Retirada[] = []

/**
 * Material no carro da equipe: soma do que ela retirou, por material, com os seriais.
 * Ainda não desconta o que foi aplicado em campo (essa baixa entra quando ligarmos ao sistema real).
 */
export function estoqueDoCarro(equipe: string, retiradas: Retirada[]): ItemRetirada[] {
  const porCodigo = new Map<string, ItemRetirada>()
  for (const r of retiradas) {
    if (r.equipe !== equipe) continue
    for (const i of r.itens) {
      const atual = porCodigo.get(i.codigo)
      if (!atual) porCodigo.set(i.codigo, { ...i, seriais: i.seriais ? [...i.seriais] : undefined })
      else {
        atual.qtd += i.qtd
        if (i.seriais) atual.seriais = [...(atual.seriais ?? []), ...i.seriais]
      }
    }
  }
  return [...porCodigo.values()].sort((a, b) => a.material.localeCompare(b.material, 'pt-BR'))
}

/** Primeiro número livre de despacho (no banco vem de uma sequence). */
export const SEQUENCIA_INICIAL = 1
export const numeroDespacho = (n: number) => `DSP-2026-${String(n).padStart(5, '0')}`

/** Materiais de um local com saldo, para montar despacho (sempre do 211) ou retirada (211 ou base). */
export function materiaisDo211(local: CodigoLocal = '211') {
  return estoqueDoLocal(local).map((l) => ({ ...l, serializado: MATERIAIS_SERIALIZADOS.has(l.codigo) }))
}

/**
 * Resumo por caixa a partir dos seriais: "CX-0418 inteira (16) + 4 de CX-0419 (16)".
 * A conta é pela caixa bipada, não por um número fixo de unidades por caixa.
 */
export function emCaixas(seriais?: string[], caixas: Caixas = CAIXAS_MEDIDOR): string | null {
  if (!seriais?.length) return null
  const porCaixa = new Map<string, number>()
  let avulsos = 0
  for (const x of seriais) {
    const cx = caixaDoSerial(x, caixas)
    if (cx) porCaixa.set(cx, (porCaixa.get(cx) ?? 0) + 1)
    else avulsos++
  }
  const partes = [...porCaixa].map(([cx, n]) => {
    const total = caixas[cx].seriais.length
    return n === total ? `${cx} inteira (${total})` : `${n} de ${cx} (${total})`
  })
  if (avulsos) partes.push(`${avulsos} avulso${avulsos === 1 ? '' : 's'}`)
  return partes.join(' + ')
}
