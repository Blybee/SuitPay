import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { REGLAS } from '../domain/documentos/tipos.ts'
import type { ProductoBuscable } from '../domain/busqueda/productos.ts'
import { usarCatalogo, umbralVigente } from '../features/catalogo/almacen.ts'
import { PanelDictado } from '../features/captura/audio.tsx'
import {
  extraerMencionDeCliente,
  resolverClienteLocal,
} from '../features/captura/cliente.ts'
import { usarCaptura } from '../features/captura/estado.ts'
import { registrarInyeccionDeCapturaParaPruebas } from '../features/captura/inyeccion-prueba.ts'
import { EstadoIlegible } from '../features/captura/ilegible.tsx'
import { PanelFotografia } from '../features/captura/imagen.tsx'
import { motivoBloqueoPorCaptura } from '../features/captura/pendientes.ts'
import { PasoTextoExtraido } from '../features/captura/revision-imagen.tsx'
import { guardarCotizacion } from '../features/cotizaciones/guardar.ts'
import { PanelDeCotizaciones } from '../features/cotizaciones/panel.tsx'
import {
  alRecuperarConectividad,
  usarDegradacion,
} from '../features/degradacion/estado.ts'
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
import { GuardaSesion } from '../features/sesion/GuardaSesion.tsx'
import { AltaClienteEnContexto } from '../features/clientes/alta-en-contexto.tsx'
import {
  consultarContribuyenteFn,
  crearClienteFn,
} from '../features/clientes/clientes.funciones.ts'
import { leerClientePorDocumento } from '../features/clientes/existencia.ts'
import { emitir } from '../features/emision/emitir.funciones.ts'
import { leerMiSerieFn } from '../features/series/series.funciones.ts'
import { CLAVES_DE_CONSULTA } from '../infra/consultas/cliente.ts'
import {
  CabeceraDocumento,
  type ClienteParaConfirmar,
  type ModoDeCabecera,
} from '../ui/componentes/CabeceraDocumento.tsx'
import { Entrada } from '../ui/componentes/Entrada.tsx'
import {
  CabecerasDeColumna,
  LineaPedido,
} from '../ui/componentes/LineaPedido.tsx'
import { PestanasMostrador } from '../ui/componentes/PestanasMostrador.tsx'
import type { PestanaMostrador } from '../ui/componentes/PestanasMostrador.tsx'
import { PieTotal } from '../ui/componentes/PieTotal.tsx'
import type { EstadoDeEmision as FaseDelBoton } from '../ui/componentes/PieTotal.tsx'
import { RevisionCaptura } from '../ui/componentes/RevisionCaptura.tsx'

/**
 * Mostrador Soft-Pill (FR-005b).
 *
 * Orden fijo en Inicio:
 * 1. Bloque sticky: buscador (`Entrada`) + tabs (Pedido | Cotizaciones | …).
 * 2. Paneles de captura / revisión (si hay).
 * 3. Contenido del tab (en Pedido: cabecera, líneas, pie de total).
 */
export const Route = createFileRoute('/')({
  component: MostradorConGuarda,
})

function MostradorConGuarda() {
  return (
    <GuardaSesion>
      <Mostrador />
    </GuardaSesion>
  )
}

