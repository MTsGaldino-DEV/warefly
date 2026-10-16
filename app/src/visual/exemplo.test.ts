import { describe, expect, it } from 'vitest'
import {
  atendimento,
  BASES,
  basesPadrao,
  capacidade,
  CAIXAS_MEDIDOR,
  colaborador,
  COLABORADORES,
  COBERTURA_BASES,
  DESPACHOS,
  despachoDaSolicitacao,
  DIVERGENCIAS,
  emCaixas,
  equipeDe,
  EQUIPES,
  equipesDaOrigem,
  estoqueDaEquipe,
  estoqueDoCarro,
  estoqueDoLocal,
  GRUPOS,
  KIT_POR_TIPO,
  lerCodigo,
  minimosDaEquipe,
  nivelDaEquipe,
  nivelDasEquipes,
  nivelDoItem,
  nivelDoLocal,
  podeRetirar,
  RESERVAS,
  RETIRADAS,
  retiradaPendente,
  retiradasDaMatricula,
  saldoReserva,
  SOLICITACOES,
  validarAnexo,
  validarEquipe,
  type Caixas,
  type Colaborador,
  type Equipe,
  type LinhaEstoque,
  type MinimoCarro,
  type Retirada,
  type Solicitacao,
} from './exemplo'

// Dados de teste: só existem aqui. A tela começa vazia e passa a ler do banco.
const serie = (prefixo: string, inicio: number, n: number) => Array.from({ length: n }, (_, i) => `${prefixo}${String(inicio + i).padStart(6, '0')}`)
const CAIXAS: Caixas = {
  'CX-0418': { codigo: '10052311', seriais: serie('MF26', 418001, 16) },
  'CX-0419': { codigo: '10052311', seriais: serie('MF26', 419001, 16) },
  'CX-0420': { codigo: '10052311', seriais: serie('MF26', 420001, 12) },
  'CX-0422': { codigo: '10052311', seriais: serie('MF26', 422001, 9) },
}
const PESSOAS: Colaborador[] = [
  { matricula: '52210', nome: 'Pessoa A', supervisor: 'Pedro' },
  { matricula: '49301', nome: 'Pessoa B', supervisor: 'Victor' },
  { matricula: '49422', nome: 'Pessoa C', supervisor: 'Victor' },
  { matricula: '53004', nome: 'Pessoa D', supervisor: 'Pedro' },
  { matricula: '55377', nome: 'Pessoa E', supervisor: 'Pedro' },
]
const EQ: Equipe[] = [
  { id: 'e1', codigo: 'MOTO 01', tipo: 'Moto', supervisor: 'Pedro', integrantes: ['52210'], bases: basesPadrao('Moto', 'Pedro'), placa: 'RTA2B09', origem: '211' },
  { id: 'e3', codigo: 'MULT 01', tipo: 'Moto/Multifuncional', supervisor: 'Victor', integrantes: ['49301', '49422'], bases: basesPadrao('Moto/Multifuncional', 'Victor'), placa: 'PUV7C33', origem: 'MNT' },
  { id: 'e6', codigo: 'MULT 04', tipo: 'Moto/Multifuncional', supervisor: 'Pedro', integrantes: ['53004'], bases: basesPadrao('Moto/Multifuncional', 'Pedro'), placa: 'SCD3A17', origem: 'ITN' },
]
const ret = (id: string, numero: string, equipe: string, retiradoPor: string, data: string, itens: Retirada['itens'], comTermo = false): Retirada => ({
  id, numero, equipe, local: '211', retiradoPor, atendidoPor: 'Atendente', data, itens,
  guiaAssinada: comTermo ? { arquivo: 'termo.pdf', formato: 'pdf', anexadoEm: data, anexadoPor: 'Atendente' } : undefined,
})
const RET: Retirada[] = [
  ret('r1', 'DSP-2026-00010', 'e1', '52210', '13/10/2026 14:05', [{ material: 'Fita', codigo: '10030117', unidade: 'rl', qtd: 2 }]),
  ret('r2', 'DSP-2026-00009', 'e3', '49301', '13/10/2026 09:40', [
    { material: 'Lacre', codigo: '10018832', unidade: 'un', qtd: 24 },
    { material: 'Medidor', codigo: '10052311', unidade: 'un', qtd: 12, seriais: CAIXAS['CX-0420'].seriais },
  ]),
  ret('r4', 'DSP-2026-00007', 'e1', '52210', '11/10/2026 10:22', [{ material: 'Fita', codigo: '10030117', unidade: 'rl', qtd: 1 }], true),
]
const SOL: Solicitacao = {
  id: 's1', numero: 'SOL-0001', base: 'RSP', situacao: 'aguardando', aberta: '13/10/2026 07:52',
  itens: [
    { material: 'Cabo', codigo: '10061204', unidade: 'm', solicitado: 120, disponivel: 84, consumo90: 310, saldoBase: 22, decisao: 'Reduzido', aprovado: 84 },
    { material: 'Conector', codigo: '10044870', unidade: 'pç', solicitado: 40, disponivel: 200, consumo90: 90, saldoBase: 5, decisao: 'Aprovado', aprovado: 40 },
    { material: 'Haste', codigo: '10027745', unidade: 'pç', solicitado: 5, disponivel: 0, consumo90: 8, saldoBase: 1, decisao: 'Sem saldo', aprovado: 0 },
  ],
}

