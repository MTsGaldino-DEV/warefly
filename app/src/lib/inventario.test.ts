import { describe, expect, it } from 'vitest'
import { justificativaPadrao, rotuloDaContagem, tipoDaContagem, validarContagem, validarMaterialNovo } from './inventario'

const fracao = (id: string) => id === 'cabo'
const rotulo = (id: string) => `Material ${id}`

describe('inventário', () => {
  it('local em implantação conta como saldo inicial; depois, como inventário', () => {
    expect(tipoDaContagem(true)).toBe('implantacao')
    expect(tipoDaContagem(false)).toBe('inventario')
    expect(rotuloDaContagem('implantacao')).toBe('Saldo inicial (implantação)')
    expect(rotuloDaContagem('inventario')).toBe('Inventário')
  })

  it('justificativa padrão diz o tipo e a data', () => {
    expect(justificativaPadrao('implantacao', '2026-10-20')).toBe('Contagem de implantação (dia D)')
    expect(justificativaPadrao('inventario', '2026-10-20')).toBe('Inventário de 20/10/2026')
  })

  it('monta os itens com a quantidade no padrão brasileiro', () => {
    const r = validarContagem(
      [
        { material_id: 'cabo', qtd: '12,5' },
        { material_id: 'parafuso', qtd: '1.500' },
        { material_id: 'luva', qtd: '0' },
      ],
      fracao,
      rotulo,
    )
    expect(r.erros).toEqual([])
    expect(r.itens).toEqual([
      { material_id: 'cabo', qtd_contada: 12.5 },
      { material_id: 'parafuso', qtd_contada: 1500 },
      { material_id: 'luva', qtd_contada: 0 },
    ])
  })

  it('aponta o erro de cada material e não manda nada', () => {
    const r = validarContagem(
      [
        { material_id: 'parafuso', qtd: '2,5' },
        { material_id: 'luva', qtd: '' },
        { material_id: 'cabo', qtd: '-1' },
        { material_id: 'cabo', qtd: '3' },
      ],
      fracao,
      rotulo,
    )
    expect(r.itens).toEqual([])
    expect(r.erros).toEqual([
      'Material parafuso: Esta unidade não aceita fração.',
      'Material luva: Informe a quantidade.',
      'Material cabo: Quantidade não pode ser negativa.',
      'Material cabo: aparece duas vezes. Deixe uma linha só.',
    ])
  })

  it('contagem vazia não segue', () => {
    expect(validarContagem([], fracao, rotulo).erros).toEqual(['Adicione ao menos um material à contagem.'])
  })

  it('cadastro rápido exige código, descrição e unidade', () => {
    expect(validarMaterialNovo({ codigo: ' ', descricao: 'Luva', unidade: 'PC' })).toBe('Informe o código SAP do material.')
    expect(validarMaterialNovo({ codigo: '9001', descricao: ' ', unidade: 'PC' })).toBe('Informe a descrição do material.')
    expect(validarMaterialNovo({ codigo: '9001', descricao: 'Luva', unidade: '' })).toBe('Escolha a unidade.')
    expect(validarMaterialNovo({ codigo: '9001', descricao: 'Luva', unidade: 'PC' })).toBeNull()
  })
})
