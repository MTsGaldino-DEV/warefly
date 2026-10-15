import { formatarData, lerNumero, qtdValida } from './formato'

/** Tipo do ajuste: enquanto o local só tem saldo inicial, a contagem é implantação. */
export type TipoContagem = 'implantacao' | 'inventario'

export function tipoDaContagem(emImplantacao: boolean): TipoContagem {
  return emImplantacao ? 'implantacao' : 'inventario'
}

export function rotuloDaContagem(tipo: TipoContagem): string {
  return tipo === 'implantacao' ? 'Saldo inicial (implantação)' : 'Inventário'
}

export function justificativaPadrao(tipo: TipoContagem, dataISO: string): string {
  return tipo === 'implantacao' ? 'Contagem de implantação (dia D)' : `Inventário de ${formatarData(dataISO)}`
}

/** Linha da contagem na tela: quantidade como o usuário digitou. */
export type LinhaContagem = { material_id: string; qtd: string }

export type ItemContagem = { material_id: string; qtd_contada: number }

/**
 * Confere a contagem antes de enviar. Quantidade zero vale (material contado
 * e não encontrado). Devolve os itens prontos para rpc_registrar_ajuste ou
 * a lista de erros, um por material.
 */
export function validarContagem(
  linhas: LinhaContagem[],
  aceitaFracao: (materialId: string) => boolean,
  rotulo: (materialId: string) => string,
): { itens: ItemContagem[]; erros: string[] } {
  if (linhas.length === 0) return { itens: [], erros: ['Adicione ao menos um material à contagem.'] }
  const erros: string[] = []
  const itens: ItemContagem[] = []
  const vistos = new Set<string>()
  for (const l of linhas) {
    if (vistos.has(l.material_id)) {
      erros.push(`${rotulo(l.material_id)}: aparece duas vezes. Deixe uma linha só.`)
      continue
    }
    vistos.add(l.material_id)
    const erro = qtdValida(l.qtd, aceitaFracao(l.material_id), { permiteZero: true })
    if (erro) erros.push(`${rotulo(l.material_id)}: ${erro}`)
    else itens.push({ material_id: l.material_id, qtd_contada: lerNumero(l.qtd) })
  }
  return erros.length ? { itens: [], erros } : { itens, erros }
}

/** Dados do cadastro rápido de material no dia do inventário. */
export type MaterialNovo = { codigo: string; descricao: string; unidade: string }

/** Devolve a mensagem de erro, ou null se o cadastro pode seguir. */
export function validarMaterialNovo(m: MaterialNovo): string | null {
  if (!m.codigo.trim()) return 'Informe o código SAP do material.'
  if (!m.descricao.trim()) return 'Informe a descrição do material.'
  if (!m.unidade) return 'Escolha a unidade.'
  return null
}
