/**
 * DADOS DE EXEMPLO do modo foco visual (só no `npm run dev`).
 * Servem para acertar a interface com a tela cheia; nada aqui vem do banco nem é gravado.
 * Quando o visual for aprovado, cada bloco é trocado pela consulta real (ver comentário em cada um).
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
// Colaboradores e equipes. EXEMPLO: o Matheus vai passar a lista real de colaboradores.

export type Colaborador = { matricula: string; nome: string; supervisor: Supervisor }
export const COLABORADORES: Colaborador[] = [
  { matricula: '52210', nome: 'Carlos Henrique Souza', supervisor: 'Pedro' },
  { matricula: '52877', nome: 'Wesley Martins', supervisor: 'Vinícius' },
  { matricula: '49301', nome: 'Rodrigo Alves', supervisor: 'Victor' },
  { matricula: '49422', nome: 'Diego Ferreira', supervisor: 'Victor' },
  { matricula: '50110', nome: 'Anderson Lima', supervisor: 'Elton' },
  { matricula: '50733', nome: 'Lucas Pereira', supervisor: 'Vinícius' },
  { matricula: '51388', nome: 'Gustavo Rocha', supervisor: 'Victor' },
  { matricula: '47720', nome: 'Fábio Nunes', supervisor: 'Elton' },
  { matricula: '53004', nome: 'Rafael Costa', supervisor: 'Pedro' },
  { matricula: '53119', nome: 'Thiago Batista', supervisor: 'Elton' },
  { matricula: '40217', nome: 'Marcos Vieira', supervisor: 'Pedro' },
  { matricula: '38102', nome: 'Paulo Ribeiro', supervisor: 'Pedro' },
  { matricula: '54210', nome: 'Bruno Teixeira', supervisor: 'Pedro' },
  { matricula: '54388', nome: 'Henrique Moura', supervisor: 'Pedro' },
  { matricula: '54412', nome: 'Leandro Santos', supervisor: 'Pedro' },
  { matricula: '54590', nome: 'Mateus Oliveira', supervisor: 'Vinícius' },
  { matricula: '54611', nome: 'Renato Dias', supervisor: 'Vinícius' },
  { matricula: '54733', nome: 'Felipe Araújo', supervisor: 'Vinícius' },
  { matricula: '54802', nome: 'Vitor Hugo Cardoso', supervisor: 'Victor' },
  { matricula: '54915', nome: 'Igor Mendes', supervisor: 'Victor' },
  { matricula: '55021', nome: 'Samuel Gomes', supervisor: 'Elton' },
  { matricula: '55136', nome: 'Júlio César Reis', supervisor: 'Elton' },
  { matricula: '55240', nome: 'Alex Fernandes', supervisor: 'Elton' },
  { matricula: '55377', nome: 'Caio Almeida', supervisor: 'Pedro' },
]

export const colaborador = (matricula: string) => COLABORADORES.find((c) => c.matricula === matricula.replace(/\D/g, ''))

export const TIPOS_EQUIPE = ['Moto', 'Moto/Multifuncional'] as const
export type TipoEquipe = (typeof TIPOS_EQUIPE)[number]

/**
 * Equipe que retira material. Retira no 211 Geral sempre; nas bases, só nas liberadas. Não consulta estoque.
 * Base de origem = onde a equipe inicia a jornada (uma base ou o 211 Geral). Escolhida no cadastro; é por ela que a equipe aparece no mapa da base.
 */
export type Equipe = { id: string; codigo: string; tipo: TipoEquipe; supervisor: Supervisor; integrantes: string[]; bases: CodigoBase[]; placa: string; origem: CodigoLocal }

/** Bases liberadas ao cadastrar: moto pode todas (por enquanto); as outras, as do grupo do supervisor. */
export const basesPadrao = (tipo: TipoEquipe, supervisor: Supervisor): CodigoBase[] => (tipo === 'Moto' ? BASES.map((b) => b.codigo) : basesDoSupervisor(supervisor))

