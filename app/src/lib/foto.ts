import { novoId } from './id'

const LADO_MAIOR = 1600
const QUALIDADE = 0.7

export function dimensoesAlvo(largura: number, altura: number, ladoMaior = LADO_MAIOR) {
  const escala = Math.min(1, ladoMaior / Math.max(largura, altura))
  return { largura: Math.round(largura * escala), altura: Math.round(altura * escala) }
}

export function caminhoFoto(remessaId: string): string {
  return `${remessaId}/${novoId()}.jpg`
}

/** Comprime no cliente: lado maior 1600 px, JPEG ~0,7. */
export async function comprimirFoto(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo)
  const { largura, altura } = dimensoesAlvo(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível processar a foto neste aparelho.')
  ctx.drawImage(bitmap, 0, 0, largura, altura)
  bitmap.close()
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível processar a foto.'))),
      'image/jpeg',
      QUALIDADE,
    )
  })
}
