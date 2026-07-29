import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { REGLAS } from '../domain/documentos/tipos.ts'
import type { ProductoBuscable } from '../domain/busqueda/productos.ts'
import { usarCatalogo, umbralVigente } from '../features/catalogo/almacen.ts'
import { usarDegradacion } from '../features/degradacion/estado.ts'
import { usarEmision } from '../features/emision/flujo.ts'
import { EstadoDeEmision } from '../features/emision/estados.tsx'
import {
  compartirComprobante,
  reimprimir,
} from '../features/emision/reimprimir.ts'
import {
  lineasCalculadas,
  sePuedeEmitir,
  totalDelPedido,
  usarPedido,
} from '../features/pedido/almacen.ts'
import { puedeEmitir, usarSesion } from '../features/sesion/almacen.ts'
import { emitir } from '../features/emision/emitir.funciones.ts'
import { CabeceraDocumento } from '../ui/componentes/CabeceraDocumento.tsx'
import { Entrada } from '../ui/componentes/Entrada.tsx'
import {
  CabecerasDeColumna,
  LineaPedido,
} from '../ui/componentes/LineaPedido.tsx'
import { PestanasMostrador } from '../ui/componentes/PestanasMostrador.tsx'
import type { PestanaMostrador } from '../ui/componentes/PestanasMostrador.tsx'
import { PieTotal } from '../ui/componentes/PieTotal.tsx'
import type { EstadoDeEmision as FaseDelBoton } from '../ui/componentes/PieTotal.tsx'

/**
 * Mostrador Soft-Pill (FR-005b).
 *
 * Orden fijo en Inicio:
 * 1. Cinta de herramientas (`Entrada`) — siempre arriba, persiste entre tabs.
 * 2. Tabs internos (Pedido | Cotizaciones | Vecinos | Lista).
 * 3. Contenido del tab (en Pedido: cabecera, líneas, pie de total).
 */
export const Route = createFileRoute('/')({
  component: Mostrador,
})

