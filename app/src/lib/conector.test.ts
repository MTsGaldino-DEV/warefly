import { describe, expect, it } from 'vitest'
import { ANDAMENTO_VAZIO, aplicarEvento, lerPing } from './conector'

describe('aplicarEvento', () => {
  it('atualiza etapa pelo id, item pelo código e guarda o fim', () => {
    let a = aplicarEvento(ANDAMENTO_VAZIO, { tipo: 'etapa', id: 'abrir', msg: 'Abrir', estado: 'andamento' })
    a = aplicarEvento(a, { tipo: 'etapa', id: 'abrir', msg: 'Abrir', estado: 'ok' })
    a = aplicarEvento(a, { tipo: 'item', codigo: '1776', estado: 'erro', msg: 'GDIS: repetido' })
    a = aplicarEvento(a, { tipo: 'fim', ok: true, incluidos: 0, total: 1, msg: 'Pronto' })
    expect(a.etapas).toEqual([{ id: 'abrir', msg: 'Abrir', estado: 'ok' }])
    expect(a.itens['1776']).toEqual({ estado: 'erro', msg: 'GDIS: repetido' })
    expect(a.fim?.msg).toBe('Pronto')
  })
  it('ignora eventos que não são de andamento', () => {
    expect(aplicarEvento(ANDAMENTO_VAZIO, { tipo: 'debug', msg: 'x' })).toBe(ANDAMENTO_VAZIO)
  })
})

describe('lerPing', () => {
  it('traz login pendente e andamento para a aba se recuperar', () => {
    const andamento = { etapas: [], itens: { '1776': { estado: 'ok' as const } }, fim: null }
    expect(lerPing({ ok: true, sessaoOk: false, tarefaAtiva: true, aguardandoLogin: true, andamento })).toEqual({
      sessaoOk: false,
      tarefaAtiva: true,
      aguardandoLogin: true,
      andamento,
    })
  })
  it('aceita conector antigo sem andamento', () => {
    expect(lerPing({ ok: true, sessaoOk: true, tarefaAtiva: false })).toEqual({
      sessaoOk: true,
      tarefaAtiva: false,
      aguardandoLogin: false,
      andamento: ANDAMENTO_VAZIO,
    })
  })
})
