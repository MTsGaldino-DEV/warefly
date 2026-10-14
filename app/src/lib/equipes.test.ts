import { describe, expect, it } from 'vitest'
import {
  agruparPorGrupo,
  alternarLocal,
  erroEquipe,
  filtrarEquipes,
  lerZeus,
  limparTexto,
  mesmosLocais,
  ordenarLocais,
  rotuloEquipe,
  validarEquipe,
  validarGrupo,
  type EquipeLista,
  type FormEquipe,
  type GrupoLista,
} from './equipes'
import type { Almox } from './supabase'

const completo: FormEquipe = {
  codigo_zeus: '90001',
  nome: 'Equipe Alfa',
  integrantes: 'Integrante A/Integrante B',
  frota: '1000',
  grupo_id: 'g1',
  locais: ['geral'],
  ativa: true,
}

describe('validarEquipe', () => {
  it('aceita o cadastro completo', () => {
    expect(validarEquipe(completo)).toBeNull()
  })
  it('exige cada campo, na ordem do formulário, com a mesma mensagem do banco', () => {
    expect(validarEquipe({ ...completo, codigo_zeus: ' ' })).toBe('Informe o código Zeus da equipe.')
    expect(validarEquipe({ ...completo, nome: '  ' })).toBe('Informe a descrição da equipe.')
    expect(validarEquipe({ ...completo, integrantes: '' })).toBe('Informe os integrantes da equipe.')
    expect(validarEquipe({ ...completo, frota: '' })).toBe('Informe a frota da equipe.')
    expect(validarEquipe({ ...completo, grupo_id: '' })).toBe('Escolha o grupo (supervisor) da equipe.')
    expect(validarEquipe({ ...completo, locais: [] })).toBe('Libere ao menos um local para a equipe retirar material.')
  })
  it('recusa Zeus que não é inteiro positivo', () => {
    for (const z of ['21a', '0', '-3', '2.5']) expect(validarEquipe({ ...completo, codigo_zeus: z })).toMatch(/número inteiro/)
  })
})

describe('lerZeus e limparTexto', () => {
  it('lê o Zeus com espaços em volta', () => {
    expect(lerZeus(' 90001 ')).toBe(90001)
    expect(lerZeus('')).toBeNull()
  })
  it('junta espaços repetidos', () => {
    expect(limparTexto('  Equipe   Alfa ')).toBe('Equipe Alfa')
    expect(limparTexto(null)).toBe('')
  })
})

describe('rotuloEquipe', () => {
  it('mostra Zeus e descrição', () => {
    expect(rotuloEquipe({ codigo_zeus: 90001, nome: 'Equipe Alfa' })).toBe('90001 · Equipe Alfa')
    expect(rotuloEquipe({ codigo_zeus: null, nome: 'Equipe antiga' })).toBe('Equipe antiga')
  })
})

const eq = (p: Partial<EquipeLista> & { id: string }): EquipeLista => ({
  codigo_zeus: null,
  nome: p.id,
  integrantes: 'Integrante A',
  frota: '1000',
  grupo_id: 'g1',
  ativa: true,
  locais: [],
  ...p,
})

const equipes = [
  eq({ id: 'a', codigo_zeus: 90003, nome: 'Equipe Ômega', integrantes: 'José Lima/Ana' }),
  eq({ id: 'b', codigo_zeus: 90001, nome: 'Equipe Beta', frota: '4404' }),
  eq({ id: 'c', codigo_zeus: 90002, nome: 'Moto Um', grupo_id: 'g2' }),
  eq({ id: 'd', codigo_zeus: 90004, nome: 'Inativa', ativa: false }),
  eq({ id: 'e', codigo_zeus: 90005, nome: 'Sem grupo', grupo_id: null, ativa: false }),
]

