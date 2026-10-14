import { cloneElement, isValidElement, useId, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { rotuloStatus, tomStatus, type Tom } from '../lib/formato'

/** Símbolo Warefly: asa de três penas em arco ascendente. */
export function Simbolo({
  tamanho = 26,
  cor = 'var(--cor-marca)',
  cor2 = 'var(--cor-asa)',
}: {
  tamanho?: number
  cor?: string
  cor2?: string
}) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 32 32" aria-hidden="true">
      <g fill="none" strokeLinecap="round" strokeWidth="3.4">
        <path d="M4 21.5Q15 20 27.5 5" stroke={cor} />
        <path d="M6.5 25.5Q16 25 24 15" stroke={cor2} />
        <path d="M9.5 29Q16.5 29 20.5 23.5" stroke={cor2} opacity="0.6" />
      </g>
    </svg>
  )
}

export function Marca({ comNome = false }: { comNome?: boolean }) {
  return (
    <span className="marca">
      <Simbolo />
      <span>
        <span className="marca-sigla">Warefly</span>
        {comNome && <span className="marca-nome">Gestão de almoxarifado</span>}
      </span>
    </span>
  )
}

/** Badge de status: sempre com texto. `tom` força a cor; `children` troca o texto. */
export function StatusBadge({ status, tom, children }: { status?: string; tom?: Tom; children?: ReactNode }) {
  return <span className={`badge ${tom ?? tomStatus(status ?? '')}`}>{children ?? rotuloStatus(status)}</span>
}

export type ItemTrilha = string | { rotulo: string; para: string }

/** Trilha de navegação (desktop). O último item é a página atual. */
export function Breadcrumb({ itens }: { itens: ItemTrilha[] }) {
  return (
    <nav className="trilha" aria-label="Trilha">
      <ol>
        {itens.map((item, i) => (
          <li key={i}>
            {i > 0 && <span aria-hidden="true">/</span>}
            {typeof item === 'string' ? (
              <span aria-current={i === itens.length - 1 ? 'page' : undefined}>{item}</span>
            ) : (
              <Link to={item.para}>{item.rotulo}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/**
 * Cabeçalho de página. Com `trilha`, o desktop mostra o breadcrumb e o link
 * "← voltar" fica só no celular.
 */
export function PaginaTopo({
  titulo,
  sub,
  voltar,
  trilha,
  acoes,
}: {
  titulo: ReactNode
  sub?: ReactNode
  voltar?: { para: string; rotulo: string }
  trilha?: ItemTrilha[]
  acoes?: ReactNode
}) {
  return (
    <>
      {trilha && <Breadcrumb itens={trilha} />}
      {voltar && (
        <Link className={trilha ? 'voltar so-movel' : 'voltar'} to={voltar.para}>
          ← {voltar.rotulo}
        </Link>
      )}
      <div className="pagina-topo">
        <div>
          <h1>{titulo}</h1>
          {sub && <p className="sub">{sub}</p>}
        </div>
        {acoes && <div className="linha">{acoes}</div>}
      </div>
    </>
  )
}

/** Cartão com título, subtítulo opcional e ações no cabeçalho (período, menu "…", botões). */
export function Regiao({
  titulo,
  sub,
  acoes,
  fita = false,
  nivel = 2,
  children,
}: {
  titulo: ReactNode
  sub?: ReactNode
  acoes?: ReactNode
  /** Faixa âmbar de atenção sob o cabeçalho. */
  fita?: boolean
  nivel?: 2 | 3
  children: ReactNode
}) {
  const id = useId()
  const Titulo = nivel === 2 ? 'h2' : 'h3'
  return (
    <section className="cartao pilha" aria-labelledby={id}>
      <div className="cartao-cab">
        <div className="cartao-titulo">
          <Titulo id={id}>{titulo}</Titulo>
          {sub && <p className="sec peq">{sub}</p>}
        </div>
        {acoes && <div className="cartao-acoes">{acoes}</div>}
      </div>
      {fita && <div className="fita" aria-hidden="true" />}
      {children}
    </section>
  )
}

export function Campo({
  rotulo,
  ajuda,
  erro,
  children,
  style,
}: {
  rotulo: ReactNode
  ajuda?: ReactNode
  erro?: string | null
  children: ReactNode
  style?: React.CSSProperties
}) {
  // O rótulo nomeia o controle; ajuda e erro o descrevem (aria-describedby),
  // para não entrarem no nome acessível do campo.
  const id = useId()
  const idDescricao = `${id}-desc`
  const temDescricao = !!(erro || ajuda)
  const controle = isValidElement<{ id?: string; 'aria-describedby'?: string }>(children)
    ? cloneElement(children, { id: children.props.id ?? id, 'aria-describedby': temDescricao ? idDescricao : undefined })
    : children
  return (
    <div className="campo" style={style}>
      <label htmlFor={isValidElement<{ id?: string }>(children) ? (children.props.id ?? id) : undefined}>{rotulo}</label>
      {controle}
      {erro ? (
        <span id={idDescricao} className="erro-campo">
          {erro}
        </span>
      ) : ajuda ? (
        <span id={idDescricao} className="ajuda">
          {ajuda}
        </span>
      ) : null}
    </div>
  )
}

export function Aviso({ tipo, children }: { tipo: 'erro' | 'sucesso' | 'info' | 'atencao'; children: ReactNode }) {
  if (!children) return null
  return (
    <div className={`aviso ${tipo}`} role={tipo === 'erro' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return <div className="carregando">{texto}</div>
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="vazio">{children}</div>
}
