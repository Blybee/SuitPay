import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { TIPOS_ELEGIBLES } from '../../domain/documentos/tipos.ts'
import { exigirIdentidad } from '../../server/auth/verificar.ts'
import { COLECCIONES, DOCUMENTOS, bd } from '../../server/firebase/admin.ts'
import { ErrorDeSuitPay, esErrorDeSuitPay, fallar } from '../../server/errores.ts'
import { proveedorActual } from '../../server/proveedor/actual.ts'
import { AlmacenFirestore } from '../../server/emision/almacen-firestore.ts'
import { anularComprobante } from '../../server/emision/anular.ts'
import type { RespuestaDeAnular } from '../../server/emision/anular.ts'
import { emitirComprobante } from '../../server/emision/emitir.ts'
import type { RespuestaDeEmitir } from '../../server/emision/emitir.ts'
import { consultarEstadoEmision } from '../../server/emision/consultar-estado.ts'
import type { ResultadoDeConsultaDeEstado } from '../../server/emision/consultar-estado.ts'
import type { Comprobante } from '../../server/emision/almacen.ts'

/**
 * El punto de entrada de la emisión desde el cliente.
 *
 * ## Por qué este archivo vive en `features/` y no en `server/`
 *
 * Parece que debería estar junto al resto de la emisión, y el linter demostró que
 * no: la frontera prohíbe que el cliente importe nada bajo `src/server/`, así que
 * un archivo de puerta colocado ahí dentro sería imposible de abrir desde la
 * pantalla. La puerta tiene que estar del lado del cliente y ser **ella** la que
 * alcanza el servidor.
 *
 * De ahí el nombre: `*.funciones.ts` es el único patrón al que la frontera concede
 * permiso para importar `src/server/`. El compilador de Start le quita el cuerpo al
 * construir el paquete del navegador, de modo que nada privilegiado viaja.
 *
 * ## Lo que se hace aquí y no en `emitir.ts`
 *
 * Solo dos cosas: **verificar quién llama** y **construir el contexto**. La lógica
 * de emisión no sabe nada de HTTP ni de Firestore, y eso es lo que permite
 * probarla sin emuladores.
 *
 * La identidad se toma **del token verificado y nunca de la petición** (principio
 * I, FR-003). Nótese que `vendedorId` no aparece en el esquema de entrada: si
 * estuviera, un cliente manipulado podría emitir en nombre de otra persona, y la
 * atribución que exige FR-027 sería decorativa.
 */

/**
 * La puerta también reexporta los tipos de la respuesta.
 *
 * Un tipo se borra al compilar y no puede filtrar nada, pero la frontera no
 * inspecciona intenciones: prohíbe la ruta. Y está bien que lo haga, porque un
 * `import type` se convierte en un import normal con quitar una palabra. Que la
 * pantalla los reciba desde aquí mantiene una sola ruta hacia el servidor.
 */
export type { RespuestaDeEmitir } from '../../server/emision/emitir.ts'
export type { RespuestaDeAnular } from '../../server/emision/anular.ts'
export type { CodigoDeError } from '../../server/errores.ts'
export type { Comprobante } from '../../server/emision/almacen.ts'

const esquemaDeLinea = z.object({
  codigo: z.string().min(1),
  descripcion: z.string().min(1),
  unidad: z.string().min(1),
  cantidad: z.number().positive().finite(),
  precio: z.number().int().positive(),
})

const esquemaDeEmision = z.object({
  claveIdempotencia: z.string().min(8),
  tipoDocumento: z.enum(TIPOS_ELEGIBLES),
  cliente: z
    .object({
      tipoDocumento: z.string().min(1),
      numeroDocumento: z.string().min(8),
      denominacion: z.string().min(1),
      direccion: z.string().optional(),
    })
    .nullable(),
  lineas: z.array(esquemaDeLinea).min(1),
  condicionPago: z.object({
    tipo: z.enum(['contado', 'credito']),
    fechaVencimiento: z.string().optional(),
  }),
  medioPago: z
    .object({ medio: z.string().min(1), montoRecibido: z.number().int() })
    .nullable(),
  cotizacionId: z.string().nullable(),
  capturaId: z.string().nullable(),
  totalDeclarado: z.number().int().optional(),
})

