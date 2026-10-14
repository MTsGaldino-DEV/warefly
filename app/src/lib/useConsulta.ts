import { useCallback, useEffect, useRef, useState } from 'react'
import { mensagemErro } from './erros'

/** Executa uma consulta assíncrona e expõe dados, erro e recarga. */
export function useConsulta<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [dados, setDados] = useState<T | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const versao = useRef(0)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const executar = useCallback(fn, deps)

  const recarregar = useCallback(async () => {
    const minha = ++versao.current
    setCarregando(true)
    setErro(null)
    try {
      const r = await executar()
      if (minha === versao.current) setDados(r)
    } catch (e) {
      if (minha === versao.current) setErro(mensagemErro(e))
    } finally {
      if (minha === versao.current) setCarregando(false)
    }
  }, [executar])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  return { dados, erro, carregando, recarregar }
}

/** Resultado de uma chamada ao Supabase: lança o erro, devolve os dados. */
export async function dadosOuErro<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await p
  if (error) throw error
  return data
}

/** Como dadosOuErro, para listas: nulo vira lista vazia. */
export async function listaOuErro<T>(p: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const { data, error } = await p
  if (error) throw error
  return data ?? []
}
