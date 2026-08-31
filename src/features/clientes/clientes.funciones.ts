import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import {
  esquemaDeCliente,
  numeroDeDocumentoIdentidad,
} from '../../domain/esquemas/comunes.ts'
import { exigirIdentidad } from '../../server/auth/verificar.ts'
import { ErrorDeSuitPay, esErrorDeSuitPay } from '../../server/errores.ts'
import { consultarContribuyente } from '../../server/contribuyentes/consultar.ts'
import type { DatosDeContribuyenteParaRevision } from '../../server/contribuyentes/consultar.ts'
import { actualizarCliente } from '../../server/clientes/actualizar.ts'
import type { ClienteActualizado } from '../../server/clientes/actualizar.ts'
import { crearCliente } from '../../server/clientes/crear.ts'
import type { ClienteCreado } from '../../server/clientes/crear.ts'
import { proveedorActual } from '../../server/proveedor/actual.ts'
import { respuestaDeFalloDeConsulta } from './fallo-consulta.ts'

export type { DatosDeContribuyenteParaRevision } from '../../server/contribuyentes/consultar.ts'
export type { ClienteCreado } from '../../server/clientes/crear.ts'
export type { ClienteActualizado } from '../../server/clientes/actualizar.ts'

const esquemaConsulta = z.object({
  tipoDocumento: z.enum(['DNI', 'RUC']),
  numeroDocumento: numeroDeDocumentoIdentidad,
})

const esquemaCrear = esquemaDeCliente.extend({
  consultadoEn: z.string().optional(),
})

export interface RespuestaDeConsultaContribuyente {
  readonly ok: boolean
  readonly datos?: DatosDeContribuyenteParaRevision
  readonly error?: ReturnType<ErrorDeSuitPay['aRespuesta']>
}

export interface RespuestaDeCrearCliente {
  readonly ok: boolean
  readonly cliente?: ClienteCreado
  readonly error?: ReturnType<ErrorDeSuitPay['aRespuesta']>
}

export interface RespuestaDeActualizarCliente {
  readonly ok: boolean
  readonly cliente?: ClienteActualizado
  readonly error?: ReturnType<ErrorDeSuitPay['aRespuesta']>
}

export const consultarContribuyenteFn = createServerFn({ method: 'POST' })
  .validator(esquemaConsulta)
  .handler(async ({ data }): Promise<RespuestaDeConsultaContribuyente> => {
    try {
      await exigirIdentidad(getRequestHeaders(), ['vendedor', 'administrador'])
      const datos = await consultarContribuyente(
        { proveedor: proveedorActual() },
        data,
      )
      return { ok: true, datos }
    } catch (error) {
      return respuestaDeFalloDeConsulta(error)
    }
  })

export const crearClienteFn = createServerFn({ method: 'POST' })
  .validator(esquemaCrear)
  .handler(async ({ data }): Promise<RespuestaDeCrearCliente> => {
    try {
      const identidad = await exigirIdentidad(getRequestHeaders(), [
        'vendedor',
        'administrador',
      ])
      const cliente = await crearCliente(data, identidad.uid)
      return { ok: true, cliente }
    } catch (error) {
      if (esErrorDeSuitPay(error)) {
        return { ok: false, error: error.aRespuesta() }
      }
      console.error('[SuitPay] fallo al crear cliente', error)
      return {
        ok: false,
        error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
      }
    }
  })

const esquemaActualizar = esquemaDeCliente
  .pick({
    tipoDocumento: true,
    numeroDocumento: true,
    denominacion: true,
    direccion: true,
    ubigeo: true,
    condicion: true,
  })
  .extend({
    instruccionesCotizacion: z
      .array(z.string().trim().min(1).max(500))
      .max(20)
      .optional(),
  })

export const actualizarClienteFn = createServerFn({ method: 'POST' })
  .validator(esquemaActualizar)
  .handler(async ({ data }): Promise<RespuestaDeActualizarCliente> => {
    try {
      await exigirIdentidad(getRequestHeaders(), ['vendedor', 'administrador'])
      const cliente = await actualizarCliente(data)
      return { ok: true, cliente }
    } catch (error) {
      if (esErrorDeSuitPay(error)) {
        return { ok: false, error: error.aRespuesta() }
      }
      console.error('[SuitPay] fallo al actualizar cliente', error)
      return {
        ok: false,
        error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
      }
    }
  })
