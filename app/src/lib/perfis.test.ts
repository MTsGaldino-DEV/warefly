import { describe, expect, it } from 'vitest'
import { locaisGeridos, regionaisGeridos, rotuloDoPerfil } from './perfis'
import type { Almox, Atribuicao } from './supabase'

const local = (id: string, tipo: Almox['tipo'], pai_id: string | null, ativo = true): Almox => ({
  id,
  codigo: id,
  nome: id,
  tipo,
  pai_id,
  cidade: null,
  ativo,
})
const ALMOX = [
  local('3256', 'externo', null),
  local('211', 'regional', '3256'),
  local('MNT', 'base', '211'),
  local('RSP', 'base', '211'),
  local('OLD', 'base', '211', false),
  local('R2', 'regional', '3256'),
  local('B2', 'base', 'R2'),
]
const atrib = (almox_id: string, funcao: Atribuicao['funcao']): Atribuicao => ({
  almox_id,
  usuario_id: 'u1',
  funcao,
  desde: '2026-10-01',
})
const ids = (lista: Almox[]) => lista.map((a) => a.id)

const GESTORA = [atrib('211', 'responsavel')]
const SUPERVISOR = [atrib('MNT', 'responsavel'), atrib('MNT', 'supervisor')]

describe('regionaisGeridos', () => {
  it('responsável de um regional gere esse regional', () => {
    expect([...regionaisGeridos(ALMOX, GESTORA)]).toEqual(['211'])
  })
  it('responsável de base não gere regional nenhum', () => {
    expect(regionaisGeridos(ALMOX, SUPERVISOR).size).toBe(0)
  })
})

describe('locaisGeridos', () => {
  it('gestora: o regional e as bases ativas dele, nunca as de outro regional', () => {
    expect(ids(locaisGeridos(ALMOX, GESTORA, false))).toEqual(['211', 'MNT', 'RSP'])
  })
  it('supervisor não gere local nenhum', () => {
    expect(locaisGeridos(ALMOX, SUPERVISOR, false)).toEqual([])
  })
  it('admin gere todos os locais ativos, menos o externo', () => {
    expect(ids(locaisGeridos(ALMOX, [], true))).toEqual(['211', 'MNT', 'RSP', 'R2', 'B2'])
  })
})

describe('rotuloDoPerfil', () => {
  it('papel global vem primeiro', () => {
    expect(rotuloDoPerfil({ papel: 'admin', ehGestora: true, ehSupervisor: false })).toBe('Administrador')
    expect(rotuloDoPerfil({ papel: 'gestao', ehGestora: false, ehSupervisor: false })).toBe('Gerência')
  })
  it('operador: gestora, supervisor ou operador', () => {
    expect(rotuloDoPerfil({ papel: 'operador', ehGestora: true, ehSupervisor: false })).toBe('Gestor(a) do almoxarifado')
    expect(rotuloDoPerfil({ papel: 'operador', ehGestora: false, ehSupervisor: true })).toBe('Supervisor')
    expect(rotuloDoPerfil({ papel: 'operador', ehGestora: false, ehSupervisor: false })).toBe('Operador')
  })
})
