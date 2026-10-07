import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { CatalogoProvider } from './auth/CatalogoContext'
import { SessaoProvider, useSessao } from './auth/SessaoContext'
import { Layout } from './components/Layout'
import { Aviso, Carregando, Marca } from './components/ui'
import { AdminAlmoxarifados } from './pages/admin/Almoxarifados'
import { ImportarMateriais } from './pages/admin/ImportarMateriais'
import { AdminMateriais, AdminUnidades } from './pages/admin/Materiais'
import { SaldoInicial } from './pages/admin/SaldoInicial'
import { RequisicaoMaterial } from './pages/automacao/RequisicaoMaterial'
import { AdminUsuarios } from './pages/admin/Usuarios'
import { Inicio } from './pages/Inicio'
import { Login } from './pages/Login'
import { Divergencias } from './pages/Divergencias'
import { Entradas } from './pages/entradas/Entradas'
import { ReceberExterno } from './pages/entradas/ReceberExterno'
import { PedidoDetalhe } from './pages/pedidos/PedidoDetalhe'
import { NovoPedido, Pedidos } from './pages/pedidos/Pedidos'
import { Guia } from './pages/remessas/Guia'
import { Equipes } from './pages/cadastros/Equipes'
import { MotivosReducao } from './pages/cadastros/MotivosReducao'
import { Receber } from './pages/remessas/Receber'
import { RemessaDetalhe } from './pages/remessas/RemessaDetalhe'
import { Remessas } from './pages/remessas/Remessas'
import { Historico } from './pages/Historico'
import { Ajuste, Movimentar, RemessaAvulsa, Saida } from './pages/movimentar/Movimentar'
import { Painel } from './pages/Painel'
import { Saldo } from './pages/Saldo'

function Protegida({ children }: { children: ReactNode }) {
  const { session, carregando, perfil, erro, sair } = useSessao()
  if (carregando) return <Carregando texto="Abrindo o Warefly…" />
  if (!session) return <Navigate to="/login" replace />
  if (!perfil?.ativo) {
    return (
      <div className="login">
        <div className="login-cartao pilha">
          <Marca comNome />
          <Aviso tipo="erro">{erro ?? 'Seu usuário está sem perfil ativo. Fale com o administrador.'}</Aviso>
          <button className="botao secundario" onClick={() => void sair()}>
            Sair
          </button>
        </div>
      </div>
    )
  }
  return <>{children}</>
}

function SoAdmin({ children }: { children: ReactNode }) {
  const { ehAdmin } = useSessao()
  return ehAdmin ? <>{children}</> : <Aviso tipo="erro">Acesso restrito ao administrador.</Aviso>
}

export default function App() {
  return (
    <BrowserRouter>
      <SessaoProvider>
        <CatalogoProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/remessas/:id/guia"
              element={
                <Protegida>
                  <Guia />
                </Protegida>
              }
            />
            <Route
              element={
                <Protegida>
                  <Layout />
                </Protegida>
              }
            >
              <Route index element={<Inicio />} />
              <Route path="saldo" element={<Saldo />} />
              <Route path="pedidos" element={<Pedidos />} />
              <Route path="pedidos/novo" element={<NovoPedido />} />
              <Route path="pedidos/:id" element={<PedidoDetalhe />} />
              <Route path="remessas" element={<Remessas />} />
              <Route path="remessas/:id" element={<RemessaDetalhe />} />
              <Route path="remessas/:id/receber" element={<Receber />} />
              <Route path="divergencias" element={<Divergencias />} />
              <Route path="movimentar" element={<Movimentar />} />
              <Route path="movimentar/saida" element={<Saida />} />
              <Route path="movimentar/transferencia" element={<RemessaAvulsa key="transferencia" tipo="transferencia" />} />
              <Route path="movimentar/devolucao" element={<RemessaAvulsa key="devolucao" tipo="devolucao" />} />
              <Route path="movimentar/ajuste" element={<Ajuste />} />
              <Route path="historico" element={<Historico />} />
              <Route path="painel" element={<Painel />} />
              <Route path="entradas" element={<Entradas />} />
              <Route path="entradas/receber" element={<ReceberExterno />} />
              <Route path="cadastros/motivos" element={<MotivosReducao />} />
              <Route path="cadastros/equipes" element={<Equipes />} />
              <Route path="admin/almoxarifados" element={<SoAdmin><AdminAlmoxarifados /></SoAdmin>} />
              <Route path="admin/usuarios" element={<SoAdmin><AdminUsuarios /></SoAdmin>} />
              <Route path="admin/materiais" element={<SoAdmin><AdminMateriais /></SoAdmin>} />
              <Route path="admin/materiais/importar" element={<SoAdmin><ImportarMateriais /></SoAdmin>} />
              <Route path="admin/unidades" element={<SoAdmin><AdminUnidades /></SoAdmin>} />
              <Route path="admin/saldo-inicial" element={<SoAdmin><SaldoInicial /></SoAdmin>} />
              <Route path="automacao/requisicao-material" element={<SoAdmin><RequisicaoMaterial /></SoAdmin>} />
              <Route path="*" element={<Aviso tipo="info">Página não encontrada.</Aviso>} />
            </Route>
          </Routes>
        </CatalogoProvider>
      </SessaoProvider>
    </BrowserRouter>
  )
}
