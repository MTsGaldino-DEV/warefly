import { useEffect, useId, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useCatalogo } from '../auth/CatalogoContext'
import { useSessao } from '../auth/SessaoContext'
import { supabase } from '../lib/supabase'
import { BuscaComando, DialogoBusca } from './BuscaGlobal'
import {
  IcAlmoxarifados,
  IcAutomacao,
  IcDivergencias,
  IcEntradas,
  IcEquipes,
  IcHistorico,
  IcInicio,
  IcMateriais,
  IcMotivos,
  IcMovimentar,
  IcPainel,
  IcPedidos,
  IcRemessas,
  IcSaida,
  IcSaldo,
  IcSaldoInicial,
  IcUnidades,
  IcUsuarios,
} from './icones'
import { MenuGrupo } from './MenuGrupo'
import { Aviso, Marca } from './ui'

type ItemMenu = { para: string; rotulo: string; grupo: string; icone: ReactNode; curto?: string; principal?: boolean }

/** Itens de navegação conforme papel e atribuições. */
// eslint-disable-next-line react-refresh/only-export-components
export function useMenu(): ItemMenu[] {
  const { ehAdmin, ehGestora, veTudo, almoxResponsavel, almoxVisiveis, almoxGeridos, basesEquipes } = useSessao()
  const opera = almoxResponsavel.length > 0
  const operaBase = almoxResponsavel.some((a) => a.tipo === 'base')
  const operaRegional = almoxResponsavel.some((a) => a.tipo === 'regional')
  const ve = veTudo || almoxVisiveis.length > 0

  const itens: ItemMenu[] = [{ para: '/', rotulo: 'Início', grupo: 'Operação', icone: <IcInicio />, principal: true }]
  if (ve) {
    itens.push({ para: '/saldo', rotulo: 'Saldo', grupo: 'Operação', icone: <IcSaldo />, principal: true })
    itens.push({ para: '/pedidos', rotulo: 'Pedidos', grupo: 'Operação', icone: <IcPedidos />, principal: true })
    itens.push({ para: '/remessas', rotulo: 'Remessas', grupo: 'Operação', icone: <IcRemessas />, principal: true })
    itens.push({ para: '/divergencias', rotulo: 'Divergências', grupo: 'Operação', icone: <IcDivergencias /> })
  }
  if (opera || almoxGeridos.length > 0) itens.push({ para: '/movimentar', rotulo: 'Movimentar', grupo: 'Operação', icone: <IcMovimentar /> })
  if (operaRegional) itens.push({ para: '/entradas', rotulo: 'Entradas do 3256', grupo: 'Operação', icone: <IcEntradas /> })
  if (operaBase && !operaRegional) itens.push({ para: '/movimentar/saida', rotulo: 'Registrar saída', grupo: 'Operação', icone: <IcSaida /> })
  if (ve) itens.push({ para: '/historico', rotulo: 'Histórico', grupo: 'Operação', icone: <IcHistorico /> })
  if (veTudo) itens.push({ para: '/painel', rotulo: 'Painel da gestão', grupo: 'Gestão', icone: <IcPainel /> })
  if (ehGestora || ehAdmin) itens.push({ para: '/cadastros/motivos', rotulo: 'Motivos de redução', grupo: 'Cadastros', icone: <IcMotivos /> })
  if (basesEquipes.length > 0) itens.push({ para: '/cadastros/equipes', rotulo: 'Equipes', grupo: 'Cadastros', icone: <IcEquipes /> })
  if (ehAdmin) {
    itens.push({ para: '/admin/almoxarifados', rotulo: 'Almoxarifados', grupo: 'Cadastros', icone: <IcAlmoxarifados /> })
    itens.push({ para: '/admin/usuarios', rotulo: 'Usuários e atribuições', grupo: 'Cadastros', icone: <IcUsuarios /> })
    itens.push({ para: '/admin/materiais', rotulo: 'Materiais', grupo: 'Cadastros', icone: <IcMateriais /> })
    itens.push({ para: '/admin/unidades', rotulo: 'Unidades', grupo: 'Cadastros', icone: <IcUnidades /> })
    itens.push({ para: '/admin/saldo-inicial', rotulo: 'Saldo inicial', grupo: 'Cadastros', icone: <IcSaldoInicial /> })
    itens.push({ para: '/automacao/requisicao-material', rotulo: 'Solicitar material no GDIS', grupo: 'Automação', icone: <IcAutomacao /> })
  }
  return itens
}

/**
 * Contadores do menu: pedidos na fila do 211 e divergências abertas.
 * Recontam a cada troca de página. Se a contagem falhar, o contador só não aparece.
 */
