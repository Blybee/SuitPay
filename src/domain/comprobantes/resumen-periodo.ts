const TIPOS_DE_VENTA = ['boleta', 'factura', 'nota_venta'] as const
const ESTADOS_FUERA = new Set(['anulado', 'rechazado', 'indeterminado'])
const TOPE = 5

export type TipoDeVenta = (typeof TIPOS_DE_VENTA)[number]

export interface FilaDeVenta {
  readonly tipoDocumento: string
  readonly estado: string
  readonly total: number
  readonly vendedorId: string
  readonly cliente: {
    readonly numeroDocumento: string
    readonly denominacion: string
  } | null
  readonly anulacion: unknown
  readonly lineas: readonly {
    readonly codigo: string
    readonly descripcion: string
    readonly importe: number
  }[]
}

export interface PuestoPorTipo {
  readonly tipo: TipoDeVenta
  readonly totalCentimos: number
  readonly cantidad: number
}

export interface PuestoDeVendedor {
  readonly vendedorId: string
  readonly totalCentimos: number
  readonly cantidad: number
}

export interface PuestoDeCliente {
  readonly numeroDocumento: string
  readonly denominacion: string
  readonly totalCentimos: number
  readonly cantidad: number
}

export interface PuestoDeProducto {
  readonly codigo: string
  readonly descripcion: string
  readonly totalCentimos: number
  readonly cantidad: number
}

export interface ResumenDePeriodo {
  readonly periodo: string
  readonly totalCentimos: number
  readonly cantidad: number
  readonly ticketPromedioCentimos: number
  /** Boletas, facturas o notas de venta cuyo estado sigue en `indeterminado`. */
  readonly ventasSinResolver: number
  readonly porTipo: readonly PuestoPorTipo[]
  readonly topVendedores: readonly PuestoDeVendedor[]
  readonly topClientes: readonly PuestoDeCliente[]
  readonly topProductos: readonly PuestoDeProducto[]
}

interface Acumulado {
  total: number
  cantidad: number
  etiqueta: string
}

function esTipoDeVenta(tipo: string): tipo is TipoDeVenta {
  return (TIPOS_DE_VENTA as readonly string[]).includes(tipo)
}

function sumaVenta(fila: FilaDeVenta): boolean {
  return (
    esTipoDeVenta(fila.tipoDocumento) &&
    !ESTADOS_FUERA.has(fila.estado) &&
    fila.anulacion == null
  )
}

function ventaSinResolver(fila: FilaDeVenta): boolean {
  return esTipoDeVenta(fila.tipoDocumento) && fila.estado === 'indeterminado'
}

function ordenar(mapa: Map<string, Acumulado>): [string, Acumulado][] {
  return [...mapa.entries()]
    .sort(
      (uno, otro) =>
        otro[1].total - uno[1].total || uno[0].localeCompare(otro[0]),
    )
    .slice(0, TOPE)
}

export function resumirPeriodo(
  filas: readonly FilaDeVenta[],
  periodo: string,
): ResumenDePeriodo {
  let totalCentimos = 0
  let cantidad = 0
  let ventasSinResolver = 0
  const porTipo = new Map<TipoDeVenta, Acumulado>(
    TIPOS_DE_VENTA.map((tipo) => [
      tipo,
      { total: 0, cantidad: 0, etiqueta: tipo },
    ]),
  )
  const vendedores = new Map<string, Acumulado>()
  const clientes = new Map<string, Acumulado>()
  const productos = new Map<string, Acumulado>()

  for (const fila of filas) {
    if (ventaSinResolver(fila)) ventasSinResolver += 1
    if (!sumaVenta(fila)) continue
    totalCentimos += fila.total
    cantidad += 1
    const tipo = porTipo.get(fila.tipoDocumento as TipoDeVenta)
    if (tipo !== undefined) {
      tipo.total += fila.total
      tipo.cantidad += 1
    }
    acumular(vendedores, fila.vendedorId, fila.total, fila.vendedorId)
    const documento = fila.cliente?.numeroDocumento.trim() ?? ''
    const claveCliente = documento === '' ? 'eventual' : documento
    const nombre =
      documento === '' ? 'Cliente eventual' : (fila.cliente?.denominacion ?? '')
    acumular(clientes, claveCliente, fila.total, nombre)
    for (const linea of fila.lineas) {
      acumular(productos, linea.codigo, linea.importe, linea.descripcion)
    }
  }

  return {
    periodo,
    totalCentimos,
    cantidad,
    ticketPromedioCentimos:
      cantidad === 0 ? 0 : Math.round(totalCentimos / cantidad),
    ventasSinResolver,
    porTipo: TIPOS_DE_VENTA.map((tipo) => {
      const puesto = porTipo.get(tipo)
      return {
        tipo,
        totalCentimos: puesto?.total ?? 0,
        cantidad: puesto?.cantidad ?? 0,
      }
    }),
    topVendedores: ordenar(vendedores).map(([vendedorId, puesto]) => ({
      vendedorId,
      totalCentimos: puesto.total,
      cantidad: puesto.cantidad,
    })),
    topClientes: ordenar(clientes).map(([numeroDocumento, puesto]) => ({
      numeroDocumento,
      denominacion: puesto.etiqueta,
      totalCentimos: puesto.total,
      cantidad: puesto.cantidad,
    })),
    topProductos: ordenar(productos).map(([codigo, puesto]) => ({
      codigo,
      descripcion: puesto.etiqueta,
      totalCentimos: puesto.total,
      cantidad: puesto.cantidad,
    })),
  }
}

function acumular(
  mapa: Map<string, Acumulado>,
  clave: string,
  importe: number,
  etiqueta: string,
): void {
  const previo = mapa.get(clave)
  if (previo === undefined) {
    mapa.set(clave, { total: importe, cantidad: 1, etiqueta })
    return
  }
  previo.total += importe
  previo.cantidad += 1
}
