import { alternarLocal } from '../lib/equipes'
import type { Almox } from '../lib/supabase'

/**
 * Locais onde a equipe (ou o grupo) retira material, como botões de ligar e
 * desligar. Local já liberado que o usuário não pode mexer aparece travado.
 */
export function SeletorLocais({
  rotulo,
  opcoes,
  valor,
  onChange,
  travados = [],
}: {
  rotulo: string
  /** Locais que o usuário pode liberar, já em ordem. */
  opcoes: Almox[]
  valor: string[]
  onChange: (locais: string[]) => void
  /** Locais liberados fora do alcance do usuário: aparecem marcados e travados. */
  travados?: Almox[]
}) {
  return (
    <div className="chips" role="group" aria-label={rotulo}>
      {travados.map((a) => (
        <button key={a.id} type="button" className="chip local" aria-pressed="true" disabled title="Só o administrador mexe neste local">
          <span aria-hidden="true">✓</span> {a.nome}
        </button>
      ))}
      {opcoes.map((a) => {
        const ligado = valor.includes(a.id)
        return (
          <button
            key={a.id}
            type="button"
            className="chip local"
            aria-pressed={ligado}
            onClick={() => onChange(alternarLocal(valor, a.id))}
          >
            <span aria-hidden="true">{ligado ? '✓' : '+'}</span> {a.nome}
          </button>
        )
      })}
    </div>
  )
}