function useContagens(regionais: string, rota: string) {
  const [contagens, setContagens] = useState<Record<string, number | null>>({})
  useEffect(() => {
    let vivo = true
    const ids = regionais ? regionais.split(',') : []
    void Promise.all([
      ids.length
        ? supabase
            .from('pedidos')
            .select('id', { count: 'exact', head: true })
            .in('atendente_id', ids)
            .in('status', ['solicitado', 'aprovado'])
            .eq('externo', false)
        : null,
      supabase.from('v_divergencias_abertas').select('remessa_item_id', { count: 'exact', head: true }),
    ]).then(([fila, divergencias]) => {
      if (vivo) setContagens({ '/pedidos': fila?.count ?? null, '/divergencias': divergencias.count ?? null })
    })
    return () => {
      vivo = false
    }
  }, [regionais, rota])
  return contagens
}

function ItemDoMenu({ item, contagem }: { item: ItemMenu; contagem: number | null | undefined }) {
  const id = useId()
  const alerta = item.para === '/divergencias'
  return (
    <>
      <NavLink to={item.para} end={item.para === '/' || item.para === '/movimentar'} aria-describedby={contagem ? id : undefined}>
        {item.icone}
        {item.rotulo}
        {!!contagem && (
          <span className={alerta ? 'menu-contagem alerta' : 'menu-contagem'} aria-hidden="true">
            {contagem}
          </span>
        )}
      </NavLink>
      {!!contagem && (
        <span id={id} hidden>
          {alerta ? `${contagem} em aberto` : `${contagem} na fila`}
        </span>
      )}
    </>
  )
}

export function Layout() {
  const { perfil, sair, almoxResponsavel, rotuloPerfil } = useSessao()
  const catalogo = useCatalogo()
  const itens = useMenu()
  const [maisAberto, setMaisAberto] = useState(false)
  const [buscaAberta, setBuscaAberta] = useState(false)
  const local = useLocation()
  const grupos = [...new Set(itens.map((i) => i.grupo))]
  const principais = itens.filter((i) => i.principal).slice(0, 4)
  const outros = itens.filter((i) => !principais.includes(i))
  const regionais = almoxResponsavel
    .filter((a) => a.tipo === 'regional')
    .map((a) => a.id)
    .join()
  const contagens = useContagens(regionais, local.pathname)

  // Ctrl+K (⌘K no Mac) abre a busca de qualquer tela.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setBuscaAberta(true)
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])

  return (
    <div className="app">
      <aside className="menu-lateral">
        <Link to="/" className="marca-link">
          <Marca comNome />
        </Link>
        <BuscaComando onClick={() => setBuscaAberta(true)} />
        <nav aria-label="Menu principal">
          {grupos.map((g) => (
            <MenuGrupo key={g} titulo={g}>
              {itens
                .filter((i) => i.grupo === g)
                .map((i) => (
                  <ItemDoMenu key={i.para} item={i} contagem={contagens[i.para]} />
                ))}
            </MenuGrupo>
          ))}
        </nav>
        <div className="menu-rodape">
          <div className="nome">{perfil?.nome}</div>
          <div>{rotuloPerfil}</div>
          <button type="button" onClick={() => void sair()}>
            Sair
          </button>
        </div>
      </aside>

      <header className="cabecalho-movel">
        <Link to="/" className="marca-link">
          <Marca />
        </Link>
        <span className="usuario">{perfil?.nome}</span>
      </header>

      <main className="conteudo" key={local.pathname}>
        {catalogo.erro && (
          <div className="aviso-catalogo">
            <Aviso tipo="erro">
              Catálogo de materiais não carregou: {catalogo.erro}{' '}
              <button className="botao fantasma peq" onClick={() => void catalogo.recarregar()}>
                Tentar de novo
              </button>
            </Aviso>
          </div>
        )}
        <Outlet />
      </main>

      <nav className="barra-inferior" aria-label="Menu rápido">
        {principais.map((i) => (
          <NavLink key={i.para} to={i.para} end={i.para === '/'}>
            {i.rotulo}
          </NavLink>
        ))}
        <button type="button" onClick={() => setMaisAberto(true)} aria-haspopup="dialog">
          Mais
        </button>
      </nav>

      {maisAberto && (
        <>
          <div className="folha-fundo" onClick={() => setMaisAberto(false)} />
          <div className="folha" role="dialog" aria-label="Mais opções" onClick={() => setMaisAberto(false)}>
            <button type="button" className="item-folha" onClick={() => setBuscaAberta(true)}>
              Buscar documento ou material
            </button>
            {outros.map((i) => (
              <Link key={i.para} to={i.para}>
                {i.rotulo}
              </Link>
            ))}
            <button type="button" className="botao secundario largo" onClick={() => void sair()}>
              Sair
            </button>
          </div>
        </>
      )}

      {buscaAberta && <DialogoBusca onFechar={() => setBuscaAberta(false)} />}
    </div>
  )
}
