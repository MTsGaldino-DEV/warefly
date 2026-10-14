import { describe, expect, it } from 'vitest'
import { ABAS_ADMIN, AUTOMACOES, ROTA_ADMIN } from './admin'

describe('administração', () => {
  it('sub-abas ficam dentro de /admin', () => {
    expect(ABAS_ADMIN.map((a) => a.rotulo)).toEqual(['Automações'])
    for (const aba of ABAS_ADMIN) expect(aba.para.startsWith(`${ROTA_ADMIN}/`)).toBe(true)
  })

  it('automações têm id único e rota dentro de Automações', () => {
    const ids = AUTOMACOES.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const a of AUTOMACOES) if (a.para) expect(a.para.startsWith('/admin/automacoes/')).toBe(true)
  })

  it('requisição de material abre a tela que já existe', () => {
    expect(AUTOMACOES.find((a) => a.id === 'requisicao-material')?.para).toBe('/admin/automacoes/requisicao-material')
  })
})
