import { exito, fallo, RASTRO_VACIO } from './interfaz.ts'
import type {
  Contribuyente,
  DocumentoAnulado,
  DocumentoConsultado,
  DocumentoEmitido,
  EstadoNormalizado,
  PeticionDeAnulacion,
  PeticionDeConsulta,
  PeticionDeContribuyente,
  PeticionDeEmision,
  PeticionDeNotaDeCredito,
  ProveedorDeEmision,
  Resultado,
} from './interfaz.ts'

/**
 * Proveedor simulado.
 *
 * Es la pieza sin la cual las pruebas obligatorias de la constitución no se
 * pueden escribir. La constitución exige cubrir **el reintento, la respuesta que
 * no llega y el fallo del proveedor**, que son los tres modos que producen un
 * comprobante duplicado, y ninguno se descubre probando a mano el camino feliz:
 * el reintento hay que provocarlo, la respuesta ausente hay que simularla y el
 * fallo del proveedor hay que inducirlo.
 *
 * Lleva además un registro de lo que se le pidió, que sirve para la afirmación
 * más importante de todas: que ante una segunda invocación con la misma clave de
 * idempotencia **el proveedor no se llamó dos veces**. Sin contar llamadas, esa
 * prueba solo podría comprobar el estado final, y el estado final se puede
 * alcanzar emitiendo dos veces.
 */

export type Comportamiento =
  | { readonly tipo: 'exito'; readonly estado?: EstadoNormalizado }
  | { readonly tipo: 'rechazo_definitivo'; readonly motivo?: string }
  | { readonly tipo: 'indisponible' }
  | { readonly tipo: 'indeterminado' }
  /** La respuesta llega, pero sin nada que permita saber qué pasó. */
  | { readonly tipo: 'respuesta_ambigua' }
  /**
   * Se acepta la emisión pero sin contestar: el proveedor sí registró el
   * documento y nosotros nunca lo supimos. Es el caso más traicionero, porque el
   * documento existe y un reintento lo duplicaría.
   */
  | { readonly tipo: 'acepta_pero_no_contesta' }

export interface RegistroDeLlamada {
  readonly operacion: 'emitir' | 'anular' | 'consultar' | 'contribuyente' | 'nota_credito'
  readonly serie: string | undefined
  readonly numero: number | null | undefined
  readonly momento: Date
}

interface DocumentoDelSimulado {
  readonly serie: string
  readonly numero: number
  estado: EstadoNormalizado
  readonly total: number
  readonly numeroDocumentoCliente: string | undefined
  readonly emitidoEn: Date
}

export class ProveedorSimulado implements ProveedorDeEmision {
  readonly nombre = 'simulado'

  /** Lo que hará la próxima emisión. Se cambia entre pruebas. */
  private comportamientoDeEmision: Comportamiento = { tipo: 'exito' }
  private comportamientoDeAnulacion: Comportamiento = { tipo: 'exito' }
  private comportamientoDeConsulta: Comportamiento = { tipo: 'exito' }
  private comportamientoDeContribuyente: Comportamiento = { tipo: 'exito' }

  /** Cola de comportamientos: el primero se usa una vez y se descarta. */
  private colaDeEmision: Comportamiento[] = []

  private readonly emitidos = new Map<string, DocumentoDelSimulado>()
  private readonly llamadas: RegistroDeLlamada[] = []
  private siguienteNumeroAsignado = 1

  // --- Configuración para las pruebas -------------------------------------

  configurarEmision(comportamiento: Comportamiento): void {
    this.comportamientoDeEmision = comportamiento
  }

  /**
   * Encola comportamientos que se consumen uno por llamada. Es lo que permite
   * probar "falla la primera vez y funciona la segunda", que es la forma del
   * reintento real.
   */
  encolarEmisiones(...comportamientos: readonly Comportamiento[]): void {
    this.colaDeEmision.push(...comportamientos)
  }

  configurarAnulacion(comportamiento: Comportamiento): void {
    this.comportamientoDeAnulacion = comportamiento
  }

  configurarConsulta(comportamiento: Comportamiento): void {
    this.comportamientoDeConsulta = comportamiento
  }

  configurarContribuyente(comportamiento: Comportamiento): void {
    this.comportamientoDeContribuyente = comportamiento
  }

  reiniciar(): void {
    this.comportamientoDeEmision = { tipo: 'exito' }
    this.comportamientoDeAnulacion = { tipo: 'exito' }
    this.comportamientoDeConsulta = { tipo: 'exito' }
    this.comportamientoDeContribuyente = { tipo: 'exito' }
    this.colaDeEmision = []
    this.emitidos.clear()
    this.llamadas.length = 0
    this.siguienteNumeroAsignado = 1
  }

