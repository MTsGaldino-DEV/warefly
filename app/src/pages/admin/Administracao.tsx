import { Link, NavLink, Outlet } from 'react-router-dom'
import { ABAS_ADMIN } from '../../lib/admin'

/**
 * Administração (só admin): abre pelo menu da conta. As sub-abas ficam em cima
 * e cada tela filha desenha o próprio título.
 */
export function Administracao() {
  return (
    <div className="pilha">
      {/* Não há menu do topo fora do Início: o caminho de volta fica aqui. */}
      <Link className="voltar" to="/">
        ← Início
      </Link>
      <nav aria-label="Administração" className="nav-pilulas">
        {ABAS_ADMIN.map((aba) => (
          <NavLink key={aba.para} to={aba.para}>
            {aba.rotulo}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
