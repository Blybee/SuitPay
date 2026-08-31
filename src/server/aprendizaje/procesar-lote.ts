import { diaEnLima } from '../../domain/anulacion/ventana.ts'
import type { DiffDeProducto } from '../../domain/aprendizaje/memoria.ts'
import { diffsDesdePares } from '../../domain/aprendizaje/memoria.ts'
import { ErrorDeSuitPay } from '../errores.ts'
import {
  invocarModeloConPartes,
} from '../asistencia/cliente-modelo.ts'
import {
  asistenciaSimuladaActiva,
} from '../asistencia/simulado.ts'
import {
  aplicarYPersistirDiff,
  cerrarLote,
  leerMemoriaDeAprendizaje,
  listarRevisionesPendientes,
  marcarRevisionesProcesadas,
  reclamarLote,
} from './almacen.ts'

const SCHEMA_CONSOLIDACION = {
  type: 'OBJECT',
  properties: {
    productos: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          codigo: { type: 'STRING' },
          aliases: { type: 'ARRAY', items: { type: 'STRING' } },
          etiquetas: { type: 'ARRAY', items: { type: 'STRING' } },
          agregados: { type: 'ARRAY', items: { type: 'STRING' } },
          quitados: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['codigo', 'aliases', 'etiquetas', 'agregados', 'quitados'],
      },
    },
  },
  required: ['productos'],
} as const

function diaAnterior(hoy: string): string {
  const [y, m, d] = hoy.split('-').map(Number)
  const utc = Date.UTC(y ?? 2026, (m ?? 1) - 1, (d ?? 1) - 1)
  return diaEnLima(new Date(utc))
}

function parsearDiffs(valor: unknown): DiffDeProducto[] {
  if (!valor || typeof valor !== 'object') return []
  const productos = (valor as { productos?: unknown }).productos
  if (!Array.isArray(productos)) return []
  const diffs: DiffDeProducto[] = []
  for (const raw of productos) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const codigo = typeof r.codigo === 'string' ? r.codigo.trim() : ''
    if (codigo === '') continue
    const lista = (campo: unknown) =>
      Array.isArray(campo)
        ? campo.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
        : []
    diffs.push({
      codigo,
      aliases: lista(r.aliases),
      etiquetas: lista(r.etiquetas),
      agregados: lista(r.agregados),
      quitados: lista(r.quitados),
    })
  }
  return diffs
}

export async function procesarLoteAprendizaje(
  ahora: Date = new Date(),
): Promise<{ omitido: boolean; diaLima: string; pares: number }> {
  const hoy = diaEnLima(ahora)
  const diaLote = diaAnterior(hoy)
  const pendientes = await listarRevisionesPendientes(diaLote)
  if (pendientes.length === 0) {
    return { omitido: true, diaLima: diaLote, pares: 0 }
  }

  const { yaCerrado } = await reclamarLote(diaLote, ahora)
  if (yaCerrado) {
    return { omitido: true, diaLima: diaLote, pares: 0 }
  }

  const pares = pendientes.flatMap((r) => r.pares)
  const memoria = await leerMemoriaDeAprendizaje()
  let diffs: DiffDeProducto[]
  let modelo = 'simulado'

  if (asistenciaSimuladaActiva()) {
    diffs = diffsDesdePares(pares, memoria)
  } else {
    modelo = process.env.ASISTENCIA_MODELO ?? 'gemini'
    const prompt = `Consolida la memoria de asistencia de ferretería/gasfitería.
Memoria vigente (JSON): ${JSON.stringify(memoria)}
Pares nuevos textoOriginal → codigoAprobado: ${JSON.stringify(pares.map((p) => ({ t: p.textoOriginal, id: p.codigoAprobado })))}
Refuerza, actualiza o quita. No dupliques sinónimos. Devuelve solo productos que cambian.`
    try {
      const crudo = await invocarModeloConPartes({
        partes: [{ text: prompt }],
        schema: SCHEMA_CONSOLIDACION,
        timeoutMs: 90_000,
      })
      diffs = parsearDiffs(crudo)
    } catch (error) {
      console.error('[SuitPay] lote de aprendizaje: modelo falló', error)
      throw new ErrorDeSuitPay('asistencia_no_disponible')
    }
  }

  await aplicarYPersistirDiff(diffs)
  await marcarRevisionesProcesadas(
    pendientes.map((p) => p.id),
    ahora,
  )
  await cerrarLote(
    diaLote,
    { pares: pares.length, diffs, modelo },
    ahora,
  )
  return { omitido: false, diaLima: diaLote, pares: pares.length }
}
