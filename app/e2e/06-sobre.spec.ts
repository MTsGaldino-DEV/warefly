import { expect, test } from '@playwright/test'

test('o login mostra a autoria e o commit no pé da tela', async ({ page }) => {
  await page.goto('/login')
  const rodape = page.getByRole('contentinfo')
  await expect(rodape).toHaveText(/^Desenvolvido por Matheus Galdino( · [0-9a-f]{7,})?$/)
  await expect(rodape.getByRole('link')).toHaveCount(0)
})