describe('sem dados de exemplo', () => {
  it('as listas começam vazias até virem do banco', () => {
    for (const lista of [COLABORADORES, EQUIPES, SOLICITACOES, DESPACHOS, RESERVAS, DIVERGENCIAS, RETIRADAS, COBERTURA_BASES]) expect(lista).toEqual([])
    expect(CAIXAS_MEDIDOR).toEqual({})
  })
  it('kit mínimo das equipes começa vazio', () => {
    expect(KIT_POR_TIPO).toEqual({ Moto: [], 'Moto/Multifuncional': [] })
  })
  it('local sem inventário fica sem cor de situação', () => {
    for (const b of BASES) expect(nivelDoLocal(estoqueDoLocal(b.codigo))).toBe('sem')
    expect(nivelDoLocal(estoqueDoLocal('211'))).toBe('sem')
  })
})


const linha = (saldo: number, minimo: number): LinhaEstoque => ({ material: 'Fita', codigo: '1', unidade: 'rl', saldo, minimo })

describe('nível do estoque em relação ao mínimo', () => {
  it('abaixo do mínimo é vermelho', () => {
    expect(nivelDoItem(linha(19, 20))).toBe('abaixo')
  })
  it('no mínimo e até 20% acima é amarelo', () => {
    expect(nivelDoItem(linha(20, 20))).toBe('proximo')
    expect(nivelDoItem(linha(24, 20))).toBe('proximo')
  })
  it('mais de 20% acima é normal', () => {
    expect(nivelDoItem(linha(25, 20))).toBe('ok')
  })
  it('o local fica com o pior nível entre os materiais', () => {
    expect(nivelDoLocal([linha(100, 20), linha(22, 20)])).toBe('proximo')
    expect(nivelDoLocal([linha(100, 20), linha(22, 20), linha(5, 20)])).toBe('abaixo')
    expect(nivelDoLocal([linha(100, 20)])).toBe('ok')
  })
  it('local sem material lançado não tem nível', () => {
    expect(nivelDoLocal([])).toBe('sem')
  })
})

const min = (codigo: string, material: string, minimo: number, unidade = 'un'): MinimoCarro => ({ codigo, material, unidade, minimo })
const KIT: Record<Equipe['tipo'], MinimoCarro[]> = {
  Moto: [min('10030117', 'Fita', 2, 'rl')],
  'Moto/Multifuncional': [min('10018832', 'Lacre', 20), min('10052311', 'Medidor', 5), min('10061204', 'Cabo', 30, 'm')],
}
const comAjuste = (id: string, ajustes: MinimoCarro[]) => ({ ...EQ.find((e) => e.id === id)!, ajustesMinimo: ajustes })

