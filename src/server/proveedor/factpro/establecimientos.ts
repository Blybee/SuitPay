import {
  exito,
  fallo,
  propagarFallo,
} from '../interfaz.ts'
import type {
  Establecimiento,
  PeticionDeCrearEstablecimiento,
  Resultado,
} from '../interfaz.ts'
import {
  pedirAlProveedor
  
} from './transporte.ts'
import type {ConfiguracionDelProveedor} from './transporte.ts';

/**
 * Administración de establecimientos (sucursales) en el proveedor.
 * Vocabulario ajeno no sale de este módulo.
 */

const RUTA = '/api/v3/sucursal'

interface DocDeSucursal {
  readonly id?: number | string
  readonly nombre?: string
  readonly codigo_anexo?: string
  readonly direccion?: string
  readonly ubigeo_id?: string
  readonly correo_electronico?: string
}

export async function crearEstablecimiento(
  configuracion: ConfiguracionDelProveedor,
  peticion: PeticionDeCrearEstablecimiento,
): Promise<Resultado<Establecimiento>> {
  const respuesta = await pedirAlProveedor(configuracion, RUTA, {
    metodo: 'POST',
    cuerpo: {
      nombre: peticion.nombre ?? '',
      codigo_anexo: peticion.codigoAnexo,
      direccion: peticion.direccion,
      ubigeo_id: peticion.ubigeoId,
      correo_electronico: peticion.correo ?? '',
    },
  })

  if (!respuesta.ok) return propagarFallo(respuesta.fallo)

  const doc = extraerDocumento(respuesta.valor.json)
  let normalizado = aEstablecimiento(doc)

  // Algunas respuestas de alta no traen `id`; lo resolvemos por el anexo.
  if (normalizado === undefined) {
    const lista = await listarEstablecimientos(configuracion)
    if (lista.ok) {
      const hallado = lista.valor.find(
        (e) => e.codigoAnexo === peticion.codigoAnexo,
      )
      if (hallado !== undefined) normalizado = hallado
    }
  }

  if (normalizado === undefined) {
    return fallo(
      'indeterminado',
      'establecimiento_sin_id',
      respuesta.valor.rastro,
    )
  }
  return exito(normalizado)
}

export async function listarEstablecimientos(
  configuracion: ConfiguracionDelProveedor,
): Promise<Resultado<readonly Establecimiento[]>> {
  const respuesta = await pedirAlProveedor(configuracion, RUTA, {
    metodo: 'GET',
  })

  if (!respuesta.ok) return propagarFallo(respuesta.fallo)

  const docs = extraerLista(respuesta.valor.json)
  return exito(
    docs
      .map((doc) => aEstablecimiento(doc))
      .filter((e): e is Establecimiento => e !== undefined),
  )
}

export async function eliminarEstablecimiento(
  configuracion: ConfiguracionDelProveedor,
  establecimientoId: string,
): Promise<Resultado<{ readonly eliminado: true }>> {
  // La documentación pública dice PUT; en demo responde DELETE
  // `{"message":"Sucursal eliminado."}`. PUT con cuerpo vacío es edición y falla.
  const respuesta = await pedirAlProveedor(
    configuracion,
    `${RUTA}/${encodeURIComponent(establecimientoId)}`,
    { metodo: 'DELETE' },
  )

  if (!respuesta.ok) return propagarFallo(respuesta.fallo)
  return exito({ eliminado: true })
}

function extraerLista(json: unknown): readonly DocDeSucursal[] {
  if (typeof json !== 'object' || json === null) return []
  const docs = (json as { docs?: unknown }).docs
  if (!Array.isArray(docs)) return []
  return docs as DocDeSucursal[]
}

function extraerDocumento(json: unknown): DocDeSucursal {
  if (typeof json !== 'object' || json === null) return {}
  const objeto = json as Record<string, unknown>
  if (objeto['data'] !== undefined && typeof objeto['data'] === 'object') {
    return objeto['data'] as DocDeSucursal
  }
  if (objeto['id'] !== undefined) return objeto
  const docs = objeto['docs']
  if (Array.isArray(docs) && docs.length > 0) {
    return docs[0] as DocDeSucursal
  }
  return objeto
}

function aEstablecimiento(doc: DocDeSucursal): Establecimiento | undefined {
  if (doc.id === undefined) return undefined
  return {
    id: String(doc.id),
    nombre: doc.nombre ?? '',
    codigoAnexo: doc.codigo_anexo ?? '',
    direccion: doc.direccion ?? '',
    ubigeoId: doc.ubigeo_id ?? '',
    correo:
      doc.correo_electronico === undefined || doc.correo_electronico === ''
        ? undefined
        : doc.correo_electronico,
  }
}
