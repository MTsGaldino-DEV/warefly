import { afterEach, describe, expect, it, vi } from 'vitest'
import { novoId } from './id'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('novoId', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('gera UUID v4 sem repetir', () => {
    const ids = new Set(Array.from({ length: 500 }, novoId))
    expect(ids.size).toBe(500)
    for (const id of ids) expect(id).toMatch(UUID_V4)
  })

  it('funciona em HTTP, onde o navegador não oferece randomUUID', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
    expect(novoId()).toMatch(UUID_V4)
  })
})
