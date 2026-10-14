import { Link } from 'react-router-dom'
import { PaginaTopo, Regiao, StatusBadge } from '../../components/ui'
import { AUTOMACOES } from '../../lib/admin'

/** Sub-aba Automações: os robôs que trabalham no GDIS pelos conectores deste PC. */
export function Automacoes() {
  return (
    <div className="pilha">
      <PaginaTopo
        titulo="Automações"
        sub="Robôs que trabalham no GDIS pela rede interna. Cada um precisa do conector aberto neste PC."
      />
      <div className="grade-2">
        {AUTOMACOES.map((a) => (
          <Regiao
            key={a.id}
            titulo={a.titulo}
            sub={a.conector}
            acoes={
              a.para ? (
                <Link className="botao peq" to={a.para} aria-label={`Abrir ${a.titulo}`}>
                  Abrir
                </Link>
              ) : (
                <StatusBadge tom="info">Fluxo em definição</StatusBadge>
              )
            }
          >
            <p className="sec">{a.descricao}</p>
          </Regiao>
        ))}
      </div>
    </div>
  )
}