describe('mínimo do carro da equipe', () => {
  it('a equipe herda o kit do tipo', () => {
    expect(minimosDaEquipe(EQ[0], KIT)).toEqual(KIT.Moto)
    expect(minimosDaEquipe(EQ[1], KIT).map((m) => m.codigo)).toEqual(['10018832', '10052311', '10061204'])
  })
  it('ajuste da equipe muda o mínimo, inclui material e, com zero, tira do kit', () => {
    const e = comAjuste('e3', [min('10018832', 'Lacre', 40), min('10061204', 'Cabo', 0, 'm'), min('10044870', 'Conector', 4)])
    expect(minimosDaEquipe(e, KIT).map((m) => [m.codigo, m.minimo])).toEqual([
      ['10018832', 40],
      ['10052311', 5],
      ['10044870', 4],
    ])
  })
  it('material do kit que a equipe não tem entra com saldo zero', () => {
    const cabo = estoqueDaEquipe(EQ[1], RET, KIT).find((l) => l.codigo === '10061204')
    expect(cabo).toMatchObject({ saldo: 0, minimo: 30 })
  })
  it('material no carro fora do kit aparece com mínimo zero e não conta para a cor', () => {
    const fita = estoqueDaEquipe(EQ[0], RET, { ...KIT, Moto: [] }).find((l) => l.codigo === '10030117')
    expect(fita).toMatchObject({ saldo: 3, minimo: 0 })
    expect(nivelDaEquipe(EQ[0], RET, { ...KIT, Moto: [] })).toBe('sem')
  })
  it('mesma regra das bases: até 20% acima é amarelo, abaixo é vermelho, pelo pior material', () => {
    // MOTO 01 tem 3 fitas no carro.
    expect(nivelDaEquipe(EQ[0], RET, { ...KIT, Moto: [min('10030117', 'Fita', 3, 'rl')] })).toBe('proximo')
    expect(nivelDaEquipe(EQ[0], RET, { ...KIT, Moto: [min('10030117', 'Fita', 2, 'rl')] })).toBe('ok')
    expect(nivelDaEquipe(EQ[0], RET, { ...KIT, Moto: [min('10030117', 'Fita', 4, 'rl')] })).toBe('abaixo')
    // MULT 01: lacre 24/20 (amarelo), medidor 12/5 (normal), cabo 0/30 (vermelho).
    expect(nivelDaEquipe(EQ[1], RET, KIT)).toBe('abaixo')
    expect(nivelDaEquipe(comAjuste('e3', [min('10061204', 'Cabo', 0, 'm')]), RET, KIT)).toBe('proximo')
  })
  it('sem kit nem ajuste a equipe fica sem cor', () => {
    expect(nivelDaEquipe(EQ[2], RET)).toBe('sem')
  })
  it('aviso no mapa geral pega o pior carro com origem no local', () => {
    expect(nivelDasEquipes('MNT', EQ, RET, KIT)).toBe('abaixo')
    expect(nivelDasEquipes('211', EQ, RET, { ...KIT, Moto: [min('10030117', 'Fita', 3, 'rl')] })).toBe('proximo')
    expect(nivelDasEquipes('211', EQ, RET, KIT)).toBeNull()
    expect(nivelDasEquipes('SMS', EQ, RET, KIT)).toBeNull()
  })
})

describe('grupos de sub-bases', () => {
  it('cada base está em exatamente um grupo', () => {
    const nosGrupos = GRUPOS.flatMap((g) => g.bases)
    expect(nosGrupos.toSorted()).toEqual(BASES.map((b) => b.codigo).toSorted())
  })
})

describe('despacho', () => {
  it('despacho gerado da solicitação leva só o que foi aprovado, com quem enviou', () => {
    const d = despachoDaSolicitacao(SOL, undefined, 'DSP-2026-00001', 'Usuário logado')
    expect(d).toMatchObject({ base: 'RSP', solicitacao: 'SOL-0001', numero: 'DSP-2026-00001', enviadoPor: 'Usuário logado' })
    expect(d.itens.map((i) => i.codigo)).toEqual(['10061204', '10044870'])
    expect(d.itens[0]).toMatchObject({ qtd: 84, unidade: 'm' })
  })
  it('quantidade escolhida na análise substitui a sugestão e zero sai do despacho', () => {
    const d = despachoDaSolicitacao(SOL, { '10061204': 50, '10044870': 0, '10027745': 3 })
    expect(d.itens.map((i) => [i.codigo, i.qtd])).toEqual([
      ['10061204', 50],
      ['10027745', 3],
    ])
  })
})

describe('atendimento da solicitação', () => {
  it('é a média do quanto cada item foi atendido', () => {
    expect(atendimento([{ solicitado: 10, aprovado: 10 }, { solicitado: 10, aprovado: 5 }])).toBe(75)
    expect(atendimento([{ solicitado: 10, aprovado: 0 }])).toBe(0)
    expect(atendimento([])).toBe(0)
  })
})

describe('reserva CEMIG', () => {
  it('saldo a retirar é o autorizado menos o retirado', () => {
    expect(saldoReserva({ material: 'x', codigo: '1', unidade: 'm', autorizado: 2000, retirado: 1650 })).toBe(350)
  })
})

