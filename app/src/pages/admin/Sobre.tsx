import { Marca, PaginaTopo, Regiao } from '../../components/ui'
import { AUTORIA, COMMIT, linhaVersao } from '../../lib/sobre'

/** Sub-aba Sobre (só admin): autoria e versão do build. */
export function Sobre() {
  const versao = linhaVersao(COMMIT)
  return (
    <div className="pilha">
      <PaginaTopo titulo="Sobre" />
      <Regiao titulo={<Marca comNome />}>
        <p>{AUTORIA}</p>
        {versao && <p className="sec peq">{versao}</p>}
      </Regiao>
    </div>
  )
}