function Mostrador() {
  const queryClient = useQueryClient()
  const [pestana, setPestana] = useState<PestanaMostrador>('pedido')
  const [termino, setTermino] = useState('')
  const [medioPago, setMedioPago] = useState('efectivo')
  const [serieAsignada, setSerieAsignada] = useState<string | null>(null)
  const [altaClienteAbierta, setAltaClienteAbierta] = useState(false)
  const [consultaClienteInicial, setConsultaClienteInicial] = useState<
    string | null
  >(null)
  const [modoCotizacion, setModoCotizacion] = useState(false)
  const [documentoNoRegistrado, setDocumentoNoRegistrado] = useState<
    string | null
  >(null)
  const [clienteParaConfirmar, setClienteParaConfirmar] =
    useState<ClienteParaConfirmar | null>(null)
  const [consultandoPadron, setConsultandoPadron] = useState(false)
  const [guardandoCotizacion, setGuardandoCotizacion] = useState(false)
  const [avisoCotizacion, setAvisoCotizacion] = useState<string | null>(null)
  const [panelDictado, setPanelDictado] = useState(false)
  const [panelFoto, setPanelFoto] = useState(false)

  const catalogo = usarCatalogo()
  const sesion = usarSesion()
  const pedido = usarPedido()
  const fase = usarEmision((estado) => estado.fase)
  const comenzarEmision = usarEmision((estado) => estado.comenzar)
  const resolverEmision = usarEmision((estado) => estado.resolver)
  const falloDeRed = usarEmision((estado) => estado.falloDeRed)
  const cerrarEmision = usarEmision((estado) => estado.cerrar)
  const degradaciones = usarDegradacion((estado) => estado.activas)
  const sinRed = degradaciones.some((cada) => cada.causa === 'red')
  const faseCaptura = usarCaptura((s) => s.fase)
  const cancelarCaptura = usarCaptura((s) => s.cancelar)

  // El arranque exige sesión: sin token, Firestore deniega y el fallback a
  // caché declaraba «sin conexión» aunque el wifi estuviera bien. Se espera
  // al uid y se fuerza reintento si la banda de red quedó activa.
  useEffect(() => {
    if (sesion.uid === null) return
    const degradadaPorRed = usarDegradacion
      .getState()
      .activas.some((cada) => cada.causa === 'red')
    void usarCatalogo.getState().cargar({
      forzar:
        degradadaPorRed ||
        usarCatalogo.getState().posiblementeDesactualizado,
    })
  }, [sesion.uid])

  useEffect(() => {
    return alRecuperarConectividad(() => {
      void usarCatalogo.getState().cargar({ forzar: true })
    })
  }, [])

  useEffect(() => {
    registrarInyeccionDeCapturaParaPruebas()
  }, [])

  useEffect(() => {
    if (!REGLAS[pedido.tipoDocumento].consumeSerieRegulada) {
      setSerieAsignada(null)
      return
    }

    const estado = { vivo: true }
    void (async () => {
      const respuesta = await leerMiSerieFn({
        data: { tipoDocumento: pedido.tipoDocumento },
      })
      if (!estado.vivo) return
      const serie = respuesta.ok ? (respuesta.serie ?? null) : null
      setSerieAsignada(serie !== null && serie.activa ? serie.serie : null)
    })()
    return () => {
      estado.vivo = false
    }
  }, [pedido.tipoDocumento, sesion.uid])

  const lineas = lineasCalculadas(pedido)
  const total = totalDelPedido(pedido)
  const umbral = umbralVigente(catalogo)
  const resultado = catalogo.buscar(termino)

  const proveedorCaido = degradaciones.some((cada) => cada.causa === 'proveedor')
  const asistenciaCaida = degradaciones.some((cada) => cada.causa === 'asistencia')
  const asistenciaDisponible = !degradaciones.some(
    (cada) => cada.causa === 'asistencia' || cada.causa === 'red',
  )
  const motivoAsistenciaInerte = sinRed
    ? 'Sin conexión: dictado y foto no disponibles. Puedes escribir el pedido.'
    : asistenciaCaida
      ? 'El dictado y la lectura de fotos no están disponibles. Puedes escribir el pedido con normalidad.'
      : null

  const motivoCaptura = motivoBloqueoPorCaptura()
  const motivoDeBloqueo =
    motivoCaptura ??
    calcularMotivoDeBloqueo({
      lineas: pedido.lineas.length,
      emitible: sePuedeEmitir(pedido),
      tipo: pedido.tipoDocumento,
      cliente: pedido.cliente,
      total,
      umbral,
      motivoDeSesion: puedeEmitir(sesion) ? null : sesion.motivoDeBloqueo,
    })

  function alAprobarCaptura(textosOriginales: readonly string[]): void {
    setPanelDictado(false)
    setPanelFoto(false)
    const mencion = extraerMencionDeCliente(textosOriginales)
    if (mencion === null || usarPedido.getState().cliente !== null) return
    const local = resolverClienteLocal(mencion, usarCatalogo.getState().clientes)
    if (local) {
      usarPedido.getState().fijarCliente({
        tipoDocumento: local.numeroDocumento.length === 11 ? 'RUC' : 'DNI',
        numeroDocumento: local.numeroDocumento,
        denominacion: local.denominacion,
      })
    } else {
      setConsultaClienteInicial(mencion)
      setAltaClienteAbierta(true)
    }
  }

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

  async function lanzarGuardadoDeCotizacion(): Promise<void> {
    if (sesion.uid === null || guardandoCotizacion) return
    setGuardandoCotizacion(true)
    setAvisoCotizacion(null)
    try {
      const resultado = await guardarCotizacion({
        uid: sesion.uid,
        lineas: pedido.lineas,
        cliente: pedido.cliente,
      })
      if (!resultado.ok || resultado.numero === undefined) {
        setAvisoCotizacion(
          resultado.mensaje ?? 'No se pudo guardar la cotización.',
        )
        return
      }
      setAvisoCotizacion(`Cotización guardada: número ${resultado.numero}.`)
      void queryClient.invalidateQueries({
        queryKey: CLAVES_DE_CONSULTA.cotizacionesPendientes,
      })
      setPestana('cotizaciones')
    } finally {
      setGuardandoCotizacion(false)
    }
  }

  const modoCabecera: ModoDeCabecera = modoCotizacion
    ? 'cotizacion'
    : pedido.tipoDocumento

  function alCambiarModoCabecera(modo: ModoDeCabecera): void {
    if (modo === 'cotizacion') {
      setModoCotizacion(true)
      return
    }
    setModoCotizacion(false)
    pedido.fijarTipoDocumento(modo)
  }

  async function alDocumentoCompleto(datos: {
    readonly tipoDocumento: 'RUC' | 'DNI'
    readonly numeroDocumento: string
  }): Promise<void> {
    setDocumentoNoRegistrado(null)
    setClienteParaConfirmar(null)
    const existente = await leerClientePorDocumento(datos.numeroDocumento)
    if (existente !== null) {
      setClienteParaConfirmar({
        tipoDocumento:
          existente.tipoDocumento === 'RUC' || existente.tipoDocumento === 'DNI'
            ? existente.tipoDocumento
            : datos.tipoDocumento,
        numeroDocumento: existente.numeroDocumento,
        denominacion: existente.denominacion,
        direccion: existente.direccion,
        condicion: existente.condicion,
        origen: 'registrado',
      })
      return
    }
    setDocumentoNoRegistrado(datos.numeroDocumento)
  }

  async function consultarNoRegistrado(): Promise<void> {
    if (documentoNoRegistrado === null || consultandoPadron) return
    const numero = documentoNoRegistrado
    const tipoDocumento: 'RUC' | 'DNI' =
      numero.length === 11 ? 'RUC' : 'DNI'
    setConsultandoPadron(true)
    try {
      const respuesta = await consultarContribuyenteFn({
        data: { tipoDocumento, numeroDocumento: numero },
      })
      if (respuesta.ok && respuesta.datos) {
        setClienteParaConfirmar({
          tipoDocumento: respuesta.datos.tipoDocumento,
          numeroDocumento: respuesta.datos.numeroDocumento,
          denominacion: respuesta.datos.denominacion,
          direccion: respuesta.datos.direccion,
          condicion: respuesta.datos.condicion,
          noHabido: respuesta.datos.noHabido,
          origen: 'consulta',
        })
        setDocumentoNoRegistrado(null)
        return
      }
      // Padrón caído o no hallado: formulario manual con el documento precargado.
      setConsultaClienteInicial(numero)
      setAltaClienteAbierta(true)
      setDocumentoNoRegistrado(null)
    } finally {
      setConsultandoPadron(false)
    }
  }

  async function confirmarClientePendiente(): Promise<void> {
    if (clienteParaConfirmar === null || consultandoPadron) return
    const pendiente = clienteParaConfirmar

    if (pendiente.origen === 'registrado') {
      pedido.fijarCliente({
        tipoDocumento: pendiente.tipoDocumento,
        numeroDocumento: pendiente.numeroDocumento,
        denominacion: pendiente.denominacion,
        direccion: pendiente.direccion,
      })
      setClienteParaConfirmar(null)
      return
    }

    setConsultandoPadron(true)
    try {
      const respuesta = await crearClienteFn({
        data: {
          tipoDocumento: pendiente.tipoDocumento,
          numeroDocumento: pendiente.numeroDocumento,
          denominacion: pendiente.denominacion,
          direccion: pendiente.direccion,
          condicion: pendiente.condicion,
          consultadoEn: new Date().toISOString(),
        },
      })
      if (!respuesta.ok || respuesta.cliente === undefined) {
        setConsultaClienteInicial(pendiente.numeroDocumento)
        setAltaClienteAbierta(true)
        setClienteParaConfirmar(null)
        return
      }
      usarCatalogo.getState().incorporarCliente({
        numeroDocumento: respuesta.cliente.numeroDocumento,
        denominacion: respuesta.cliente.denominacion,
      })
      pedido.fijarCliente({
        tipoDocumento: pendiente.tipoDocumento,
        numeroDocumento: pendiente.numeroDocumento,
        denominacion: pendiente.denominacion,
        direccion: pendiente.direccion,
      })
      setClienteParaConfirmar(null)
    } finally {
      setConsultandoPadron(false)
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
      {/* Buscador + tabs: un solo bloque sticky, sin borde/hueco entre ambos. */}
      <div className="sticky top-0 z-20 w-full border-b border-borde bg-papel">
        <Entrada
          termino={termino}
          onTerminoCambia={setTermino}
          resultado={resultado}
          onElegirProducto={agregar}
          asistenciaDisponible={asistenciaDisponible}
          motivoAsistenciaInerte={motivoAsistenciaInerte}
          onDictar={() => {
            setPanelFoto(false)
            setPanelDictado(true)
            setPestana('pedido')
          }}
          onFotografiar={() => {
            setPanelDictado(false)
            setPanelFoto(true)
            setPestana('pedido')
          }}
        />
        <PestanasMostrador activa={pestana} onCambiar={setPestana} />
      </div>

      <PanelDictado
        termino={termino}
        abierto={panelDictado}
        onCerrar={() => setPanelDictado(false)}
      />
      <PanelFotografia
        termino={termino}
        abierto={panelFoto}
        onCerrar={() => setPanelFoto(false)}
      />

      {faseCaptura === 'ilegible' && (
        <EstadoIlegible
          motivo={
            usarCaptura.getState().motivoIlegible ??
            'No se pudo leer la captura.'
          }
          onReintentar={() => {
            cancelarCaptura()
            setPanelFoto(true)
          }}
          onCerrar={() => {
            cancelarCaptura()
            setPanelFoto(false)
          }}
        />
      )}

      {faseCaptura === 'revision_texto' && (
        <PasoTextoExtraido
          onContinuar={() => {
            /* fase pasa a revision en el store */
          }}
          onCancelar={() => {
            cancelarCaptura()
            setPanelFoto(false)
          }}
        />
      )}

      {faseCaptura === 'revision' && (
        <RevisionCaptura
          onAprobada={(textos) => {
            alAprobarCaptura(textos)
            setPestana('pedido')
          }}
          onDescartar={() => {
            setPanelDictado(false)
            setPanelFoto(false)
          }}
        />
      )}

      {pestana === 'pedido' && (
        <div className="flex min-h-0 flex-1 flex-col">
          <CabeceraDocumento
            modo={modoCabecera}
            onCambiarModo={alCambiarModoCabecera}
            serie={serieAsignada}
            cliente={pedido.cliente}
            onAgregarClienteNuevo={() => {
              setConsultaClienteInicial(null)
              setDocumentoNoRegistrado(null)
              setClienteParaConfirmar(null)
              setAltaClienteAbierta(true)
            }}
            onQuitarCliente={() => {
              pedido.fijarCliente(null)
              setClienteParaConfirmar(null)
              setDocumentoNoRegistrado(null)
            }}
            onDocumentoCompleto={(datos) => {
              void alDocumentoCompleto(datos)
            }}
            onDocumentoIncompleto={() => {
              setDocumentoNoRegistrado(null)
              setClienteParaConfirmar(null)
            }}
            documentoNoRegistrado={documentoNoRegistrado}
            onConsultarNoRegistrado={() => {
              void consultarNoRegistrado()
            }}
            consultandoPadron={consultandoPadron}
            clienteParaConfirmar={clienteParaConfirmar}
            onConfirmarCliente={() => {
              void confirmarClientePendiente()
            }}
            onCancelarConfirmacion={() => {
              setClienteParaConfirmar(null)
            }}
            total={total}
            umbral={umbral}
          />

          <AltaClienteEnContexto
            abierta={altaClienteAbierta}
            onCerrar={() => {
              setAltaClienteAbierta(false)
              setConsultaClienteInicial(null)
            }}
            indiceDeClientes={catalogo.clientes}
            onClienteElegido={(cliente) => pedido.fijarCliente(cliente)}
            onClienteCreadoEnIndice={(entrada) =>
              usarCatalogo.getState().incorporarCliente(entrada)
            }
            consultaInicial={consultaClienteInicial}
          />

          <div className="flex-1 overflow-y-auto pb-2">
            <CabecerasDeColumna numeroDeLineas={pedido.lineas.length} />
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

          {avisoCotizacion !== null ? (
            <p
              role="status"
              className="border-t border-borde px-4 py-2 text-cuerpo font-bold text-tinta"
            >
              {avisoCotizacion}
            </p>
          ) : null}

          <PieTotal
            total={total}
            medioPago={medioPago}
            onCambiarMedioPago={setMedioPago}
            estado={faseDelBoton}
            motivoDeBloqueo={modoCotizacion ? null : motivoDeBloqueo}
            onEmitir={() => void lanzarEmision()}
            modoCotizacion={modoCotizacion}
            onGuardarCotizacion={() => void lanzarGuardadoDeCotizacion()}
            guardandoCotizacion={guardandoCotizacion}
            puedeGuardarCotizacion={pedido.lineas.length > 0}
            proveedorCaido={proveedorCaido}
            sinRed={sinRed}
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
        <PanelDeCotizaciones onRecuperada={() => setPestana('pedido')} />
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
