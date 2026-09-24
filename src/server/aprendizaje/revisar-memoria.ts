import type { CambioDeRevision, MapaDeMemoria } from '../../domain/aprendizaje/memoria.ts'
import {
  aplicarPropuestaDeRevision,
  memoriaConIndicio,
  propuestaDeDeduplicacion,
  tandasDeRevision,
} from '../../domain/aprendizaje/memoria.ts'
import { ErrorDeSuitPay } from '../errores.ts'
import { invocarModeloConPartes } from '../asistencia/cliente-modelo.ts'
import { asistenciaSimuladaActiva } from '../asistencia/simulado.ts'
import {
  escribirMemoriaDeAprendizaje,
  leerMarcasDeAprendizaje,
  leerMemoriaDeAprendizaje,
} from './almacen.ts'

const SCHEMA_REVISION = {
  type: 'OBJECT',
  properties: {
    mensaje: { type: 'STRING' },
    cambios: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          codigo: { type: 'STRING' },
          aliases: { type: 'ARRAY', items: { type: 'STRING' } },
          etiquetas: { type: 'ARRAY', items: { type: 'STRING' } },
          quitados: { type: 'ARRAY', items: { type: 'STRING' } },
          motivo: { type: 'STRING' },
        },
        required: ['codigo', 'aliases', 'etiquetas', 'quitados', 'motivo'],
      },
    },
  },
  required: ['mensaje', 'cambios'],
} as const

export const MENSAJE_SIN_REPETICION =
  'No hay repeticiones que quitar. Los coloquiales distintos se mantienen.'

function lista(campo: unknown): string[] {
  if (!Array.isArray(campo)) return []
  return campo.filter((item): item is string => typeof item === 'string')
}

export function parsearCambiosDeRevision(valor: unknown): CambioDeRevision[] {
  if (!valor || typeof valor !== 'object') return []
  const cambios = (valor as { cambios?: unknown }).cambios
  if (!Array.isArray(cambios)) return []
  const salida: CambioDeRevision[] = []
  for (const raw of cambios) {
    if (!raw || typeof raw !== 'object') continue
    const fila = raw as Record<string, unknown>
    const codigo = typeof fila.codigo === 'string' ? fila.codigo.trim() : ''
    if (codigo === '') continue
    const quitados = lista(fila.quitados)
    if (quitados.length === 0) continue
    salida.push({
      codigo,
      aliases: lista(fila.aliases),
      etiquetas: lista(fila.etiquetas),
      quitados,
      motivo:
        typeof fila.motivo === 'string' && fila.motivo.trim() !== ''
          ? fila.motivo.trim()
          : 'Repetición en el mismo código.',
    })
  }
  return salida
}

function promptDeRevision(memoria: MapaDeMemoria): string {
  return `Inspeccionas la memoria de alias de ferretería/gasfitería. Devuelve SOLO JSON.

No fuerces una propuesta. Si no hay una repetición clara, cambios debe ser [] y mensaje explica que no hay nada que quitar.

Por cada código (SKU):
- Quita solo aprendizajes repetidos: el mismo alias o la misma etiqueta, aunque cambien mayúsculas o espacios.
- Deja los sinónimos y coloquiales distintos. No los fusiones ni los reescribas.
- Compacta solo si un alias se repite a sí mismo y basta rescatar unos términos que ya están en ese alias.
- No inventes alias ni etiquetas nuevas.
- Si dudas, no incluyas ese código.

mensaje: una frase. Si hay cambios, resume qué se quita. Si no hay, di que no hay repeticiones.
motivo: una frase breve, solo en los códigos que sí cambian.

Memoria (codigo → aliases, etiquetas):
${JSON.stringify(memoria)}`
}

function mensajeDe(valor: unknown): string {
  if (!valor || typeof valor !== 'object') return ''
  const mensaje = (valor as { mensaje?: unknown }).mensaje
  return typeof mensaje === 'string' ? mensaje.trim() : ''
}

export async function proponerRevisionDeMemoria(): Promise<{
  readonly cambios: readonly CambioDeRevision[]
  readonly mensaje: string
}> {
  const memoria = await leerMemoriaDeAprendizaje()
  const candidatos = memoriaConIndicio(memoria)
  if (Object.keys(candidatos).length === 0) {
    return { cambios: [], mensaje: MENSAJE_SIN_REPETICION }
  }
  if (asistenciaSimuladaActiva()) {
    const cambios = propuestaDeDeduplicacion(candidatos)
    return {
      cambios,
      mensaje:
        cambios.length === 0
          ? MENSAJE_SIN_REPETICION
          : 'Hay alias repetidos salvo mayúsculas o espacios.',
    }
  }
  const tandas = tandasDeRevision(candidatos)
  const cambios: CambioDeRevision[] = []
  const mensajes: string[] = []
  for (const tanda of tandas) {
    const crudo = await invocarModeloConPartes({
      partes: [{ text: promptDeRevision(tanda) }],
      schema: SCHEMA_REVISION,
      timeoutMs: 90_000,
    })
    cambios.push(...parsearCambiosDeRevision(crudo))
    const mensaje = mensajeDe(crudo)
    if (mensaje !== '') mensajes.push(mensaje)
  }
  if (cambios.length === 0) {
    return {
      cambios: [],
      mensaje: mensajes[0] ?? MENSAJE_SIN_REPETICION,
    }
  }
  return {
    cambios,
    mensaje: mensajes[0] ?? 'Hay repeticiones para revisar.',
  }
}

export async function autorizarRevisionDeMemoria(
  cambios: readonly CambioDeRevision[],
): Promise<void> {
  if (cambios.length === 0) return
  const memoria = await leerMemoriaDeAprendizaje()
  const siguiente = aplicarPropuestaDeRevision(memoria, cambios, true)
  const marcas = await leerMarcasDeAprendizaje()
  try {
    await escribirMemoriaDeAprendizaje(siguiente, marcas)
  } catch (error) {
    if (error instanceof ErrorDeSuitPay) throw error
    throw new ErrorDeSuitPay('fallo_inesperado')
  }
}
