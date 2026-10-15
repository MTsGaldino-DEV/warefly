import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const LOCAL = { id: 'crc', codigo: 'CRC', nome: 'Coroaci', tipo: 'base', pai_id: '211', ativo: true }
const MATERIAL = { id: 'm1', codigo_sap: '7001', descricao: 'PARAFUSO', unidade: 'PC', ativo: true }

const rpc = vi.fn()
const recarregar = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: (tabela: string) => ({
      select: () => ({
        eq: () =>
          tabela === 'ajustes'
            ? { single: async () => ({ data: { numero: 7 }, error: null }) }
            : Promise.resolve({ data: [{ material_id: 'm1', saldo: 4 }], error: null }),
      }),
    }),
  },
}))

vi.mock('../../auth/SessaoContext', () => ({
  useSessao: () => ({ almoxGeridos: [LOCAL] }),
}))

vi.mock('../../auth/CatalogoContext', () => ({
  useCatalogo: () => ({
    material: (id: string) => (id === 'm1' ? MATERIAL : undefined),
    unidades: [{ codigo: 'PC', descricao: 'Peça', aceita_fracao: false }],
    aceitaFracao: () => false,
    buscar: (termo: string) => (termo ? [MATERIAL] : []),
    carregando: false,
    recarregar,
  }),
}))

const { Inventario } = await import('./Inventario')

beforeEach(() => {
  localStorage.clear()
  rpc.mockReset()
  rpc.mockImplementation(async (nome: string) => {
    if (nome === 'fn_em_implantacao') return { data: true, error: null }
    if (nome === 'rpc_registrar_ajuste') return { data: 'aj1', error: null }
    if (nome === 'rpc_cadastrar_material_rapido') return { data: 'm1', error: null }
    return { data: null, error: null }
  })
})
afterEach(cleanup)

async function adicionarParafuso() {
  fireEvent.change(screen.getByRole('combobox', { name: 'Adicionar material' }), { target: { value: '7001' } })
  fireEvent.click(await screen.findByRole('option', { name: /PARAFUSO/ }))
}

describe('Inventário', () => {
  it('local sem operação conta como saldo inicial', async () => {
    render(<Inventario />)
    expect(await screen.findByText('Saldo inicial (implantação)')).not.toBeNull()
    expect((screen.getByLabelText('Justificativa') as HTMLInputElement).value).toBe('Contagem de implantação (dia D)')
  })

  it('lança a contagem com a quantidade digitada', async () => {
    render(<Inventario />)
    await screen.findByText('Saldo inicial (implantação)')
    await adicionarParafuso()
    expect(screen.getByText('4')).not.toBeNull()
    fireEvent.change(screen.getByLabelText('Quantidade contada de PARAFUSO'), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lançar contagem' }))
    expect(await screen.findByText(/Contagem lançada em Coroaci: AJU-000007 com 1 material/)).not.toBeNull()
    expect(rpc).toHaveBeenCalledWith('rpc_registrar_ajuste', expect.objectContaining({
      p_almox_id: 'crc',
      p_tipo: 'implantacao',
      p_itens: [{ material_id: 'm1', qtd_contada: 12 }],
    }))
  })

  it('não lança com quantidade em branco', async () => {
    render(<Inventario />)
    await screen.findByText('Saldo inicial (implantação)')
    await adicionarParafuso()
    fireEvent.click(screen.getByRole('button', { name: 'Lançar contagem' }))
    expect(await screen.findByText('7001 PARAFUSO: Informe a quantidade.')).not.toBeNull()
    expect(rpc).not.toHaveBeenCalledWith('rpc_registrar_ajuste', expect.anything())
  })

  it('local em operação conta como inventário', async () => {
    rpc.mockImplementation(async (nome: string) => ({ data: nome === 'fn_em_implantacao' ? false : null, error: null }))
    render(<Inventario />)
    expect(await screen.findByText('Inventário', { selector: '.badge' })).not.toBeNull()
  })

  it('cadastra material fora do catálogo e põe na contagem', async () => {
    render(<Inventario />)
    await screen.findByText('Saldo inicial (implantação)')
    fireEvent.click(screen.getByRole('button', { name: 'Material fora do catálogo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar e adicionar' }))
    expect(await screen.findByText('Informe o código SAP do material.')).not.toBeNull()
    fireEvent.change(screen.getByLabelText('Código SAP'), { target: { value: '7001' } })
    fireEvent.change(screen.getByLabelText('Unidade'), { target: { value: 'PC' } })
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Parafuso' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar e adicionar' }))
    await waitFor(() => expect(screen.getByLabelText('Quantidade contada de PARAFUSO')).not.toBeNull())
    expect(rpc).toHaveBeenCalledWith('rpc_cadastrar_material_rapido', { p_codigo_sap: '7001', p_descricao: 'Parafuso', p_unidade: 'PC' })
    expect(recarregar).toHaveBeenCalled()
  })

  it('guarda o rascunho da contagem no navegador', async () => {
    render(<Inventario />)
    await screen.findByText('Saldo inicial (implantação)')
    await adicionarParafuso()
    fireEvent.change(screen.getByLabelText('Quantidade contada de PARAFUSO'), { target: { value: '3' } })
    cleanup()
    render(<Inventario />)
    expect(((await screen.findByLabelText('Quantidade contada de PARAFUSO')) as HTMLInputElement).value).toBe('3')
  })
})
