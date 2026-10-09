import { extraerPaginas } from './extraer-pdf.ts'
import { parsearClientes, parsearTransportistas } from './parsear.ts'
import type {
  ClienteDePadron,
  ConteoDeLote,
  ProgresoDeImportacion,
  ResumenDeImportacion,
  TransportistaDePadron,
} from './tipos.ts'

export const TAMANO_DE_LOTE = 400

type Fila = ClienteDePadron | TransportistaDePadron

async function guardarEnLotes(
  filas: readonly Fila[],
  persistirLote: (lote: readonly Fila[]) => Promise<ConteoDeLote>,
  alProgreso: ((progreso: ProgresoDeImportacion) => void) | undefined,
  ceder: () => Promise<void>,
  tamanoLote: number,
): Promise<ConteoDeLote> {
  let nuevos = 0
  let yaExistian = 0
  const total = filas.length
  for (let inicio = 0; inicio < total; inicio += tamanoLote) {
    const lote = filas.slice(inicio, inicio + tamanoLote)
    alProgreso?.({ fase: 'guardando', hecho: inicio, total })
    await ceder()
    const parcial = await persistirLote(lote)
    nuevos += parcial.nuevos
    yaExistian += parcial.yaExistian
    alProgreso?.({
      fase: 'guardando',
      hecho: Math.min(inicio + lote.length, total),
      total,
    })
    await ceder()
  }
  return { nuevos, yaExistian }
}

export async function correrImportacion(opciones: {
  readonly bytes: Uint8Array
  readonly tipo: 'clientes' | 'transportistas'
  readonly persistirLote: (lote: readonly Fila[]) => Promise<ConteoDeLote>
  readonly alProgreso?: (progreso: ProgresoDeImportacion) => void
  readonly ceder?: () => Promise<void>
  readonly tamanoLote?: number
}): Promise<ResumenDeImportacion> {
  const ceder = opciones.ceder ?? (async () => {})
  const tamanoLote = opciones.tamanoLote ?? TAMANO_DE_LOTE
  const paginas = await extraerPaginas(
    opciones.bytes,
    async (pagina, total) => {
      opciones.alProgreso?.({ fase: 'leyendo', hecho: pagina, total })
      await ceder()
    },
  )
  const lectura =
    opciones.tipo === 'clientes'
      ? parsearClientes(paginas)
      : parsearTransportistas(paginas)
  const conteo = await guardarEnLotes(
    lectura.filas,
    opciones.persistirLote,
    opciones.alProgreso,
    ceder,
    tamanoLote,
  )
  return { ...conteo, descartados: lectura.descartados }
}
