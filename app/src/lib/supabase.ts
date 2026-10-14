import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { fetchComRetentativa } from './retentativa'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !chave) {
  throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em app/.env')
}

export const supabase = createClient<Database>(url, chave, {
  global: { fetch: fetchComRetentativa() },
})

type Publico = Database['public']
export type Tabela<T extends keyof Publico['Tables']> = Publico['Tables'][T]['Row']
export type Enum<E extends keyof Publico['Enums']> = Publico['Enums'][E]

export type Almox = Tabela<'almoxarifados'>
export type Material = Tabela<'materiais'>
export type Unidade = Tabela<'unidades'>
export type Perfil = Tabela<'perfis'>
export type Atribuicao = Tabela<'atribuicoes'>
export type Pedido = Tabela<'pedidos'>

/**
 * Carrega todas as linhas de uma consulta paginando de 1000 em 1000
 * (limite padrão da API do Supabase).
 */
export async function carregarTodos<T>(
  consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pagina = 1000,
): Promise<T[]> {
  const todos: T[] = []
  for (let de = 0; ; de += pagina) {
    const { data, error } = await consulta(de, de + pagina - 1)
    if (error) throw error
    todos.push(...(data ?? []))
    if (!data || data.length < pagina) return todos
  }
}
