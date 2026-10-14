import type { Almox, Atribuicao, Enum } from './supabase'

/** Regionais em que o usuário é responsável: é isso que faz dele gestor(a) do almoxarifado. */
export function regionaisGeridos(almoxarifados: Almox[], atribuicoes: Atribuicao[]): Set<string> {
  const regionais = new Set(almoxarifados.filter((a) => a.tipo === 'regional').map((a) => a.id))
  return new Set(atribuicoes.filter((a) => a.funcao === 'responsavel' && regionais.has(a.almox_id)).map((a) => a.almox_id))
}

/** Locais cujo estoque o usuário ajusta: o admin, todos; a gestora, o regional dela e as bases dele. */
export function locaisGeridos(almoxarifados: Almox[], atribuicoes: Atribuicao[], ehAdmin: boolean): Almox[] {
  const ativos = almoxarifados.filter((a) => a.tipo !== 'externo' && a.ativo)
  if (ehAdmin) return ativos
  const regionais = regionaisGeridos(almoxarifados, atribuicoes)
  return ativos.filter((a) => regionais.has(a.id) || (a.pai_id !== null && regionais.has(a.pai_id)))
}

/** Rótulo do perfil no rodapé do menu. */
export function rotuloDoPerfil(p: {
  papel: Enum<'papel_usuario'> | null | undefined
  ehGestora: boolean
  ehSupervisor: boolean
}): string {
  if (p.papel === 'admin') return 'Administrador'
  if (p.papel === 'gestao') return 'Gerência'
  if (p.ehGestora) return 'Gestor(a) do almoxarifado'
  if (p.ehSupervisor) return 'Supervisor'
  return 'Operador'
}
