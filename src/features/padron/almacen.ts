import { create } from 'zustand'
import { correrImportacion } from '../../domain/padron/correr.ts'
import type {
  ClienteDePadron,
  ResumenDeImportacion,
  TransportistaDePadron,
} from '../../domain/padron/tipos.ts'
import { mostrarNotificacion } from '../notificaciones/almacen.ts'
import { guardarLoteDePadronFn } from './padron.funciones.ts'

export type FaseDeImportacion =
  'ocioso' | 'leyendo' | 'guardando' | 'listo' | 'error'

interface EstadoDeImportacion {
  readonly fase: FaseDeImportacion
  readonly tipo: 'clientes' | 'transportistas' | null
  readonly hecho: number
  readonly total: number
  readonly resumen: ResumenDeImportacion | null
  readonly mensajeError: string | null
  iniciar: (tipo: 'clientes' | 'transportistas', archivo: File) => Promise<void>
}

function etiqueta(tipo: 'clientes' | 'transportistas'): string {
  return tipo === 'clientes' ? 'Clientes' : 'Transportistas'
}

export function textoDeResumen(
  tipo: 'clientes' | 'transportistas',
  resumen: ResumenDeImportacion,
): string {
  return `${etiqueta(tipo)}: ${resumen.nuevos} nuevos, ${resumen.yaExistian} ya existían, ${resumen.descartados} descartados.`
}

function mensajeDeFallo(error: unknown): string {
  if (error instanceof Error && error.message === 'pdf_ilegible') {
    return 'No se pudo leer el PDF. Tiene que traer texto, no solo una imagen.'
  }
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message
  }
  return 'No se pudo importar el PDF.'
}

export const usarImportacionDePadron = create<EstadoDeImportacion>(
  (set, get) => ({
    fase: 'ocioso',
    tipo: null,
    hecho: 0,
    total: 0,
    resumen: null,
    mensajeError: null,

    async iniciar(tipo, archivo) {
      const fase = get().fase
      if (fase === 'leyendo' || fase === 'guardando') return

      set({
        fase: 'leyendo',
        tipo,
        hecho: 0,
        total: 0,
        resumen: null,
        mensajeError: null,
      })

      try {
        const bytes = new Uint8Array(await archivo.arrayBuffer())
        const resumen = await correrImportacion({
          bytes,
          tipo,
          persistirLote: async (filas) => {
            if (filas.length === 0) return { nuevos: 0, yaExistian: 0 }
            const respuesta = await guardarLoteDePadronFn({
              data:
                tipo === 'clientes'
                  ? { tipo: 'clientes', filas: filas as ClienteDePadron[] }
                  : {
                      tipo: 'transportistas',
                      filas: filas as TransportistaDePadron[],
                    },
            })
            if (!respuesta.ok) {
              const motivo = respuesta.error?.detalle?.['motivo']
              if (motivo === 'indice_demasiado_grande') {
                throw new Error(
                  'El índice no cabe en un documento. La importación se detuvo. Vuelve a cargar el mismo PDF: lo ya guardado no se duplica.',
                )
              }
              throw new Error(
                respuesta.error?.mensaje ??
                  'No se pudo guardar el lote. Vuelve a cargar el mismo PDF: lo ya guardado no se duplica.',
              )
            }
            return {
              nuevos: respuesta.nuevos ?? 0,
              yaExistian: respuesta.yaExistian ?? 0,
            }
          },
          alProgreso: (progreso) => {
            set({
              fase: progreso.fase,
              hecho: progreso.hecho,
              total: progreso.total,
            })
          },
          ceder: () =>
            new Promise((resolver) => {
              setTimeout(resolver, 0)
            }),
        })

        set({ fase: 'listo', resumen, mensajeError: null })
        mostrarNotificacion({
          tono: 'exito',
          titulo: 'Importación lista',
          mensaje: textoDeResumen(tipo, resumen),
          duracionMs: 8_000,
        })
      } catch (error) {
        const mensajeError = mensajeDeFallo(error)
        set({ fase: 'error', mensajeError })
        mostrarNotificacion({
          tono: 'error',
          titulo: 'Importación detenida',
          mensaje: mensajeError,
          duracionMs: 8_000,
        })
      }
    },
  }),
)