function Mostrador() {
  const [pestana, setPestana] = useState<PestanaMostrador>('pedido')
  const [termino, setTermino] = useState('')
  const [medioPago, setMedioPago] = useState('efectivo')

  const catalogo = usarCatalogo()
  const sesion = usarSesion()
  const pedido = usarPedido()
  const fase = usarEmision((estado) => estado.fase)
  const comenzarEmision = usarEmision((estado) => estado.comenzar)
  const resolverEmision = usarEmision((estado) => estado.resolver)
  const falloDeRed = usarEmision((estado) => estado.falloDeRed)
  const cerrarEmision = usarEmision((estado) => estado.cerrar)
  const degradaciones = usarDegradacion((estado) => estado.activas)

  useEffect(() => usarSesion.getState().vigilar(), [])
  useEffect(() => {
    void usarCatalogo.getState().cargar()
  }, [])

  const lineas = lineasCalculadas(pedido)
  const total = totalDelPedido(pedido)
  const umbral = umbralVigente(catalogo)
  const resultado = catalogo.buscar(termino)

  const proveedorCaido = degradaciones.some((cada) => cada.causa === 'proveedor')
  const asistenciaDisponible = !degradaciones.some(
    (cada) => cada.causa === 'asistencia' || cada.causa === 'red',
  )

  const motivoDeBloqueo = calcularMotivoDeBloqueo({
    lineas: pedido.lineas.length,
    emitible: sePuedeEmitir(pedido),
    tipo: pedido.tipoDocumento,
    cliente: pedido.cliente,
    total,
    umbral,
    motivoDeSesion: puedeEmitir(sesion) ? null : sesion.motivoDeBloqueo,
  })

  function agregar(producto: ProductoBuscable): void {
    pedido.agregarLinea({
      codigo: producto.codigo,
      descripcion: producto.descripcion,
      unidad: producto.unidad,
      cantidad: 1,
      precio: producto.precio,
    })
  }

  async function lanzarEmision(): Promise<void> {
    if (!comenzarEmision()) return

    const clave = pedido.reclamarClaveDeIdempotencia()

    try {
      const respuesta = await emitir({
        data: {
          claveIdempotencia: clave,
          tipoDocumento: pedido.tipoDocumento,
          cliente: pedido.cliente,
          lineas: pedido.lineas.map((linea) => ({
            codigo: linea.codigo,
            descripcion: linea.descripcion,
            unidad: linea.unidad,
            cantidad: linea.cantidad,
            precio: linea.precio,
          })),
          condicionPago: { tipo: 'contado' },
          medioPago: { medio: medioPago, montoRecibido: total },
          cotizacionId: pedido.cotizacionId,
          capturaId: pedido.capturaId,
          totalDeclarado: total,
        },
      })
      resolverEmision(respuesta)
    } catch {
      falloDeRed()
    }
  }

  const faseDelBoton: FaseDelBoton =
    fase.nombre === 'en_vuelo'
      ? 'emitiendo'
      : fase.nombre === 'emitida'
        ? 'emitido'
        : motivoDeBloqueo !== null
          ? 'inhabilitado'
          : 'listo'

  return (
    <div className="flex min-h-full flex-col">
      {/* Cinta de herramientas: siempre visible en Inicio, encima de los tabs. */}
      <Entrada
        termino={termino}
        onTerminoCambia={setTermino}
        resultado={resultado}
        onElegirProducto={agregar}
        asistenciaDisponible={asistenciaDisponible}
      />

      <PestanasMostrador activa={pestana} onCambiar={setPestana} />

      {pestana === 'pedido' && (
        <div className="flex min-h-0 flex-1 flex-col">
          <CabeceraDocumento
            tipo={pedido.tipoDocumento}
            onCambiarTipo={pedido.fijarTipoDocumento}
            serie={null}
            cliente={pedido.cliente}
            onElegirCliente={() => undefined}
            onQuitarCliente={() => pedido.fijarCliente(null)}
            total={total}
            umbral={umbral}
          />

          <div className="flex-1 overflow-y-auto pb-2">
            <CabecerasDeColumna />
            <ul>
              {lineas.map((linea, indice) => (
                <LineaPedido
                  key={`${linea.codigo}-${indice}`}
                  linea={linea}
                  indice={indice}
                  precioDeCatalogo={
                    catalogo.productoPorCodigo(linea.codigo)?.precio
                  }
                  onCambiarCantidad={(cantidad) =>
                    pedido.cambiarCantidad(indice, cantidad)
                  }
                  onCambiarPrecio={(precio) =>
                    pedido.cambiarPrecio(indice, precio)
                  }
                  onQuitar={() => pedido.quitarLinea(indice)}
                />
              ))}
            </ul>
          </div>

          <PieTotal
            total={total}
            numeroDeLineas={pedido.lineas.length}
            medioPago={medioPago}
            onCambiarMedioPago={setMedioPago}
            estado={faseDelBoton}
            motivoDeBloqueo={motivoDeBloqueo}
            onEmitir={() => void lanzarEmision()}
            proveedorCaido={proveedorCaido}
          />

          <EstadoDeEmision
            fase={fase}
            onCerrar={cerrarEmision}
            onReintentar={() => void lanzarEmision()}
            onImprimir={(id) => void reimprimir(id)}
            onCompartir={(id) => void compartirComprobante(id)}
          />
        </div>
      )}

      {pestana === 'cotizaciones' && (
        <PanelPlaceholder
          titulo="Cotizaciones"
          texto="Aquí aparecerán las cotizaciones del día para reabrirlas en el pedido."
        />
      )}

      {pestana === 'vecinos' && (
        <PanelPlaceholder
          titulo="Vecinos"
          texto="Búsqueda de clientes frecuentes del barrio / zona."
        />
      )}

      {pestana === 'lista' && (
        <PanelPlaceholder
          titulo="Lista"
          texto="Contenido por definir (clarify del intake). Placeholder hasta entonces."
        />
      )}
    </div>
  )
}

function PanelPlaceholder({
  titulo,
  texto,
}: {
  readonly titulo: string
  readonly texto: string
}) {
  return (
    <div className="flex flex-1 flex-col px-6 py-10">
      <h2 className="text-cabecera font-bold text-tinta">{titulo}</h2>
      <p className="mt-2 max-w-lg text-cuerpo text-desvaida">{texto}</p>
      <div className="mt-8 rounded-3xl border border-borde bg-papel p-6 shadow-sm">
        <p className="font-mono text-etiqueta uppercase text-desvaida">
          En construcción
        </p>
      </div>
    </div>
  )
}

function calcularMotivoDeBloqueo(datos: {
  readonly lineas: number
  readonly emitible: boolean
  readonly tipo: 'boleta' | 'factura' | 'nota_venta'
  readonly cliente: unknown
  readonly total: number
  readonly umbral: number
  readonly motivoDeSesion: string | null
}): string | null {
  if (datos.motivoDeSesion !== null) return datos.motivoDeSesion

  if (datos.lineas === 0) return null

  if (!datos.emitible) {
    return 'Hay una línea con cantidad o precio en cero. Corrígela para poder emitir.'
  }

  const reglas = REGLAS[datos.tipo]
  if (datos.cliente === null) {
    if (reglas.exigeClienteIdentificado) {
      return 'Una factura necesita el RUC del cliente. Identifícalo para poder emitir.'
    }
    if (reglas.sujetoAUmbralDeIdentificacion && datos.total > datos.umbral) {
      return 'Este importe obliga a identificar al cliente. Ingresa su documento para continuar.'
    }
  }

  return null
}