describe('capacidade de atender a solicitação com o estoque de hoje', () => {
  const item = (solicitado: number, disponivel: number, decisao: 'Aprovado' | 'Cancelado' = 'Aprovado') => ({ material: 'm', codigo: String(solicitado + disponivel), unidade: 'un', solicitado, disponivel, consumo90: 0, saldoBase: 0, decisao, aprovado: 0 })
  it('completo quando todo item tem disponível', () => {
    expect(capacidade({ itens: [item(10, 10), item(5, 20)] })).toBe('completo')
  })
  it('parcial quando algum item falta ou vem reduzido', () => {
    expect(capacidade({ itens: [item(10, 4), item(5, 20)] })).toBe('parcial')
    expect(capacidade({ itens: [item(10, 0), item(5, 20)] })).toBe('parcial')
  })
  it('sem estoque quando nenhum item tem disponível; cancelado não conta', () => {
    expect(capacidade({ itens: [item(10, 0)] })).toBe('nenhum')
    expect(capacidade({ itens: [item(10, 10, 'Cancelado'), item(5, 0)] })).toBe('nenhum')
  })
})

describe('leitor de código e caixas de medidor', () => {
  it('caixa traz todos os seriais dela', () => {
    const l = lerCodigo(' cx-0420 ', CAIXAS)
    expect(l.tipo).toBe('caixa')
    if (l.tipo === 'caixa') expect(l.seriais).toHaveLength(12)
  })
  it('serial avulso é reconhecido e código desconhecido não', () => {
    expect(lerCodigo('MF26420003', CAIXAS)).toMatchObject({ tipo: 'serial', serial: 'MF26420003' })
    expect(lerCodigo('XYZ', CAIXAS).tipo).toBe('desconhecido')
    expect(lerCodigo('CX-0420').tipo).toBe('desconhecido')
  })
  it('cada caixa tem a sua quantidade: não existe número fixo por caixa', () => {
    expect(lerCodigo('CX-0418', CAIXAS)).toMatchObject({ seriais: expect.arrayContaining(['MF26418016']) })
    const l = lerCodigo('CX-0422', CAIXAS)
    if (l.tipo === 'caixa') expect(l.seriais).toHaveLength(9)
  })
  it('resume pela caixa: inteira, parte de uma caixa e avulsos', () => {
    const cx18 = CAIXAS['CX-0418'].seriais
    const cx19 = CAIXAS['CX-0419'].seriais.slice(0, 4)
    expect(emCaixas([...cx18, ...cx19], CAIXAS)).toBe('CX-0418 inteira (16) + 4 de CX-0419 (16)')
    expect(emCaixas(['MF99000001'], CAIXAS)).toBe('1 avulso')
    expect(emCaixas([])).toBeNull()
    expect(emCaixas(undefined)).toBeNull()
  })
})

