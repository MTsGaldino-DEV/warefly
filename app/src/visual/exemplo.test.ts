import { describe, expect, it } from 'vitest'
import { atendimento, BASES, basesPadrao, capacidade, colaborador, EQUIPES, equipeDe, podeRetirar, validarEquipe, DESPACHOS, despachoDaSolicitacao, CAIXAS_MEDIDOR, equipesDaOrigem, estoqueDoCarro, emCaixas, estoqueDoLocal, GRUPOS, lerCodigo, nivelDoItem, nivelDoLocal, RESERVAS, RETIRADAS, retiradaPendente, retiradasDaMatricula, validarAnexo, saldoReserva, SOLICITACOES, type LinhaEstoque } from './exemplo'

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
  it('o exemplo mostra as três cores no mapa', () => {
    const niveis = new Set(BASES.map((b) => nivelDoLocal(estoqueDoLocal(b.codigo))))
    expect(niveis).toEqual(new Set(['ok', 'proximo', 'abaixo']))
  })
})

describe('grupos de sub-bases', () => {
  it('cada base está em exatamente um grupo', () => {
    const nosGrupos = GRUPOS.flatMap((g) => g.bases)
    expect(nosGrupos.toSorted()).toEqual(BASES.map((b) => b.codigo).toSorted())
  })
})

