import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { USUARIOS } from './apoio'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

// O container do banco local se chama supabase_db_<project_id do config.toml>.
const PROJETO = /^project_id\s*=\s*"([^"]+)"/m.exec(readFileSync(path.join(RAIZ, 'supabase', 'config.toml'), 'utf8'))?.[1]

function sql(comando: string) {
  execSync(`docker exec -i supabase_db_${PROJETO} psql -v ON_ERROR_STOP=1 -U postgres -q`, { input: comando, stdio: ['pipe', 'inherit', 'inherit'] })
}

/** Zera o banco local e cria os usuários de teste com papéis e atribuições. */
export default async function preparar() {
  execSync('supabase db reset --local', { cwd: RAIZ, stdio: 'ignore' })
  const status = JSON.parse(execSync('supabase status -o json', { cwd: RAIZ, stdio: ['ignore', 'pipe', 'ignore'] }).toString())
  const chave = status.SERVICE_ROLE_KEY as string

  // O reset reinicia auth, storage e realtime, que podem voltar com os IPs
  // trocados entre si. O Kong guarda os endereços antigos e responde 502
  // (foto do recebimento falha com "invalid response from upstream").
  // Reiniciar o Kong faz ele achar os serviços de novo; depois espera os três.
  execSync(`docker restart supabase_kong_${PROJETO}`, { stdio: 'ignore' })
  const rotas = ['/auth/v1/health', '/storage/v1/bucket', '/realtime/v1/api/ping']
  const cabecalhos = { apikey: chave, Authorization: `Bearer ${chave}` }
  for (let i = 0; i < 60; i++) {
    const respostas = await Promise.all(
      rotas.map((rota) => fetch(`http://127.0.0.1:54321${rota}`, { headers: cabecalhos }).catch(() => null)),
    )
    if (respostas.every((r) => r?.ok)) break
    await new Promise((ok) => setTimeout(ok, 1000))
  }

  for (const u of Object.values(USUARIOS)) {
    const r = await fetch('http://127.0.0.1:54321/auth/v1/admin/users', {
      method: 'POST',
      headers: { apikey: chave, Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: u.email, password: u.senha, email_confirm: true, user_metadata: { nome: u.nome } }),
    })
    if (!r.ok) throw new Error(`Falha ao criar ${u.email}: ${await r.text()}`)
  }

  sql(`
    update perfis set papel = 'admin'  where email = '${USUARIOS.admin.email}';
    insert into atribuicoes (almox_id, usuario_id, funcao)
    select a.id, p.id, f::funcao_atribuicao
      from (values ('211', '${USUARIOS.carlos.email}', 'responsavel'),
                   ('211', '${USUARIOS.gestao.email}', 'operador'),
                   ('RSP', '${USUARIOS.vinicius.email}', 'responsavel'), ('RSP', '${USUARIOS.vinicius.email}', 'supervisor'),
                   ('AIM', '${USUARIOS.vinicius.email}', 'responsavel'), ('AIM', '${USUARIOS.vinicius.email}', 'supervisor'))
           as v (codigo, email, f)
      join almoxarifados a on a.codigo = v.codigo
      join perfis p on p.email = v.email;
  `)
}