  // --- Observación --------------------------------------------------------

  get historial(): readonly RegistroDeLlamada[] {
    return this.llamadas
  }

  llamadasA(operacion: RegistroDeLlamada['operacion']): number {
    return this.llamadas.filter((cada) => cada.operacion === operacion).length
  }

  /** Cuántos documentos existen de verdad en el proveedor. */
  get documentosEmitidos(): number {
    return this.emitidos.size
  }

  documentoDe(serie: string, numero: number): DocumentoDelSimulado | undefined {
    return this.emitidos.get(`${serie}-${numero}`)
  }

  // --- Operaciones --------------------------------------------------------

  async emitir(
    peticion: PeticionDeEmision,
  ): Promise<Resultado<DocumentoEmitido>> {
    this.llamadas.push({
      operacion: 'emitir',
      serie: peticion.serie,
      numero: peticion.numero,
      momento: new Date(),
    })

    const comportamiento = this.colaDeEmision.shift() ?? this.comportamientoDeEmision
    const numero = peticion.numero ?? this.siguienteNumeroAsignado

    switch (comportamiento.tipo) {
      case 'rechazo_definitivo':
        return fallo(
          'rechazo_definitivo',
          comportamiento.motivo ?? 'documento_invalido',
          {
            ...RASTRO_VACIO,
            codigoOriginal: '2027',
            mensajeOriginal: 'El documento no cumple la estructura exigida',
            estadoHttp: 422,
          },
        )

      case 'indisponible':
        return fallo('indisponible', 'no_se_pudo_contactar', {
          ...RASTRO_VACIO,
          mensajeOriginal: 'fetch failed',
        })

      case 'indeterminado':
        return fallo('indeterminado', 'tiempo_de_espera_agotado', {
          ...RASTRO_VACIO,
          mensajeOriginal: 'The operation was aborted due to timeout',
        })

      case 'respuesta_ambigua':
        // Contestó, pero con algo que no permite decidir. La clasificación
        // conservadora es indeterminado: cuesta una consulta, y equivocarse al
        // contrario cuesta un documento fiscal de más.
        return fallo(
          'indeterminado',
          'respuesta_sin_forma_reconocible',
          {
            ...RASTRO_VACIO,
            cuerpoOriginal: '<html>502 Bad Gateway</html>',
            estadoHttp: 502,
          },
        )

      case 'acepta_pero_no_contesta': {
        // El documento SÍ queda registrado en el proveedor. Nosotros nunca lo
        // sabremos por esta llamada, y por eso la consulta posterior lo
        // encontrará. Es el caso que hace obligatoria la reconciliación.
        this.registrar(peticion, numero, 'registrado')
        return fallo('indeterminado', 'conexion_cortada_tras_enviar', {
          ...RASTRO_VACIO,
          mensajeOriginal: 'socket hang up',
        })
      }

      case 'exito': {
        const estado = comportamiento.estado ?? 'aceptado'
        this.registrar(peticion, numero, estado)
        return exito({
          serie: peticion.serie,
          numero,
          estado,
          archivos: {
            pdf: `https://simulado.invalido/${peticion.serie}-${numero}.pdf`,
            xml: `https://simulado.invalido/${peticion.serie}-${numero}.xml`,
            cdr: `https://simulado.invalido/R-${peticion.serie}-${numero}.zip`,
          },
          referenciaExterna: `sim-${peticion.serie}-${numero}`,
          rastro: { ...RASTRO_VACIO, estadoHttp: 200 },
        })
      }
    }
  }

  private registrar(
    peticion: PeticionDeEmision,
    numero: number,
    estado: EstadoNormalizado,
  ): void {
    const clave = `${peticion.serie}-${numero}`
    this.emitidos.set(clave, {
      serie: peticion.serie,
      numero,
      estado,
      total: peticion.total,
      numeroDocumentoCliente: peticion.cliente?.numeroDocumento,
      emitidoEn: peticion.emitidoEn,
    })
    if (peticion.numero === null) {
      this.siguienteNumeroAsignado = numero + 1
    }
  }

