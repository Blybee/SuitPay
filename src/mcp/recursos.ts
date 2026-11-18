import { ResourceTemplate } from '@modelcontextprotocol/server'
import type { McpServer, Variables } from '@modelcontextprotocol/server'
import { resumenDeVentas } from '../server/ventas/resumen-periodo.ts'

export function registrarRecursoDeVentas(servidor: McpServer): void {
  servidor.registerResource(
    'resumen-ventas',
    new ResourceTemplate('suitpay://ventas/{periodo}', { list: undefined }),
    {
      title: 'Resumen de ventas',
      description:
        'Resumen de un mes AAAA-MM. Incluye documento y razón social. No incluye teléfono ni dirección.',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      const resumen = await resumenDeVentas({ periodo: variable(variables, 'periodo') })
      const salida = {
        periodo: resumen.periodo,
        totalCentimos: resumen.totalCentimos,
        cantidad: resumen.cantidad,
        ticketPromedioCentimos: resumen.ticketPromedioCentimos,
        ventasSinResolver: resumen.ventasSinResolver,
        porTipo: resumen.porTipo,
        topVendedores: resumen.topVendedores,
        topClientes: resumen.topClientes,
        topProductos: resumen.topProductos,
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(salida),
          },
        ],
      }
    },
  )
}

function variable(variables: Variables, clave: string): string {
  const valor = variables[clave]
  if (typeof valor === 'string') return valor
  return valor?.[0] ?? ''
}
