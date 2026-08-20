/**
 * Tipos SuitPay de la guía de remisión. Los códigos del proveedor
 * (modo 01/02, motivo 04, …) viven solo en el adaptador.
 */

export const MODOS_DE_TRANSPORTE = ['publico', 'privado'] as const
export type ModoDeTransporte = (typeof MODOS_DE_TRANSPORTE)[number]

export const MOTIVOS_DE_TRASLADO = [
  'venta',
  'compra',
  'consignacion',
  'entre_almacenes',
  'otros',
] as const
export type MotivoDeTraslado = (typeof MOTIVOS_DE_TRASLADO)[number]

export interface DireccionDeTraslado {
  readonly ubigeo: string
  readonly direccion: string
  readonly anexo?: string
}

export interface TransportistaDeGuia {
  readonly numeroDocumento: string
  readonly denominacion: string
  readonly numeroRegistroMtc?: string
}

export interface ConductorDeGuia {
  readonly tipoDocumento: string
  readonly numeroDocumento: string
  readonly nombres: string
  readonly licencia: string
  readonly placa: string
}

export interface ItemDeGuia {
  readonly codigo: string
  readonly cantidad: number
  readonly descripcion: string
  readonly unidad: string
}

export interface TrasladoDeGuia {
  readonly modoTransporte: ModoDeTransporte
  readonly motivoTraslado: MotivoDeTraslado
  readonly pesoBruto: number
  readonly unidadPeso: string
  readonly numeroBultos: number
  readonly direccionPartida: DireccionDeTraslado
  readonly direccionLlegada: DireccionDeTraslado
  readonly transportista?: TransportistaDeGuia
  readonly conductor?: ConductorDeGuia
  readonly items: readonly ItemDeGuia[]
}

/** Una guía vigente ocupa el cupo 1:1 del comprobante origen. */
export function guiaEstaVigente(estado: string): boolean {
  return estado !== 'anulado' && estado !== 'rechazado'
}
