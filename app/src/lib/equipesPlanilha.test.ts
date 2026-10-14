import { describe, expect, it } from 'vitest'
import {
  detectarColunasEquipes,
  encontrarCabecalhoEquipes,
  diferencas,
  lerConciliacao,
  lerEquipes,
  paraRpc,
  type MapaEquipes,
} from './equipesPlanilha'

// Mesmo formato da aba META ATUALIZADA, com dados fictícios.
const cabecalho = ['DESCRIÇÃO', 'supervisor', 'zeus', 'equipe', 'frota', '  Abr/2026  ', 'Meta 2026']
const planilha: unknown[][] = [
  cabecalho,
  [' SOBREAVISO ', null, 90100, null, null, 1000, 9000],
  ['EQUIPE  ALFA ', 'Grupo B', 90001, 'Integrante A/ Integrante B', 1000, 500, 6000],
  ['EQUIPE BETA', 'Grupo B', 90002, 'Integrante C - Não lançar', 2000, 500, 6000],
  ['EQUIPE GAMA', 'Grupo B', 90003, 'Integrante D', 3000, 500, 6000],
  ['EQUIPE GAMA', 'Grupo B', 90003, 'Integrante D', 3000, 500, 5000],
  ['MOTO UM', '#N/A', 90004, '#N/A', '#N/A', 100, 900],
  ['MOTO DOIS', 'Moto', '90005', 'Integrante E', '4000', 100, 900],
  ['EQUIPE DELTA', 'Grupo B', 90003, 'Integrante F', 5000, 500, 6000],
  [null, null, null, null, null, 2600, 33800],
  [null, 0, null, 0, null, 2600, 33800],
  [null, 'Grupo B', null, 'Integrante G', 6000, 500, 6000],
  ['TOTAL', null, 'zeus?', null, null, null, null],
]

const mapa: MapaEquipes = { descricao: 0, supervisor: 1, zeus: 2, integrantes: 3, frota: 4 }

describe('colunas', () => {
  it('reconhece as colunas da planilha e ignora as de meta', () => {
    expect(detectarColunasEquipes(cabecalho)).toEqual(mapa)
  })
  it('acha o cabeçalho mesmo com linhas de título antes', () => {
    expect(encontrarCabecalhoEquipes([['Atualização'], [], cabecalho])).toBe(2)
    expect(encontrarCabecalhoEquipes([['a', 'b']])).toBe(-1)
  })
})

describe('lerEquipes', () => {
  const r = lerEquipes(planilha.slice(1), mapa, 2)

  it('lê uma linha completa, juntando espaços e com frota em texto', () => {
    expect(r.equipes.find((e) => e.zeus === 90001)).toEqual({
      linha: 3,
      zeus: 90001,
      descricao: 'EQUIPE ALFA',
      supervisor: 'Grupo B',
      integrantes: 'Integrante A/ Integrante B',
      frota: '1000',
      problema: null,
    })
  })
  it('aceita Zeus e frota digitados como texto', () => {
    expect(r.equipes.find((e) => e.zeus === 90005)).toMatchObject({ frota: '4000', problema: null })
  })
  it('marca o problema das linhas que entram inativas', () => {
    const problema = (z: number) => r.equipes.find((e) => e.zeus === z)?.problema
    expect(problema(90100)).toBe('Sem supervisor; Sem integrantes; Sem frota')
    expect(problema(90002)).toBe('Marcada "Não lançar"')
    expect(problema(90004)).toBe('Célula com #N/A; Sem supervisor; Sem integrantes; Sem frota')
  })
  it('#N/A vira campo vazio, não texto', () => {
    expect(r.equipes.find((e) => e.zeus === 90004)).toMatchObject({ supervisor: null, integrantes: null, frota: null })
  })
  it('Zeus repetido entra uma vez: vale a primeira linha', () => {
    expect(r.equipes.filter((e) => e.zeus === 90003)).toHaveLength(1)
    expect(r.equipes.find((e) => e.zeus === 90003)?.integrantes).toBe('Integrante D')
    expect(r.repetidas).toEqual([
      { linha: 6, zeus: '90003', motivo: 'Repetida, igual à linha 5: entra uma vez' },
      { linha: 9, zeus: '90003', motivo: 'Repetida com dados diferentes: vale a linha 5' },
    ])
  })
  it('pula linha vazia e de totais e deixa de fora a sem Zeus válido', () => {
    expect(r.equipes).toHaveLength(6)
    expect(r.deixadas).toEqual([
      { linha: 12, zeus: '', motivo: 'Sem código Zeus' },
      { linha: 13, zeus: 'zeus?', motivo: 'Código Zeus inválido' },
    ])
  })
  it('monta o corpo da RPC sem o número da linha', () => {
    expect(paraRpc(r.equipes)[0]).toEqual({
      zeus: 90100,
      descricao: 'SOBREAVISO',
      supervisor: null,
      integrantes: null,
      frota: null,
      problema: 'Sem supervisor; Sem integrantes; Sem frota',
    })
  })
})

describe('lerConciliacao', () => {
  it('lê o retorno da RPC e tolera chave ausente', () => {
    expect(lerConciliacao({ novas: [1, 2], alteradas: [], sem_mudanca: [3], inativadas: [4] })).toEqual({
      novas: [1, 2],
      alteradas: [],
      sem_mudanca: [3],
      inativadas: [4],
      com_problema: [],
    })
  })
})

describe('diferencas', () => {
  const grupos = [
    { id: 'g1', nome: 'Grupo B', chave_planilha: 'Grupo B', ativo: true },
    { id: 'g2', nome: 'Grupo Moto', chave_planilha: 'Moto', ativo: true },
  ]
  const linha = {
    linha: 3,
    zeus: 90001,
    descricao: 'EQUIPE ALFA',
    supervisor: 'grupo b',
    integrantes: 'Integrante A',
    frota: '1000',
    problema: null,
  }
  const atual = { nome: 'EQUIPE ALFA', integrantes: 'Integrante A', frota: '1000', grupo_id: 'g1', ativa: true }

  it('sem mudança quando tudo bate, sem diferença de maiúscula no supervisor', () => {
    expect(diferencas(linha, atual, grupos)).toEqual([])
  })
  it('lista cada campo que muda', () => {
    expect(
      diferencas({ ...linha, descricao: 'EQUIPE ALFA 2', integrantes: 'Integrante Z', frota: '2000', supervisor: 'Moto' }, atual, grupos),
    ).toEqual([
      'Descrição: EQUIPE ALFA → EQUIPE ALFA 2',
      'Integrantes: Integrante A → Integrante Z',
      'Frota: 1000 → 2000',
      'Grupo: Grupo B → Grupo Moto (locais voltam ao padrão do grupo)',
    ])
  })
  it('linha com problema deixa a equipe inativa; voltar completa reativa', () => {
    expect(diferencas({ ...linha, problema: 'Marcada "Não lançar"' }, atual, grupos)).toEqual(['Fica inativa'])
    expect(diferencas(linha, { ...atual, ativa: false }, grupos)).toEqual(['Volta a ficar ativa'])
  })
  it('descrição vazia vira "Zeus N", como no banco', () => {
    expect(diferencas({ ...linha, descricao: null }, atual, grupos)).toEqual(['Descrição: EQUIPE ALFA → Zeus 90001'])
  })
})
