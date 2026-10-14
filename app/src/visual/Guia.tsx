import { motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Simbolo } from '../components/ui'
import './guia.css'
import { colaborador, emCaixas, nomeLocal, type Despacho, type Equipe, type Retirada } from './exemplo'

/** O que vai para o papel: a guia de um despacho para base ou o termo de uma retirada no balcão. */
export type DocumentoGuia = { tipo: 'despacho'; despacho: Despacho } | { tipo: 'retirada'; retirada: Retirada }


/**
 * Folha A4 pronta para imprimir e assinar.
 * Na impressão só a folha aparece (ver guia.css). Marca Warefly por enquanto; a logo da empresa pode entrar em `.guia-logo` depois.
 */
export function GuiaImpressao({ documento, onFechar, responsavel, equipes }: { documento: DocumentoGuia; onFechar: () => void; responsavel?: string; equipes: Equipe[] }) {
  useEffect(() => {
    document.body.classList.add('com-guia')
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar()
    }
    window.addEventListener('keydown', tecla)
    return () => {
      document.body.classList.remove('com-guia')
      window.removeEventListener('keydown', tecla)
    }
  }, [onFechar])

  // Hora fixada quando a guia abre, para não mudar a cada renderização.
  const [emitida] = useState(() => new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ''))
  const ehRetirada = documento.tipo === 'retirada'
  const numero = ehRetirada ? documento.retirada.numero : documento.despacho.numero
  const titulo = ehRetirada ? 'Termo de retirada' : 'Guia de despacho'

  return createPortal(
    <motion.div className="guia-portal" role="dialog" aria-modal="true" aria-label={`${titulo} ${numero}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="guia-barra">
        <div>
          <strong>{titulo}</strong>
          <span>Confira antes de imprimir. A folha sai em A4, em uma via.</span>
        </div>
        <div className="guia-barra-acoes">
          <button type="button" className="guia-botao" onClick={onFechar}>
            Fechar
          </button>
          <button type="button" className="guia-botao primario" onClick={() => window.print()} autoFocus>
            Imprimir
          </button>
        </div>
      </div>

      <div className="guia-rolagem">
        <motion.article className="guia-folha" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
          <header className="guia-cab">
            <div className="guia-marca">
              <div className="guia-logo">
                <Simbolo tamanho={40} />
              </div>
              <div>
                <strong>Warefly</strong>
                <span>Almoxarifado 211 Geral · Governador Valadares</span>
              </div>
            </div>
            <div className="guia-numero">
              <span className="guia-sobrelinha">{titulo}</span>
              <strong>{numero}</strong>
              <span>Emitida em {emitida}</span>
            </div>
          </header>
          {documento.tipo === 'despacho' ? <CorpoDespacho d={documento.despacho} responsavel={responsavel} /> : <CorpoRetirada r={documento.retirada} equipe={equipes.find((e) => e.id === documento.retirada.equipe)} />}
          <footer className="guia-rodape">
            <span>Gerada pelo Warefly</span>
            <span className="mono">{numero}</span>
          </footer>
        </motion.article>
      </div>
    </motion.div>,
    document.body,
  )
}

function Rota({ destino, detalhe }: { destino: ReactNode; detalhe: string }) {
  return (
    <section className="guia-rota" aria-label="Origem e destino">
      <div className="guia-ponta">
        <span className="guia-sobrelinha">Origem</span>
        <strong>211 Geral</strong>
        <span>Governador Valadares</span>
      </div>
      <svg className="guia-seta" viewBox="0 0 48 12" aria-hidden="true">
        <path d="M0 6h44M38 1l6 5-6 5" />
      </svg>
      <div className="guia-ponta">
        <span className="guia-sobrelinha">Destino</span>
        <strong>{destino}</strong>
        <span>{detalhe}</span>
      </div>
    </section>
  )
}

function Seriais({ seriais }: { seriais?: string[] }) {
  if (!seriais?.length) return null
  return <span className="guia-seriais mono">Seriais: {seriais.join(', ')}</span>
}

function CorpoDespacho({ d, responsavel }: { d: Despacho; responsavel?: string }) {
  const destino = nomeLocal(d.base)
  return (
    <>
      <Rota destino={`${d.base} · ${destino}`} detalhe="Sub-base" />
      <dl className="guia-dados">
        <div>
          <dt>Solicitação</dt>
          <dd className="mono">{d.solicitacao || '—'}</dd>
        </div>
        <div>
          <dt>Despachado por</dt>
          <dd>{d.enviadoPor}</dd>
        </div>
        <div>
          <dt>Veículo (placa)</dt>
          <dd className={d.veiculo ? 'mono' : 'guia-preencher'}>{d.veiculo}</dd>
        </div>
        <div>
          <dt>Motorista</dt>
          <dd className="guia-preencher" />
        </div>
      </dl>
      <table className="guia-tabela">
        <thead>
          <tr>
            <th className="num">#</th>
            <th>Código</th>
            <th>Material</th>
            <th className="num">Enviado</th>
            <th>Un.</th>
            <th className="num">Recebido</th>
            <th>Observação</th>
          </tr>
        </thead>
        <tbody>
          {d.itens.map((it, i) => (
            <tr key={it.codigo + i}>
              <td className="num sec">{i + 1}</td>
              <td className="mono">{it.codigo}</td>
              <td>
                {it.material}
                <Seriais seriais={it.seriais} />
              </td>
              <td className="num forte">{it.qtd.toLocaleString('pt-BR')}</td>
              <td>{it.unidade}</td>
              <td className="guia-preencher" />
              <td className="guia-preencher" />
            </tr>
          ))}
        </tbody>
      </table>
      <p className="guia-total">
        {d.itens.length} {d.itens.length === 1 ? 'material' : 'materiais'} neste despacho
      </p>
      <div className="guia-aviso">
        <strong>Na chegada</strong> confira cada material. Se faltar, sobrar ou chegar avariado, anote a quantidade recebida e o motivo na linha do material e registre a divergência no Warefly.
      </div>
      <section className="guia-assinaturas">
        <Assinatura titulo="Expedição" local="211 Geral" nome={d.enviadoPor || responsavel} data={d.saida} />
        <Assinatura titulo="Recebimento" local={`${d.base} · ${destino}`} />
      </section>
    </>
  )
}

function CorpoRetirada({ r, equipe }: { r: Retirada; equipe?: Equipe }) {
  const pessoa = colaborador(r.retiradoPor)
  const local = r.local === '211' ? '211 Geral' : `${r.local} · ${nomeLocal(r.local)}`
  return (
    <>
      <Rota destino={pessoa?.nome ?? `Matrícula ${r.retiradoPor}`} detalhe={`${equipe ? `${equipe.codigo} · ${equipe.tipo}` : 'Equipe não informada'} · retirado em ${local}`} />
      <dl className="guia-dados">
        <div>
          <dt>Retirado por</dt>
          <dd>
            {pessoa?.nome ?? '—'} <span className="mono">({r.retiradoPor})</span>
          </dd>
        </div>
        <div>
          <dt>Equipe e supervisão</dt>
          <dd>
            {equipe?.codigo ?? '—'} · {pessoa?.supervisor ?? equipe?.supervisor ?? '—'}
          </dd>
        </div>
        <div>
          <dt>Atendido por</dt>
          <dd>{r.atendidoPor}</dd>
        </div>
        <div>
          <dt>Data e hora</dt>
          <dd>{r.data}</dd>
        </div>
      </dl>
      <table className="guia-tabela retirada">
        <thead>
          <tr>
            <th className="num">#</th>
            <th>Código</th>
            <th>Material</th>
            <th className="num">Quantidade</th>
            <th>Un.</th>
          </tr>
        </thead>
        <tbody>
          {r.itens.map((it, i) => {
            const caixas = emCaixas(it.seriais)
            return (
              <tr key={it.codigo + i}>
                <td className="num sec">{i + 1}</td>
                <td className="mono">{it.codigo}</td>
                <td>
                  {it.material}
                  {caixas && <span className="guia-seriais">{caixas}</span>}
                  <Seriais seriais={it.seriais} />
                </td>
                <td className="num forte">{it.qtd.toLocaleString('pt-BR')}</td>
                <td>{it.unidade}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {r.observacao && (
        <p className="guia-observacao">
          <strong>Observação:</strong> {r.observacao}
        </p>
      )}
      <div className="guia-aviso">
        <strong>Antes de assinar</strong> confira os materiais e os seriais. A assinatura confirma que os itens acima foram entregues à matrícula informada.
      </div>
      <section className="guia-assinaturas">
        <Assinatura titulo="Quem retirou" local={equipe?.codigo ?? ''} nome={pessoa?.nome} matricula={r.retiradoPor} data={r.data} />
        <Assinatura titulo="Almoxarifado" local={local} nome={r.atendidoPor} data={r.data} />
      </section>
    </>
  )
}

function Assinatura({ titulo, local, nome, matricula, data }: { titulo: string; local: string; nome?: string; matricula?: string; data?: string }) {
  return (
    <div className="guia-assinatura">
      <div className="guia-assinatura-cab">
        <strong>{titulo}</strong>
        <span>{local}</span>
      </div>
      <div className="guia-campos">
        <div>
          <span>Nome</span>
          <i>{nome}</i>
        </div>
        <div className="curto">
          <span>Matrícula</span>
          <i>{matricula}</i>
        </div>
        <div className="curto">
          <span>Data e hora</span>
          <i>{data}</i>
        </div>
      </div>
      <div className="guia-linha-assinatura">
        <i />
        <span>Assinatura</span>
      </div>
    </div>
  )
}
