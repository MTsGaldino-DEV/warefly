import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { COMMIT } from '../../lib/sobre'
import { Sobre } from './Sobre'

afterEach(cleanup)

describe('Sobre', () => {
  it('mostra a autoria e a versão do build', () => {
    render(<Sobre />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sobre')
    expect(screen.getByText('Desenvolvido por Matheus Galdino')).not.toBeNull()
    if (COMMIT) expect(screen.getByText(`Versão ${COMMIT}`)).not.toBeNull()
    else expect(screen.queryByText(/^Versão /)).toBeNull()
  })

  it('não tem link nem e-mail', () => {
    render(<Sobre />)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.queryByText(/@/)).toBeNull()
  })
})
