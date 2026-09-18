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
import { esPermisoDenegado } from '../../infra/firebase/errores.ts'
import { encolarPorClave } from './cola.ts'

export interface ResultadoPersistirVecino {
  readonly ok: boolean
  readonly mensaje?: string
  readonly archivo?: boolean
  readonly lineas?: readonly LineaDePedido[]
  readonly total?: number
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

function centimosEnteros(valor: number): number {
  return Number.isFinite(valor) ? Math.round(valor) : 0
}

function mensajeDeFallo(error: unknown): string {
  if (error instanceof Error && error.message.startsWith('Ese')) {
    return error.message
  }
  if (error instanceof Error && error.message.startsWith('Esa')) {
    return error.message
  }
  return 'No se pudieron guardar las líneas del vecino.'
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
  return encolarPorClave(datos.cotizacionId, () =>
    mutarLineasDeVecinoAhora(datos),
  )
}

async function mutarLineasDeVecinoAhora(datos: {
  readonly cotizacionId: string
  readonly mutar: (lineas: readonly LineaDePedido[]) => readonly LineaDePedido[]
  readonly ahora?: Date
}): Promise<ResultadoPersistirVecino> {
  const ahora = datos.ahora ?? new Date()
  const hoy = diaEnLima(ahora)
  const padre = doc(obtenerBaseDeDatos(), 'cotizaciones', datos.cotizacionId)

  try {
    return await persistirConCamposDeDeuda(datos, padre, ahora, hoy, true)
  } catch (error) {
    if (esPermisoDenegado(error)) {
      try {
        return await persistirConCamposDeDeuda(
          datos,
          padre,
          ahora,
          hoy,
          false,
        )
      } catch (reintento) {
        return fallarPersistir(reintento)
      }
    }
    return fallarPersistir(error)
  }
}

async function persistirConCamposDeDeuda(
  datos: {
    readonly cotizacionId: string
    readonly mutar: (lineas: readonly LineaDePedido[]) => readonly LineaDePedido[]
  },
  padre: ReturnType<typeof doc>,
  ahora: Date,
  hoy: string,
  conCamposDeDeuda: boolean,
): Promise<ResultadoPersistirVecino> {
  let archivo = false
  let lineasResultado: LineaDePedido[] = []
  let totalResultado = 0
  await runTransaction(obtenerBaseDeDatos(), async (tx) => {
    const instantanea = await tx.get(padre)
    if (!instantanea.exists()) {
      throw new Error('Ese vecino ya no existe.')
    }
    const actuales = instantanea.data()
    if (actuales['estado'] !== 'pendiente' || actuales['canal'] !== 'vecino') {
      throw new Error('Esa cotización de vecino no se puede editar.')
    }

    const lineasVivas = mapearLineasDePedido(actuales['lineas'])
    const actualizadoEn =
      actuales['actualizadoEn'] !== null &&
      actuales['actualizadoEn'] !== undefined &&
      typeof actuales['actualizadoEn'] === 'object' &&
      'toDate' in actuales['actualizadoEn'] &&
      typeof (actuales['actualizadoEn'] as { toDate: () => Date }).toDate ===
        'function'
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
    const hayQueArchivar = hayQueArchivarPedidoVivo(
      diaCivil,
      hoy,
      lineasVivas.length,
    )

    if (hayQueArchivar && !conCamposDeDeuda) {
      throw new Error('Esa cotización de vecino no se puede archivar.')
    }

    if (hayQueArchivar) {
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
      const totalDia = centimosEnteros(calcularTotal(fusionadas))
      const totalPrevio = existente.exists()
        ? Number(existente.data()?.['total'] ?? 0)
        : 0
      totalDeudas = centimosEnteros(totalDeudas - totalPrevio + totalDia)
      tx.set(refDeuda, {
        fecha: diaCivil,
        lineas: serializarLineas(fusionadas),
        total: totalDia,
        generacion: 0,
      })
      vivas = []
    }

    const siguientes = datos.mutar(vivas)
    lineasResultado = [...siguientes]
    totalResultado = centimosEnteros(calcularTotal(siguientes))
    const parche: Record<string, unknown> = {
      lineas: serializarLineas(siguientes),
      total: totalResultado,
      actualizadoEn: serverTimestamp(),
    }
    if (conCamposDeDeuda) {
      parche['diaCivilLineas'] = hoy
      parche['totalDeudas'] = centimosEnteros(totalDeudas)
    }
    tx.update(padre, parche)
  })
  return {
    ok: true,
    archivo,
    lineas: lineasResultado,
    total: totalResultado,
  }
}

function fallarPersistir(error: unknown): ResultadoPersistirVecino {
  const mensaje = mensajeDeFallo(error)
  if (mensaje === 'No se pudieron guardar las líneas del vecino.') {
    console.error('[SuitPay] mutarLineasDeVecino: fallo', error)
  }
  return { ok: false, mensaje }
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