interface ParametrosDelSistema {
  readonly umbralIdentificacionBoleta: number
  readonly formatoImpresionPorDefecto: 'a4' | 'rollo'
}

/**
 * Lee los parámetros de `config/parametros`.
 *
 * Es **una lectura por emisión**, y es deliberado: el umbral es de origen
 * regulatorio y tiene que poder cambiarse sin desplegar. Cachearlo en memoria del
 * proceso ahorraría esa lectura pero haría que un cambio de norma tardara en
 * surtir efecto un tiempo impredecible, distinto en cada instancia. Para una
 * cifra con consecuencias legales, la lectura vale lo que cuesta.
 */
async function leerParametros(): Promise<ParametrosDelSistema> {
  const [coleccion, documento] = DOCUMENTOS.parametros.split('/')
  const instantanea = await bd()
    .collection(coleccion ?? COLECCIONES.config)
    .doc(documento ?? 'parametros')
    .get()

  const datos = instantanea.data() ?? {}
  return {
    umbralIdentificacionBoleta: datos['umbralIdentificacionBoleta'] ?? 70_000,
    formatoImpresionPorDefecto: datos['formatoImpresionPorDefecto'] ?? 'a4',
  }
}

export interface RespuestaDeEmisionParaCliente {
  readonly ok: boolean
  readonly comprobante?: RespuestaDeEmitir
  readonly error?: ReturnType<ErrorDeSuitPay['aRespuesta']>
}

export const emitir = createServerFn({ method: 'POST' })
  .validator(esquemaDeEmision)
  .handler(async ({ data }): Promise<RespuestaDeEmisionParaCliente> => {
    const identidad = await exigirIdentidad(getRequestHeaders(), [
      'vendedor',
      'administrador',
    ])

    const parametros = await leerParametros()

    try {
      const comprobante = await emitirComprobante(
        {
          almacen: new AlmacenFirestore(),
          proveedor: proveedorActual(),
          vendedorId: identidad.uid,
          umbralIdentificacion: parametros.umbralIdentificacionBoleta,
          formatoImpresion: parametros.formatoImpresionPorDefecto,
        },
        { ...data, cliente: data.cliente ?? null },
      )
      return { ok: true, comprobante }
    } catch (error) {
      // Los errores conocidos viajan como datos y no como excepción, para que el
      // cliente pueda distinguir `emision_indeterminada` de un fallo de red. Si
      // llegaran como una excepción genérica, la interfaz no podría saber que
      // **no debe ofrecer reintentar**, que es lo único que no puede fallar.
      if (esErrorDeSuitPay(error)) {
        return { ok: false, error: error.aRespuesta() }
      }
      console.error('[SuitPay] fallo inesperado al emitir', error)
      return {
        ok: false,
        error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
      }
    }
  })

/**
 * Lee un comprobante ya emitido. Sirve para la reimpresión y para consultar el
 * estado de una venta que quedó en verificación.
 *
 * Un vendedor solo puede leer los suyos; un administrador, cualquiera. La
 * comprobación es aquí y no en las reglas porque el Admin SDK las salta.
 */
