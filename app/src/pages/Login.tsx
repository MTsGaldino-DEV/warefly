import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useSessao } from '../auth/SessaoContext'
import { Aviso, Campo, Marca } from '../components/ui'
import { mensagemErro } from '../lib/erros'
import { DOMINIO_LOGIN, emailDoUsuario } from '../lib/login'
import { supabase } from '../lib/supabase'

export function Login() {
  const { session } = useSessao()
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: emailDoUsuario(usuario), password: senha })
    setEnviando(false)
    if (error) setErro(mensagemErro(error))
  }

  return (
    <div className="login">
      <form className="login-cartao pilha" onSubmit={entrar}>
        <Marca comNome />
        <Campo rotulo="Usuário" ajuda={`Ex.: matheus.galdino (sem @${DOMINIO_LOGIN})`}>
          <input
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Senha">
          <input type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Campo>
        <Aviso tipo="erro">{erro}</Aviso>
        <button className="botao primario" type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="sec peq">Sem acesso? Peça ao administrador do sistema.</p>
      </form>
    </div>
  )
}
