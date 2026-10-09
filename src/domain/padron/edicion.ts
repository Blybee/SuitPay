/**
 * Altas y cambios que Guardar envía al servidor.
 * El índice solo lleva documento y denominación; la ficha vive en el documento.
 */

export interface FichaDeCliente {
  readonly direccion: string
  readonly telefono: string
  readonly correo: string
  readonly ubigeo: string
  readonly condicion: string
}

export interface FichaDeTransportista {
  readonly direccion: string
  readonly numeroRegistroMtc: string
}

export type FichaDePadron = FichaDeCliente | FichaDeTransportista

export interface AltaDeCliente {
  readonly tipoDocumento: 'DNI' | 'RUC'
  readonly numeroDocumento: string
  readonly denominacion: string
  readonly direccion?: string
  readonly telefono?: string
  readonly correo?: string
  readonly ubigeo?: string
  readonly condicion?: string
}

export interface CambioDeCliente {
  readonly numeroDocumento: string
  readonly denominacion: string
  readonly ficha?: FichaDeCliente
}

export interface AltaDeTransportista {
  readonly numeroDocumento: string
  readonly denominacion: string
  readonly direccion?: string
  readonly numeroRegistroMtc?: string
}

export interface CambioDeTransportista {
  readonly numeroDocumento: string
  readonly denominacion: string
  readonly ficha?: FichaDeTransportista
}
