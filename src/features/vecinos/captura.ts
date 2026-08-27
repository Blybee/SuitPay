import { formatearImporte } from '../../domain/totales/calculo.ts'
import type { LineaDePedido } from '../../domain/totales/calculo.ts'
import { enlaceChatWhatsApp } from '../../domain/vecinos/telefono.ts'
import { mostrarNotificacion } from '../notificaciones/almacen.ts'

/**
 * Dibuja la lista del vecino (productos + total) y la copia al portapapeles.
 * Si hay celular, abre wa.me (click-to-chat no admite adjuntar la imagen).
 */

export async function pintarListaDeVecino(datos: {
  readonly alias: string
  readonly lineas: readonly LineaDePedido[]
  readonly total: number
}): Promise<Blob> {
  const escala = 2
  const ancho = 640
  const fila = 36
  const cabecera = 72
  const pie = 64
  const alto = cabecera + Math.max(datos.lineas.length, 1) * fila + pie
  const canvas = document.createElement('canvas')
  canvas.width = ancho * escala
  canvas.height = alto * escala
  const ctx = canvas.getContext('2d')
  if (ctx === null) {
    throw new Error('No se pudo crear la captura.')
  }
  ctx.scale(escala, escala)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, ancho, alto)
  ctx.fillStyle = '#1a1714'
  ctx.font = 'bold 22px sans-serif'
  ctx.fillText(datos.alias, 24, 40)
  ctx.font = '12px monospace'
  ctx.fillStyle = '#6b7280'
  ctx.fillText('Producto', 24, 64)
  ctx.fillText('Cant.', 420, 64)
  ctx.fillText('Importe', 520, 64)

  ctx.font = '16px sans-serif'
  ctx.fillStyle = '#1a1714'
  if (datos.lineas.length === 0) {
    ctx.fillStyle = '#6b7280'
    ctx.fillText('Sin productos', 24, cabecera + 24)
  } else {
    datos.lineas.forEach((linea, indice) => {
      const y = cabecera + indice * fila + 24
      ctx.fillStyle = '#1a1714'
      ctx.font = 'bold 16px sans-serif'
      const nombre = linea.descripcion.length > 42
        ? `${linea.descripcion.slice(0, 42)}…`
        : linea.descripcion
      ctx.fillText(nombre, 24, y)
      ctx.font = '16px monospace'
      ctx.fillText(String(linea.cantidad), 420, y)
      ctx.fillText(formatearImporte(linea.precio * linea.cantidad), 520, y)
    })
  }

  ctx.fillStyle = '#1a1714'
  ctx.font = 'bold 22px monospace'
  ctx.fillText(`Total ${formatearImporte(datos.total)}`, 24, alto - 24)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((resultado) => resolve(resultado), 'image/png')
  })
  if (blob === null) throw new Error('No se pudo crear la captura.')
  return blob
}

export async function copiarCapturaYAbrirWhatsApp(datos: {
  readonly imagen: Blob
  readonly telefono: string | null
  readonly alias: string
}): Promise<void> {
  let copiado = false
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': datos.imagen }),
    ])
    copiado = true
  } catch {
    copiado = false
  }

  const chat =
    datos.telefono !== null && datos.telefono.trim() !== ''
      ? enlaceChatWhatsApp(datos.telefono)
      : null

  if (copiado && chat !== null) {
    mostrarNotificacion({
      tono: 'exito',
      duracionMs: 6_000,
      mensaje: `Captura copiada. WhatsApp abierto: pega la imagen en el chat de ${datos.alias}.`,
    })
  } else if (copiado) {
    mostrarNotificacion({
      tono: 'exito',
      duracionMs: 6_000,
      mensaje: `Captura de ${datos.alias} copiada. Pégala en WhatsApp.`,
    })
  } else if (chat !== null) {
    mostrarNotificacion({
      tono: 'info',
      duracionMs: 6_000,
      mensaje:
        'WhatsApp abierto, pero no se pudo copiar la imagen. Haz otra captura o comparte el archivo a mano.',
    })
  } else {
    mostrarNotificacion({
      tono: 'error',
      mensaje: 'No se pudo copiar la captura. Prueba de nuevo o usa otro navegador.',
    })
  }

  if (chat !== null) {
    window.setTimeout(() => {
      window.open(chat, '_blank', 'noopener,noreferrer')
    }, 300)
  }
}
