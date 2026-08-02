import { serieEsValida } from '../../../domain/documentos/tipos.ts'
import type { TipoDeDocumento } from '../../../domain/documentos/tipos.ts'
import {
  exito,
  fallo,
  propagarFallo,
} from '../interfaz.ts'
import type {
  PeticionDeCrearSerieEnProveedor,
  Resultado,
  SerieEnProveedor,
} from '../interfaz.ts'
import {
  pedirAlProveedor
  
} from './transporte.ts'
import type {ConfiguracionDelProveedor} from './transporte.ts';

/**
 * Alta y baja de series en el proveedor.
 *
 * Códigos de tipo (columna del proveedor, no SUNAT):
 * factura → 7, boleta → 8. Nota de venta no se crea aquí.
 */

const RUTA = '/api/v3/series'

function codigoTipoDocumento(tipo: TipoDeDocumento): number | undefined {
  switch (tipo) {
    case 'factura':
      return 7
    case 'boleta':
      return 8
    default:
      return undefined
  }
}

export async function crearSerie(
  configuracion: ConfiguracionDelProveedor,
  peticion: PeticionDeCrearSerieEnProveedor,
): Promise<Resultado<SerieEnProveedor>> {
  const codigo = codigoTipoDocumento(peticion.tipoDocumento)
  if (codigo === undefined) {
    return fallo('rechazo_definitivo', 'tipo_sin_serie_en_proveedor', {
      codigoOriginal: undefined,
      mensajeOriginal: undefined,
      cuerpoOriginal: undefined,
      estadoHttp: undefined,
    })
  }

  if (!serieEsValida(peticion.tipoDocumento, peticion.serie)) {
    return fallo('rechazo_definitivo', 'serie_invalida_para_tipo', {
      codigoOriginal: undefined,
      mensajeOriginal: undefined,
      cuerpoOriginal: undefined,
      estadoHttp: undefined,
    })
  }

  const respuesta = await pedirAlProveedor(configuracion, RUTA, {
    metodo: 'POST',
    cuerpo: {
      tipo_documento: codigo,
      serie: peticion.serie,
      numero_a_comenzar: peticion.numeroInicial,
      sucursal: peticion.establecimientoId,
    },
  })

  if (!respuesta.ok) return propagarFallo(respuesta.fallo)

  const datos = extraerSerie(respuesta.valor.json)
  if (datos.id === undefined) {
    return fallo('indeterminado', 'serie_sin_id', respuesta.valor.rastro)
  }

  return exito({
    id: String(datos.id),
    serie: datos.serie ?? peticion.serie,
    tipoDocumento: peticion.tipoDocumento,
    numeroInicial:
      typeof datos.numero_a_comenzar === 'number'
        ? datos.numero_a_comenzar
        : peticion.numeroInicial,
    establecimientoId: String(
      datos.sucursal ?? peticion.establecimientoId,
    ),
  })
}

export async function eliminarSerie(
  configuracion: ConfiguracionDelProveedor,
  serieIdEnProveedor: string,
): Promise<Resultado<{ readonly eliminado: true }>> {
  // Docs públicas dicen PUT; en demo es DELETE (igual que sucursal).
  const respuesta = await pedirAlProveedor(
    configuracion,
    `${RUTA}/${encodeURIComponent(serieIdEnProveedor)}`,
    { metodo: 'DELETE' },
  )

  if (!respuesta.ok) return propagarFallo(respuesta.fallo)
  return exito({ eliminado: true })
}

function extraerSerie(json: unknown): {
  id?: number | string
  serie?: string
  numero_a_comenzar?: number
  sucursal?: number | string
} {
  if (typeof json !== 'object' || json === null) return {}
  const objeto = json as Record<string, unknown>
  if (objeto['data'] !== undefined && typeof objeto['data'] === 'object') {
    return objeto['data'] as {
      id?: number | string
      serie?: string
      numero_a_comenzar?: number
      sucursal?: number | string
    }
  }
  return objeto
}
