import { describe, expect, it } from 'vitest'
import { COMMIT, linhaRodape } from './sobre'

describe('linhaRodape', () => {
  it('junta a autoria e o commit', () => {
    expect(linhaRodape('a1b2c3d')).toBe('Desenvolvido por Matheus Galdino · a1b2c3d')
  })

  it('sem commit, sai só a autoria', () => {
    expect(linhaRodape(null)).toBe('Desenvolvido por Matheus Galdino')
  })

  it('o commit do build é o hash curto ou null', () => {
    if (COMMIT !== null) expect(COMMIT).toMatch(/^[0-9a-f]{7,}$/)
  })
})
