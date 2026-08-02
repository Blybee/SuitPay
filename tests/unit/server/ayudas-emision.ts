import { AlmacenEnMemoria } from '../../../src/server/emision/almacen-memoria.ts'
import { idDeSerie } from '../../../src/server/emision/almacen.ts'
import { ProveedorSimulado } from '../../../src/server/proveedor/simulado.ts'
import type {
  ContextoDeEmision,
  PeticionDeEmitir,
} from '../../../src/server/emision/emitir.ts'
import type { TipoDeDocumento } from '../../../src/domain/documentos/tipos.ts'

/**
 * Andamiaje compartido por las pruebas de emisión.
 *
 * ## Por qué sigue usando ProveedorSimulado
 *
 * La constitución exige cubrir reintento, respuesta ausente y fallo del
 * proveedor. Esos modos **hay que inyectarlos**: el API real no ofrece un
 * interruptor «acepta pero no contestes» ni «indeterminado a voluntad».
 * Por eso estas pruebas de lógica de SuitPay usan el simulado; el contrato
 * HTTP del proveedor se verifica aparte en `*-demo.test.ts` y scripts T027.
 *
 * No conviertas este andamiaje al proveedor real: dejarías de poder probar
 * el principio II.
 */

export const VENDEDOR = 'vendedor-1'
export const UMBRAL = 70_000

export interface Escenario {
  readonly almacen: AlmacenEnMemoria
  readonly proveedor: ProveedorSimulado
  readonly contexto: ContextoDeEmision
}

export function montarEscenario(
  opciones: {
    readonly series?: readonly TipoDeDocumento[]
    readonly ultimoNumero?: number
    readonly umbral?: number
    readonly momento?: Date
  } = {},
): Escenario {
  const almacen = new AlmacenEnMemoria()
  const proveedor = new ProveedorSimulado()

  const prefijos: Partial<Record<TipoDeDocumento, string>> = {
    boleta: 'B001',
    factura: 'F001',
  }

  for (const tipo of opciones.series ?? ['boleta', 'factura']) {
    const serie = prefijos[tipo]
    if (serie === undefined) continue
    const ultimoNumero = opciones.ultimoNumero ?? 0
    almacen.sembrarSerie({
      id: idDeSerie(VENDEDOR, tipo),
      serie,
      tipoDocumento: tipo,
      vendedorId: VENDEDOR,
      // Por omisión: origen 1 con ultimoNumero 0 (primer reclamado = 1).
      numeroInicial: ultimoNumero + 1,
      ultimoNumero,
      ultimoNumeroConfirmado: ultimoNumero,
      activa: true,
    })
  }

  const momento = opciones.momento ?? new Date('2026-07-28T15:00:00Z')

  const contexto: ContextoDeEmision = {
    almacen,
    proveedor,
    vendedorId: VENDEDOR,
    umbralIdentificacion: opciones.umbral ?? UMBRAL,
    formatoImpresion: 'a4',
    ahora: () => momento,
  }

  return { almacen, proveedor, contexto }
}

let contador = 0

/** Una petición válida y mínima. Cada prueba cambia solo lo que le interesa. */
export function peticion(
  cambios: Partial<PeticionDeEmitir> = {},
): PeticionDeEmitir {
  contador++
  return {
    claveIdempotencia: `clave-${contador}`,
    tipoDocumento: 'boleta',
    cliente: null,
    lineas: [
      {
        codigo: 'TUB-1-2',
        descripcion: 'TUBO PVC 1/2 PULGADA',
        unidad: 'UND',
        cantidad: 2,
        precio: 1_250,
      },
    ],
    condicionPago: { tipo: 'contado' },
    medioPago: { medio: 'efectivo', montoRecibido: 2_500 },
    cotizacionId: null,
    capturaId: null,
    ...cambios,
  }
}

export const CLIENTE_IDENTIFICADO = {
  tipoDocumento: 'RUC',
  numeroDocumento: '20512345678',
  denominacion: 'FERRETERIA EL TORNILLO S.A.C.',
  direccion: 'AV. SIEMPRE VIVA 742',
} as const
