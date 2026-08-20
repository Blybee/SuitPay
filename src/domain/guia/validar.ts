import type { TrasladoDeGuia } from './tipos.ts'

export type CampoFaltanteDeGuia = {
  readonly campo: string
  readonly motivo: string
}

/**
 * Validación de campos condicionales (FR-004). No emite; solo dice qué falta.
 */
export function faltantesDelTraslado(
  traslado: TrasladoDeGuia,
): readonly CampoFaltanteDeGuia[] {
  const faltantes: CampoFaltanteDeGuia[] = []

  if (traslado.items.length === 0) {
    faltantes.push({ campo: 'items', motivo: 'La guía necesita al menos un ítem.' })
  }
  for (const item of traslado.items) {
    if (item.cantidad <= 0 || item.descripcion.trim() === '') {
      faltantes.push({
        campo: 'items',
        motivo: 'Cada ítem necesita descripción y cantidad positiva.',
      })
      break
    }
  }

  if (traslado.pesoBruto <= 0) {
    faltantes.push({ campo: 'pesoBruto', motivo: 'Indica el peso bruto.' })
  }
  if (traslado.numeroBultos <= 0) {
    faltantes.push({ campo: 'numeroBultos', motivo: 'Indica el número de bultos.' })
  }
  if (!ubigeoValido(traslado.direccionPartida.ubigeo)) {
    faltantes.push({ campo: 'partida.ubigeo', motivo: 'Ubigeo de partida inválido.' })
  }
  if (traslado.direccionPartida.direccion.trim() === '') {
    faltantes.push({ campo: 'partida.direccion', motivo: 'Falta la dirección de partida.' })
  }
  if (!ubigeoValido(traslado.direccionLlegada.ubigeo)) {
    faltantes.push({ campo: 'llegada.ubigeo', motivo: 'Ubigeo de llegada inválido.' })
  }
  if (traslado.direccionLlegada.direccion.trim() === '') {
    faltantes.push({ campo: 'llegada.direccion', motivo: 'Falta la dirección de llegada.' })
  }

  if (traslado.motivoTraslado === 'entre_almacenes') {
    if ((traslado.direccionPartida.anexo ?? '').trim() === '') {
      faltantes.push({ campo: 'partida.anexo', motivo: 'El traslado interno pide anexo de partida.' })
    }
    if ((traslado.direccionLlegada.anexo ?? '').trim() === '') {
      faltantes.push({ campo: 'llegada.anexo', motivo: 'El traslado interno pide anexo de llegada.' })
    }
  }

  if (traslado.modoTransporte === 'publico') {
    const t = traslado.transportista
    if (t === undefined || t.numeroDocumento.length !== 11 || t.denominacion.trim() === '') {
      faltantes.push({
        campo: 'transportista',
        motivo: 'El transporte público exige RUC y denominación del transportista.',
      })
    }
  }

  if (traslado.modoTransporte === 'privado') {
    const c = traslado.conductor
    if (
      c === undefined ||
      c.numeroDocumento.trim() === '' ||
      c.nombres.trim() === '' ||
      c.licencia.trim() === '' ||
      c.placa.trim() === ''
    ) {
      faltantes.push({
        campo: 'conductor',
        motivo: 'El transporte privado exige conductor, licencia y placa.',
      })
    }
  }

  return faltantes
}

export function trasladoEsEmitible(traslado: TrasladoDeGuia): boolean {
  return faltantesDelTraslado(traslado).length === 0
}

function ubigeoValido(ubigeo: string): boolean {
  return /^\d{6}$/.test(ubigeo)
}
