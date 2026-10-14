/** Regras da requisição de material no GDIS (as mesmas do conector). */

export type ItemRequisicao = { codigo: string; quantidade: string; materialId: string | null }

export const INSTALACAO_PADRAO = '3013248220'

/** "2026-05" → "0105 3005": do dia 01 ao dia 30 do mês, sem barras. */
export function codigosPeriodo(periodo: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(periodo)
  const mes = m ? Number(m[2]) : 0
  if (!m || mes < 1 || mes > 12) throw new Error('Escolha o mês da requisição.')
  return `01${m[2]} 30${m[2]}`
}

export function frasePeriodo(periodo: string): string {
  return `REQUISICAO DE MATERIAIS DE MANUTENCAO PARA O PERIODO ${codigosPeriodo(periodo)}`
}

export function mesSeguinte(hoje = new Date()): string {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function qtdValida(q: string): boolean {
  if (!/^\d+$/.test(q.trim())) return false
  const n = Number(q)
  return n >= 1 && n <= 999
}

/** Lê "código; quantidade" por linha (aceita ;, tab ou espaços, como vem do Excel). */
export function lerLista(
  texto: string,
  jaNaLista: Set<string>,
  idDoCodigo: (codigo: string) => string | null,
): { itens: ItemRequisicao[]; erros: string[] } {
  const itens: ItemRequisicao[] = []
  const erros: string[] = []
  const vistos = new Set(jaNaLista)
  texto.split(/\r?\n/).forEach((linha, i) => {
    const n = i + 1
    if (!linha.trim()) return
    const partes = linha.trim().split(/[;\t ]+/)
    const [codigo, quantidade] = partes
    if (partes.length !== 2 || !/^\d+$/.test(codigo)) {
      erros.push(`Linha ${n}: use "código; quantidade" com código só de números.`)
      return
    }
    if (!qtdValida(quantidade)) {
      erros.push(`Linha ${n}: a quantidade deve ser inteira, de 1 a 999.`)
      return
    }
    if (vistos.has(codigo)) {
      erros.push(`Linha ${n}: o código ${codigo} já está na lista.`)
      return
    }
    vistos.add(codigo)
    itens.push({ codigo, quantidade, materialId: idDoCodigo(codigo) })
  })
  return { itens, erros }
}

export function validarRequisicao(periodo: string, instalacao: string, itens: ItemRequisicao[]): string[] {
  const erros: string[] = []
  try {
    codigosPeriodo(periodo)
  } catch (e) {
    erros.push((e as Error).message)
  }
  if (!/^\d{10}$/.test(instalacao)) erros.push('A instalação deve ter 10 dígitos.')
  if (!itens.length) erros.push('Informe ao menos um item.')
  for (const item of itens) {
    if (!qtdValida(item.quantidade)) erros.push(`${item.codigo}: a quantidade deve ser inteira, de 1 a 999.`)
  }
  return erros
}

export function paraEnvio(periodo: string, instalacao: string, itens: ItemRequisicao[]) {
  return {
    periodo,
    instalacao,
    itens: itens.map((i) => ({ codigo: i.codigo, quantidade: Number(i.quantidade) })),
  }
}
