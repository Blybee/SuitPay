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
import { PieTotal  } from '../ui/componentes/PieTotal.tsx'
import type {EstadoDeEmision as FaseDelBoton} from '../ui/componentes/PieTotal.tsx';

/**
 * El mostrador. La pantalla única de venta.
 *
 * ## Lo que deliberadamente no está aquí
 *
 * Ninguna métrica, ningún gráfico, ningún contador de ventas del día, ningún
 * avatar, ninguna navegación permanente. No es minimalismo: el vendedor tiene un
 * cliente delante y cada elemento que compite por su atención es un elemento que
 * alarga la venta. Un contador de ventas del día es exactamente la clase de cosa
 * que se pide en una reunión y que nadie mira en el mostrador.
 *
 * ## El orden de las tres barras
 *
 * Entrada arriba a todo el ancho, columna de papel en medio, total anclado al pie.
 * El total no puede viajar con el contenido: con catorce líneas se iría fuera de
 * pantalla, y el total es lo que se comprueba antes de cobrar.
 *
 * Hay además un beneficio no buscado: con la entrada arriba y el botón de emitir
 * abajo, los separa toda la altura de la pantalla. La protección contra la pulsación
 * accidental que se quiso sacar de un gesto elaborado la da gratis la posición.
 */
export const Route = createFileRoute('/')({
  component: Mostrador,
})

function Mostrador() {
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
    // Se marca en vuelo **antes** de cualquier espera. La segunda pulsación de un
    // doble clic entra aquí, encuentra el estado ya ocupado y se va sin hacer
    // nada. Es la primera de las dos defensas.
    if (!comenzarEmision()) return

    // La clave se reclama una vez por intención de venta. Si esto es un reintento
    // del mismo gesto, devuelve la misma clave y el servidor reconocerá el
    // comprobante en lugar de emitir otro. Es la segunda defensa, y la que cubre
    // lo que la primera no puede: dos dispositivos y una recarga de página.
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
      // Indistinguible de una respuesta que se perdió: la petición pudo llegar.
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
    <div className="flex min-h-svh flex-col">
      <Entrada
        termino={termino}
        onTerminoCambia={setTermino}
        resultado={resultado}
        onElegirProducto={agregar}
        asistenciaDisponible={asistenciaDisponible}
      />

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
        {/* El pedido vacío no lleva ilustración ni mensaje de bienvenida: la
            columna con sus cabeceras y la entrada enfocada ya dicen que se puede
            teclear. Un cartel de bienvenida se lee una vez y estorba las otras
            noventa y nueve veces del día. */}
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
              onCambiarPrecio={(precio) => pedido.cambiarPrecio(indice, precio)}
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
  )
}

/**
 * El motivo por el que no se puede emitir, dicho con palabras.
 *
 * Se calcula en un solo sitio y se devuelve como texto, no como un booleano con
 * un mensaje aparte: así no puede ocurrir que el botón esté inhabilitado y el
 * motivo no aparezca, que es el fallo que convierte un bloqueo legítimo en la
 * sensación de que el sistema está roto.
 *
 * El orden es el de lo que el vendedor puede resolver primero.
 */
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

  if (datos.lineas === 0) return null // No es un bloqueo: es una hoja en blanco.

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
