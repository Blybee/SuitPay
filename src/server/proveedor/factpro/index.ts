import {
  exito,
  fallo,
  propagarFallo
  
  
  
  
  
  
  
  
  
  
  
} from '../interfaz.ts'
import type {Contribuyente, DocumentoAnulado, DocumentoConsultado, DocumentoEmitido, PeticionDeAnulacion, PeticionDeConsulta, PeticionDeContribuyente, PeticionDeEmision, PeticionDeNotaDeCredito, ProveedorDeEmision, Resultado} from '../interfaz.ts';
import { consultarDocumento } from './consultar.ts'
import { emitirDocumento } from './emitir.ts'
import { traducirEstado } from './estados.ts'
import {
  leerConfiguracion,
  pedirAlProveedor
  
} from './transporte.ts'
import type {ConfiguracionDelProveedor} from './transporte.ts';

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
const RUTA_DE_CONTRIBUYENTE = '/api/v3/consulta-ruc'
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

    // La baja no es instantánea. Mientras esté en curso se informa el estado
    // anterior a propósito, para que la interfaz **no la presente como cerrada**:
    // decirle al vendedor que ya está anulado cuando todavía puede fallar es peor
    // que hacerle esperar.
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

  async consultarContribuyente(
    peticion: PeticionDeContribuyente,
  ): Promise<Resultado<Contribuyente>> {
    const respuesta = await pedirAlProveedor(
      this.configuracion,
      RUTA_DE_CONTRIBUYENTE,
      { numero: peticion.numeroDocumento, tipo: peticion.tipoDocumento },
    )

    if (!respuesta.ok) return propagarFallo(respuesta.fallo)

    const datos = (
      respuesta.valor.json as {
        data?: {
          nombre?: string
          direccion?: string
          ubigeo?: string
          condicion?: string
          estado?: string
        }
      }
    ).data

    if (datos?.nombre === undefined) {
      return fallo('rechazo_definitivo', 'no_encontrado', respuesta.valor.rastro)
    }

    return exito({
      denominacion: datos.nombre,
      direccion: datos.direccion,
      ubigeo: datos.ubigeo,
      // Alimenta la advertencia de FR-024: hay que poder avisar de que el
      // contribuyente está señalado como no habido **sin impedir facturarle**.
      condicion: datos.condicion,
      estadoRegistro: datos.estado,
    })
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
}
