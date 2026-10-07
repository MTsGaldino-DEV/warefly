/** Conversa com o conector local do Warefly (pasta conector/, porta 3335). */

export const URL_CONECTOR = (import.meta.env.VITE_CONECTOR_URL as string | undefined) ?? 'http://localhost:3335'

export type EstadoPasso = 'andamento' | 'ok' | 'erro'

export type EventoConector =
  | { tipo: 'aguardando_login' | 'sessao_ok' | 'sessao_perdida' | 'debug'; msg: string }
  | { tipo: 'etapa'; id: string; msg: string; estado: EstadoPasso }
  | { tipo: 'item'; codigo: string; estado: EstadoPasso; msg?: string }
  | { tipo: 'fim'; ok: boolean; incluidos: number; total: number; msg: string }

/** Andamento da última tarefa: etapas, itens por código e o fim. */
export type Andamento = {
  etapas: { id: string; msg: string; estado: EstadoPasso }[]
  itens: Record<string, { estado: EstadoPasso; msg?: string }>
  fim: Extract<EventoConector, { tipo: 'fim' }> | null
}

export const ANDAMENTO_VAZIO: Andamento = { etapas: [], itens: {}, fim: null }

export type EstadoConector = { sessaoOk: boolean; tarefaAtiva: boolean; aguardandoLogin: boolean; andamento: Andamento }

export function aplicarEvento(a: Andamento, e: EventoConector): Andamento {
  if (e.tipo === 'etapa')
    return { ...a, etapas: [...a.etapas.filter((x) => x.id !== e.id), { id: e.id, msg: e.msg, estado: e.estado }] }
  if (e.tipo === 'item') return { ...a, itens: { ...a.itens, [e.codigo]: { estado: e.estado, msg: e.msg } } }
  if (e.tipo === 'fim') return { ...a, fim: e }
  return a
}

/** O conector é quem guarda o estado; a aba relê pelo /ping ao abrir ou recarregar. */
export function lerPing(j: {
  ok?: boolean
  sessaoOk: boolean
  tarefaAtiva: boolean
  aguardandoLogin?: boolean
  andamento?: Andamento
}): EstadoConector {
  return {
    sessaoOk: j.sessaoOk,
    tarefaAtiva: j.tarefaAtiva,
    aguardandoLogin: j.aguardandoLogin ?? false,
    andamento: j.andamento ?? ANDAMENTO_VAZIO,
  }
}

/** Estado do conector, ou null se ele não responde. */
export async function pingConector(): Promise<EstadoConector | null> {
  try {
    const r = await fetch(`${URL_CONECTOR}/ping`, { signal: AbortSignal.timeout(2000) })
    if (!r.ok) return null
    return lerPing((await r.json()) as Parameters<typeof lerPing>[0])
  } catch {
    return null
  }
}

export async function chamarConector(caminho: string, corpo?: unknown): Promise<void> {
  let r: Response
  try {
    r = await fetch(`${URL_CONECTOR}${caminho}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo ?? {}),
    })
  } catch {
    throw new Error('O conector não respondeu. Confira se ele está rodando.')
  }
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; erro?: string }
  if (!r.ok || j.ok === false) throw new Error(j.erro ?? `O conector recusou o pedido (${r.status}).`)
}

/** Assina os eventos do conector; devolve a função que encerra a assinatura. */
export function ouvirConector(aoEvento: (e: EventoConector) => void): () => void {
  const fonte = new EventSource(`${URL_CONECTOR}/eventos`)
  fonte.onmessage = (m) => {
    try {
      aoEvento(JSON.parse(m.data as string) as EventoConector)
    } catch {
      // evento malformado: ignora
    }
  }
  return () => fonte.close()
}