describe('despacho', () => {
  it('números de despacho são únicos entre bases e retiradas e seguem DSP-AAAA-NNNNN', () => {
    const numeros = [...DESPACHOS.map((d) => d.numero), ...RETIRADAS.map((r) => r.numero)]
    expect(new Set(numeros).size).toBe(numeros.length)
    for (const n of numeros) expect(n).toMatch(/^DSP-\d{4}-\d{5}$/)
  })
  it('despacho gerado da solicitação leva só o que foi aprovado', () => {
    const s = SOLICITACOES[0]
    const d = despachoDaSolicitacao(s)
    expect(d.base).toBe(s.base)
    expect(d.solicitacao).toBe(s.numero)
    expect(d.itens.map((i) => i.codigo)).toEqual(['10061204', '10044870', '10052311', '10030117'])
    expect(d.itens[0]).toMatchObject({ qtd: 84, unidade: 'm' })
  })
  it('quantidade escolhida na análise substitui a sugestão e zero sai do despacho', () => {
    const s = SOLICITACOES[0]
    const d = despachoDaSolicitacao(s, { '10061204': 50, '10044870': 0, '10052311': 0, '10030117': 20 })
    expect(d.itens.map((i) => [i.codigo, i.qtd])).toEqual([
      ['10061204', 50],
      ['10030117', 20],
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
  it('saldo a retirar é o autorizado menos o retirado, nunca negativo no exemplo', () => {
    for (const r of RESERVAS) for (const i of r.itens) expect(saldoReserva(i)).toBeGreaterThanOrEqual(0)
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
  it('o exemplo tem os três casos na fila', () => {
    const fila = SOLICITACOES.filter((s) => s.situacao === 'aguardando' || s.situacao === 'aprovada')
    expect(new Set(fila.map(capacidade))).toEqual(new Set(['completo', 'parcial', 'nenhum']))
  })
})

describe('leitor de código e caixas de medidor', () => {
  it('caixa traz todos os seriais dela', () => {
    const l = lerCodigo(' cx-0420 ')
    expect(l.tipo).toBe('caixa')
    if (l.tipo === 'caixa') expect(l.seriais).toHaveLength(12)
  })
  it('serial avulso é reconhecido e código desconhecido não', () => {
    expect(lerCodigo('MF26420003')).toMatchObject({ tipo: 'serial', serial: 'MF26420003' })
    expect(lerCodigo('XYZ').tipo).toBe('desconhecido')
  })
  it('cada caixa tem a sua quantidade: não existe número fixo por caixa', () => {
    expect(lerCodigo('CX-0418')).toMatchObject({ seriais: expect.arrayContaining(['MF26418016']) })
    const l = lerCodigo('CX-0422')
    if (l.tipo === 'caixa') expect(l.seriais).toHaveLength(9)
  })
  it('resume pela caixa: inteira, parte de uma caixa e avulsos', () => {
    const cx18 = CAIXAS_MEDIDOR['CX-0418'].seriais
    const cx19 = CAIXAS_MEDIDOR['CX-0419'].seriais.slice(0, 4)
    expect(emCaixas([...cx18, ...cx19])).toBe('CX-0418 inteira (16) + 4 de CX-0419 (16)')
    expect(emCaixas(['MF99000001'])).toBe('1 avulso')
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
    const mult = EQUIPES.find((e) => e.codigo === 'MULT 01')!
    expect(podeRetirar(mult, '211')).toBe(true)
    expect(podeRetirar(mult, 'CRC')).toBe(true)
    expect(podeRetirar(mult, 'SMS')).toBe(false)
  })
  it('matrícula traz nome, supervisão e equipe', () => {
    expect(colaborador('52210')).toMatchObject({ nome: 'Carlos Henrique Souza', supervisor: 'Pedro' })
    expect(equipeDe('Mat. 52210', EQUIPES)?.codigo).toBe('MOTO 01')
    expect(colaborador('99999')).toBeUndefined()
  })
  it('cadastro completo passa; placa em minúscula é aceita', () => {
    expect(validarEquipe(nova, EQUIPES)).toEqual([])
  })
  it('cadastro incompleto diz tudo o que falta', () => {
    const erros = validarEquipe({ ...nova, codigo: '', integrantes: [], bases: [], placa: '12', origem: '' }, EQUIPES)
    expect(erros).toHaveLength(5)
    expect(erros).toContain('Escolha a base de origem: onde a equipe inicia a jornada (ou o 211 Geral).')
  })
  it('não aceita código repetido nem integrante que já está em outra equipe', () => {
    const erros = validarEquipe({ ...nova, codigo: 'moto 01', integrantes: ['52210'] }, EQUIPES)
    expect(erros.some((e) => e.includes('Já existe'))).toBe(true)
    expect(erros.some((e) => e.includes('MOTO 01. Tire'))).toBe(true)
  })
  it('base de origem numa base precisa estar entre as liberadas; 211 Geral sempre vale', () => {
    const fora = validarEquipe({ ...nova, tipo: 'Moto/Multifuncional', bases: ['RSP'], origem: 'ITN' }, EQUIPES)
    expect(fora).toContain('A base de origem ITN precisa estar entre as bases liberadas. Marque ITN ou escolha outra base de origem.')
    expect(validarEquipe({ ...nova, bases: ['RSP'], origem: '211' }, EQUIPES)).toEqual([])
  })
  it('mapa da base mostra só as equipes com origem nela', () => {
    expect(equipesDaOrigem('ITN', EQUIPES).map((e) => e.codigo)).toEqual(['MULT 04', 'MOTO 03'])
    expect(equipesDaOrigem('211', EQUIPES).map((e) => e.codigo)).toEqual(['MOTO 01'])
    for (const b of BASES) expect(equipesDaOrigem(b.codigo, EQUIPES).length).toBeGreaterThan(0)
  })
  it('equipe com origem em ITN retira em TRM, mas o veículo só aparece no mapa de ITN', () => {
    const mult04 = EQUIPES.find((e) => e.codigo === 'MULT 04')!
    expect(mult04.origem).toBe('ITN')
    expect(podeRetirar(mult04, 'TRM')).toBe(true)
    expect(equipesDaOrigem('ITN', EQUIPES)).toContain(mult04)
    expect(equipesDaOrigem('TRM', EQUIPES)).not.toContain(mult04)
  })
  it('estoque do carro soma as retiradas da equipe por material, com os seriais', () => {
    const extra = { ...RETIRADAS.find((r) => r.id === 'r6')!, id: 'x', itens: [{ material: 'Lacre polipropileno', codigo: '10018832', unidade: 'un', qtd: 6 }] }
    const carro = estoqueDoCarro('e3', [...RETIRADAS, extra])
    expect(carro.find((i) => i.codigo === '10018832')?.qtd).toBe(24 + 6)
    const medidor = carro.find((i) => i.codigo === '10052311')
    expect(medidor?.qtd).toBe(12)
    expect(medidor?.seriais).toHaveLength(12)
    expect(estoqueDoCarro('e16', RETIRADAS)).toEqual([])
  })
  it('matrícula fora da lista de colaboradores é recusada', () => {
    expect(validarEquipe({ ...nova, integrantes: ['99999'] }, EQUIPES)).toContain('Matrícula 99999 não está na lista de colaboradores.')
  })
})

describe('termo assinado da retirada', () => {
  it('retirada sem termo anexado fica pendente; com termo, sai da lista', () => {
    const pendentes = RETIRADAS.filter(retiradaPendente).map((r) => r.numero)
    expect(pendentes).toEqual(['DSP-2026-00389', 'DSP-2026-00387'])
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
    const extra = { ...RETIRADAS[0], id: 'x', numero: 'DSP-2026-00300', data: '01/10/2026 08:00' }
    const lista = retiradasDaMatricula([extra, ...RETIRADAS], '52210').map((r) => r.numero)
    expect(lista).toEqual(['DSP-2026-00389', 'DSP-2026-00383', 'DSP-2026-00300'])
  })

  it('ignora pontuação na matrícula digitada', () => {
    expect(retiradasDaMatricula(RETIRADAS, '52.210')).toHaveLength(2)
    expect(retiradasDaMatricula(RETIRADAS, '99999')).toHaveLength(0)
  })
})
