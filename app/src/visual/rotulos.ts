import { RETIRAM_DO_211, type Capacidade, type CodigoLocal, type Decisao, type Nivel, type Solicitacao } from './exemplo'

/** Textos e tons compartilhados pelos painéis e janelas do modo foco visual. */

export type TomTrilho = 'ok' | 'atencao' | 'alerta'
export const TOM_NIVEL: Record<Nivel, TomTrilho> = { ok: 'ok', proximo: 'atencao', abaixo: 'alerta', sem: 'ok' }
export const TEXTO_NIVEL: Record<Nivel, string> = { ok: 'Normal', proximo: 'Próximo do mínimo', abaixo: 'Abaixo do mínimo', sem: 'Sem inventário' }
/** No carro da equipe, "sem" quer dizer que o tipo ainda não tem kit mínimo cadastrado. */
export const TEXTO_NIVEL_CARRO: Record<Nivel, string> = { ...TEXTO_NIVEL, sem: 'Sem kit mínimo' }
export const SELO_NIVEL: Record<Nivel, string> = { ok: 'ok', proximo: 'atencao', abaixo: 'alerta', sem: 'neutro' }

export const CLASSE_DECISAO: Record<Decisao, string> = { Aprovado: 'ok', Reduzido: 'transito', 'Sem saldo': 'alerta', Cancelado: 'neutro' }

export const ROTULO_SITUACAO: Record<Solicitacao['situacao'], string> = {
  aguardando: 'Aguardando análise',
  aprovada: 'Aprovada, falta despachar',
  divergencia: 'Com divergência',
  enviada: 'Despachada',
}
export const TOM_SITUACAO: Record<Solicitacao['situacao'], string> = { aguardando: 'info', aprovada: 'ok', divergencia: 'alerta', enviada: 'neutro' }

export const subtituloLocal = (c: CodigoLocal) => (c === '211' ? `Estoque central · ${RETIRAM_DO_211.join(' e ')} retiram daqui` : `Estoque da base ${c}`)

/** Com o estoque de hoje: atende tudo, em parte ou nada. */
export const TEXTO_CAPACIDADE: Record<Capacidade, string> = { completo: 'Atende completo', parcial: 'Atende parcial', nenhum: 'Sem estoque' }
export const SELO_CAPACIDADE: Record<Capacidade, string> = { completo: 'ok', parcial: 'atencao', nenhum: 'alerta' }
