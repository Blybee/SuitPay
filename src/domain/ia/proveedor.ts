export const PROVEEDORES_DE_IA = ['openrouter', 'gemini'] as const
export type ProveedorDeIa = (typeof PROVEEDORES_DE_IA)[number]

/** Audio, PDF y Compras no tienen interruptor: siempre Gemini. */
export type ModalidadDeIa = 'texto' | 'imagen' | 'audio' | 'pdf' | 'compras'

export interface InterruptoresDeIa {
  readonly texto: ProveedorDeIa
  readonly imagen: ProveedorDeIa
}

export const INTERRUPTORES_POR_DEFECTO: InterruptoresDeIa = {
  texto: 'openrouter',
  imagen: 'gemini',
}

export function proveedorDe(
  modalidad: ModalidadDeIa,
  interruptores: InterruptoresDeIa,
): ProveedorDeIa {
  if (modalidad === 'texto') return interruptores.texto
  if (modalidad === 'imagen') return interruptores.imagen
  return 'gemini'
}

export interface ParteConMime {
  readonly inlineData?: { readonly mimeType: string }
  readonly fileData?: { readonly mimeType: string }
}

/**
 * Compras, audio y PDF ganan aunque el llamador haya pedido texto o imagen.
 * Una parte de imagen dentro de una tarea de texto sigue el interruptor de imagen.
 */
export function modalidadEfectiva(
  pedida: ModalidadDeIa,
  partes: readonly ParteConMime[],
): ModalidadDeIa {
  if (pedida === 'compras' || pedida === 'audio' || pedida === 'pdf') {
    return pedida
  }
  const mimes = partes.map(
    (parte) => parte.inlineData?.mimeType ?? parte.fileData?.mimeType ?? '',
  )
  if (mimes.some((mime) => mime.startsWith('audio/'))) return 'audio'
  if (mimes.some((mime) => mime === 'application/pdf')) return 'pdf'
  if (pedida === 'imagen' || mimes.some((mime) => mime.startsWith('image/'))) {
    return 'imagen'
  }
  return 'texto'
}
