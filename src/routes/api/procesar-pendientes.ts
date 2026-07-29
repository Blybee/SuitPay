import { createFileRoute } from '@tanstack/react-router'
import { AlmacenFirestore } from '../../server/emision/almacen-firestore.ts'
import { procesarPendientes } from '../../server/emision/pendientes.ts'
import { exigirSecretoDeTareas } from '../../server/auth/verificar.ts'
import { esErrorDeSuitPay } from '../../server/errores.ts'
import { proveedorActual } from '../../server/proveedor/actual.ts'

/**
 * La ruta que completa las ventas que quedaron esperando.
 *
 * A diferencia de la reconciliación, **esta sí emite**, y por eso su protección
 * importa más: es el único otro camino por el que se invoca al proveedor. Lo hace
 * únicamente sobre comprobantes en estado `pendiente`, donde consta que no se
 * emitió nada, y reutilizando el correlativo que ya se había reservado.
 */
export const Route = createFileRoute('/api/procesar-pendientes')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          exigirSecretoDeTareas(request.headers)
        } catch (error) {
          if (esErrorDeSuitPay(error)) {
            return new Response('No encontrado', { status: 404 })
          }
          throw error
        }

        const resumen = await procesarPendientes({
          almacen: new AlmacenFirestore(),
          proveedor: proveedorActual(),
          formatoImpresion: 'a4',
        })

        console.info('[SuitPay] pendientes procesados', resumen)
        return Response.json(resumen)
      },
    },
  },
})
