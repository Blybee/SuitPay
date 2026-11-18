import { ResourceTemplate } from '@modelcontextprotocol/server'
import type { McpServer, Variables } from '@modelcontextprotocol/server'
import { buscarProductosPublicados, consultarExistencias } from '../server/mcp/catalogo.ts'
import {
  cotizacionesPendientes,
  obtenerComprobante,
} from '../server/mcp/consultas.ts'
import { bd, COLECCIONES } from '../server/firebase/admin.ts'

export function registrarRecursos(servidor: McpServer): void {
  servidor.registerResource(
    'catalogo',
    'suitpay://catalogo',
    {
      title: 'Catálogo publicado',
      description: 'Versión y cantidad de productos. Sin precios de costo.',
      mimeType: 'application/json',
    },
    async (uri) => contenido(uri.href, await resumenDeCatalogo()),
  )

  servidor.registerResource(
    'inventario',
    new ResourceTemplate('suitpay://inventario/{codigo}', { list: undefined }),
    {
      title: 'Existencia de un código',
      description: 'Cantidad y costo de compra de un código.',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      const codigo = variable(variables, 'codigo')
      const stock = await consultarExistencias({ codigos: [codigo] })
      return contenido(uri.href, stock.existencias[0] ?? null)
    },
  )

  servidor.registerResource(
    'comprobante',
    new ResourceTemplate('suitpay://comprobantes/{id}', { list: undefined }),
    {
      title: 'Comprobante',
      description: 'Un comprobante. El cliente solo trae documento y razón social.',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      const leido = await obtenerComprobante({ id: variable(variables, 'id') })
      return contenido(uri.href, leido.comprobante)
    },
  )

  servidor.registerResource(
    'cotizaciones-pendientes',
    'suitpay://cotizaciones/pendientes',
    {
      title: 'Cotizaciones pendientes',
      description: 'Cotizaciones abiertas, sin teléfono ni dirección.',
      mimeType: 'application/json',
    },
    async (uri) => contenido(uri.href, await cotizacionesPendientes({})),
  )
}

async function resumenDeCatalogo(): Promise<{ version: number; totalProductos: number }> {
  const instantanea = await bd().collection(COLECCIONES.catalogo).doc('actual').get()
  const datos = instantanea.data()
  const productos = datos?.['productos']
  return {
    version: typeof datos?.['version'] === 'number' ? datos['version'] : 0,
    totalProductos: Array.isArray(productos) ? productos.length : 0,
  }
}

function contenido(uri: string, valor: unknown) {
  return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(valor) }] }
}

function variable(variables: Variables, clave: string): string {
  const valor = variables[clave]
  if (typeof valor === 'string') return valor
  return valor?.[0] ?? ''
}
