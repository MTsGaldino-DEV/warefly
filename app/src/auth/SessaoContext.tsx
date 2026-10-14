import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { mensagemErro } from '../lib/erros'
import { locaisGeridos, regionaisGeridos, rotuloDoPerfil } from '../lib/perfis'
import { comRetentativa } from '../lib/retentativa'
import { supabase, type Almox, type Atribuicao, type Perfil } from '../lib/supabase'

type Sessao = {
  session: Session | null
  carregando: boolean
  erro: string | null
  perfil: Perfil | null
  atribuicoes: Atribuicao[]
  almoxarifados: Almox[]
  ehAdmin: boolean
  ehGestao: boolean
  /** gestão ou admin: veem tudo */
  veTudo: boolean
  responsavelEm: (almoxId: string) => boolean
  /** almoxarifados em que o usuário é responsável (opera) */
  almoxResponsavel: Almox[]
  /** almoxarifados cujo saldo o usuário pode consultar */
  almoxVisiveis: Almox[]
  /** responsável de um almoxarifado regional: aprova, entrega, ajusta e inventaria */
  ehGestora: boolean
  /** locais cujo estoque o usuário ajusta: admin, todos; gestora, o regional e as bases dele */
  almoxGeridos: Almox[]
  /** gestão do almoxarifado ou admin: cadastram equipes e liberam locais */
  mantemEquipes: boolean
  /** vê a lista de equipes: quem mantém, a gerência e quem é de alguma base */
  veEquipes: boolean
  /** rótulo do perfil no rodapé do menu */
  rotuloPerfil: string
  almox:(id: string | null | undefined) => Almox | undefined
  recarregarPerfil: () => Promise<void>
  sair: () => Promise<void>
}

const Contexto = createContext<Sessao | null>(null)

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [iniciado, setIniciado] = useState(false)
  const [carregandoPerfil, setCarregandoPerfil] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [atribuicoes, setAtribuicoes] = useState<Atribuicao[]>([])
  const [almoxarifados, setAlmoxarifados] = useState<Almox[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setIniciado(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const usuarioId = session?.user.id

  const recarregarPerfil = useCallback(async () => {
    if (!usuarioId) {
      setPerfil(null)
      setAtribuicoes([])
      setAlmoxarifados([])
      return
    }
    setCarregandoPerfil(true)
    setErro(null)
    try {
      const [p, a, x] = await comRetentativa(async () => {
        const r = await Promise.all([
          supabase.from('perfis').select('*').eq('id', usuarioId).maybeSingle(),
          supabase.from('atribuicoes').select('*').eq('usuario_id', usuarioId),
          supabase.from('almoxarifados').select('*').order('tipo').order('nome'),
        ])
        for (const { error } of r) if (error) throw error
        return r
      })
      setPerfil(p.data)
      setAtribuicoes(a.data ?? [])
      setAlmoxarifados(x.data ?? [])
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setCarregandoPerfil(false)
    }
  }, [usuarioId])

  useEffect(() => {
    void recarregarPerfil()
  }, [recarregarPerfil])

  const valor = useMemo<Sessao>(() => {
    const ehAdmin = !!perfil?.ativo && perfil.papel === 'admin'
    const ehGestao = !!perfil?.ativo && perfil.papel === 'gestao'
    const veTudo = ehAdmin || ehGestao
    const ativo = !!perfil?.ativo
    const minhas = ativo ? atribuicoes : []
    const idsResp = new Set(minhas.filter((a) => a.funcao === 'responsavel').map((a) => a.almox_id))
    const idsAtrib = new Set(minhas.map((a) => a.almox_id))
    const ehGestora = regionaisGeridos(almoxarifados, minhas).size > 0
    const porId = new Map(almoxarifados.map((a) => [a.id, a]))
    const operaveis = almoxarifados.filter((a) => a.tipo !== 'externo')

    return {
      session,
      carregando: !iniciado || carregandoPerfil,
      erro,
      perfil,
      atribuicoes,
      almoxarifados,
      ehAdmin,
      ehGestao,
      veTudo,
      responsavelEm: (id) => idsResp.has(id),
      almoxResponsavel: operaveis.filter((a) => idsResp.has(a.id)),
      almoxVisiveis: veTudo
        ? operaveis
        : operaveis.filter((a) => idsAtrib.has(a.id) || (a.pai_id !== null && idsResp.has(a.pai_id))),
      ehGestora,
      almoxGeridos: locaisGeridos(almoxarifados, minhas, ehAdmin),
      mantemEquipes: ehGestora || ehAdmin,
      veEquipes: veTudo || ehGestora || operaveis.some((a) => a.tipo === 'base' && idsAtrib.has(a.id)),
      rotuloPerfil: rotuloDoPerfil({ papel: perfil?.papel, ehGestora, ehSupervisor: minhas.some((a) => a.funcao === 'supervisor') }),
      almox: (id) => (id ? porId.get(id) : undefined),
      recarregarPerfil,
      sair: async () => {
        await supabase.auth.signOut()
      },
    }
  }, [session, iniciado, carregandoPerfil, erro, perfil, atribuicoes, almoxarifados, recarregarPerfil])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSessao(): Sessao {
  const s = useContext(Contexto)
  if (!s) throw new Error('useSessao fora do SessaoProvider')
  return s
}