export const EQUIPES: Equipe[] = [
  { id: 'e1', codigo: 'MOTO 01', tipo: 'Moto', supervisor: 'Pedro', integrantes: ['52210'], bases: basesPadrao('Moto', 'Pedro'), placa: 'RTA2B09', origem: '211' },
  { id: 'e2', codigo: 'MOTO 02', tipo: 'Moto', supervisor: 'Vinícius', integrantes: ['52877'], bases: basesPadrao('Moto', 'Vinícius'), placa: 'QXP4E21', origem: 'RSP' },
  { id: 'e3', codigo: 'MULT 01', tipo: 'Moto/Multifuncional', supervisor: 'Victor', integrantes: ['49301', '49422'], bases: basesPadrao('Moto/Multifuncional', 'Victor'), placa: 'PUV7C33', origem: 'MNT' },
  { id: 'e4', codigo: 'MULT 02', tipo: 'Moto/Multifuncional', supervisor: 'Elton', integrantes: ['50110', '53119'], bases: basesPadrao('Moto/Multifuncional', 'Elton'), placa: 'SBA2F18', origem: 'SMS' },
  { id: 'e5', codigo: 'MULT 03', tipo: 'Moto/Multifuncional', supervisor: 'Vinícius', integrantes: ['50733'], bases: basesPadrao('Moto/Multifuncional', 'Vinícius'), placa: 'RVX9D41', origem: 'AIM' },
  { id: 'e6', codigo: 'MULT 04', tipo: 'Moto/Multifuncional', supervisor: 'Pedro', integrantes: ['53004', '54210'], bases: basesPadrao('Moto/Multifuncional', 'Pedro'), placa: 'SCD3A17', origem: 'ITN' },
  { id: 'e7', codigo: 'MOTO 03', tipo: 'Moto', supervisor: 'Pedro', integrantes: ['54388'], bases: basesPadrao('Moto', 'Pedro'), placa: 'RTB5C62', origem: 'ITN' },
  { id: 'e8', codigo: 'MULT 05', tipo: 'Moto/Multifuncional', supervisor: 'Pedro', integrantes: ['54412'], bases: basesPadrao('Moto/Multifuncional', 'Pedro'), placa: 'QWE1F45', origem: 'TRM' },
  { id: 'e9', codigo: 'MULT 06', tipo: 'Moto/Multifuncional', supervisor: 'Vinícius', integrantes: ['54590', '54611'], bases: basesPadrao('Moto/Multifuncional', 'Vinícius'), placa: 'PXR8B20', origem: 'RSP' },
  { id: 'e10', codigo: 'MULT 07', tipo: 'Moto/Multifuncional', supervisor: 'Vinícius', integrantes: ['54733'], bases: basesPadrao('Moto/Multifuncional', 'Vinícius'), placa: 'SAK4D73', origem: 'CPN' },
  { id: 'e11', codigo: 'MULT 08', tipo: 'Moto/Multifuncional', supervisor: 'Victor', integrantes: ['51388'], bases: basesPadrao('Moto/Multifuncional', 'Victor'), placa: 'RLM6E04', origem: 'ITB' },
  { id: 'e12', codigo: 'MOTO 04', tipo: 'Moto', supervisor: 'Victor', integrantes: ['54802'], bases: basesPadrao('Moto', 'Victor'), placa: 'QJH2C88', origem: 'MNT' },
  { id: 'e13', codigo: 'MULT 09', tipo: 'Moto/Multifuncional', supervisor: 'Victor', integrantes: ['54915'], bases: basesPadrao('Moto/Multifuncional', 'Victor'), placa: 'SBN7A31', origem: 'CRC' },
  { id: 'e14', codigo: 'MULT 10', tipo: 'Moto/Multifuncional', supervisor: 'Elton', integrantes: ['47720', '55021'], bases: basesPadrao('Moto/Multifuncional', 'Elton'), placa: 'PTZ3F09', origem: 'SJE' },
  { id: 'e15', codigo: 'MOTO 05', tipo: 'Moto', supervisor: 'Elton', integrantes: ['55136'], bases: basesPadrao('Moto', 'Elton'), placa: 'RUC9B56', origem: 'SMS' },
  { id: 'e16', codigo: 'MULT 11', tipo: 'Moto/Multifuncional', supervisor: 'Elton', integrantes: ['55240'], bases: basesPadrao('Moto/Multifuncional', 'Elton'), placa: 'SDF5E12', origem: 'SEF' },
]

/** Equipes que iniciam a jornada neste local: são as caixinhas do mapa da base. */
export const equipesDaOrigem = (local: CodigoLocal, equipes: Equipe[]) => equipes.filter((e) => e.origem === local)

export const equipeDe = (matricula: string, equipes: Equipe[]) => equipes.find((e) => e.integrantes.includes(matricula.replace(/\D/g, '')))

