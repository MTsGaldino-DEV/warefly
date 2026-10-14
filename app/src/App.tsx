import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { CatalogoProvider } from './auth/CatalogoContext'
import { SessaoProvider, useSessao } from './auth/SessaoContext'
import { Layout } from './components/Layout'
import { Aviso, Carregando, Marca } from './components/ui'
import { Administracao } from './pages/admin/Administracao'
import { AdminAlmoxarifados } from './pages/admin/Almoxarifados'
import { Automacoes } from './pages/admin/Automacoes'
import { ImportarMateriais } from './pages/admin/ImportarMateriais'
import { AdminMateriais, AdminUnidades } from './pages/admin/Materiais'
import { SaldoInicial } from './pages/admin/SaldoInicial'
import { RequisicaoMaterial } from './pages/automacao/RequisicaoMaterial'
import { AdminUsuarios } from './pages/admin/Usuarios'
import { Login } from './pages/Login'
import { Armazem } from './visual/Armazem'
import { Equipes } from './pages/cadastros/Equipes'
import { Grupos } from './pages/cadastros/Grupos'
import { ImportarEquipes } from './pages/cadastros/ImportarEquipes'
import { MotivosReducao } from './pages/cadastros/MotivosReducao'

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
              element={
                <Protegida>
                  <Layout />
                </Protegida>
              }
            >
              <Route index element={<Armazem />} />
              <Route path="cadastros/motivos" element={<MotivosReducao />} />
              <Route path="cadastros/equipes" element={<Equipes />} />
              <Route path="cadastros/equipes/importar" element={<ImportarEquipes />} />
              <Route path="cadastros/grupos" element={<SoAdmin><Grupos /></SoAdmin>} />
              <Route path="admin/almoxarifados" element={<SoAdmin><AdminAlmoxarifados /></SoAdmin>} />
              <Route path="admin/usuarios" element={<SoAdmin><AdminUsuarios /></SoAdmin>} />
              <Route path="admin/materiais" element={<SoAdmin><AdminMateriais /></SoAdmin>} />
              <Route path="admin/materiais/importar" element={<SoAdmin><ImportarMateriais /></SoAdmin>} />
              <Route path="admin/unidades" element={<SoAdmin><AdminUnidades /></SoAdmin>} />
              <Route path="admin/saldo-inicial" element={<SoAdmin><SaldoInicial /></SoAdmin>} />
              <Route path="admin" element={<SoAdmin><Administracao /></SoAdmin>}>
                <Route index element={<Navigate to="automacoes" replace />} />
                <Route path="automacoes" element={<Automacoes />} />
                <Route path="automacoes/requisicao-material" element={<RequisicaoMaterial />} />
              </Route>
              {/* Endereço antigo da automação, antes da Administração. */}
              <Route path="automacao/requisicao-material" element={<Navigate to="/admin/automacoes/requisicao-material" replace />} />
              <Route path="*" element={<Aviso tipo="info">Página não encontrada.</Aviso>} />
            </Route>
          </Routes>
        </CatalogoProvider>
      </SessaoProvider>
    </BrowserRouter>
  )
}
