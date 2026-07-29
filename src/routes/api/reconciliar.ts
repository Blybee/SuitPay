import { createFileRoute } from '@tanstack/react-router'
import { AlmacenFirestore } from '../../server/emision/almacen-firestore.ts'
import { reconciliarEmisiones } from '../../server/emision/reconciliar.ts'
import { exigirSecretoDeTareas } from '../../server/auth/verificar.ts'
import { esErrorDeSuitPay } from '../../server/errores.ts'
import { proveedorActual } from '../../server/proveedor/actual.ts'

/**
 * La ruta que dispara Cloud Scheduler para reconciliar.
 *
 * No lleva sesión de usuario porque no hay usuario: la autentica un secreto
 * compartido. Y si el secreto no está configurado, la ruta queda **cerrada**, no
 * abierta: un despliegue al que se le olvidó la variable de entorno no puede
 * dejar expuesta una ruta que toca comprobantes.
 *
 * Es idempotente por construcción, así que un disparo duplicado del planificador
 * no hace daño: la tarea nunca emite, solo consulta y adopta estados.
 */
export const Route = createFileRoute('/api/reconciliar')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          exigirSecretoDeTareas(request.headers)
        } catch (error) {
          if (esErrorDeSuitPay(error)) {
            // 404 y no 403: una ruta de tarea programada no debe confirmar su
            // existencia a quien no trae el secreto.
            return new Response('No encontrado', { status: 404 })
          }
          throw error
        }

        const resumen = await reconciliarEmisiones({
          almacen: new AlmacenFirestore(),
          proveedor: proveedorActual(),
        })

        console.info('[SuitPay] reconciliación', resumen)
        return Response.json(resumen)
      },
    },
  },
})
