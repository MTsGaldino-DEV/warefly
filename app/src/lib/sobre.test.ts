import { describe, expect, it } from 'vitest'
import { AUTORIA, COMMIT, linhaVersao } from './sobre'

describe('sobre', () => {
  it('autoria é só o crédito, sem e-mail nem ano', () => {
    expect(AUTORIA).toBe('Desenvolvido por Matheus Galdino')
  })

  it('versão usa o commit do build', () => {
    expect(linhaVersao('a1b2c3d')).toBe('Versão a1b2c3d')
  })

  it('sem commit, não há linha de versão', () => {
    expect(linhaVersao(null)).toBeNull()
  })

  it('o commit do build é o hash curto ou null', () => {
    if (COMMIT !== null) expect(COMMIT).toMatch(/^[0-9a-f]{7,}$/)
  })
})
