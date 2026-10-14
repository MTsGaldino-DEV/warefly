import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { Automacoes } from './Automacoes'

afterEach(cleanup)

describe('Automações', () => {
  it('lista as automações e abre a requisição de material', () => {
    render(
      <MemoryRouter>
        <Automacoes />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Automações')
    const abrir = screen.getByRole('link', { name: 'Abrir Solicitar material no GDIS' })
    expect(abrir.getAttribute('href')).toBe('/admin/automacoes/requisicao-material')
  })

  it('automação sem fluxo definido não tem link', () => {
    render(
      <MemoryRouter>
        <Automacoes />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Serviços executados das equipes' })).not.toBeNull()
    expect(screen.queryByRole('link', { name: 'Abrir Serviços executados das equipes' })).toBeNull()
    expect(screen.getByText('Fluxo em definição')).not.toBeNull()
  })
})
