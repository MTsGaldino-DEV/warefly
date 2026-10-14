import type { EquipeLista, GrupoLista } from '../../lib/equipes'
import { carregarTodos, supabase } from '../../lib/supabase'
import { listaOuErro } from '../../lib/useConsulta'

/**
 * Grupos (com os locais padrão) e as equipes que o usuário enxerga (com os
 * locais liberados). O RLS já filtra: a gestão vê todas; quem é de base, as
 * liberadas nas bases dele.
 */
export async function carregarEquipes(): Promise<{ grupos: GrupoLista[]; equipes: EquipeLista[] }> {
  const [grupos, grupoLocais, equipes, equipeLocais] = await Promise.all([
    listaOuErro(supabase.from('grupos').select('id, nome, tipo_equipe, chave_planilha, ativo').order('nome')),
    listaOuErro(supabase.from('grupo_locais').select('grupo_id, almox_id')),
    carregarTodos((de, ate) =>
      supabase
        .from('equipes')
        .select('id, codigo_zeus, nome, integrantes, frota, grupo_id, ativa')
        .order('codigo_zeus', { nullsFirst: false })
        .range(de, ate),
    ),
    carregarTodos((de, ate) => supabase.from('equipe_locais').select('equipe_id, almox_id').order('equipe_id').range(de, ate)),
  ])

  const locaisDe = <K extends string>(linhas: ({ almox_id: string } & Record<K, string>)[], chave: K) => {
    const mapa = new Map<string, string[]>()
    for (const l of linhas) mapa.set(l[chave], [...(mapa.get(l[chave]) ?? []), l.almox_id])
    return mapa
  }
  const porGrupo = locaisDe(grupoLocais, 'grupo_id')
  const porEquipe = locaisDe(equipeLocais, 'equipe_id')

  return {
    grupos: grupos.map((g) => ({ ...g, locais: porGrupo.get(g.id) ?? [] })),
    equipes: equipes.map((e) => ({ ...e, locais: porEquipe.get(e.id) ?? [] })),
  }
}