/** Retirar no 211 Geral todas podem; numa base, só se ela estiver liberada para a equipe. */
export const podeRetirar = (e: Equipe, local: CodigoLocal) => local === '211' || e.bases.includes(local)

const PLACA = /^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/
export const normalizarPlaca = (p: string) => p.trim().toUpperCase().replace(/\s/g, '')

/** Tudo obrigatório no cadastro, para não ficar errado. Devolve o que falta (vazio = pode salvar). */
export function validarEquipe(e: Omit<Equipe, 'id' | 'origem'> & { id?: string; origem: CodigoLocal | '' }, equipes: Equipe[]): string[] {
  const erros: string[] = []
  const codigo = e.codigo.trim().toUpperCase()
  if (!codigo) erros.push('Informe o nome ou código da equipe (ex.: MOTO 03).')
  else if (equipes.some((x) => x.id !== e.id && x.codigo.toUpperCase() === codigo)) erros.push(`Já existe uma equipe ${codigo}. Use outro código.`)
  if (!TIPOS_EQUIPE.includes(e.tipo)) erros.push('Escolha o tipo da equipe.')
  if (!SUPERVISORES.includes(e.supervisor)) erros.push('Escolha o supervisor.')
  if (!e.integrantes.length) erros.push('Adicione ao menos um integrante pela matrícula.')
  for (const m of e.integrantes) {
    if (!colaborador(m)) erros.push(`Matrícula ${m} não está na lista de colaboradores.`)
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
export const BASES_COM_ALERTA: CodigoBase[] = ['SMS']

/** Indicadores do topo. Real: contagens de pedidos, despachos e divergências. */
export const INDICADORES = [
  { id: 'fila', valor: 14, legenda: 'Solicitações na fila', subindo: true, tom: 'ok' as Tom, barras: [12, 18, 10, 22, 16, 26, 14, 30, 20, 38, 24, 18, 28, 16] },
  { id: 'transito', valor: 7, legenda: 'Despachos em trânsito', subindo: true, tom: 'ok' as Tom, barras: [14, 10, 20, 16, 24, 12, 28, 18, 34, 22, 30, 40, 16, 20] },
  { id: 'divergencias', valor: 3, legenda: 'Divergências abertas', subindo: false, tom: 'alerta' as Tom, barras: [10, 16, 12, 20, 14, 26, 32, 18, 22, 12, 16, 10, 20, 14] },
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

const it = (material: string, codigo: string, unidade: string, solicitado: number, disponivel: number, consumo90: number, saldoBase: number, decisao: Decisao, aprovado: number): ItemSolicitacao => ({
  material, codigo, unidade, solicitado, disponivel, consumo90, saldoBase, decisao, aprovado,
})

/** Fila de solicitações. Real: pedidos + pedido_itens. As enviadas sem pendência vão para o histórico. */
export const SOLICITACOES: Solicitacao[] = [
  {
    id: 's1', numero: 'SOL-0142', base: 'RSP', situacao: 'aguardando', aberta: '13/10/2026 07:52',
    itens: [
      it('Cabo multiplex 2x16 mm²', '10061204', 'm', 120, 84, 310, 22, 'Reduzido', 84),
      it('Conector perfuração 16-70', '10044870', 'pç', 40, 260, 58, 31, 'Aprovado', 40),
      it('Medidor monofásico', '10052311', 'un', 6, 4, 9, 1, 'Reduzido', 4),
      it('Fita isolante 19 mm', '10030117', 'rl', 20, 52, 74, 18, 'Aprovado', 20),
    ],
  },
  {
    id: 's8', numero: 'SOL-0143', base: 'CRC', situacao: 'aguardando', aberta: '13/10/2026 08:20',
    itens: [it('Medidor monofásico', '10052311', 'un', 8, 0, 14, 0, 'Sem saldo', 0)],
  },
  {
    id: 's4', numero: 'SOL-0141', base: 'AIM', situacao: 'aguardando', aberta: '13/10/2026 07:10',
    itens: [
      it('Haste de aterramento 2,4 m', '10027745', 'pç', 18, 9, 40, 4, 'Reduzido', 9),
      it('Fita isolante 19 mm', '10030117', 'rl', 10, 52, 12, 26, 'Cancelado', 0),
    ],
  },
  {
    id: 's2', numero: 'SOL-0139', base: 'MNT', situacao: 'aprovada', aberta: '12/10/2026 16:20',
    itens: [
      it('Fita isolante 19 mm', '10030117', 'rl', 30, 52, 74, 14, 'Aprovado', 30),
      it('Haste de aterramento 2,4 m', '10027745', 'pç', 12, 21, 30, 6, 'Aprovado', 12),
    ],
  },
  {
    id: 's3', numero: 'SOL-0137', base: 'SMS', situacao: 'divergencia', aberta: '09/10/2026 10:05', despacho: 'DSP-2026-00385',
    itens: [
      it('Lacre polipropileno', '10018832', 'un', 500, 1200, 900, 140, 'Aprovado', 500),
      it('Cabo multiplex 2x16 mm²', '10061204', 'm', 200, 0, 380, 12, 'Sem saldo', 0),
    ],
  },
  {
    id: 's5', numero: 'SOL-0135', base: 'ITN', situacao: 'enviada', aberta: '12/10/2026 09:30', despacho: 'DSP-2026-00391',
    itens: [it('Conector perfuração 16-70', '10044870', 'pç', 20, 64, 58, 12, 'Aprovado', 20)],
  },
  {
    id: 's6', numero: 'SOL-0133', base: 'MNT', situacao: 'enviada', aberta: '11/10/2026 14:12', despacho: 'DSP-2026-00390',
    itens: [
      it('Haste de aterramento 2,4 m', '10027745', 'pç', 12, 30, 30, 2, 'Aprovado', 12),
      it('Medidor monofásico', '10052311', 'un', 10, 18, 14, 3, 'Aprovado', 10),
      it('Fita isolante 19 mm', '10030117', 'rl', 30, 80, 74, 10, 'Aprovado', 30),
    ],
  },
  {
    id: 's7', numero: 'SOL-0131', base: 'RSP', situacao: 'enviada', aberta: '11/10/2026 08:45', despacho: 'DSP-2026-00388',
    itens: [
      it('Cabo multiplex 2x16 mm²', '10061204', 'm', 150, 300, 310, 40, 'Aprovado', 150),
      it('Conector perfuração 16-70', '10044870', 'pç', 60, 260, 58, 20, 'Aprovado', 60),
    ],
  },
]

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
export const DESPACHOS: Despacho[] = [
  {
    id: 'd1', numero: 'DSP-2026-00388', base: 'RSP', solicitacao: 'SOL-0131', situacao: 'Em trânsito', conferido: 0,
    saida: '13/10/2026 08:14', enviadoPor: 'Marcos Vieira', veiculo: 'QXP-4E21',
    itens: [
      { material: 'Cabo multiplex 2x16 mm²', codigo: '10061204', unidade: 'm', qtd: 150 },
      { material: 'Conector perfuração 16-70', codigo: '10044870', unidade: 'pç', qtd: 60 },
    ],
  },
  {
    id: 'd2', numero: 'DSP-2026-00390', base: 'MNT', solicitacao: 'SOL-0133', situacao: 'Chegou, em conferência', conferido: 54,
    saida: '12/10/2026 15:40', enviadoPor: 'Marcos Vieira', veiculo: 'RTA-2B09', recebidoPor: 'Gustavo Rocha', recebidoEm: '13/10/2026 09:05',
    itens: [
      { material: 'Haste de aterramento 2,4 m', codigo: '10027745', unidade: 'pç', qtd: 12, recebido: 12 },
      { material: 'Medidor monofásico', codigo: '10052311', unidade: 'un', qtd: 10 },
      { material: 'Fita isolante 19 mm', codigo: '10030117', unidade: 'rl', qtd: 30 },
    ],
  },
  {
    id: 'd3', numero: 'DSP-2026-00385', base: 'SMS', solicitacao: 'SOL-0137', situacao: 'Com divergência', conferido: 100,
    saida: '10/10/2026 09:02', enviadoPor: 'Paulo Ribeiro', veiculo: 'QXP-4E21', recebidoPor: 'Fábio Nunes', recebidoEm: '10/10/2026 14:31', alerta: true,
    itens: [{ material: 'Lacre polipropileno', codigo: '10018832', unidade: 'un', qtd: 500, recebido: 485 }],
  },
  {
    id: 'd4', numero: 'DSP-2026-00391', base: 'ITN', solicitacao: 'SOL-0135', situacao: 'Em trânsito', conferido: 0,
    saida: '13/10/2026 10:30', enviadoPor: 'Paulo Ribeiro', veiculo: 'RTA-2B09',
    itens: [{ material: 'Conector perfuração 16-70', codigo: '10044870', unidade: 'pç', qtd: 20 }],
  },
]

/** Próximo número de despacho (no banco vem de uma sequence). */
export const PROXIMO_DESPACHO = 'DSP-2026-00392'

/** Monta o despacho que sai de uma solicitação: só o que foi aprovado (quantidade maior que zero). */
export function despachoDaSolicitacao(s: Solicitacao, aprovados?: Record<string, number>, numero?: string): Despacho {
  return {
    id: `novo-${s.id}`,
    numero: numero ?? s.despacho ?? PROXIMO_DESPACHO,
    base: s.base,
    solicitacao: s.numero,
    situacao: 'Aguardando carregamento',
    conferido: 0,
    saida: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ''),
    enviadoPor: 'Marcos Vieira',
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
export const RESERVAS: Reserva[] = [
  {
    numero: 'RES-0057', aberta: '09/09/2026', dias: 34, alerta: true,
    itens: [
      { material: 'Cabo multiplex 2x16 mm²', codigo: '10061204', unidade: 'm', autorizado: 2000, retirado: 1650 },
      { material: 'Medidor monofásico', codigo: '10052311', unidade: 'un', autorizado: 120, retirado: 40 },
      { material: 'Haste de aterramento 2,4 m', codigo: '10027745', unidade: 'pç', autorizado: 80, retirado: 80 },
      { material: 'Conector perfuração 16-70', codigo: '10044870', unidade: 'pç', autorizado: 600, retirado: 210 },
    ],
  },
  {
    numero: 'RES-0061', aberta: '28/09/2026', dias: 15,
    itens: [
      { material: 'Lacre polipropileno', codigo: '10018832', unidade: 'un', autorizado: 5000, retirado: 2000 },
      { material: 'Fita isolante 19 mm', codigo: '10030117', unidade: 'rl', autorizado: 300, retirado: 120 },
    ],
  },
  {
    numero: 'RES-0063', aberta: '06/10/2026', dias: 7,
    itens: [
      { material: 'Parafuso cabeça abaulada 16x150', codigo: '10011420', unidade: 'pç', autorizado: 900, retirado: 0 },
      { material: 'Arruela quadrada 38 mm', codigo: '10011987', unidade: 'pç', autorizado: 900, retirado: 150 },
      { material: 'Cabo multiplex 2x16 mm²', codigo: '10061204', unidade: 'm', autorizado: 1500, retirado: 0 },
    ],
  },
  {
    numero: 'RES-0064', aberta: '10/10/2026', dias: 3,
    itens: [{ material: 'Medidor monofásico', codigo: '10052311', unidade: 'un', autorizado: 60, retirado: 0 }],
  },
]

export const saldoReserva = (i: ItemReserva) => i.autorizado - i.retirado

/** Divergências abertas. Real: v_divergencias_abertas. */
export const DIVERGENCIAS = [
  { despacho: 'DSP-2026-00385', base: 'SMS' as CodigoBase, material: 'Lacre polipropileno', motivo: 'Falta', qtd: '−15 un', dias: 3 },
  { despacho: 'DSP-2026-00379', base: 'CRC' as CodigoBase, material: 'Fita isolante 19 mm', motivo: 'Sobra', qtd: '+2 rl', dias: 6 },
  { despacho: 'DSP-2026-00379', base: 'CRC' as CodigoBase, material: 'Haste de aterramento 2,4 m', motivo: 'Avaria', qtd: '−1 pç', dias: 6 },
]

// ---------------------------------------------------------------------------
// Estoque e nível em relação ao mínimo

const CATALOGO = [
  { material: 'Cabo multiplex 2x16 mm²', codigo: '10061204', unidade: 'm' },
  { material: 'Conector perfuração 16-70', codigo: '10044870', unidade: 'pç' },
  { material: 'Fita isolante 19 mm', codigo: '10030117', unidade: 'rl' },
  { material: 'Haste de aterramento 2,4 m', codigo: '10027745', unidade: 'pç' },
  { material: 'Lacre polipropileno', codigo: '10018832', unidade: 'un' },
  { material: 'Medidor monofásico', codigo: '10052311', unidade: 'un' },
  { material: 'Parafuso cabeça abaulada 16x150', codigo: '10011420', unidade: 'pç' },
  { material: 'Arruela quadrada 38 mm', codigo: '10011987', unidade: 'pç' },
]

export type LinhaEstoque = { material: string; codigo: string; unidade: string; saldo: number; minimo: number }
export type Nivel = 'ok' | 'proximo' | 'abaixo'

/** Saldo até 20% acima do mínimo conta como "próximo do mínimo". A confirmar com a operação. */
export const MARGEM_PROXIMO = 1.2

export function nivelDoItem(l: LinhaEstoque): Nivel {
  if (l.saldo < l.minimo) return 'abaixo'
  if (l.saldo <= l.minimo * MARGEM_PROXIMO) return 'proximo'
  return 'ok'
}

/** Nível do local: o pior entre os materiais. */
export function nivelDoLocal(linhas: LinhaEstoque[]): Nivel {
  const niveis = linhas.map(nivelDoItem)
  if (niveis.includes('abaixo')) return 'abaixo'
  if (niveis.includes('proximo')) return 'proximo'
  return 'ok'
}

/** Situação que o exemplo força em alguns locais, para o mapa mostrar as três cores. */
const NIVEL_EXEMPLO: Partial<Record<CodigoLocal, Nivel>> = { SMS: 'abaixo', CRC: 'abaixo', AIM: 'proximo', SEF: 'proximo' }

/** Estoque de um local (painel ao clicar no mapa). Real: v_saldo filtrado pelo almoxarifado. */
export function estoqueDoLocal(codigo: CodigoLocal): LinhaEstoque[] {
  const semente = codigo.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
  const escala = codigo === '211' ? 12 : 1
  const forcado = NIVEL_EXEMPLO[codigo]
  const alvo = semente % CATALOGO.length
  return CATALOGO.map((m, i) => {
    const minimo = (20 + ((semente + i * 7) % 30)) * escala
    let saldo = Math.round(minimo * (1.5 + ((semente * (i + 3)) % 17) / 10))
    if (forcado === 'abaixo' && (i === alvo || i === (alvo + 3) % CATALOGO.length)) saldo = Math.round(minimo * 0.55)
    if (forcado && i === (alvo + 1) % CATALOGO.length) saldo = Math.round(minimo * 1.1)
    return { ...m, saldo, minimo }
  })
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
export const COBERTURA_BASES: { base: CodigoBase; dias: number }[] = [
  { base: 'ITN', dias: 24 }, { base: 'TRM', dias: 31 }, { base: 'RSP', dias: 12 }, { base: 'AIM', dias: 9 },
  { base: 'CPN', dias: 27 }, { base: 'MNT', dias: 18 }, { base: 'ITB', dias: 22 }, { base: 'CRC', dias: 5 },
  { base: 'SMS', dias: 4 }, { base: 'SJE', dias: 16 }, { base: 'SEF', dias: 11 },
]
/** Abaixo disso a base está crítica (vermelho); abaixo de COBERTURA_BOA, em atenção (amarelo). */
export const COBERTURA_CRITICA = 7
export const COBERTURA_BOA = 15

export const ENTREGAS = {
  solicitado: [30, 38, 34, 46, 42, 54, 50, 60, 56, 64, 62],
  entregue: [16, 20, 18, 30, 26, 40, 48, 78, 52, 38, 44],
}

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
export const MATERIAIS_SERIALIZADOS = new Set(['10052311'])

const serie = (prefixo: string, inicio: number, n: number) => Array.from({ length: n }, (_, i) => `${prefixo}${String(inicio + i).padStart(6, '0')}`)

/**
 * Caixas de medidor com os seriais dentro. Não há número fixo por caixa (umas vêm com 16, outras com menos):
 * a quantidade é a da própria caixa, contada pelos seriais. Real: cadastro das caixas recebidas (etiqueta com código de barras).
 */
export const CAIXAS_MEDIDOR: Record<string, { codigo: string; seriais: string[] }> = {
  'CX-0418': { codigo: '10052311', seriais: serie('MF26', 418001, 16) },
  'CX-0419': { codigo: '10052311', seriais: serie('MF26', 419001, 16) },
  'CX-0420': { codigo: '10052311', seriais: serie('MF26', 420001, 12) },
  'CX-0421': { codigo: '10052311', seriais: serie('MF26', 421001, 16) },
  'CX-0422': { codigo: '10052311', seriais: serie('MF26', 422001, 9) },
}

/** Caixa de onde saiu um serial (ou nada, se for avulso). */
export const caixaDoSerial = (serial: string) => Object.keys(CAIXAS_MEDIDOR).find((cx) => CAIXAS_MEDIDOR[cx].seriais.includes(serial))

/** O que um código bipado representa: uma caixa inteira, um serial avulso ou nada conhecido. */
export function lerCodigo(bruto: string): { tipo: 'caixa'; caixa: string; codigo: string; seriais: string[] } | { tipo: 'serial'; codigo: string; serial: string } | { tipo: 'desconhecido' } {
  const codigo = bruto.trim().toUpperCase()
  const caixa = CAIXAS_MEDIDOR[codigo]
  if (caixa) return { tipo: 'caixa', caixa: codigo, codigo: caixa.codigo, seriais: caixa.seriais }
  for (const c of Object.values(CAIXAS_MEDIDOR)) if (c.seriais.includes(codigo)) return { tipo: 'serial', codigo: c.codigo, serial: codigo }
  return { tipo: 'desconhecido' }
}

export const RETIRADAS: Retirada[] = [
  {
    id: 'r1', numero: 'DSP-2026-00389', equipe: 'e1', local: '211', retiradoPor: '52210', atendidoPor: 'Marcos Vieira', data: '13/10/2026 14:05',
    itens: [
      { material: 'Medidor monofásico', codigo: '10052311', unidade: 'un', qtd: 20, seriais: [...CAIXAS_MEDIDOR['CX-0418'].seriais, ...CAIXAS_MEDIDOR['CX-0419'].seriais.slice(0, 4)] },
      { material: 'Lacre polipropileno', codigo: '10018832', unidade: 'un', qtd: 40 },
    ],
  },
  {
    id: 'r2', numero: 'DSP-2026-00387', equipe: 'e3', local: '211', retiradoPor: '49301', atendidoPor: 'Marcos Vieira', data: '13/10/2026 09:40',
    itens: [
      { material: 'Cabo multiplex 2x16 mm²', codigo: '10061204', unidade: 'm', qtd: 50 },
      { material: 'Conector perfuração 16-70', codigo: '10044870', unidade: 'pç', qtd: 10 },
    ],
  },
  {
    id: 'r3', numero: 'DSP-2026-00386', equipe: 'e2', local: 'RSP', retiradoPor: '52877', atendidoPor: 'Paulo Ribeiro', data: '12/10/2026 16:12',
    itens: [{ material: 'Fita isolante 19 mm', codigo: '10030117', unidade: 'rl', qtd: 6 }],
    guiaAssinada: { arquivo: 'termo-DSP-2026-00386.pdf', formato: 'pdf', anexadoEm: '12/10/2026 17:30', anexadoPor: 'Paulo Ribeiro' },
  },
  {
    id: 'r4', numero: 'DSP-2026-00383', equipe: 'e1', local: '211', retiradoPor: '52210', atendidoPor: 'Marcos Vieira', data: '11/10/2026 10:22',
    itens: [
      { material: 'Lacre polipropileno', codigo: '10018832', unidade: 'un', qtd: 30 },
      { material: 'Conector perfuração 16-70', codigo: '10044870', unidade: 'pç', qtd: 8 },
    ],
    guiaAssinada: { arquivo: 'IMG_20261011_1031.jpg', formato: 'foto', anexadoEm: '11/10/2026 10:35', anexadoPor: 'Marcos Vieira' },
  },
  {
    id: 'r5', numero: 'DSP-2026-00384', equipe: 'e6', local: 'ITN', retiradoPor: '53004', atendidoPor: 'Marcos Vieira', data: '10/10/2026 09:15',
    itens: [
      { material: 'Cabo multiplex 2x16 mm²', codigo: '10061204', unidade: 'm', qtd: 30 },
      { material: 'Conector perfuração 16-70', codigo: '10044870', unidade: 'pç', qtd: 12 },
      { material: 'Fita isolante 19 mm', codigo: '10030117', unidade: 'rl', qtd: 4 },
    ],
    guiaAssinada: { arquivo: 'IMG_20261010_0921.jpg', formato: 'foto', anexadoEm: '10/10/2026 09:24', anexadoPor: 'Marcos Vieira' },
  },
  {
    id: 'r6', numero: 'DSP-2026-00382', equipe: 'e3', local: '211', retiradoPor: '49422', atendidoPor: 'Marcos Vieira', data: '09/10/2026 15:40',
    itens: [
      { material: 'Medidor monofásico', codigo: '10052311', unidade: 'un', qtd: 12, seriais: CAIXAS_MEDIDOR['CX-0420'].seriais },
      { material: 'Lacre polipropileno', codigo: '10018832', unidade: 'un', qtd: 24 },
    ],
    guiaAssinada: { arquivo: 'termo-DSP-2026-00382.pdf', formato: 'pdf', anexadoEm: '09/10/2026 16:02', anexadoPor: 'Marcos Vieira' },
  },
  {
    id: 'r7', numero: 'DSP-2026-00381', equipe: 'e4', local: '211', retiradoPor: '50110', atendidoPor: 'Paulo Ribeiro', data: '09/10/2026 08:05',
    itens: [
      { material: 'Medidor monofásico', codigo: '10052311', unidade: 'un', qtd: 9, seriais: CAIXAS_MEDIDOR['CX-0422'].seriais },
      { material: 'Lacre polipropileno', codigo: '10018832', unidade: 'un', qtd: 18 },
      { material: 'Fita isolante 19 mm', codigo: '10030117', unidade: 'rl', qtd: 3 },
    ],
    guiaAssinada: { arquivo: 'IMG_20261009_0811.jpg', formato: 'foto', anexadoEm: '09/10/2026 08:14', anexadoPor: 'Paulo Ribeiro' },
  },
  {
    id: 'r8', numero: 'DSP-2026-00380', equipe: 'e9', local: 'RSP', retiradoPor: '54590', atendidoPor: 'Paulo Ribeiro', data: '08/10/2026 14:20',
    itens: [
      { material: 'Cabo multiplex 2x16 mm²', codigo: '10061204', unidade: 'm', qtd: 40 },
      { material: 'Conector perfuração 16-70', codigo: '10044870', unidade: 'pç', qtd: 8 },
    ],
    guiaAssinada: { arquivo: 'termo-DSP-2026-00380.pdf', formato: 'pdf', anexadoEm: '08/10/2026 15:01', anexadoPor: 'Paulo Ribeiro' },
  },
  {
    id: 'r9', numero: 'DSP-2026-00378', equipe: 'e14', local: '211', retiradoPor: '47720', atendidoPor: 'Marcos Vieira', data: '08/10/2026 10:00',
    itens: [
      { material: 'Medidor monofásico', codigo: '10052311', unidade: 'un', qtd: 16, seriais: CAIXAS_MEDIDOR['CX-0421'].seriais },
      { material: 'Lacre polipropileno', codigo: '10018832', unidade: 'un', qtd: 30 },
    ],
    guiaAssinada: { arquivo: 'IMG_20261008_1009.jpg', formato: 'foto', anexadoEm: '08/10/2026 10:12', anexadoPor: 'Marcos Vieira' },
  },
]

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
export const SEQUENCIA_INICIAL = 392
export const numeroDespacho = (n: number) => `DSP-2026-${String(n).padStart(5, '0')}`

/** Materiais de um local com saldo, para montar despacho (sempre do 211) ou retirada (211 ou base). */
export function materiaisDo211(local: CodigoLocal = '211') {
  return estoqueDoLocal(local).map((l) => ({ ...l, serializado: MATERIAIS_SERIALIZADOS.has(l.codigo) }))
}

/**
 * Resumo por caixa a partir dos seriais: "CX-0418 inteira (16) + 4 de CX-0419 (16)".
 * A conta é pela caixa bipada, não por um número fixo de unidades por caixa.
 */
export function emCaixas(seriais?: string[]): string | null {
  if (!seriais?.length) return null
  const porCaixa = new Map<string, number>()
  let avulsos = 0
  for (const x of seriais) {
    const cx = caixaDoSerial(x)
    if (cx) porCaixa.set(cx, (porCaixa.get(cx) ?? 0) + 1)
    else avulsos++
  }
  const partes = [...porCaixa].map(([cx, n]) => {
    const total = CAIXAS_MEDIDOR[cx].seriais.length
    return n === total ? `${cx} inteira (${total})` : `${n} de ${cx} (${total})`
  })
  if (avulsos) partes.push(`${avulsos} avulso${avulsos === 1 ? '' : 's'}`)
  return partes.join(' + ')
}
