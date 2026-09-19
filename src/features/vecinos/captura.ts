import { formatearImporte } from '../../domain/totales/calculo.ts'
import type { LineaDePedido } from '../../domain/totales/calculo.ts'
import { envolverTextoPorAncho } from '../../domain/captura/envolver-texto.ts'
import { enlaceChatWhatsApp } from '../../domain/vecinos/telefono.ts'
import { mostrarNotificacion } from '../notificaciones/almacen.ts'

/**
 * Rasteriza productos + total en un lienzo fuera del DOM (offscreen canvas).
 * El alto crece con cada fila (nombres largos hacen wrap). Luego se copia al
 * portapapeles; si hay celular, abre wa.me (click-to-chat no adjunta la imagen).
 */

const ESCALA = 2
const ANCHO = 640
const X_PRODUCTO = 24
const X_CANTIDAD = 420
const X_IMPORTE = 520
const ANCHO_NOMBRE = X_CANTIDAD - X_PRODUCTO - 16
const ALTO_LINEA = 20
const RELLENO_FILA = 12
const CABECERA = 72
const PIE = 64
const FILA_GRUPO = 28
const FUENTE_NOMBRE = 'bold 16px sans-serif'

function altoDeFila(renglones: number): number {
  return renglones * ALTO_LINEA + RELLENO_FILA
}

function contextoDeMedida(): CanvasRenderingContext2D {
  const lienzo = document.createElement('canvas')
  const ctx = lienzo.getContext('2d')
  if (ctx === null) throw new Error('No se pudo crear la captura.')
  ctx.font = FUENTE_NOMBRE
  return ctx
}

function renglonesDeNombre(
  ctx: CanvasRenderingContext2D,
  descripcion: string,
): readonly string[] {
  ctx.font = FUENTE_NOMBRE
  return envolverTextoPorAncho(
    descripcion,
    ANCHO_NOMBRE,
    (fragmento) => ctx.measureText(fragmento).width,
  )
}

function crearLienzo(alto: number): {
  readonly canvas: HTMLCanvasElement
  readonly ctx: CanvasRenderingContext2D
} {
  const canvas = document.createElement('canvas')
  canvas.width = ANCHO * ESCALA
  canvas.height = alto * ESCALA
  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('No se pudo crear la captura.')
  ctx.scale(ESCALA, ESCALA)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, ANCHO, alto)
  return { canvas, ctx }
}

function pintarEncabezado(
  ctx: CanvasRenderingContext2D,
  titulo: string,
): void {
  ctx.fillStyle = '#1a1714'
  ctx.font = 'bold 22px sans-serif'
  ctx.fillText(titulo, 24, 40)
  ctx.font = '12px monospace'
  ctx.fillStyle = '#6b7280'
  ctx.fillText('Producto', X_PRODUCTO, 64)
  ctx.fillText('Cant.', X_CANTIDAD, 64)
  ctx.fillText('Importe', X_IMPORTE, 64)
}

function pintarFilaDeProducto(
  ctx: CanvasRenderingContext2D,
  linea: LineaDePedido,
  y: number,
  renglones: readonly string[],
): void {
  ctx.fillStyle = '#1a1714'
  ctx.font = FUENTE_NOMBRE
  ctx.save()
  ctx.beginPath()
  ctx.rect(
    X_PRODUCTO,
    y - ALTO_LINEA,
    ANCHO_NOMBRE,
    renglones.length * ALTO_LINEA + RELLENO_FILA,
  )
  ctx.clip()
  for (let i = 0; i < renglones.length; i += 1) {
    ctx.fillText(renglones[i]!, X_PRODUCTO, y + i * ALTO_LINEA)
  }
  ctx.restore()
  ctx.font = '16px monospace'
  ctx.fillText(String(linea.cantidad), X_CANTIDAD, y)
  ctx.fillText(formatearImporte(linea.precio * linea.cantidad), X_IMPORTE, y)
}

function pintarPie(
  ctx: CanvasRenderingContext2D,
  total: number,
  alto: number,
): void {
  ctx.fillStyle = '#1a1714'
  ctx.font = 'bold 22px monospace'
  ctx.fillText(`Total ${formatearImporte(total)}`, 24, alto - 24)
}

async function blobDeCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((resultado) => resolve(resultado), 'image/png')
  })
  if (blob === null) throw new Error('No se pudo crear la captura.')
  return blob
}

export async function pintarListaDeVecino(datos: {
  readonly titulo: string
  readonly lineas: readonly LineaDePedido[]
  readonly total: number
}): Promise<Blob> {
  const medidor = contextoDeMedida()
  const renglonesPorFila = datos.lineas.map((linea) =>
    renglonesDeNombre(medidor, linea.descripcion),
  )
  const cuerpo =
    datos.lineas.length === 0
      ? altoDeFila(1)
      : renglonesPorFila.reduce(
          (suma, renglones) => suma + altoDeFila(renglones.length),
          0,
        )
  const alto = CABECERA + cuerpo + PIE
  const { canvas, ctx } = crearLienzo(alto)
  pintarEncabezado(ctx, datos.titulo)

  if (datos.lineas.length === 0) {
    ctx.fillStyle = '#6b7280'
    ctx.font = '16px sans-serif'
    ctx.fillText('Sin productos', X_PRODUCTO, CABECERA + 24)
  } else {
    let y = CABECERA + 24
    datos.lineas.forEach((linea, indice) => {
      const renglones = renglonesPorFila[indice]!
      pintarFilaDeProducto(ctx, linea, y, renglones)
      y += altoDeFila(renglones.length)
    })
  }

  pintarPie(ctx, datos.total, alto)
  return blobDeCanvas(canvas)
}

