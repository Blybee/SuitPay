import type { MotivoDeTraslado, TrasladoDeGuia } from '../../../domain/guia/tipos.ts'

/**
 * Mapeo SuitPay → códigos de la API. No sale de este directorio.
 */

export function codigoModoTransporte(modo: TrasladoDeGuia['modoTransporte']): string {
  return modo === 'publico' ? '01' : '02'
}

export function codigoMotivoTraslado(motivo: MotivoDeTraslado): string {
  switch (motivo) {
    case 'venta':
      return '01'
    case 'compra':
      return '02'
    case 'entre_almacenes':
      return '04'
    case 'consignacion':
      return '13'
    case 'otros':
      return '13'
  }
}

export function cuerpoDeGuia(traslado: TrasladoDeGuia): Record<string, unknown> {
  const cuerpo: Record<string, unknown> = {
    codigo_modo_transporte: codigoModoTransporte(traslado.modoTransporte),
    motivo_traslado: codigoMotivoTraslado(traslado.motivoTraslado),
    peso_bruto_total: traslado.pesoBruto,
    peso_bruto_unidad: traslado.unidadPeso,
    numero_de_bultos: traslado.numeroBultos,
    direccion_partida: {
      ubigeo: traslado.direccionPartida.ubigeo,
      direccion: traslado.direccionPartida.direccion,
      ...(traslado.direccionPartida.anexo
        ? { anexo: traslado.direccionPartida.anexo }
        : {}),
    },
    direccion_llegada: {
      ubigeo: traslado.direccionLlegada.ubigeo,
      direccion: traslado.direccionLlegada.direccion,
      ...(traslado.direccionLlegada.anexo
        ? { anexo: traslado.direccionLlegada.anexo }
        : {}),
    },
    items: traslado.items.map((item) => ({
      codigo: item.codigo,
      cantidad: item.cantidad,
      descripcion: item.descripcion,
      unidad: item.unidad,
    })),
  }

  if (traslado.transportista !== undefined) {
    cuerpo['transportista'] = {
      numero_documento: traslado.transportista.numeroDocumento,
      denominacion: traslado.transportista.denominacion,
      ...(traslado.transportista.numeroRegistroMtc
        ? { registro_mtc: traslado.transportista.numeroRegistroMtc }
        : {}),
    }
  }

  if (traslado.conductor !== undefined) {
    cuerpo['conductor'] = {
      tipo_documento: traslado.conductor.tipoDocumento,
      numero_documento: traslado.conductor.numeroDocumento,
      nombres: traslado.conductor.nombres,
      licencia: traslado.conductor.licencia,
      placa: traslado.conductor.placa,
    }
  }

  return cuerpo
}
