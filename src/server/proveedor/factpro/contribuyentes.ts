import { exito, fallo, propagarFallo } from '../interfaz.ts'
import type {
  Contribuyente,
  PeticionDeContribuyente,
  Resultado,
} from '../interfaz.ts'
import { pedirAlProveedor } from './transporte.ts'
import type { ConfiguracionDelProveedor } from './transporte.ts'

/**
 * Host de la API de consulta RUC/DNI (distinto del de facturación v3).
 * Documentación: GET /api/v1/ruc/{ruc} y GET /api/v1/dni/{dni}.
 */
const URL_CONSULTAS_POR_OMISION = 'https://consultas.factpro.la'

function configuracionDeConsultas(
  facturacion: ConfiguracionDelProveedor,
): ConfiguracionDelProveedor {
  const desdeEntorno = process.env['PROVEEDOR_CONSULTAS_URL_BASE']
  const urlBase = (
    desdeEntorno !== undefined && desdeEntorno !== ''
      ? desdeEntorno
      : URL_CONSULTAS_POR_OMISION
  ).replace(/\/$/, '')

  return {
    urlBase,
    token: facturacion.token,
    esperaMs: facturacion.esperaMs,
  }
}

function rutaDeConsulta(peticion: PeticionDeContribuyente): string {
  const numero = encodeURIComponent(peticion.numeroDocumento.trim())
  return peticion.tipoDocumento === 'DNI'
    ? `/api/v1/dni/${numero}`
    : `/api/v1/ruc/${numero}`
}

function textoOpcional(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim() !== ''
    ? valor.trim()
    : undefined
}

function denominacionDesdeRespuesta(
  tipo: PeticionDeContribuyente['tipoDocumento'],
  cuerpo: Record<string, unknown>,
): string | undefined {
  if (tipo === 'RUC') {
    return textoOpcional(cuerpo['nombre'])
  }

  const nombres = textoOpcional(cuerpo['nombres'])
  const apellidoPaterno = textoOpcional(cuerpo['apellido_paterno'])
  const apellidoMaterno = textoOpcional(cuerpo['apellido_materno'])
  const nombreCompleto = textoOpcional(cuerpo['nombre_completo'])
  if (nombreCompleto !== undefined) return nombreCompleto

  const partes = [apellidoPaterno, apellidoMaterno, nombres].filter(
    (p): p is string => p !== undefined,
  )
  if (partes.length === 0) return nombres
  return partes.join(' ')
}

/**
 * Consulta de contribuyente detrás de la frontera del proveedor.
 * Solo vive bajo `factpro/`.
 *
 * Usa la API de consultas (host propio), no el endpoint de facturación v3.
 */
export async function consultarContribuyenteEnProveedor(
  configuracion: ConfiguracionDelProveedor,
  peticion: PeticionDeContribuyente,
): Promise<Resultado<Contribuyente>> {
  const consultas = configuracionDeConsultas(configuracion)
  const respuesta = await pedirAlProveedor(consultas, rutaDeConsulta(peticion), {
    metodo: 'GET',
  })

  if (!respuesta.ok) return propagarFallo(respuesta.fallo)

  const cuerpo =
    typeof respuesta.valor.json === 'object' && respuesta.valor.json !== null
      ? (respuesta.valor.json as Record<string, unknown>)
      : undefined

  if (cuerpo === undefined) {
    return fallo('rechazo_definitivo', 'no_encontrado', respuesta.valor.rastro)
  }

  const denominacion = denominacionDesdeRespuesta(
    peticion.tipoDocumento,
    cuerpo,
  )
  if (denominacion === undefined) {
    return fallo('rechazo_definitivo', 'no_encontrado', respuesta.valor.rastro)
  }

  return exito({
    denominacion,
    direccion:
      textoOpcional(cuerpo['direccion_completa']) ??
      textoOpcional(cuerpo['direccion']),
    ubigeo: textoOpcional(cuerpo['ubigeo']),
    condicion: textoOpcional(cuerpo['condicion']),
    estadoRegistro: textoOpcional(cuerpo['estado']),
  })
}
