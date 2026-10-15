import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSessao } from '../../auth/SessaoContext'
import { Aviso } from '../../components/ui'
import { abasVisiveis } from '../../lib/admin'

/**
 * Administração: abre pelo menu da conta. O admin vê todas as sub-abas; a
 * gestora do almoxarifado, só o Inventário. As sub-abas ficam em cima e cada
 * tela filha desenha o próprio título.
 */
export function Administracao() {
  const { ehAdmin, ehGestora } = useSessao()
  const local = useLocation()
  const abas = abasVisiveis({ ehAdmin, ehGestora })
  if (abas.length === 0) return <Aviso tipo="erro">Acesso restrito ao administrador e à gestão do almoxarifado.</Aviso>
  // /admin puro, ou uma sub-aba que este perfil não vê: abre a primeira que ele vê.
  const permitida = abas.some((a) => local.pathname === a.para || local.pathname.startsWith(`${a.para}/`))
  if (!permitida) return <Navigate to={abas[0].para} replace />
  return (
    <div className="pilha">
      {/* Não há menu do topo fora do Início: o caminho de volta fica aqui. */}
      <Link className="voltar" to="/">
        ← Início
      </Link>
      <nav aria-label="Administração" className="nav-pilulas">
        {abas.map((aba) => (
          <NavLink key={aba.para} to={aba.para}>
            {aba.rotulo}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