export async function pintarDeudasDeVecino(datos: {
  readonly titulo: string
  readonly grupos: readonly {
    readonly etiqueta: string
    readonly lineas: readonly LineaDePedido[]
  }[]
  readonly total: number
}): Promise<Blob> {
  const medidor = contextoDeMedida()
  const renglonesPorGrupo = datos.grupos.map((grupo) =>
    grupo.lineas.map((linea) => renglonesDeNombre(medidor, linea.descripcion)),
  )
  const filas = datos.grupos.reduce((suma, grupo, indiceGrupo) => {
    const renglones = renglonesPorGrupo[indiceGrupo]!
    if (grupo.lineas.length === 0) {
      return suma + FILA_GRUPO + altoDeFila(1)
    }
    const cuerpoGrupo = renglones.reduce(
      (acc, cada) => acc + altoDeFila(cada.length),
      0,
    )
    return suma + FILA_GRUPO + cuerpoGrupo
  }, 0)
  const alto = CABECERA + Math.max(filas, altoDeFila(1)) + PIE
  const { canvas, ctx } = crearLienzo(alto)
  pintarEncabezado(ctx, datos.titulo)

  let yBase = CABECERA
  if (datos.grupos.length === 0) {
    ctx.fillStyle = '#6b7280'
    ctx.font = '16px sans-serif'
    ctx.fillText('Sin deudas', X_PRODUCTO, CABECERA + 24)
  } else {
    datos.grupos.forEach((grupo, indiceGrupo) => {
      ctx.fillStyle = '#6b7280'
      ctx.font = 'bold 14px sans-serif'
      ctx.fillText(grupo.etiqueta, X_PRODUCTO, yBase + 20)
      yBase += FILA_GRUPO
      const renglonesDelGrupo = renglonesPorGrupo[indiceGrupo]!
      if (grupo.lineas.length === 0) {
        ctx.fillStyle = '#6b7280'
        ctx.font = '16px sans-serif'
        ctx.fillText('Sin productos', X_PRODUCTO, yBase + 24)
        yBase += altoDeFila(1)
        return
      }
      grupo.lineas.forEach((linea, indice) => {
        const renglones = renglonesDelGrupo[indice]!
        pintarFilaDeProducto(ctx, linea, yBase + 24, renglones)
        yBase += altoDeFila(renglones.length)
      })
    })
  }

  pintarPie(ctx, datos.total, alto)
  return blobDeCanvas(canvas)
}

export async function copiarCapturaYAbrirWhatsApp(datos: {
  readonly imagen: Blob
  readonly telefono: string | null
  readonly titulo: string
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
      mensaje: `Captura copiada. WhatsApp abierto: pega la imagen en el chat de ${datos.titulo}.`,
    })
  } else if (copiado) {
    mostrarNotificacion({
      tono: 'exito',
      duracionMs: 6_000,
      mensaje: `Captura de ${datos.titulo} copiada. Pégala en WhatsApp.`,
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

/** Pinta todas las líneas, copia la PNG y, si hay teléfono, abre WhatsApp. */
export async function capturarListaDeProductos(datos: {
  readonly titulo: string
  readonly lineas: readonly LineaDePedido[]
  readonly total: number
  readonly telefono: string | null
}): Promise<void> {
  try {
    const imagen = await pintarListaDeVecino({
      titulo: datos.titulo,
      lineas: datos.lineas,
      total: datos.total,
    })
    await copiarCapturaYAbrirWhatsApp({
      imagen,
      telefono: datos.telefono,
      titulo: datos.titulo,
    })
  } catch (error) {
    console.error('[SuitPay] captura lista', error)
    mostrarNotificacion({
      tono: 'error',
      mensaje: 'No se pudo generar la captura.',
    })
  }
}

export async function capturarDeudasDeVecino(datos: {
  readonly titulo: string
  readonly telefono: string | null
  readonly grupos: readonly {
    readonly etiqueta: string
    readonly lineas: readonly LineaDePedido[]
  }[]
  readonly total: number
  readonly fusionadas: boolean
  readonly lineasFusionadas?: readonly LineaDePedido[]
}): Promise<void> {
  try {
    const imagen = datos.fusionadas
      ? await pintarListaDeVecino({
          titulo: datos.titulo,
          lineas: datos.lineasFusionadas ?? [],
          total: datos.total,
        })
      : await pintarDeudasDeVecino({
          titulo: datos.titulo,
          grupos: datos.grupos,
          total: datos.total,
        })
    await copiarCapturaYAbrirWhatsApp({
      imagen,
      telefono: datos.telefono,
      titulo: datos.titulo,
    })
  } catch (error) {
    console.error('[SuitPay] captura deudas', error)
    mostrarNotificacion({
      tono: 'error',
      mensaje: 'No se pudo generar la captura.',
    })
  }
}
