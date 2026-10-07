import { describe, expect, it } from 'vitest'
import { codigosPeriodo, frasePeriodo, lerLista, mesSeguinte, paraEnvio, validarRequisicao } from './requisicaoGdis'

const catalogo: Record<string, string> = { '1776': 'id-1776', '240': 'id-240' }
const idDoCodigo = (c: string) => catalogo[c] ?? null

describe('período', () => {
  it('vira 01MM 30MM', () => {
    expect(codigosPeriodo('2026-05')).toBe('0105 3005')
    expect(codigosPeriodo('2026-10')).toBe('0110 3010')
    expect(frasePeriodo('2026-05')).toBe('REQUISICAO DE MATERIAIS DE MANUTENCAO PARA O PERIODO 0105 3005')
  })
  it('recusa mês inválido', () => {
    expect(() => codigosPeriodo('2026-13')).toThrow()
    expect(() => codigosPeriodo('')).toThrow()
  })
  it('mês seguinte vira o ano em dezembro', () => {
    expect(mesSeguinte(new Date(2026, 9, 7))).toBe('2026-11')
    expect(mesSeguinte(new Date(2026, 11, 31))).toBe('2027-01')
  })
})

describe('lerLista', () => {
  it('aceita ponto e vírgula, tab e espaços e ignora linhas vazias', () => {
    const r = lerLista('1776;3\n\n240\t12\n999999   1\n', new Set(), idDoCodigo)
    expect(r.erros).toEqual([])
    expect(r.itens).toEqual([
      { codigo: '1776', quantidade: '3', materialId: 'id-1776' },
      { codigo: '240', quantidade: '12', materialId: 'id-240' },
      { codigo: '999999', quantidade: '1', materialId: null },
    ])
  })
  it('aponta a linha ruim pelo número e mantém as boas', () => {
    const r = lerLista('Código;Qtd\n1776;2\n240;1,5\n123', new Set(), idDoCodigo)
    expect(r.itens.map((i) => i.codigo)).toEqual(['1776'])
    expect(r.erros).toEqual([
      'Linha 1: use "código; quantidade" com código só de números.',
      'Linha 3: a quantidade deve ser inteira, de 1 a 999.',
      'Linha 4: use "código; quantidade" com código só de números.',
    ])
  })
  it('não repete código já na lista nem dentro do texto', () => {
    const r = lerLista('1776;1\n240;1\n240;2', new Set(['1776']), idDoCodigo)
    expect(r.itens.map((i) => i.codigo)).toEqual(['240'])
    expect(r.erros).toEqual(['Linha 1: o código 1776 já está na lista.', 'Linha 3: o código 240 já está na lista.'])
  })
})

describe('validarRequisicao', () => {
  const ok = [{ codigo: '1776', quantidade: '2', materialId: 'id-1776' }]
  it('passa quando está certo', () => {
    expect(validarRequisicao('2026-05', '3013248220', ok)).toEqual([])
  })
  it('aponta cada problema', () => {
    expect(validarRequisicao('2026-05', '301', ok)).toContain('A instalação deve ter 10 dígitos.')
    expect(validarRequisicao('2026-05', '3013248220', [])).toContain('Informe ao menos um item.')
    expect(validarRequisicao('2026-05', '3013248220', [{ ...ok[0], quantidade: '' }])).toContain(
      '1776: a quantidade deve ser inteira, de 1 a 999.',
    )
    expect(validarRequisicao('x', '3013248220', ok)[0]).toMatch(/mês/)
  })
})

it('paraEnvio converte quantidade em número', () => {
  expect(paraEnvio('2026-05', '3013248220', [{ codigo: '1776', quantidade: '2', materialId: null }])).toEqual({
    periodo: '2026-05',
    instalacao: '3013248220',
    itens: [{ codigo: '1776', quantidade: 2 }],
  })
})
