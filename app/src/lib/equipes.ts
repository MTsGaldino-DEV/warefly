import { mensagemErro } from './erros'
import type { Almox, Enum } from './supabase'

/** Equipe como a tela usa: linha de `equipes` mais os locais liberados. */
export type EquipeLista = {
  id: string
  codigo_zeus: number | null
  nome: string
  integrantes: string | null
  frota: string | null
  grupo_id: string | null
  ativa: boolean
  locais: string[]
}

export type GrupoLista = {
  id: string
  nome: string
  tipo_equipe: Enum<'tipo_equipe'>
  chave_planilha: string | null
  ativo: boolean
  locais: string[]
}

/** Campos do formulário de equipe, como o usuário digitou. */
export type FormEquipe = {
  codigo_zeus: string
  nome: string
  integrantes: string
  frota: string
  grupo_id: string
  locais: string[]
  ativa: boolean
}

/** Campos do formulário de grupo. */
export type FormGrupo = { nome: string; tipo_equipe: Enum<'tipo_equipe'>; chave_planilha: string; locais: string[]; ativo: boolean }

/** Junta espaços repetidos e tira os das pontas, como o banco grava. */
export function limparTexto(valor: string | null | undefined): string {
  return (valor ?? '').replace(/\s+/g, ' ').trim()
}

function semAcento(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** Zeus digitado: número inteiro positivo, ou null. */
export function lerZeus(valor: string): number | null {
  const t = valor.trim()
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  return n > 0 && Number.isSafeInteger(n) ? n : null
}

/**
 * Confere o cadastro antes de enviar. As mensagens são as mesmas do banco,
 * que faz a mesma checagem.
 */
export function validarEquipe(f: FormEquipe): string | null {
  if (!f.codigo_zeus.trim()) return 'Informe o código Zeus da equipe.'
  if (lerZeus(f.codigo_zeus) === null) return 'O código Zeus é um número inteiro, como 21402. Corrija e salve de novo.'
  if (!limparTexto(f.nome)) return 'Informe a descrição da equipe.'
  if (!limparTexto(f.integrantes)) return 'Informe os integrantes da equipe.'
  if (!limparTexto(f.frota)) return 'Informe a frota da equipe.'
  if (!f.grupo_id) return 'Escolha o grupo (supervisor) da equipe.'
  if (!f.locais.length) return 'Libere ao menos um local para a equipe retirar material.'
  return null
}

/** Mesmas regras do banco (rpc_salvar_grupo), para avisar antes de enviar. */
export function validarGrupo(f: FormGrupo): string | null {
  if (!limparTexto(f.nome)) return 'Informe o nome do grupo.'
  if (f.ativo && !f.locais.length) return 'Escolha ao menos um local onde as equipes do grupo retiram material.'
  return null
}

/** "21402 · HEBIO/ONOFRE", ou só a descrição quando não há Zeus. */
export function rotuloEquipe(e: { codigo_zeus: number | null; nome: string }): string {
  return e.codigo_zeus ? `${e.codigo_zeus} · ${e.nome}` : e.nome
}

export type FiltroEquipes = { busca: string; grupoId: string; mostrarInativas: boolean }

/** Busca por Zeus, descrição, integrantes ou frota, sem diferença de acento e maiúscula. */
export function filtrarEquipes<T extends EquipeLista>(equipes: T[], f: FiltroEquipes): T[] {
  const termos = semAcento(f.busca).split(/\s+/).filter(Boolean)
  return equipes.filter((e) => {
    if (!f.mostrarInativas && !e.ativa) return false
    if (f.grupoId && (e.grupo_id ?? 'sem-grupo') !== f.grupoId) return false
    if (!termos.length) return true
    const texto = semAcento([e.codigo_zeus ?? '', e.nome, e.integrantes ?? '', e.frota ?? ''].join(' '))
    return termos.every((t) => texto.includes(t))
  })
}

/**
 * Grupos na ordem da tela: multifuncionais e depois motos, cada um por nome.
 * Equipes sem grupo ficam num bloco à parte, no fim.
 */
export function agruparPorGrupo<T extends EquipeLista>(
  equipes: T[],
  grupos: GrupoLista[],
): { grupo: GrupoLista | null; equipes: T[] }[] {
  const ordem = [...grupos].sort(
    (a, b) => Number(a.tipo_equipe === 'moto') - Number(b.tipo_equipe === 'moto') || a.nome.localeCompare(b.nome, 'pt-BR'),
  )
  const porZeus = (a: T, b: T) => (a.codigo_zeus ?? 0) - (b.codigo_zeus ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR')
  const blocos: { grupo: GrupoLista | null; equipes: T[] }[] = ordem.map((g) => ({
    grupo: g,
    equipes: equipes.filter((e) => e.grupo_id === g.id).sort(porZeus),
  }))
  const conhecidos = new Set(grupos.map((g) => g.id))
  const semGrupo = equipes.filter((e) => !e.grupo_id || !conhecidos.has(e.grupo_id)).sort(porZeus)
  if (semGrupo.length) blocos.push({ grupo: null, equipes: semGrupo })
  return blocos.filter((b) => b.equipes.length > 0)
}

/** Locais em ordem de leitura: o 211 Geral (regional) primeiro, depois as bases por nome. */
export function ordenarLocais(ids: string[], almoxarifados: Almox[]): Almox[] {
  const conjunto = new Set(ids)
  return almoxarifados
    .filter((a) => conjunto.has(a.id))
    .sort((a, b) => Number(a.tipo !== 'regional') - Number(b.tipo !== 'regional') || a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Liga ou desliga um local na lista, sem repetir. */
export function alternarLocal(locais: string[], id: string): string[] {
  return locais.includes(id) ? locais.filter((l) => l !== id) : [...locais, id]
}

/** Mesmos locais, em qualquer ordem. */
export function mesmosLocais(a: string[], b: string[]): boolean {
  const sa = new Set(a)
  return sa.size === new Set(b).size && b.every((x) => sa.has(x))
}

/** As RPCs de equipe devolvem texto pronto, inclusive no Zeus repetido (23505). */
export function erroEquipe(e: unknown): string {
  const x = e as { code?: string; message?: string } | null
  return x?.code === '23505' && x.message ? x.message : mensagemErro(e)
}
