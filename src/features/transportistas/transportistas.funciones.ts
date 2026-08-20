import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { exigirIdentidad } from '../../server/auth/verificar.ts'
import { ErrorDeSuitPay, esErrorDeSuitPay } from '../../server/errores.ts'
import { consultarContribuyente } from '../../server/contribuyentes/consultar.ts'
import { crearTransportista } from '../../server/transportistas/crear.ts'
import { proveedorActual } from '../../server/proveedor/actual.ts'
import { respuestaDeFalloDeConsulta } from '../clientes/fallo-consulta.ts'

const esquemaCrear = z.object({
  numeroDocumento: z.string().regex(/^\d{11}$/),
  denominacion: z.string().min(1),
  numeroRegistroMtc: z.string().optional(),
  direccion: z.string().optional(),
  consultadoEn: z.string().optional(),
})

export const consultarTransportistaFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      numeroDocumento: z.string().regex(/^\d{11}$/),
    }),
  )
  .handler(async ({ data }) => {
    try {
      await exigirIdentidad(getRequestHeaders(), ['vendedor', 'administrador'])
      const datos = await consultarContribuyente(
        { proveedor: proveedorActual() },
        { tipoDocumento: 'RUC', numeroDocumento: data.numeroDocumento },
      )
      return { ok: true as const, datos }
    } catch (error) {
      return respuestaDeFalloDeConsulta(error)
    }
  })

export const crearTransportistaFn = createServerFn({ method: 'POST' })
  .validator(esquemaCrear)
  .handler(async ({ data }) => {
    try {
      const identidad = await exigirIdentidad(getRequestHeaders(), [
        'vendedor',
        'administrador',
      ])
      const transportista = await crearTransportista(data, identidad.uid)
      return { ok: true as const, transportista }
    } catch (error) {
      if (esErrorDeSuitPay(error)) {
        return { ok: false as const, error: error.aRespuesta() }
      }
      console.error('[SuitPay] fallo al crear transportista', error)
      return {
        ok: false as const,
        error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
      }
    }
  })
