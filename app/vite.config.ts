/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'

/**
 * Commit do build, para o pé da tela de login. No Docker não há .git:
 * o commit chega pela variável WAREFLY_COMMIT (build arg do docker-compose).
 */
function commitAtual(): string | null {
  const daVariavel = process.env.WAREFLY_COMMIT?.trim()
  if (daVariavel) return daVariavel.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null
  } catch {
    return null
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __WAREFLY_COMMIT__: JSON.stringify(commitAtual()),
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
