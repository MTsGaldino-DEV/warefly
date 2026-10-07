import type { ReactNode } from 'react'

/** Ícone de traço 24×24 na cor do texto. Decorativo: quem dá o nome é o rótulo ao lado. */
function Icone({ children }: { children: ReactNode }) {
  return (
    <svg
      className="icone"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const IcInicio = () => (
  <Icone>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9v12h14V9" />
    <path d="M10 21v-6h4v6" />
  </Icone>
)

export const IcSaldo = () => (
  <Icone>
    <path d="M21 8 12 3 3 8v8l9 5 9-5z" />
    <path d="m3 8 9 5 9-5" />
    <path d="M12 13v8" />
  </Icone>
)

export const IcPedidos = () => (
  <Icone>
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M9 12h6" />
    <path d="M9 16h6" />
  </Icone>
)

export const IcRemessas = () => (
  <Icone>
    <path d="M1 4h14v12H1z" />
    <path d="M15 8h4l4 4v4h-8z" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </Icone>
)

export const IcDivergencias = () => (
  <Icone>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </Icone>
)

export const IcMovimentar = () => (
  <Icone>
    <path d="M4 7h16" />
    <path d="m16 3 4 4-4 4" />
    <path d="M20 17H4" />
    <path d="m8 13-4 4 4 4" />
  </Icone>
)

export const IcEntradas = () => (
  <Icone>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m7 10 5 5 5-5" />
    <path d="M12 15V3" />
  </Icone>
)

export const IcSaida = () => (
  <Icone>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m17 8-5-5-5 5" />
    <path d="M12 3v12" />
  </Icone>
)

export const IcHistorico = () => (
  <Icone>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icone>
)

export const IcPainel = () => (
  <Icone>
    <path d="M18 20V10" />
    <path d="M12 20V4" />
    <path d="M6 20v-6" />
  </Icone>
)

export const IcAlmoxarifados = () => (
  <Icone>
    <path d="M3 21V9l9-5 9 5v12" />
    <path d="M7 21v-8h10v8" />
    <path d="M7 17h10" />
  </Icone>
)

export const IcUsuarios = () => (
  <Icone>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.9" />
    <path d="M16 3.1a4 4 0 0 1 0 7.8" />
  </Icone>
)

export const IcMateriais = () => (
  <Icone>
    <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z" />
    <path d="M7 7h.01" />
  </Icone>
)

export const IcUnidades = () => (
  <Icone>
    <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0z" />
    <path d="m14.5 12.5 2-2" />
    <path d="m11.5 9.5 2-2" />
    <path d="m8.5 6.5 2-2" />
    <path d="m17.5 15.5 2-2" />
  </Icone>
)

export const IcSaldoInicial = () => (
  <Icone>
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <path d="M4 22v-7" />
  </Icone>
)

/** Motivos de redução: lista com marcadores. */
export const IcMotivos = () => (
  <Icone>
    <path d="M9 6h11" />
    <path d="M9 12h11" />
    <path d="M9 18h11" />
    <path d="M4 6h.01" />
    <path d="M4 12h.01" />
    <path d="M4 18h.01" />
  </Icone>
)

/** Equipes: duas pessoas. */
export const IcEquipes = () => (
  <Icone>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
    <path d="M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
  </Icone>
)

/** Automação: raio. */
export const IcAutomacao = () => (
  <Icone>
    <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
  </Icone>
)

/** Seta de abrir e fechar grupo: aponta para baixo; o CSS gira quando recolhido. */
export const IcSeta = () => (
  <Icone>
    <path d="m6 9 6 6 6-6" />
  </Icone>
)