describe('filtrarEquipes', () => {
  const base = { busca: '', grupoId: '', mostrarInativas: false }
  it('esconde as inativas por padrão', () => {
    expect(filtrarEquipes(equipes, base).map((e) => e.id)).toEqual(['a', 'b', 'c'])
    expect(filtrarEquipes(equipes, { ...base, mostrarInativas: true })).toHaveLength(5)
  })
  it('busca por Zeus, descrição, integrantes e frota, sem acento', () => {
    expect(filtrarEquipes(equipes, { ...base, busca: 'omega' }).map((e) => e.id)).toEqual(['a'])
    expect(filtrarEquipes(equipes, { ...base, busca: 'jose' }).map((e) => e.id)).toEqual(['a'])
    expect(filtrarEquipes(equipes, { ...base, busca: '4404' }).map((e) => e.id)).toEqual(['b'])
    expect(filtrarEquipes(equipes, { ...base, busca: '90002' }).map((e) => e.id)).toEqual(['c'])
    expect(filtrarEquipes(equipes, { ...base, busca: 'equipe beta' }).map((e) => e.id)).toEqual(['b'])
  })
  it('filtra pelo grupo, inclusive "sem grupo"', () => {
    expect(filtrarEquipes(equipes, { ...base, grupoId: 'g2' }).map((e) => e.id)).toEqual(['c'])
    expect(filtrarEquipes(equipes, { ...base, grupoId: 'sem-grupo', mostrarInativas: true }).map((e) => e.id)).toEqual(['e'])
  })
})

const grupos: GrupoLista[] = [
  { id: 'g2', nome: 'Grupo Moto', tipo_equipe: 'moto', chave_planilha: 'Moto', ativo: true, locais: [] },
  { id: 'g3', nome: 'Grupo Vazio', tipo_equipe: 'multifuncional', chave_planilha: null, ativo: true, locais: [] },
  { id: 'g1', nome: 'Grupo B', tipo_equipe: 'multifuncional', chave_planilha: 'B', ativo: true, locais: [] },
]

describe('agruparPorGrupo', () => {
  it('multifuncionais antes das motos, equipes por Zeus, sem grupo no fim e sem blocos vazios', () => {
    const blocos = agruparPorGrupo(equipes, grupos)
    expect(blocos.map((b) => b.grupo?.id ?? null)).toEqual(['g1', 'g2', null])
    expect(blocos[0].equipes.map((e) => e.codigo_zeus)).toEqual([90001, 90003, 90004])
  })
})

const almox = (id: string, nome: string, tipo: Almox['tipo']) => ({ id, nome, tipo }) as Almox
const locais = [almox('b2', 'Base Zeta', 'base'), almox('geral', 'Geral', 'regional'), almox('b1', 'Base Alfa', 'base')]

describe('locais', () => {
  it('ordena com o regional primeiro e as bases por nome', () => {
    expect(ordenarLocais(['b2', 'b1', 'geral'], locais).map((a) => a.id)).toEqual(['geral', 'b1', 'b2'])
    expect(ordenarLocais(['b2'], locais).map((a) => a.id)).toEqual(['b2'])
  })
  it('liga e desliga um local', () => {
    expect(alternarLocal(['geral'], 'b1')).toEqual(['geral', 'b1'])
    expect(alternarLocal(['geral', 'b1'], 'geral')).toEqual(['b1'])
  })
  it('compara listas sem importar a ordem', () => {
    expect(mesmosLocais(['a', 'b'], ['b', 'a'])).toBe(true)
    expect(mesmosLocais(['a'], ['a', 'b'])).toBe(false)
  })
})

describe('erroEquipe', () => {
  it('usa a mensagem da RPC no Zeus repetido', () => {
    expect(erroEquipe({ code: '23505', message: 'Já existe uma equipe com o código Zeus 90001.' })).toBe(
      'Já existe uma equipe com o código Zeus 90001.',
    )
  })
  it('cai na tradução comum nos outros erros', () => {
    expect(erroEquipe({ message: 'permission denied for table equipes' })).toBe('Você não tem permissão para esta ação.')
  })
})

describe('validarGrupo', () => {
  const grupo = { nome: 'Grupo B', tipo_equipe: 'multifuncional' as const, chave_planilha: 'B', locais: ['geral'], ativo: true }
  it('exige nome e, no grupo ativo, ao menos um local', () => {
    expect(validarGrupo(grupo)).toBeNull()
    expect(validarGrupo({ ...grupo, nome: ' ' })).toBe('Informe o nome do grupo.')
    expect(validarGrupo({ ...grupo, locais: [] })).toBe('Escolha ao menos um local onde as equipes do grupo retiram material.')
    expect(validarGrupo({ ...grupo, locais: [], ativo: false })).toBeNull()
  })
})
