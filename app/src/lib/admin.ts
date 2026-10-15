/**
 * Área de administração: abre pelo menu da conta (ícone de perfil). O admin vê
 * todas as sub-abas; a gestora do almoxarifado vê só as marcadas com `gestora`.
 */

export const ROTA_ADMIN = '/admin'

/** Sub-abas da administração. */
export const ABAS_ADMIN = [
  { para: '/admin/inventario', rotulo: 'Inventário', gestora: true },
  { para: '/admin/automacoes', rotulo: 'Automações', gestora: false },
  { para: '/admin/sobre', rotulo: 'Sobre', gestora: false },
] as const

export type AbaAdmin = (typeof ABAS_ADMIN)[number]

/** Sub-abas que o usuário vê; vazio = sem acesso à administração. */
export function abasVisiveis(p: { ehAdmin: boolean; ehGestora: boolean }): AbaAdmin[] {
  return ABAS_ADMIN.filter((a) => p.ehAdmin || (p.ehGestora && a.gestora))
}

export type Automacao = {
  id: string
  titulo: string
  descricao: string
  /** Rota da tela da automação; sem rota, aparece como "em definição". */
  para: string | null
  /** Conector local que a automação usa. */
  conector: string
}

export const AUTOMACOES: Automacao[] = [
  {
    id: 'requisicao-material',
    titulo: 'Solicitar material no GDIS',
    descricao: 'Monta a nota corretiva de requisição de material. O robô para antes de salvar: você revisa e salva no GDIS.',
    para: '/admin/automacoes/requisicao-material',
    conector: 'Conector Warefly · porta 3335',
  },
  {
    id: 'servicos-equipes',
    titulo: 'Serviços executados das equipes',
    descricao: 'Busca no Histórico do GDIS os serviços executados por equipe e dia.',
    para: null,
    conector: 'Conector de serviços · porta 3336',
  },
]
