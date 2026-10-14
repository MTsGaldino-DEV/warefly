import { describe, expect, it } from 'vitest'
import {
  formatarData,
  formatarDoc,
  formatarQtd,
  hojeISO,
  lerNumero,
  qtdValida,
  rotuloStatus,
  tomStatus,
} from './formato'

describe('formatarDoc', () => {
  it('preenche o número com seis dígitos', () => {
    expect(formatarDoc('PED', 123)).toBe('PED-000123')
    expect(formatarDoc('REM', 1234567)).toBe('REM-1234567')
  })
})

describe('formatarQtd', () => {
  it('usa vírgula decimal e sem zeros à direita', () => {
    expect(formatarQtd(10)).toBe('10')
    expect(formatarQtd(10.5)).toBe('10,5')
    expect(formatarQtd('2.250')).toBe('2,25')
  })
  it('separa milhar com ponto', () => {
    expect(formatarQtd(1234.5)).toBe('1.234,5')
  })
  it('mostra traço para vazio', () => {
    expect(formatarQtd(null)).toBe('—')
    expect(formatarQtd(undefined)).toBe('—')
  })
})

describe('datas', () => {
  it('formata data ISO sem deslocar o fuso', () => {
    expect(formatarData('2026-09-28')).toBe('28/09/2026')
    expect(formatarData(null)).toBe('—')
  })
  it('hoje é calculado no fuso de São Paulo', () => {
    expect(hojeISO(new Date('2026-09-29T02:00:00Z'))).toBe('2026-09-28')
    expect(hojeISO(new Date('2026-09-29T04:00:00Z'))).toBe('2026-09-29')
  })
})

describe('status', () => {
  it('tem rótulo em português', () => {
    expect(rotuloStatus('em_transito')).toBe('Em trânsito')
    expect(rotuloStatus('com_divergencia')).toBe('Com divergência')
    expect(rotuloStatus('encerrada')).toBe('Encerrada')
  })
  it('agrupa status nas cores da identidade', () => {
    expect(tomStatus('solicitado')).toBe('info')
    expect(tomStatus('aprovado')).toBe('info')
    expect(tomStatus('em_transito')).toBe('transito')
    expect(tomStatus('encerrado')).toBe('ok')
    expect(tomStatus('encerrada')).toBe('ok')
    expect(tomStatus('com_divergencia')).toBe('alerta')
    expect(tomStatus('rascunho')).toBe('neutro')
    expect(tomStatus('cancelado')).toBe('neutro')
  })
})

describe('qtdValida', () => {
  it('exige número positivo', () => {
    expect(qtdValida('', false)).toBe('Informe a quantidade.')
    expect(qtdValida('abc', false)).toBe('Quantidade inválida.')
    expect(qtdValida('0', false, { permiteZero: false })).toBe('Informe uma quantidade maior que zero.')
    expect(qtdValida('-1', false)).toBe('Quantidade não pode ser negativa.')
  })
  it('bloqueia fração em unidade inteira', () => {
    expect(qtdValida('1,5', false)).toBe('Esta unidade não aceita fração.')
    expect(qtdValida('1,5', true)).toBeNull()
    expect(qtdValida('3', false)).toBeNull()
  })
  it('aceita zero quando permitido', () => {
    expect(qtdValida('0', false, { permiteZero: true })).toBeNull()
  })
})

describe('lerNumero no padrão brasileiro', () => {
  it('ponto em grupos de três é separador de milhar', () => {
    expect(lerNumero('1.000')).toBe(1000)
    expect(lerNumero('1.500')).toBe(1500)
    expect(lerNumero('12.345.678')).toBe(12345678)
    expect(lerNumero('1.234,5')).toBe(1234.5)
  })
  it('ponto que não forma milhar é decimal (teclado sem vírgula)', () => {
    expect(lerNumero('1.5')).toBe(1.5)
    expect(lerNumero('2.25')).toBe(2.25)
  })
})

describe('qtdValida: casas decimais', () => {
  it('aceita até três casas', () => {
    expect(qtdValida('1,125', true)).toBeNull()
    expect(qtdValida('1,1255', true)).toBe('Use no máximo 3 casas decimais.')
  })
})
