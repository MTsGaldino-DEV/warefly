import { Outlet, useLocation } from 'react-router-dom'

/**
 * Moldura das telas logadas. O Início (Armazem) desenha a própria barra e abre os menus em gavetas;
 * cadastros e Administração abrem pelo endereço ou pelo menu da conta.
 */
export function Layout() {
  const local = useLocation()
  return (
    <div className="app foco">
      <main className="conteudo-foco" key={local.pathname}>
        <Outlet />
      </main>
    </div>
  )
}
