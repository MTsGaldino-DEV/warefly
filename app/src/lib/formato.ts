const FUSO = 'America/Sao_Paulo'

export type Tom = 'info' | 'transito' | 'ok' | 'alerta' | 'neutro'

const ROTULOS: Record<string, string> = {
  rascunho: 'Rascunho',
  solicitado: 'Solicitado',
  aprovado: 'Aprovado',
  em_transito: 'Em trânsito',
  com_divergencia: 'Com divergência',
  encerrado: 'Encerrado',
  encerrada: 'Encerrada',
  cancelado: 'Cancelado',
  // remessas
  atendimento: 'Atendimento',
  externa: 'Entrada do 3256',
  transferencia: 'Transferência',
  devolucao: 'Devolução',
  reenvio: 'Reenvio',
  // divergências e tratamentos
  falta: 'Falta',
  sobra: 'Sobra',
  avaria: 'Avaria',
  trocado: 'Trocado',
  chegou_depois: 'Chegou depois',
  baixa_transito: 'Baixa em trânsito',
  ajuste_origem: 'Ajuste na origem',
  erro_contagem: 'Erro de contagem',
  estorno_origem: 'Não saiu da origem',
  externo: 'Externo',
  // saídas e ajustes
  aplicacao: 'Aplicação',
  perda: 'Perda',
  implantacao: 'Implantação',
  inventario: 'Inventário',
  // movimentações
  saldo_inicial: 'Saldo inicial',
  envio_remessa: 'Envio de remessa',
  recebimento_remessa: 'Recebimento',
  saida: 'Saída',
  ajuste_inventario: 'Ajuste de inventário',
  ajuste_divergencia: 'Ajuste de divergência',
  // papéis
  admin: 'Administrador',
  gestao: 'Gerência',
  operador: 'Operador',
  responsavel: 'Responsável',
  supervisor: 'Supervisor',
  regional: 'Regional',
  base: 'Base',
}

export function rotuloStatus(valor: string | null | undefined): string {
  if (!valor) return '—'
  return ROTULOS[valor] ?? valor
}

export function tomStatus(status: string): Tom {
  switch (status) {
    case 'solicitado':
    case 'aprovado':
      return 'info'
    case 'em_transito':
      return 'transito'
    case 'encerrado':
    case 'encerrada':
      return 'ok'
    case 'com_divergencia':
      return 'alerta'
    default:
      return 'neutro'
  }
}

export function formatarDoc(prefixo: 'PED' | 'REM' | 'SAI' | 'AJU', numero: number): string {
  return `${prefixo}-${String(numero).padStart(6, '0')}`
}

const numeroBR = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })
const moedaBR = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatarQtd(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  return numeroBR.format(Number(valor))
}

/** Diferença com sinal explícito: +2,5 · −1 · 0 */
export function formatarMoeda(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  return moedaBR.format(Number(valor))
}

export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

export function hojeISO(agora: Date = new Date()): string {
  // en-CA formata como AAAA-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora)
}

/**
 * Converte texto digitado em número; NaN se inválido. Padrão brasileiro:
 * vírgula decimal e ponto de milhar ("1.234,5"). Sem vírgula, ponto em
 * grupos de três é milhar ("1.500" = 1500); fora disso é decimal ("1.5").
 */
export function lerNumero(texto: string | number): number {
  if (typeof texto === 'number') return texto
  const limpo = texto.trim()
  if (limpo === '') return Number.NaN
  let normalizado: string
  if (limpo.includes(',')) normalizado = limpo.replace(/\./g, '').replace(',', '.')
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(limpo)) normalizado = limpo.replace(/\./g, '')
  else normalizado = limpo
  return /^-?\d+(\.\d+)?$/.test(normalizado) ? Number(normalizado) : Number.NaN
}

/** Retorna a mensagem de erro, ou null se a quantidade é válida. */
export function qtdValida(
  texto: string,
  aceitaFracao: boolean,
  opcoes: { permiteZero?: boolean } = {},
): string | null {
  if (texto.trim() === '') return 'Informe a quantidade.'
  const n = lerNumero(texto)
  if (Number.isNaN(n)) return 'Quantidade inválida.'
  if (n < 0) return 'Quantidade não pode ser negativa.'
  if (n === 0 && !opcoes.permiteZero) return 'Informe uma quantidade maior que zero.'
  if (!aceitaFracao && !Number.isInteger(n)) return 'Esta unidade não aceita fração.'
  if (Math.round(n * 1000) !== n * 1000) return 'Use no máximo 3 casas decimais.'
  return null
}