  async anular(
    peticion: PeticionDeAnulacion,
  ): Promise<Resultado<DocumentoAnulado>> {
    this.llamadas.push({
      operacion: 'anular',
      serie: peticion.serie,
      numero: peticion.numero,
      momento: new Date(),
    })

    switch (this.comportamientoDeAnulacion.tipo) {
      case 'rechazo_definitivo':
        return fallo('rechazo_definitivo', 'baja_no_admitida', RASTRO_VACIO)
      case 'indisponible':
        return fallo('indisponible', 'no_se_pudo_contactar', RASTRO_VACIO)
      case 'indeterminado':
      case 'respuesta_ambigua':
      case 'acepta_pero_no_contesta':
        return fallo('indeterminado', 'tiempo_de_espera_agotado', RASTRO_VACIO)
      case 'exito': {
        const documento = this.emitidos.get(`${peticion.serie}-${peticion.numero}`)
        if (documento !== undefined) documento.estado = 'anulado'
        return exito({
          estado: 'anulado',
          referenciaExterna: `sim-baja-${peticion.serie}-${peticion.numero}`,
          rastro: { ...RASTRO_VACIO, estadoHttp: 200 },
        })
      }
    }
  }

  async consultarDocumento(
    peticion: PeticionDeConsulta,
  ): Promise<Resultado<DocumentoConsultado>> {
    this.llamadas.push({
      operacion: 'consultar',
      serie: peticion.serie,
      numero: peticion.numero,
      momento: new Date(),
    })

    switch (this.comportamientoDeConsulta.tipo) {
      case 'indisponible':
        return fallo('indisponible', 'no_se_pudo_contactar', RASTRO_VACIO)
      case 'indeterminado':
      case 'respuesta_ambigua':
      case 'acepta_pero_no_contesta':
        return fallo('indeterminado', 'consulta_sin_respuesta', RASTRO_VACIO)
      case 'rechazo_definitivo':
        return fallo('rechazo_definitivo', 'consulta_invalida', RASTRO_VACIO)
      case 'exito': {
        const documento = this.emitidos.get(`${peticion.serie}-${peticion.numero}`)
        if (documento === undefined) {
          return exito({
            existe: false,
            serie: peticion.serie,
            numero: peticion.numero,
            estado: undefined,
            total: undefined,
            numeroDocumentoCliente: undefined,
            emitidoEn: undefined,
            archivos: { pdf: undefined, xml: undefined, cdr: undefined },
            rastro: { ...RASTRO_VACIO, estadoHttp: 200 },
          })
        }
        return exito({
          existe: true,
          serie: documento.serie,
          numero: documento.numero,
          estado: documento.estado,
          total: documento.total,
          numeroDocumentoCliente: documento.numeroDocumentoCliente,
          emitidoEn: documento.emitidoEn,
          archivos: {
            pdf: `https://simulado.invalido/${documento.serie}-${documento.numero}.pdf`,
            xml: `https://simulado.invalido/${documento.serie}-${documento.numero}.xml`,
            cdr: undefined,
          },
          rastro: { ...RASTRO_VACIO, estadoHttp: 200 },
        })
      }
    }
  }

  async consultarContribuyente(
    peticion: PeticionDeContribuyente,
  ): Promise<Resultado<Contribuyente>> {
    this.llamadas.push({
      operacion: 'contribuyente',
      serie: undefined,
      numero: undefined,
      momento: new Date(),
    })

    switch (this.comportamientoDeContribuyente.tipo) {
      case 'indisponible':
      case 'indeterminado':
      case 'respuesta_ambigua':
      case 'acepta_pero_no_contesta':
        return fallo('indisponible', 'consulta_no_disponible', RASTRO_VACIO)
      case 'rechazo_definitivo':
        return fallo('rechazo_definitivo', 'no_encontrado', RASTRO_VACIO)
      case 'exito':
        return exito({
          denominacion:
            peticion.tipoDocumento === 'RUC'
              ? 'FERRETERIA SIMULADA S.A.C.'
              : 'PEREZ SIMULADO, JUAN',
          direccion: 'AV. SIMULADA 123, LIMA',
          ubigeo: '150101',
          condicion: 'HABIDO',
          estadoRegistro: 'ACTIVO',
        })
    }
  }

  async emitirNotaCredito(
    peticion: PeticionDeNotaDeCredito,
  ): Promise<Resultado<DocumentoEmitido>> {
    this.llamadas.push({
      operacion: 'nota_credito',
      serie: peticion.serie,
      numero: peticion.numero,
      momento: new Date(),
    })

    const numero = peticion.numero ?? this.siguienteNumeroAsignado
    return exito({
      serie: peticion.serie,
      numero,
      estado: 'aceptado',
      archivos: {
        pdf: `https://simulado.invalido/NC-${peticion.serie}-${numero}.pdf`,
        xml: undefined,
        cdr: undefined,
      },
      referenciaExterna: `sim-nc-${peticion.serie}-${numero}`,
      rastro: { ...RASTRO_VACIO, estadoHttp: 200 },
    })
  }
}
