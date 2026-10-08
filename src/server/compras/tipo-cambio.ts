import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { textoDeTipoCambio } from '../../domain/compras/moneda.ts'
import { COLECCIONES, bd } from '../firebase/admin.ts'

const URL_SUNAT = 'https://api.apis.net.pe/v1/tipo-cambio-sunat'
const TIMEOUT_MS = 4_000

const esquemaRespuesta = z.object({
  venta: z.number().positive(),
  fecha: z.string().optional(),
})

export type MotivoDeTipoCambio = 'no_publicado' | 'limite' | 'sin_respuesta'

export interface TipoCambioGuardado {
  readonly fecha: string
  readonly venta: number
  readonly fechaPublicada: string
}

export interface AlmacenDeTipoCambio {
  leer: (fecha: string) => Promise<TipoCambioGuardado | null>
  guardar: (valor: TipoCambioGuardado) => Promise<void>
}

export interface ResultadoDeTiposDeCambio {
  readonly tipos: readonly TipoCambioGuardado[]
  readonly fallos: readonly {
    readonly fecha: string
    readonly motivo: MotivoDeTipoCambio
  }[]
}

export async function consultarTipoCambioSunat(
  fecha: string,
  fetchImpl: typeof fetch = globalThis.fetch,
  timeoutMs = TIMEOUT_MS,
): Promise<
  | {
      readonly ok: true
      readonly venta: number
      readonly fechaPublicada: string
    }
  | { readonly ok: false; readonly motivo: MotivoDeTipoCambio }
> {
  try {
    const respuesta = await fetchImpl(
      `${URL_SUNAT}?fecha=${encodeURIComponent(fecha)}`,
      { signal: AbortSignal.timeout(timeoutMs) },
    )
    if (respuesta.status === 404) return { ok: false, motivo: 'no_publicado' }
    if (respuesta.status === 429) return { ok: false, motivo: 'limite' }
    if (!respuesta.ok) return { ok: false, motivo: 'sin_respuesta' }
    const crudo: unknown = await respuesta.json()
    const parseado = esquemaRespuesta.safeParse(crudo)
    if (!parseado.success) return { ok: false, motivo: 'sin_respuesta' }
    const texto = textoDeTipoCambio(parseado.data.venta)
    if (texto === undefined) return { ok: false, motivo: 'sin_respuesta' }
    return {
      ok: true,
      venta: parseado.data.venta,
      fechaPublicada: parseado.data.fecha ?? fecha,
    }
  } catch {
    return { ok: false, motivo: 'sin_respuesta' }
  }
}

export async function resolverTiposDeCambio(
  fechas: readonly string[],
  deps: {
    readonly almacen: AlmacenDeTipoCambio
    readonly fetchImpl?: typeof fetch
    readonly timeoutMs?: number
  },
): Promise<ResultadoDeTiposDeCambio> {
  const tipos: TipoCambioGuardado[] = []
  const fallos: { fecha: string; motivo: MotivoDeTipoCambio }[] = []
  const unicas = [...new Set(fechas)]
  for (const fecha of unicas) {
    const cache = await leerSeguro(deps.almacen, fecha)
    if (cache !== null) {
      tipos.push(cache)
      continue
    }
    const consulta = await consultarTipoCambioSunat(
      fecha,
      deps.fetchImpl,
      deps.timeoutMs,
    )
    if (!consulta.ok) {
      fallos.push({ fecha, motivo: consulta.motivo })
      continue
    }
    const guardado: TipoCambioGuardado = {
      fecha,
      venta: consulta.venta,
      fechaPublicada: consulta.fechaPublicada,
    }
    try {
      await deps.almacen.guardar(guardado)
    } catch (error) {
      console.error('[SuitPay] no se pudo cachear el tipo de cambio', error)
    }
    tipos.push(guardado)
  }
  return { tipos, fallos }
}

async function leerSeguro(
  almacen: AlmacenDeTipoCambio,
  fecha: string,
): Promise<TipoCambioGuardado | null> {
  try {
    return await almacen.leer(fecha)
  } catch (error) {
    console.error('[SuitPay] no se pudo leer el tipo de cambio cacheado', error)
    return null
  }
}

export class AlmacenDeTipoCambioFirestore implements AlmacenDeTipoCambio {
  async leer(fecha: string): Promise<TipoCambioGuardado | null> {
    const snap = await bd()
      .collection(COLECCIONES.tiposDeCambio)
      .doc(fecha)
      .get()
    if (!snap.exists) return null
    const venta = snap.get('venta')
    if (typeof venta !== 'number' || !Number.isFinite(venta) || venta <= 0) {
      return null
    }
    const publicada = snap.get('fechaPublicada')
    return {
      fecha,
      venta,
      fechaPublicada: typeof publicada === 'string' ? publicada : fecha,
    }
  }

  async guardar(valor: TipoCambioGuardado): Promise<void> {
    await bd().collection(COLECCIONES.tiposDeCambio).doc(valor.fecha).set(
      {
        venta: valor.venta,
        fechaPublicada: valor.fechaPublicada,
        guardadoEn: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  }
}
