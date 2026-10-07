/** Conversa com o conector local do Warefly (pasta conector/, porta 3335). */

export const URL_CONECTOR = (import.meta.env.VITE_CONECTOR_URL as string | undefined) ?? 'http://localhost:3335'

export type EstadoConector = { sessaoOk: boolean; tarefaAtiva: boolean }
export type EstadoPasso = 'andamento' | 'ok' | 'erro'

export type EventoConector =
  | { tipo: 'aguardando_login' | 'sessao_ok' | 'sessao_perdida' | 'debug'; msg: string }
  | { tipo: 'etapa'; id: string; msg: string; estado: EstadoPasso }
  | { tipo: 'item'; codigo: string; estado: EstadoPasso; msg?: string }
  | { tipo: 'fim'; ok: boolean; incluidos: number; total: number; msg: string }

/** Estado do conector, ou null se ele não responde. */
export async function pingConector(): Promise<EstadoConector | null> {
  try {
    const r = await fetch(`${URL_CONECTOR}/ping`, { signal: AbortSignal.timeout(2000) })
    if (!r.ok) return null
    const j = (await r.json()) as { sessaoOk: boolean; tarefaAtiva: boolean }
    return { sessaoOk: j.sessaoOk, tarefaAtiva: j.tarefaAtiva }
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
