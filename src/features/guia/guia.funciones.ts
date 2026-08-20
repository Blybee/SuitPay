import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { MOTIVOS_DE_TRASLADO, MODOS_DE_TRANSPORTE } from '../../domain/guia/tipos.ts'
import { exigirIdentidad } from '../../server/auth/verificar.ts'
import { ErrorDeSuitPay, esErrorDeSuitPay } from '../../server/errores.ts'
import { AlmacenFirestore } from '../../server/emision/almacen-firestore.ts'
import { emitirGuia } from '../../server/emision/emitir-guia.ts'
import type { RespuestaDeEmitirGuia } from '../../server/emision/emitir-guia.ts'
import { DOCUMENTOS, bd } from '../../server/firebase/admin.ts'
import { proveedorActual } from '../../server/proveedor/actual.ts'

export type { RespuestaDeEmitirGuia }

const esquemaDireccion = z.object({
  ubigeo: z.string().regex(/^\d{6}$/),
  direccion: z.string().min(1),
  anexo: z.string().optional(),
})

const esquemaTraslado = z.object({
  modoTransporte: z.enum(MODOS_DE_TRANSPORTE),
  motivoTraslado: z.enum(MOTIVOS_DE_TRASLADO),
  pesoBruto: z.number().positive(),
  unidadPeso: z.string().min(1),
  numeroBultos: z.number().int().positive(),
  direccionPartida: esquemaDireccion,
  direccionLlegada: esquemaDireccion,
  transportista: z
    .object({
      numeroDocumento: z.string().length(11),
      denominacion: z.string().min(1),
      numeroRegistroMtc: z.string().optional(),
    })
    .optional(),
  conductor: z
    .object({
      tipoDocumento: z.string().min(1),
      numeroDocumento: z.string().min(1),
      nombres: z.string().min(1),
      licencia: z.string().min(1),
      placa: z.string().min(1),
    })
    .optional(),
  items: z
    .array(
      z.object({
        codigo: z.string().min(1),
        cantidad: z.number().positive(),
        descripcion: z.string().min(1),
        unidad: z.string().min(1),
      }),
    )
    .min(1),
})

const esquemaEmitirGuia = z.object({
  claveIdempotencia: z.string().min(8),
  destinatario: z
    .object({
      tipoDocumento: z.string().min(1),
      numeroDocumento: z.string().min(8),
      denominacion: z.string().min(1),
      direccion: z.string().optional(),
    })
    .nullable(),
  traslado: esquemaTraslado,
  comprobanteOrigenId: z.string().nullable(),
})

export interface RespuestaDeGuiaParaCliente {
  readonly ok: boolean
  readonly comprobante?: RespuestaDeEmitirGuia
  readonly error?: ReturnType<ErrorDeSuitPay['aRespuesta']>
}

async function leerFormato(): Promise<'a4' | 'rollo'> {
  const [coleccion, documento] = DOCUMENTOS.parametros.split('/')
  const instantanea = await bd()
    .collection(coleccion ?? 'config')
    .doc(documento ?? 'parametros')
    .get()
  const formato = instantanea.data()?.['formatoImpresionPorDefecto']
  return formato === 'rollo' ? 'rollo' : 'a4'
}

export const emitirGuiaFn = createServerFn({ method: 'POST' })
  .validator(esquemaEmitirGuia)
  .handler(async ({ data }): Promise<RespuestaDeGuiaParaCliente> => {
    const identidad = await exigirIdentidad(getRequestHeaders(), [
      'vendedor',
      'administrador',
    ])
    const formatoImpresion = await leerFormato()

    try {
      const comprobante = await emitirGuia(
        {
          almacen: new AlmacenFirestore(),
          proveedor: proveedorActual(),
          vendedorId: identidad.uid,
          formatoImpresion,
        },
        data,
      )
      return { ok: true, comprobante }
    } catch (error) {
      if (esErrorDeSuitPay(error)) {
        return { ok: false, error: error.aRespuesta() }
      }
      console.error('[SuitPay] fallo inesperado al emitir guía', error)
      return {
        ok: false,
        error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
      }
    }
  })

export const leerIndiceDeTransportistasFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await exigirIdentidad(getRequestHeaders(), [
      'vendedor',
      'administrador',
      'jefe',
    ])
    const [coleccion, id] = DOCUMENTOS.indiceDeTransportistas.split('/')
    const snap = await bd()
      .collection(coleccion ?? 'indices')
      .doc(id ?? 'transportistas')
      .get()
    const lista =
      (snap.data()?.['transportistas'] as
        | Array<{ numeroDocumento: string; denominacion: string }>
        | undefined) ?? []
    return { ok: true as const, transportistas: lista }
  },
)
