/** Área de administração: abre pelo menu da conta (ícone de perfil) e é só do admin. */

export const ROTA_ADMIN = '/admin'

/** Sub-abas da administração. Por enquanto só Automações. */
export const ABAS_ADMIN = [{ para: '/admin/automacoes', rotulo: 'Automações' }] as const

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