describe('equipes e acesso às bases', () => {
  const nova = { codigo: 'MOTO 09', tipo: 'Moto' as const, supervisor: 'Pedro' as const, integrantes: ['55377'], bases: basesPadrao('Moto', 'Pedro'), placa: 'abc1d23', origem: 'ITN' as const }
  it('moto começa com todas as bases; as outras com as do supervisor', () => {
    expect(basesPadrao('Moto', 'Elton')).toHaveLength(BASES.length)
    expect(basesPadrao('Moto/Multifuncional', 'Victor')).toEqual(['MNT', 'ITB', 'CRC'])
  })
  it('todas retiram no 211 Geral; na base só se estiver liberada', () => {
    const mult = EQ.find((e) => e.codigo === 'MULT 01')!
    expect(podeRetirar(mult, '211')).toBe(true)
    expect(podeRetirar(mult, 'CRC')).toBe(true)
    expect(podeRetirar(mult, 'SMS')).toBe(false)
  })
  it('matrícula traz nome, supervisão e equipe', () => {
    expect(colaborador('52210', PESSOAS)).toMatchObject({ nome: 'Pessoa A', supervisor: 'Pedro' })
    expect(equipeDe('Mat. 52210', EQ)?.codigo).toBe('MOTO 01')
    expect(colaborador('99999', PESSOAS)).toBeUndefined()
    expect(colaborador('52210')).toBeUndefined()
  })
  it('cadastro completo passa; placa em minúscula é aceita', () => {
    expect(validarEquipe(nova, EQ, PESSOAS)).toEqual([])
  })
  it('cadastro incompleto diz tudo o que falta', () => {
    const erros = validarEquipe({ ...nova, codigo: '', integrantes: [], bases: [], placa: '12', origem: '' }, EQ, PESSOAS)
    expect(erros).toHaveLength(5)
    expect(erros).toContain('Escolha a base de origem: onde a equipe inicia a jornada (ou o 211 Geral).')
  })
  it('não aceita código repetido nem integrante que já está em outra equipe', () => {
    const erros = validarEquipe({ ...nova, codigo: 'moto 01', integrantes: ['52210'] }, EQ, PESSOAS)
    expect(erros.some((e) => e.includes('Já existe'))).toBe(true)
    expect(erros.some((e) => e.includes('MOTO 01. Tire'))).toBe(true)
  })
  it('base de origem numa base precisa estar entre as liberadas; 211 Geral sempre vale', () => {
    const fora = validarEquipe({ ...nova, tipo: 'Moto/Multifuncional', bases: ['RSP'], origem: 'ITN' }, EQ, PESSOAS)
    expect(fora).toContain('A base de origem ITN precisa estar entre as bases liberadas. Marque ITN ou escolha outra base de origem.')
    expect(validarEquipe({ ...nova, bases: ['RSP'], origem: '211' }, EQ, PESSOAS)).toEqual([])
  })
  it('mapa da base mostra só as equipes com origem nela', () => {
    expect(equipesDaOrigem('ITN', EQ).map((e) => e.codigo)).toEqual(['MULT 04'])
    expect(equipesDaOrigem('211', EQ).map((e) => e.codigo)).toEqual(['MOTO 01'])
    expect(equipesDaOrigem('SMS', EQ)).toEqual([])
  })
  it('equipe com origem em ITN retira em TRM, mas o veículo só aparece no mapa de ITN', () => {
    const mult04 = EQ.find((e) => e.codigo === 'MULT 04')!
    expect(mult04.origem).toBe('ITN')
    expect(podeRetirar(mult04, 'TRM')).toBe(true)
    expect(equipesDaOrigem('ITN', EQ)).toContain(mult04)
    expect(equipesDaOrigem('TRM', EQ)).not.toContain(mult04)
  })
  it('estoque do carro soma as retiradas da equipe por material, com os seriais', () => {
    const extra = { ...RET[1], id: 'x', itens: [{ material: 'Lacre', codigo: '10018832', unidade: 'un', qtd: 6 }] }
    const carro = estoqueDoCarro('e3', [...RET, extra])
    expect(carro.find((i) => i.codigo === '10018832')?.qtd).toBe(24 + 6)
    const medidor = carro.find((i) => i.codigo === '10052311')
    expect(medidor?.qtd).toBe(12)
    expect(medidor?.seriais).toHaveLength(12)
    expect(estoqueDoCarro('e6', RET)).toEqual([])
  })
  it('matrícula fora da lista de colaboradores é recusada', () => {
    expect(validarEquipe({ ...nova, integrantes: ['99999'] }, EQ, PESSOAS)).toContain('Matrícula 99999 não está na lista de colaboradores.')
  })
})

describe('termo assinado da retirada', () => {
  it('retirada sem termo anexado fica pendente; com termo, sai da lista', () => {
    const pendentes = RET.filter(retiradaPendente).map((r) => r.numero)
    expect(pendentes).toEqual(['DSP-2026-00010', 'DSP-2026-00009'])
  })

  it('aceita foto ou PDF e recusa outros arquivos dizendo o que fazer', () => {
    expect(validarAnexo({ name: 'termo.pdf', type: 'application/pdf', size: 200_000 })).toEqual({ formato: 'pdf' })
    expect(validarAnexo({ name: 'IMG_1.jpg', type: 'image/jpeg', size: 3_000_000 })).toEqual({ formato: 'foto' })
    const doc = validarAnexo({ name: 'termo.docx', type: 'application/vnd.openxmlformats', size: 1000 })
    expect('erro' in doc && doc.erro).toMatch(/não é foto nem PDF/)
    const grande = validarAnexo({ name: 'scan.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 })
    expect('erro' in grande && grande.erro).toMatch(/passa de 10 MB/)
  })
})

describe('retiradas por matrícula', () => {
  it('traz todas as retiradas da matrícula, da mais recente para a mais antiga', () => {
    const extra = { ...RET[0], id: 'x', numero: 'DSP-2026-00001', data: '01/10/2026 08:00' }
    const lista = retiradasDaMatricula([extra, ...RET], '52210').map((r) => r.numero)
    expect(lista).toEqual(['DSP-2026-00010', 'DSP-2026-00007', 'DSP-2026-00001'])
  })

  it('ignora pontuação na matrícula digitada', () => {
    expect(retiradasDaMatricula(RET, '52.210')).toHaveLength(2)
    expect(retiradasDaMatricula(RET, '99999')).toHaveLength(0)
  })
})
