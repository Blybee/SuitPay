import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { resumenDeVentas } from '../../server/ventas/resumen-periodo.ts'

const puesto = z
  .object({
    totalCentimos: z
      .number()
      .int()
      .describe('Suma con IGV incluido, en céntimos.'),
    cantidad: z.number().int().describe('Cantidad de ítems de ese puesto.'),
  })
  .strict()

export const esquemaDeResumenDeVentas = z
  .object({
    periodo: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .describe('Mes civil en America/Lima, formato AAAA-MM.'),
  })
  .strict()

const esquemaDeSalida = z
  .object({
    periodo: z.string().describe('Mes consultado, AAAA-MM.'),
    totalCentimos: z
      .number()
      .int()
      .describe('Total del mes con IGV incluido, en céntimos.'),
    cantidad: z.number().int().describe('Comprobantes que entran en el total.'),
    ticketPromedioCentimos: z
      .number()
      .int()
      .describe('totalCentimos dividido entre cantidad, redondeado.'),
    ventasSinResolver: z
      .number()
      .int()
      .describe(
        'Boletas, facturas o notas de venta aún en estado indeterminado. Si es mayor que cero, el mes no se guarda.',
      ),
    porTipo: z
      .array(
        puesto
          .extend({
            tipo: z
              .enum(['boleta', 'factura', 'nota_venta'])
              .describe('Tipo de comprobante de venta.'),
          })
          .strict(),
      )
      .describe('Mezcla de boleta, factura y nota de venta.'),
    topVendedores: z
      .array(
        puesto
          .extend({
            vendedorId: z.string().describe('Uid del vendedor.'),
          })
          .strict(),
      )
      .describe('Hasta cinco vendedores, de mayor a menor total.'),
    topClientes: z
      .array(
        puesto
          .extend({
            numeroDocumento: z
              .string()
              .describe('RUC, DNI o la clave eventual.'),
            denominacion: z.string().describe('Razón social o nombre.'),
          })
          .strict(),
      )
      .describe(
        'Hasta cinco clientes, de mayor a menor total. Incluye documento y razón social. Sin dirección, teléfono ni correo.',
      ),
    topProductos: z
      .array(
        puesto
          .extend({
            codigo: z.string().describe('Código del producto.'),
            descripcion: z.string().describe('Descripción del producto.'),
          })
          .strict(),
      )
      .describe('Hasta cinco productos según el importe de la línea, con IGV.'),
  })
  .strict()

export function registrarResumenDeVentas(servidor: McpServer): void {
  servidor.registerTool(
    'resumen_ventas',
    {
      title: 'Resumen de ventas',
      description:
        'Resume un mes de ventas en America/Lima. Incluye boleta, factura y nota de venta. Excluye anulados, rechazados, indeterminados e internos de contingencia. Los montos ya incluyen IGV y están en céntimos. El top de clientes incluye documento y razón social.',
      inputSchema: esquemaDeResumenDeVentas,
      outputSchema: esquemaDeSalida,
      annotations: { readOnlyHint: true },
    },
    async ({ periodo }) => {
      const resumen = await resumenDeVentas({ periodo })
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
        content: [{ type: 'text', text: JSON.stringify(salida) }],
        structuredContent: salida,
      }
    },
  )
}
