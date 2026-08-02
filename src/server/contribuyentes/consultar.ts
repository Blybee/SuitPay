import { fallar } from '../errores.ts'
import type { ProveedorDeEmision } from '../proveedor/interfaz.ts'

/**
 * Consulta de contribuyente para revisión del vendedor.
 *
 * **No crea el cliente** (principio I / FR-023). Solo trae datos oficiales
 * para que el vendedor confirme. Señaliza explícitamente la condición de no
 * habido (FR-024).
 */

export interface PeticionDeConsultaDeContribuyente {
  readonly tipoDocumento: 'DNI' | 'RUC'
  readonly numeroDocumento: string
}

export interface DatosDeContribuyenteParaRevision {
  readonly tipoDocumento: 'DNI' | 'RUC'
  readonly numeroDocumento: string
  readonly denominacion: string
  readonly direccion: string | undefined
  readonly ubigeo: string | undefined
  readonly condicion: string | undefined
  readonly estadoRegistro: string | undefined
  /** FR-024: advertencia visible; la decisión queda al vendedor. */
  readonly noHabido: boolean
}

export interface ContextoDeConsultaDeContribuyente {
  readonly proveedor: ProveedorDeEmision
}

function esNoHabido(condicion: string | undefined): boolean {
  if (condicion === undefined) return false
  return condicion.toUpperCase().includes('NO HABIDO')
}

export async function consultarContribuyente(
  contexto: ContextoDeConsultaDeContribuyente,
  peticion: PeticionDeConsultaDeContribuyente,
): Promise<DatosDeContribuyenteParaRevision> {
  const resultado = await contexto.proveedor.consultarContribuyente({
    tipoDocumento: peticion.tipoDocumento,
    numeroDocumento: peticion.numeroDocumento,
  })

  if (!resultado.ok) {
    const { clase, razon, rastro } = resultado.fallo
    // 401/403 del host de consultas ≠ «RUC inexistente»: el token de
    // facturación puede ser válido y aun así rechazarse en consultas.
    if (
      clase === 'indisponible' ||
      razon.startsWith('credenciales_rechazadas')
    ) {
      console.error('[SuitPay] consulta contribuyente no disponible', {
        clase,
        razon,
        estadoHttp: rastro.estadoHttp,
        mensajeOriginal: rastro.mensajeOriginal,
      })
      fallar('servicio_no_disponible')
    }
    console.error('[SuitPay] contribuyente no encontrado', {
      razon,
      estadoHttp: rastro.estadoHttp,
      mensajeOriginal: rastro.mensajeOriginal,
    })
    fallar('no_encontrado', { numeroDocumento: peticion.numeroDocumento })
  }

  const datos = resultado.valor
  return {
    tipoDocumento: peticion.tipoDocumento,
    numeroDocumento: peticion.numeroDocumento,
    denominacion: datos.denominacion,
    direccion: datos.direccion,
    ubigeo: datos.ubigeo,
    condicion: datos.condicion,
    estadoRegistro: datos.estadoRegistro,
    noHabido: esNoHabido(datos.condicion),
  }
}
