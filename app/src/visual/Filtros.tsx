import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

/** Peças de filtro reutilizadas nas janelas grandes: busca por palavra, seleção múltipla, ordenação e chave liga/desliga. */

export function Busca({ valor, onMudar, placeholder, rotulo }: { valor: string; onMudar: (v: string) => void; placeholder: string; rotulo: string }) {
  return (
    <label className="busca-v2">
      <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M11 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM20 20l-4.5-4.5" />
      </svg>
      <input type="search" placeholder={placeholder} value={valor} onChange={(e) => onMudar(e.target.value)} aria-label={rotulo} />
    </label>
  )
}

export type Opcao = { valor: string; rotulo: string; detalhe?: string }

export function MultiSelecao({ rotulo, opcoes, selecionadas, onMudar }: { rotulo: string; opcoes: Opcao[]; selecionadas: string[]; onMudar: (v: string[]) => void }) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])
  const resumo = selecionadas.length === 0 || selecionadas.length === opcoes.length ? 'Todas' : selecionadas.length === 1 ? (opcoes.find((o) => o.valor === selecionadas[0])?.rotulo ?? '1') : `${selecionadas.length} selecionadas`
  const alternar = (v: string) => onMudar(selecionadas.includes(v) ? selecionadas.filter((x) => x !== v) : [...selecionadas, v])
  return (
    <div className="multi-v2" ref={caixa}>
      <button type="button" className="filtro-botao" aria-expanded={aberto} aria-haspopup="listbox" onClick={() => setAberto(!aberto)}>
        <span className="sec">{rotulo}:</span> {resumo}
        <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <AnimatePresence>
        {aberto && (
          <motion.div className="multi-lista vidro" role="listbox" aria-multiselectable="true" aria-label={rotulo} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
            {opcoes.map((o) => (
              <label key={o.valor} className="multi-opcao">
                <input type="checkbox" checked={selecionadas.includes(o.valor)} onChange={() => alternar(o.valor)} />
                <span>{o.rotulo}</span>
                {o.detalhe && <span className="sec">{o.detalhe}</span>}
              </label>
            ))}
            <div className="multi-rodape">
              <button type="button" className="mini-botao" onClick={() => onMudar(opcoes.map((o) => o.valor))}>
                Todas
              </button>
              <button type="button" className="mini-botao" onClick={() => onMudar([])}>
                Limpar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Ordenar<T extends string>({ valor, opcoes, onMudar }: { valor: T; opcoes: { valor: T; rotulo: string }[]; onMudar: (v: T) => void }) {
  return (
    <label className="filtro-botao ordenar">
      <span className="sec">Ordenar:</span>
      <select value={valor} onChange={(e) => onMudar(e.target.value as T)} aria-label="Ordenar por">
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Chave({ ativo, onMudar, rotulo }: { ativo: boolean; onMudar: (v: boolean) => void; rotulo: string }) {
  return (
    <button type="button" className="chave-v2" role="switch" aria-checked={ativo} onClick={() => onMudar(!ativo)}>
      <span className="chave-trilho" aria-hidden="true">
        <motion.span className="chave-bola" layout transition={{ type: 'spring', stiffness: 500, damping: 34 }} />
      </span>
      {rotulo}
    </button>
  )
}
