import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { exigirIdentidad } from '../../server/auth/verificar.ts'
import { ErrorDeSuitPay, esErrorDeSuitPay } from '../../server/errores.ts'
import { AlmacenDeCatalogoFirestore } from '../../server/catalogo/almacen-firestore.ts'
import type { CatalogoPublicado } from '../../server/catalogo/tipos.ts'

export interface RespuestaDeCatalogoPublicado {
  readonly ok: boolean
  readonly catalogo?: CatalogoPublicado | null
  readonly error?: ReturnType<ErrorDeSuitPay['aRespuesta']>
}

export const leerCatalogoPublicadoFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<RespuestaDeCatalogoPublicado> => {
    try {
      await exigirIdentidad(getRequestHeaders(), [
        'administrador',
        'jefe',
      ])
      const catalogo = await new AlmacenDeCatalogoFirestore().leerPublicado()
      return { ok: true, catalogo }
    } catch (error) {
      if (esErrorDeSuitPay(error)) {
        return { ok: false, error: error.aRespuesta() }
      }
      console.error('[SuitPay] fallo al leer catálogo publicado', error)
      return {
        ok: false,
        error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
      }
    }
  },
)