export const leerComprobante = createServerFn({ method: 'GET' })
  .validator(z.object({ comprobanteId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const identidad = await exigirIdentidad(getRequestHeaders(), [
      'vendedor',
      'administrador',
      'jefe',
    ])

    const comprobante = await new AlmacenFirestore().leerComprobante(
      data.comprobanteId,
    )

    if (comprobante === undefined) {
      fallar('comprobante_no_encontrado')
    }

    if (
      identidad.rol === 'vendedor' &&
      comprobante.vendedorId !== identidad.uid
    ) {
      fallar('comprobante_no_encontrado')
    }

    return comprobante
  })

export interface RespuestaDeConsultaParaCliente {
  readonly ok: boolean
  readonly resultado?: ResultadoDeConsultaDeEstado
  readonly error?: ReturnType<ErrorDeSuitPay['aRespuesta']>
}

/**
 * Consulta bajo demanda (decisión 10). Nunca emite.
 */
export const consultarEstado = createServerFn({ method: 'POST' })
  .validator(z.object({ comprobanteId: z.string().min(1) }))
  .handler(async ({ data }): Promise<RespuestaDeConsultaParaCliente> => {
    const identidad = await exigirIdentidad(getRequestHeaders(), [
      'vendedor',
      'administrador',
    ])

    const almacen = new AlmacenFirestore()
    const previo = await almacen.leerComprobante(data.comprobanteId)
    if (previo === undefined) {
      fallar('comprobante_no_encontrado')
    }
    if (identidad.rol === 'vendedor' && previo.vendedorId !== identidad.uid) {
      fallar('comprobante_no_encontrado')
    }

    try {
      const resultado = await consultarEstadoEmision(
        { almacen, proveedor: proveedorActual() },
        data.comprobanteId,
      )
      return { ok: true, resultado }
    } catch (error) {
      if (esErrorDeSuitPay(error)) {
        return { ok: false, error: error.aRespuesta() }
      }
      console.error('[SuitPay] fallo al consultar estado', error)
      return {
        ok: false,
        error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
      }
    }
  })

export interface RespuestaDeAnulacionParaCliente {
  readonly ok: boolean
  readonly resultado?: RespuestaDeAnular
  readonly error?: ReturnType<ErrorDeSuitPay['aRespuesta']>
}

/** Anulación con confirmación explícita (US4). Autor = uid del token. */
export const anular = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      comprobanteId: z.string().min(1),
      motivo: z.string().trim().min(4).max(300),
    }),
  )
  .handler(async ({ data }): Promise<RespuestaDeAnulacionParaCliente> => {
    const identidad = await exigirIdentidad(getRequestHeaders(), [
      'vendedor',
      'administrador',
    ])

    try {
      const resultado = await anularComprobante(
        {
          almacen: new AlmacenFirestore(),
          proveedor: proveedorActual(),
        },
        {
          comprobanteId: data.comprobanteId,
          motivo: data.motivo,
          autorId: identidad.uid,
        },
      )
      return { ok: true, resultado }
    } catch (error) {
      if (esErrorDeSuitPay(error)) {
        return { ok: false, error: error.aRespuesta() }
      }
      console.error('[SuitPay] fallo inesperado al anular', error)
      return {
        ok: false,
        error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
      }
    }
  })

export interface RespuestaDeListadoParaCliente {
  readonly ok: boolean
  readonly items?: readonly Comprobante[]
  readonly hayMas?: boolean
  readonly error?: ReturnType<ErrorDeSuitPay['aRespuesta']>
}

/** Listado con cursor (nunca offset). Vendedor: solo los suyos. */
export const listarComprobantes = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      limite: z.number().int().min(1).max(50).optional(),
      cursorId: z.string().min(1).optional(),
      cursorEmitidoEn: z.string().datetime().optional(),
    }),
  )
  .handler(async ({ data }): Promise<RespuestaDeListadoParaCliente> => {
    const identidad = await exigirIdentidad(getRequestHeaders(), [
      'vendedor',
      'administrador',
      'jefe',
    ])

    const vendedorId = identidad.rol === 'vendedor' ? identidad.uid : null

    try {
      const pagina = await new AlmacenFirestore().listarComprobantes({
        vendedorId,
        limite: data.limite ?? 20,
        cursorId: data.cursorId,
        cursorEmitidoEn:
          data.cursorEmitidoEn === undefined
            ? undefined
            : new Date(data.cursorEmitidoEn),
      })
      return { ok: true, items: pagina.items, hayMas: pagina.hayMas }
    } catch (error) {
      console.error('[SuitPay] fallo al listar comprobantes', error)
      return {
        ok: false,
        error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
      }
    }
  })
