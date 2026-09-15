import {
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { diaEnLima } from '../../domain/anulacion/ventana.ts'
import { calcularTotal } from '../../domain/totales/calculo.ts'
import type { LineaDePedido } from '../../domain/totales/calculo.ts'
import {
  SUBCOLECCION_DEUDAS_POR_DIA,
  diaCivilDeLineasVivas,
  fusionarLineasPorCodigo,
  hayQueArchivarPedidoVivo,
  mapearLineasDePedido,
} from '../../domain/vecinos/deudas.ts'
import { obtenerBaseDeDatos } from '../../infra/firebase/cliente.ts'

export interface ResultadoPersistirVecino {
  readonly ok: boolean
  readonly mensaje?: string
  readonly archivo?: boolean
}

function serializarLineas(lineas: readonly LineaDePedido[]) {
  return lineas.map((linea) => ({
    codigo: linea.codigo,
    descripcion: linea.descripcion,
    unidad: linea.unidad,
    cantidad: linea.cantidad,
    precio: linea.precio,
  }))
}

function referenciaDeuda(cotizacionId: string, fecha: string) {
  return doc(
    obtenerBaseDeDatos(),
    'cotizaciones',
    cotizacionId,
    SUBCOLECCION_DEUDAS_POR_DIA,
    fecha,
  )
}

/**
 * Reescribe líneas del pedido vivo. Si el día civil Lima ya pasó, archiva
 * primero las líneas actuales a `deudasPorDia` (FR-035g).
 */
export async function mutarLineasDeVecino(datos: {
  readonly cotizacionId: string
  readonly mutar: (lineas: readonly LineaDePedido[]) => readonly LineaDePedido[]
  readonly ahora?: Date
}): Promise<ResultadoPersistirVecino> {
  const ahora = datos.ahora ?? new Date()
  const hoy = diaEnLima(ahora)
  const padre = doc(obtenerBaseDeDatos(), 'cotizaciones', datos.cotizacionId)

  try {
    let archivo = false
    await runTransaction(obtenerBaseDeDatos(), async (tx) => {
      const instantanea = await tx.get(padre)
      if (!instantanea.exists()) {
        throw new Error('Ese vecino ya no existe.')
      }
      const actuales = instantanea.data()
      if (
        actuales['estado'] !== 'pendiente' ||
        actuales['canal'] !== 'vecino'
      ) {
        throw new Error('Esa cotización de vecino no se puede editar.')
      }

      const lineasVivas = mapearLineasDePedido(actuales['lineas'])
      const actualizadoEn =
        actuales['actualizadoEn'] !== null &&
        actuales['actualizadoEn'] !== undefined &&
        typeof actuales['actualizadoEn'] === 'object' &&
        'toDate' in actuales['actualizadoEn'] &&
        typeof (
          actuales['actualizadoEn'] as { toDate: () => Date }
        ).toDate === 'function'
          ? (actuales['actualizadoEn'] as { toDate: () => Date }).toDate()
          : null
      const diaCivil = diaCivilDeLineasVivas(
        typeof actuales['diaCivilLineas'] === 'string'
          ? actuales['diaCivilLineas']
          : null,
        actualizadoEn,
        ahora,
      )

      let vivas = lineasVivas
      let totalDeudas =
        typeof actuales['totalDeudas'] === 'number' ? actuales['totalDeudas'] : 0

      if (hayQueArchivarPedidoVivo(diaCivil, hoy, lineasVivas.length)) {
        archivo = true
        const refDeuda = referenciaDeuda(datos.cotizacionId, diaCivil)
        const existente = await tx.get(refDeuda)
        const previas = existente.exists()
          ? mapearLineasDePedido(existente.data()?.['lineas'])
          : []
        const fusionadas = fusionarLineasPorCodigo([
          { fecha: diaCivil, lineas: previas },
          { fecha: diaCivil, lineas: lineasVivas },
        ])
        const totalDia = calcularTotal(fusionadas)
        const totalPrevio = existente.exists()
          ? Number(existente.data()?.['total'] ?? 0)
          : 0
        totalDeudas = totalDeudas - totalPrevio + totalDia
        tx.set(refDeuda, {
          fecha: diaCivil,
          lineas: serializarLineas(fusionadas),
          total: totalDia,
          generacion: 0,
        })
        vivas = []
      }

      const siguientes = datos.mutar(vivas)
      tx.update(padre, {
        lineas: serializarLineas(siguientes),
        total: calcularTotal(siguientes),
        diaCivilLineas: hoy,
        totalDeudas,
        actualizadoEn: serverTimestamp(),
      })
    })
    return { ok: true, archivo }
  } catch (error) {
    const mensaje =
      error instanceof Error && error.message.startsWith('Ese')
        ? error.message
        : error instanceof Error && error.message.startsWith('Esa')
          ? error.message
          : 'No se pudieron guardar las líneas del vecino.'
    if (mensaje === 'No se pudieron guardar las líneas del vecino.') {
      console.error('[SuitPay] mutarLineasDeVecino: fallo', error)
    }
    return { ok: false, mensaje }
  }
}

export async function persistirLineasDeVecino(datos: {
  readonly cotizacionId: string
  readonly lineas: readonly LineaDePedido[]
}): Promise<ResultadoPersistirVecino> {
  return mutarLineasDeVecino({
    cotizacionId: datos.cotizacionId,
    mutar: () => datos.lineas,
  })
}

export async function asegurarCorteDeDia(
  cotizacionId: string,
  ahora?: Date,
): Promise<ResultadoPersistirVecino> {
  return mutarLineasDeVecino({
    cotizacionId,
    mutar: (lineas) => lineas,
    ahora,
  })
}
