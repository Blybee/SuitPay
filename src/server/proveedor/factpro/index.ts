import {
  exito,
  fallo,
  propagarFallo,
} from '../interfaz.ts'
import type {
  Contribuyente,
  DocumentoAnulado,
  DocumentoConsultado,
  DocumentoEmitido,
  Establecimiento,
  PeticionDeAnulacion,
  PeticionDeConsulta,
  PeticionDeContribuyente,
  PeticionDeCrearEstablecimiento,
  PeticionDeCrearSerieEnProveedor,
  PeticionDeEmision,
  PeticionDeNotaDeCredito,
  ProveedorDeEmision,
  Resultado,
  SerieEnProveedor,
} from '../interfaz.ts'
import { consultarDocumento } from './consultar.ts'
import { consultarContribuyenteEnProveedor } from './contribuyentes.ts'
import {
  crearEstablecimiento as crearEstablecimientoEnApi,
  eliminarEstablecimiento as eliminarEstablecimientoEnApi,
  listarEstablecimientos as listarEstablecimientosEnApi,
} from './establecimientos.ts'
import { emitirDocumento } from './emitir.ts'
import { traducirEstado } from './estados.ts'
import {
  crearSerie as crearSerieEnApi,
  eliminarSerie as eliminarSerieEnApi,
} from './series-config.ts'
import {
  leerConfiguracion,
  pedirAlProveedor,
} from './transporte.ts'
import type { ConfiguracionDelProveedor } from './transporte.ts'

/**
 * El adaptador del proveedor, ensamblado.
 *
 * **Éste es el único archivo del sistema que sabe qué proveedor se usa.** Todo lo
 * que hay debajo de `factpro/` habla su vocabulario; todo lo que hay por encima
 * habla el de SuitPay. Cambiar de proveedor es escribir otra carpeta hermana y
 * cambiar la línea que construye este objeto.
 *
 * La comprobación de que la frontera es real es buscar el nombre del proveedor en
 * el repositorio y no encontrarlo fuera de `src/server/proveedor/`. El linter lo
 * impone para los imports.
 */

const RUTA_DE_BAJA = '/api/v3/anulaciones'
const RUTA_DE_NOTA_CREDITO = '/api/v3/notas'

export class ProveedorFactpro implements ProveedorDeEmision {
  readonly nombre = 'factpro'

  private readonly configuracion: ConfiguracionDelProveedor

  constructor(configuracion?: ConfiguracionDelProveedor) {
    this.configuracion = configuracion ?? leerConfiguracion()
  }

  emitir(peticion: PeticionDeEmision): Promise<Resultado<DocumentoEmitido>> {
    return emitirDocumento(this.configuracion, peticion)
  }

  consultarDocumento(
    peticion: PeticionDeConsulta,
  ): Promise<Resultado<DocumentoConsultado>> {
    return consultarDocumento(this.configuracion, peticion)
  }

  async anular(
    peticion: PeticionDeAnulacion,
  ): Promise<Resultado<DocumentoAnulado>> {
    const respuesta = await pedirAlProveedor(this.configuracion, RUTA_DE_BAJA, {
      serie: peticion.serie,
      numero: String(peticion.numero),
      motivo: peticion.motivo,
      fecha_emision: peticion.emitidoEn.toISOString(),
    })

    if (!respuesta.ok) return propagarFallo(respuesta.fallo)

    const datos = (
      respuesta.valor.json as { data?: { estado?: string; external_id?: string } }
    ).data

    const traducido = traducirEstado(datos?.estado)

    if (traducido.anulacionEnCurso) {
      return exito({
        estado: 'aceptado',
        referenciaExterna: datos?.external_id,
        rastro: respuesta.valor.rastro,
      })
    }

    if (traducido.estado === undefined) {
      return fallo(
        'indeterminado',
        `estado_de_baja_desconocido_${datos?.estado ?? 'ausente'}`,
        respuesta.valor.rastro,
      )
    }

    return exito({
      estado: traducido.estado,
      referenciaExterna: datos?.external_id,
      rastro: respuesta.valor.rastro,
    })
  }

  consultarContribuyente(
    peticion: PeticionDeContribuyente,
  ): Promise<Resultado<Contribuyente>> {
    return consultarContribuyenteEnProveedor(this.configuracion, peticion)
  }

  async emitirNotaCredito(
    peticion: PeticionDeNotaDeCredito,
  ): Promise<Resultado<DocumentoEmitido>> {
    const respuesta = await pedirAlProveedor(
      this.configuracion,
      RUTA_DE_NOTA_CREDITO,
      {
        serie: peticion.serie,
        numero: peticion.numero === null ? '#' : String(peticion.numero),
        motivo: peticion.motivo,
        documento_referencia: {
          serie: peticion.documentoDeReferencia.serie,
          numero: String(peticion.documentoDeReferencia.numero),
        },
        total: (peticion.total / 100).toFixed(2),
        fecha_emision: peticion.emitidoEn.toISOString(),
      },
    )

    if (!respuesta.ok) return propagarFallo(respuesta.fallo)

    const datos = (
      respuesta.valor.json as {
        data?: {
          serie?: string
          numero?: string | number
          estado?: string
          external_id?: string
          enlace_pdf?: string
        }
      }
    ).data

    const traducido = traducirEstado(datos?.estado)
    if (traducido.estado === undefined || datos === undefined) {
      return fallo('indeterminado', 'nota_sin_estado', respuesta.valor.rastro)
    }

    const numero =
      typeof datos.numero === 'number'
        ? datos.numero
        : Number.parseInt(String(datos.numero ?? ''), 10)

    if (!Number.isFinite(numero)) {
      return fallo('indeterminado', 'nota_sin_numero', respuesta.valor.rastro)
    }

    return exito({
      serie: datos.serie ?? peticion.serie,
      numero,
      estado: traducido.estado,
      archivos: { pdf: datos.enlace_pdf, xml: undefined, cdr: undefined },
      referenciaExterna: datos.external_id,
      rastro: respuesta.valor.rastro,
    })
  }

  crearEstablecimiento(
    peticion: PeticionDeCrearEstablecimiento,
  ): Promise<Resultado<Establecimiento>> {
    return crearEstablecimientoEnApi(this.configuracion, peticion)
  }

  listarEstablecimientos(): Promise<Resultado<readonly Establecimiento[]>> {
    return listarEstablecimientosEnApi(this.configuracion)
  }

  eliminarEstablecimiento(
    establecimientoId: string,
  ): Promise<Resultado<{ readonly eliminado: true }>> {
    return eliminarEstablecimientoEnApi(this.configuracion, establecimientoId)
  }

  crearSerie(
    peticion: PeticionDeCrearSerieEnProveedor,
  ): Promise<Resultado<SerieEnProveedor>> {
    return crearSerieEnApi(this.configuracion, peticion)
  }

  eliminarSerie(
    serieIdEnProveedor: string,
  ): Promise<Resultado<{ readonly eliminado: true }>> {
    return eliminarSerieEnApi(this.configuracion, serieIdEnProveedor)
  }
}
