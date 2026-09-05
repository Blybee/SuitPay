import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type { ProductoBuscable } from '../domain/busqueda/productos.ts'
import { pedidoTienePrecioBajoCatalogo } from '../domain/totales/calculo.ts'
import { usarBusqueda } from '../features/busqueda/almacen.ts'
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
import {
  BarraPasoTextoExtraido,
  ListaPasoTextoExtraido,
} from '../features/captura/revision-imagen.tsx'
import {
  reconocerCrearVecino,
  type PropuestaCrearVecino,
} from '../features/comandos/crear-vecino.ts'
import {
  despacharComando,
  mensajeDeProhibido,
} from '../features/comandos/ejecutar.ts'
import { InstruccionIncompleta } from '../features/comandos/incompletas.tsx'
import { comandoDesdeDictado } from '../features/comandos/por-voz.ts'
import {
  ResultadosDeComando,
  type ResultadoDeComando,
} from '../features/comandos/resultados.tsx'
import type { OperacionDeConsulta } from '../features/comandos/catalogo.ts'
import { PapeletaDeGuia } from '../features/guia/papeleta.tsx'
import type { BorradorDeGuia } from '../features/guia/papeleta.tsx'
import { AltaTransportista } from '../features/transportistas/alta.tsx'
import { guardarCotizacion } from '../features/cotizaciones/guardar.ts'
import { PanelDeCotizaciones } from '../features/cotizaciones/panel.tsx'
import { crearCotizacionVecino } from '../features/vecinos/crear.ts'
import { persistirDatosDeVecino } from '../features/vecinos/datos.ts'
import { agregarProductoAVecino } from '../features/vecinos/lineas.ts'
import { PanelDeVecinos } from '../features/vecinos/panel.tsx'
import { PanelDeListaRequerimiento } from '../features/lista/panel.tsx'
import { usarDiaLista } from '../features/lista/dia-activo.ts'
import { agregarProductosALista } from '../features/lista/persistir.ts'
import { urgenciaDesdeTexto } from '../domain/lista/urgencia.ts'
import { claveDeDiaLima } from '../domain/captura/hora-lima.ts'
import { aplicarLineasAprobadasAlPedido } from '../features/captura/aprobar.ts'
import type { LineaCapturaAprobada } from '../features/captura/aprobar.ts'
import { resolverDestinoDeVecino } from '../domain/captura/mencion-vecino.ts'
import {
  avisoPerezosoDeCodigo,
  vaciarCacheInventario,
} from '../features/inventario/consultar.ts'
import {
  alRecuperarConectividad,
  usarDegradacion,
} from '../features/degradacion/estado.ts'
import { usarEmision } from '../features/emision/flujo.ts'
import { calcularMotivoDeBloqueo } from '../features/emision/bloqueo.ts'
import { EstadoDeEmision } from '../features/emision/estados.tsx'
import { resolverYPrecargarPdf } from '../features/emision/precarga.ts'
import { etiquetaDeAsociacionGuia } from '../features/guia/etiqueta.ts'
import {
  compartirComprobante,
  reimprimir,
} from '../features/emision/reimprimir.ts'
import { usarNotificaciones } from '../features/notificaciones/almacen.ts'
import {
  lineasCalculadas,
  sePuedeEmitir,
  totalDelPedido,
  usarPedido,
  type ClienteDelPedido,
} from '../features/pedido/almacen.ts'
import { puedeEmitir, usarSesion } from '../features/sesion/almacen.ts'
import { GuardaSesion } from '../features/sesion/GuardaSesion.tsx'
import { AltaClienteEnContexto } from '../features/clientes/alta-en-contexto.tsx'
import type {
  ArranqueManualDeCliente,
  ArranqueRevisionDeCliente,
} from '../features/clientes/alta-en-contexto.tsx'
import { consultarContribuyenteFn } from '../features/clientes/clientes.funciones.ts'
import { leerClientePorDocumento } from '../features/clientes/existencia.ts'
import {
  decidirTrasConsultaContribuyente,
  mensajeDeConsultaIndisponible,
} from '../features/clientes/resultado-consulta.ts'
import { emitir } from '../features/emision/emitir.funciones.ts'
import { leerMiSerieFn } from '../features/series/series.funciones.ts'
import { CLAVES_DE_CONSULTA } from '../infra/consultas/cliente.ts'
import { DOCUMENTO_CLIENTE_POR_NOMBRE } from '../features/clientes/documento-marcador.ts'
import {
  CabeceraDocumento,
  modoEncadenaGuia,
  tipoFiscalDeModo,
  type ModoDeCabecera,
  type SeriesEnCabecera,
} from '../ui/componentes/CabeceraDocumento.tsx'
import { Entrada, type MangoDeEntrada } from '../ui/componentes/Entrada.tsx'
import {
  CabecerasDeColumna,
  LineaPedido,
} from '../ui/componentes/LineaPedido.tsx'
import { Modal } from '../ui/componentes/Modal.tsx'
import {
  CuerpoPestana,
  PestanasMostrador,
} from '../ui/componentes/PestanasMostrador.tsx'
import type { PestanaMostrador } from '../ui/componentes/PestanasMostrador.tsx'
import { Boton } from '../ui/componentes/primitivas.tsx'
import { PieTotal } from '../ui/componentes/PieTotal.tsx'
import type { EstadoDeEmision as FaseDelBoton } from '../ui/componentes/PieTotal.tsx'
import { RevisionCaptura } from '../ui/componentes/RevisionCaptura.tsx'
import type { Cotizacion } from '../features/cotizaciones/tipos.ts'
import { listarCotizacionesPendientes } from '../features/cotizaciones/leer.ts'
import { intentarLoteAprendizaje } from '../features/aprendizaje/empujar-lote.ts'
import {
  paresDesdeCaptura,
  registrarParesEnSegundoPlano,
} from '../features/aprendizaje/registrar.ts'

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
  const entradaRef = useRef<MangoDeEntrada>(null)
  const [pestana, setPestana] = useState<PestanaMostrador>('pedido')
  const [termino, setTermino] = useState('')
  const [medioPago, setMedioPago] = useState('efectivo')
  const [seriesCabecera, setSeriesCabecera] = useState<SeriesEnCabecera>({
    boleta: null,
    factura: null,
    guia: null,
  })
  const [encadenarGuia, setEncadenarGuia] = useState(false)
  const [altaClienteAbierta, setAltaClienteAbierta] = useState(false)
  const [consultaClienteInicial, setConsultaClienteInicial] = useState<
    string | null
  >(null)
  const [altaManualInicial, setAltaManualInicial] =
    useState<ArranqueManualDeCliente | null>(null)
  const [altaRevisionInicial, setAltaRevisionInicial] =
    useState<ArranqueRevisionDeCliente | null>(null)
  const modoCotizacion = usarPedido((s) => s.modoCotizacion)
  const [consultandoPadron, setConsultandoPadron] = useState(false)
  const [guardandoCotizacion, setGuardandoCotizacion] = useState(false)
  const [avisoCotizacion, setAvisoCotizacion] = useState<string | null>(null)
  const [panelDictado, setPanelDictado] = useState(false)
  const [panelFoto, setPanelFoto] = useState(false)
  const [vecinoActivoId, setVecinoActivoId] = useState<string | null>(null)
  const [propuestaVecino, setPropuestaVecino] =
    useState<PropuestaCrearVecino | null>(null)
  const [pendienteAltaVecino, setPendienteAltaVecino] =
    useState<PropuestaCrearVecino | null>(null)
  const [creandoVecino, setCreandoVecino] = useState(false)
  const [avisoVecino, setAvisoVecino] = useState<string | null>(null)
  const [resultadoComando, setResultadoComando] =
    useState<ResultadoDeComando | null>(null)
  const [comandoIncompleto, setComandoIncompleto] = useState<{
    readonly operacion: OperacionDeConsulta
    readonly faltantes: readonly string[]
    readonly prefijo: string
  } | null>(null)
  const [papeletaGuiaAbierta, setPapeletaGuiaAbierta] = useState(false)
  const [lineaSenalada, setLineaSenalada] = useState<{
    readonly codigo: string
    readonly tipo: 'existente' | 'nueva'
    readonly vez: number
  } | null>(null)
  const [borradorGuia, setBorradorGuia] = useState<BorradorDeGuia | null>(null)
  const [altaTransportistaRuc, setAltaTransportistaRuc] = useState<
    string | null
  >(null)
  const [avisosInventario, setAvisosInventario] = useState<
    ReadonlyMap<string, string>
  >(() => new Map())

  const catalogo = usarCatalogo()
  const ultimaBusqueda = usarBusqueda((estado) => estado.ultima)
  const sesion = usarSesion()
  const pedido = usarPedido()
  const fase = usarEmision((estado) => estado.fase)
  const comenzarEmision = usarEmision((estado) => estado.comenzar)
  const resolverEmision = usarEmision((estado) => estado.resolver)
  const falloDeRed = usarEmision((estado) => estado.falloDeRed)
  const cerrarEmision = usarEmision((estado) => estado.cerrar)
  const promoverEncadenado = usarEmision((estado) => estado.promoverEncadenado)
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
        degradadaPorRed || usarCatalogo.getState().posiblementeDesactualizado,
    })
    intentarLoteAprendizaje()
    function alFoco(): void {
      intentarLoteAprendizaje()
    }
    window.addEventListener('focus', alFoco)
    return () => window.removeEventListener('focus', alFoco)
  }, [sesion.uid])

  useEffect(() => {
    return alRecuperarConectividad(() => {
      void usarCatalogo.getState().cargar({ forzar: true })
    })
  }, [])

  useEffect(() => {
    registrarInyeccionDeCapturaParaPruebas()
  }, [])

  function registrarAvisoInventario(codigo: string, aviso: string | null): void {
    setAvisosInventario((previo) => {
      const siguiente = new Map(previo)
      if (aviso === null || aviso.length === 0) siguiente.delete(codigo)
      else siguiente.set(codigo, aviso)
      return siguiente
    })
  }

  function consultarAvisoInventario(codigo: string): void {
    void avisoPerezosoDeCodigo(codigo).then((aviso) => {
      registrarAvisoInventario(codigo, aviso)
    })
  }

  useEffect(() => {
    if (sesion.uid === null) {
      setSeriesCabecera({ boleta: null, factura: null, guia: null })
      return
    }
    const estado = { vivo: true }
    void (async () => {
      const [boleta, factura, guia] = await Promise.all([
        leerMiSerieFn({ data: { tipoDocumento: 'boleta' } }),
        leerMiSerieFn({ data: { tipoDocumento: 'factura' } }),
        leerMiSerieFn({ data: { tipoDocumento: 'guia' } }),
      ])
      if (!estado.vivo) return
      const serieDe = (
        respuesta: Awaited<ReturnType<typeof leerMiSerieFn>>,
      ): string | null => {
        const serie = respuesta.ok ? (respuesta.serie ?? null) : null
        return serie !== null && serie.activa ? serie.serie : null
      }
      setSeriesCabecera({
        boleta: serieDe(boleta),
        factura: serieDe(factura),
        guia: serieDe(guia),
      })
    })()
    return () => {
      estado.vivo = false
    }
  }, [sesion.uid])

  const lineas = lineasCalculadas(pedido)
  const total = totalDelPedido(pedido)
  const umbral = umbralVigente(catalogo)
  const resultado = catalogo.buscar(termino)

  const proveedorCaido = degradaciones.some(
    (cada) => cada.causa === 'proveedor',
  )
  const asistenciaCaida = degradaciones.some(
    (cada) => cada.causa === 'asistencia',
  )
  const asistenciaDisponible = !degradaciones.some(
    (cada) => cada.causa === 'asistencia' || cada.causa === 'red',
  )
  const motivoAsistenciaInerte = sinRed
    ? 'Sin conexión: dictado y foto no disponibles. Puedes escribir el pedido.'
    : asistenciaCaida
      ? 'El dictado y la lectura de fotos no están disponibles. Puedes escribir el pedido con normalidad.'
      : null

  const hayPrecioBajoCatalogo = pedidoTienePrecioBajoCatalogo(
    pedido.lineas,
    (codigo) => catalogo.productoPorCodigo(codigo)?.precio,
  )
  const motivoPrecioBajo = hayPrecioBajoCatalogo
    ? 'Hay un precio por debajo del mayorista. Súbelo al de catálogo o más para poder emitir o guardar.'
    : null

  const motivoCaptura = motivoBloqueoPorCaptura()
  const motivoDeBloqueo =
    motivoCaptura ??
    motivoPrecioBajo ??
    calcularMotivoDeBloqueo({
      lineas: pedido.lineas.length,
      emitible: sePuedeEmitir(pedido),
      tipo: pedido.tipoDocumento,
      cliente: pedido.cliente,
      total,
      umbral,
      motivoDeSesion: puedeEmitir(sesion) ? null : sesion.motivoDeBloqueo,
      encadenarGuia,
      serieGuia: seriesCabecera.guia,
    })

  async function alAprobarCaptura(
    lineas: readonly LineaCapturaAprobada[],
    textosOriginales: readonly string[],
    capturaId: string | null,
  ): Promise<boolean> {
    setPanelDictado(false)
    setPanelFoto(false)
    const hablado = textosOriginales.join(' ')
    const comando = comandoDesdeDictado(hablado)
    if (comando !== null) {
      void ejecutarComando(comando)
      return true
    }

    if (pestana === 'lista' && sesion.uid !== null) {
      const hoy = claveDeDiaLima(new Date())
      const resultado = await agregarProductosALista({
        uid: sesion.uid,
        fecha: hoy,
        productos: lineas.map((linea) => ({
          codigo: linea.codigo,
          descripcion: linea.descripcion,
          cantidad: linea.cantidad,
          urgencia: urgenciaDesdeTexto(linea.textoOriginal),
        })),
      })
      if (!resultado.ok) {
        usarNotificaciones.getState().mostrar({
          tono: 'error',
          mensaje: resultado.mensaje ?? 'No se pudo agregar a la lista.',
        })
        return false
      }
      usarDiaLista.getState().fijar(hoy)
      void queryClient.invalidateQueries({
        queryKey: CLAVES_DE_CONSULTA.listaRequerimiento(sesion.uid, hoy),
      })
      usarNotificaciones.getState().mostrar({
        tono: 'exito',
        mensaje:
          lineas.length === 1
            ? 'Producto agregado a la lista de requerimiento.'
            : `${lineas.length} productos agregados a la lista de requerimiento.`,
      })
      return true
    }

    if (pestana === 'vecinos') {
      const listaVecinos = await listarCotizacionesPendientes('vecino')
      const destinoId = resolverDestinoDeVecino({
        textos: textosOriginales,
        vecinos: listaVecinos.map((cada) => ({
          id: cada.id,
          alias: cada.aliasVecino ?? '',
        })),
        activoId: vecinoActivoId,
      })
      if (destinoId === null) {
        usarNotificaciones.getState().mostrar({
          tono: 'error',
          mensaje: 'No hay un vecino activo para asignar el dictado.',
        })
        return false
      }
      const activa = listaVecinos.find((cada) => cada.id === destinoId)
      if (activa === undefined) {
        setAvisoVecino('Ese vecino ya no está disponible.')
        return false
      }
      let actuales = [...activa.lineas]
      for (const linea of lineas) {
        const producto: ProductoBuscable = {
          codigo: linea.codigo,
          descripcion: linea.descripcion,
          unidad: linea.unidad,
          precio:
            usarCatalogo.getState().productoPorCodigo(linea.codigo)?.precio ??
            0,
          activo: true,
        }
        const resultado = await agregarProductoAVecino({
          cotizacionId: activa.id,
          lineasActuales: actuales,
          producto,
          cantidad: linea.cantidad,
        })
        if (!resultado.ok) {
          setAvisoVecino(resultado.mensaje ?? 'No se pudo agregar el producto.')
          return false
        }
        const indice = actuales.findIndex(
          (cada) => cada.codigo === linea.codigo,
        )
        if (indice >= 0) {
          const previa = actuales[indice]!
          actuales = actuales.map((cada, i) =>
            i === indice
              ? { ...previa, cantidad: previa.cantidad + linea.cantidad }
              : cada,
          )
        } else {
          actuales = [
            ...actuales,
            {
              codigo: linea.codigo,
              descripcion: linea.descripcion,
              unidad: linea.unidad,
              cantidad: linea.cantidad,
              precio: producto.precio,
            },
          ]
        }
      }
      setVecinoActivoId(destinoId)
      void queryClient.invalidateQueries({
        queryKey: CLAVES_DE_CONSULTA.cotizacionesVecinos,
      })
      usarNotificaciones.getState().mostrar({
        tono: 'exito',
        mensaje: `Agregado a ${activa.aliasVecino ?? `H${activa.numero}`}.`,
      })
      return true
    }

    const aplicadas = aplicarLineasAprobadasAlPedido(lineas, capturaId)
    for (const linea of lineas) consultarAvisoInventario(linea.codigo)
    registrarParesEnSegundoPlano({
      medio: usarCaptura.getState().tipo ?? 'captura',
      pares: paresDesdeCaptura(lineas),
      clienteId: usarPedido.getState().cliente?.numeroDocumento,
    })
    const propuesto = usarCaptura.getState().clientePropuesto
    if (propuesto !== null && usarPedido.getState().cliente === null) {
      usarPedido.getState().fijarCliente(propuesto)
    }
    if (aplicadas.agregadas > 0 && aplicadas.omitidas === 0) {
      usarNotificaciones.getState().mostrar({
        tono: 'exito',
        mensaje:
          aplicadas.agregadas === 1
            ? 'Producto agregado al pedido.'
            : `${aplicadas.agregadas} productos agregados al pedido.`,
      })
    } else if (aplicadas.omitidas > 0) {
      usarNotificaciones.getState().mostrar({
        tono: 'info',
        mensaje:
          aplicadas.omitidas === 1
            ? 'Un producto de la captura ya estaba en el pedido; no se duplicó.'
            : `${aplicadas.omitidas} productos de la captura ya estaban en el pedido; no se duplicaron.`,
      })
    }

    const mencion = extraerMencionDeCliente(textosOriginales)
    if (mencion === null || usarPedido.getState().cliente !== null) return true
    const local = resolverClienteLocal(
      mencion,
      usarCatalogo.getState().clientes,
    )
    if (local) {
      usarPedido.getState().fijarCliente({
        tipoDocumento: local.numeroDocumento.length === 11 ? 'RUC' : 'DNI',
        numeroDocumento: local.numeroDocumento,
        denominacion: local.denominacion,
      })
    } else {
      setAltaManualInicial(null)
      setAltaRevisionInicial(null)
      setConsultaClienteInicial(mencion)
      setAltaClienteAbierta(true)
    }
    return true
  }

  async function ejecutarComando(texto: string): Promise<void> {
    const recortado = texto.trim()
    const clave = recortado.toLowerCase()
    // La propuesta salta con Enter, no en cada tecla: si saltara al completar
    // el documento, el modal interrumpiría antes de poder escribir el
    // teléfono opcional.
    const propuestaDeVecino = reconocerCrearVecino(recortado)
    if (propuestaDeVecino !== null) {
      setPropuestaVecino(propuestaDeVecino)
      return
    }
    if (clave === '/guia' || clave.startsWith('/guia ')) {
      setBorradorGuia(null)
      setPapeletaGuiaAbierta(true)
      setTermino('')
      return
    }
    if (
      clave === '/crear transportista' ||
      clave.startsWith('/crear transportista ')
    ) {
      const ruc = recortado.slice('/crear transportista'.length).trim()
      setAltaTransportistaRuc(ruc)
      setTermino('')
      return
    }

    const despacho = await despacharComando(texto)
    if (despacho.reconocer.tipo === 'escritura_prohibida') {
      setResultadoComando(mensajeDeProhibido(despacho.reconocer))
      return
    }
    if (despacho.reconocer.tipo === 'incompleto') {
      setComandoIncompleto({
        operacion: despacho.reconocer.operacion,
        faltantes: despacho.reconocer.faltantes,
        prefijo: despacho.reconocer.operacion.prefijo,
      })
      return
    }
    if (despacho.pestana !== undefined) {
      setPestana(despacho.pestana)
      setTermino('')
      return
    }
    if (despacho.resultado !== undefined) {
      setResultadoComando(despacho.resultado)
      setTermino('')
    }
  }

  function agregar(producto: ProductoBuscable): void {
    if (pestana === 'lista' && sesion.uid !== null) {
      void (async () => {
        const hoy = claveDeDiaLima(new Date())
        const resultado = await agregarProductosALista({
          uid: sesion.uid!,
          fecha: hoy,
          productos: [
            {
              codigo: producto.codigo,
              descripcion: producto.descripcion,
            },
          ],
        })
        if (!resultado.ok) {
          usarNotificaciones.getState().mostrar({
            tono: 'error',
            mensaje: resultado.mensaje ?? 'No se pudo agregar a la lista.',
          })
          return
        }
        usarDiaLista.getState().fijar(hoy)
        void queryClient.invalidateQueries({
          queryKey: CLAVES_DE_CONSULTA.listaRequerimiento(sesion.uid!, hoy),
        })
      })()
      return
    }

    if (pestana === 'vecinos' && vecinoActivoId !== null) {
      void (async () => {
        const lista = await listarCotizacionesPendientes('vecino')
        const activa = lista.find((cada) => cada.id === vecinoActivoId)
        if (activa === undefined) {
          setAvisoVecino('Ese vecino ya no está disponible.')
          return
        }
        const resultado = await agregarProductoAVecino({
          cotizacionId: activa.id,
          lineasActuales: activa.lineas,
          producto,
        })
        if (!resultado.ok) {
          setAvisoVecino(resultado.mensaje ?? 'No se pudo agregar el producto.')
          return
        }
        setAvisoVecino(null)
        void queryClient.invalidateQueries({
          queryKey: CLAVES_DE_CONSULTA.cotizacionesVecinos,
        })
      })()
      return
    }

    const agregada = pedido.agregarLinea({
      codigo: producto.codigo,
      descripcion: producto.descripcion,
      unidad: producto.unidad,
      cantidad: 1,
      precio: producto.precio,
    })
    consultarAvisoInventario(producto.codigo)
    setLineaSenalada((prev) => ({
      codigo: producto.codigo,
      tipo: agregada ? 'nueva' : 'existente',
      vez: (prev?.vez ?? 0) + 1,
    }))
    if (!agregada) {
      usarNotificaciones.getState().mostrar({
        tono: 'info',
        mensaje: `${producto.descripcion} ya está en el pedido.`,
      })
    }
  }

  function agregarVarios(productos: readonly ProductoBuscable[]): void {
    if (productos.length === 0) return
    if (pestana === 'lista' && sesion.uid !== null) {
      void (async () => {
        const hoy = claveDeDiaLima(new Date())
        const resultado = await agregarProductosALista({
          uid: sesion.uid!,
          fecha: hoy,
          productos: productos.map((producto) => ({
            codigo: producto.codigo,
            descripcion: producto.descripcion,
          })),
        })
        if (!resultado.ok) {
          usarNotificaciones.getState().mostrar({
            tono: 'error',
            mensaje: resultado.mensaje ?? 'No se pudo agregar a la lista.',
          })
          return
        }
        usarDiaLista.getState().fijar(hoy)
        void queryClient.invalidateQueries({
          queryKey: CLAVES_DE_CONSULTA.listaRequerimiento(sesion.uid!, hoy),
        })
      })()
      return
    }
    if (pestana === 'vecinos' && vecinoActivoId !== null) {
      for (const producto of productos) agregar(producto)
      return
    }

    let añadidos = 0
    let omitidos = 0
    for (const producto of productos) {
      const agregada = pedido.agregarLinea({
        codigo: producto.codigo,
        descripcion: producto.descripcion,
        unidad: producto.unidad,
        cantidad: 1,
        precio: producto.precio,
      })
      consultarAvisoInventario(producto.codigo)
      if (agregada) añadidos += 1
      else omitidos += 1
    }
    if (omitidos > 0) {
      usarNotificaciones.getState().mostrar({
        tono: 'info',
        mensaje:
          añadidos === 0
            ? `${omitidos === 1 ? 'Ese producto ya estaba' : `${omitidos} productos ya estaban`} en el pedido.`
            : `Se añadieron ${añadidos}; ${omitidos} ya estaban en el pedido.`,
      })
    }
  }

  async function aplicarClienteAlVecino(
    propuesta: PropuestaCrearVecino,
    cliente: ClienteDelPedido,
    uid: string,
  ): Promise<void> {
    if (propuesta.cotizacionId !== undefined) {
      const resultado = await persistirDatosDeVecino({
        cotizacionId: propuesta.cotizacionId,
        alias: propuesta.alias,
        telefono: propuesta.telefono ?? '',
        cliente,
      })
      if (!resultado.ok) {
        setAvisoVecino(
          resultado.mensaje ?? 'No se pudieron guardar los datos del vecino.',
        )
        return
      }
      void queryClient.invalidateQueries({
        queryKey: CLAVES_DE_CONSULTA.cotizacionesVecinos,
      })
      usarNotificaciones.getState().mostrar({
        tono: 'exito',
        mensaje: 'Datos del vecino actualizados.',
      })
      return
    }

    const resultado = await crearCotizacionVecino({
      uid,
      alias: propuesta.alias,
      cliente,
      ...(propuesta.telefono !== undefined
        ? { telefono: propuesta.telefono }
        : {}),
    })
    if (!resultado.ok || resultado.cotizacionId === undefined) {
      setAvisoVecino(resultado.mensaje ?? 'No se pudo crear el vecino.')
      return
    }
    setTermino('')
    setPropuestaVecino(null)
    setVecinoActivoId(resultado.cotizacionId)
    setPestana('vecinos')
    void queryClient.invalidateQueries({
      queryKey: CLAVES_DE_CONSULTA.cotizacionesVecinos,
    })
    usarNotificaciones.getState().mostrar({
      tono: 'exito',
      duracionMs: 5_000,
      mensaje: `Vecino ${propuesta.alias} listo.`,
    })
  }

  async function confirmarCrearVecino(
    propuesta: PropuestaCrearVecino,
  ): Promise<void> {
    if (sesion.uid === null) return
    setCreandoVecino(true)
    setAvisoVecino(null)
    try {
      const existente = await leerClientePorDocumento(propuesta.numeroDocumento)
      if (existente === null) {
        setPendienteAltaVecino(propuesta)
        setAltaManualInicial(null)
        setAltaRevisionInicial(null)
        setConsultaClienteInicial(propuesta.numeroDocumento)
        setAltaClienteAbierta(true)
        setPropuestaVecino(null)
        return
      }
      await aplicarClienteAlVecino(
        propuesta,
        {
          tipoDocumento: existente.tipoDocumento,
          numeroDocumento: existente.numeroDocumento,
          denominacion: existente.denominacion,
          ...(existente.direccion !== undefined
            ? { direccion: existente.direccion }
            : {}),
        },
        sesion.uid,
      )
    } finally {
      setCreandoVecino(false)
    }
  }

  function convertirVecinoEnPedido(cotizacion: Cotizacion): void {
    pedido.cargarDesdeCotizacion({
      cotizacionId: cotizacion.id,
      lineas: cotizacion.lineas,
      cliente: cotizacion.cliente,
    })
    pedido.fijarModoCotizacion(false)
    setPestana('pedido')
    setAvisoCotizacion(
      `Cotización de vecino #${cotizacion.numero} abierta. Elige boleta, factura o nota de venta y emite.`,
    )
  }

  async function lanzarEmision(): Promise<void> {
    if (!comenzarEmision()) return

    const clave = pedido.reclamarClaveDeIdempotencia()
    const avisosAlEmitir = [
      ...new Set(
        pedido.lineas.flatMap((linea) => {
          const aviso = avisosInventario.get(linea.codigo)
          return aviso === undefined ? [] : [aviso]
        }),
      ),
    ]
    if (avisosAlEmitir.length > 0) {
      usarNotificaciones.getState().mostrar({
        tono: 'info',
        mensaje: avisosAlEmitir.join(' '),
      })
    }

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
      resolverEmision(respuesta, {
        conservarPedido: encadenarGuia,
      })
      if (respuesta.ok && respuesta.comprobante !== undefined) {
        vaciarCacheInventario()
        setAvisosInventario(new Map())
        limpiarContextoDeCotizacionEnCabecera()
        void resolverYPrecargarPdf(
          respuesta.comprobante.comprobanteId,
          respuesta.comprobante.archivos.pdf,
        )
        if (encadenarGuia) {
          if (seriesCabecera.guia === null) {
            promoverEncadenado()
            setEncadenarGuia(false)
            usarNotificaciones.getState().mostrar({
              tono: 'info',
              mensaje:
                'El comprobante se emitió. Falta serie de guía para continuar.',
            })
            return
          }
          pedido.fijarComprobanteOrigen({
            id: respuesta.comprobante.comprobanteId,
            etiqueta: etiquetaDeAsociacionGuia(
              pedido.tipoDocumento,
              respuesta.comprobante.serie,
              respuesta.comprobante.numero,
            ),
          })
          setPapeletaGuiaAbierta(true)
        }
      }
    } catch {
      falloDeRed()
    }
  }

  function limpiarContextoDeCotizacionEnCabecera(): void {
    pedido.fijarModoCotizacion(false)
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
        cotizacionId: pedido.cotizacionId,
      })
      if (!resultado.ok || resultado.numero === undefined) {
        setAvisoCotizacion(
          resultado.mensaje ?? 'No se pudo guardar la cotización.',
        )
        return
      }
      registrarParesEnSegundoPlano({
        medio: 'cotizar',
        pares: pedido.lineas.map((linea) => ({
          textoOriginal: linea.descripcion,
          codigoAprobado: linea.codigo,
          descripcionAprobada: linea.descripcion,
        })),
        clienteId: pedido.cliente?.numeroDocumento,
      })
      // Cierra el borrador en Pedido: la cotización vive en su tab.
      // Sin aviso persistente en Pedido (el listado de Cotizaciones basta).
      usarPedido.getState().vaciar()
      limpiarContextoDeCotizacionEnCabecera()
      setAvisoCotizacion(null)
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
    : encadenarGuia && pedido.tipoDocumento === 'boleta'
      ? 'boleta_guia'
      : encadenarGuia && pedido.tipoDocumento === 'factura'
        ? 'factura_guia'
        : pedido.tipoDocumento

  function alCambiarModoCabecera(modo: ModoDeCabecera): void {
    if (modo === 'cotizacion') {
      pedido.fijarModoCotizacion(true)
      setEncadenarGuia(false)
      return
    }
    pedido.fijarModoCotizacion(false)
    const fiscal = tipoFiscalDeModo(modo)
    if (fiscal === 'cotizacion') return
    pedido.fijarTipoDocumento(fiscal)
    setEncadenarGuia(modoEncadenaGuia(modo))
  }

  function abrirAltaRevisionTrasConsulta(
    datos: ArranqueRevisionDeCliente,
  ): void {
    setConsultaClienteInicial(null)
    setAltaManualInicial(null)
    setAltaRevisionInicial(datos)
    setAltaClienteAbierta(true)
  }

  function abrirAltaManualTrasConsulta(params: {
    readonly tipoDocumento: 'DNI' | 'RUC'
    readonly numeroDocumento: string
    readonly mensaje: string
  }): void {
    setConsultaClienteInicial(null)
    setAltaRevisionInicial(null)
    setAltaManualInicial({
      tipoDocumento: params.tipoDocumento,
      numeroDocumento: params.numeroDocumento,
      mensaje: params.mensaje,
    })
    setAltaClienteAbierta(true)
  }

  async function alDocumentoCompleto(datos: {
    readonly tipoDocumento: 'RUC' | 'DNI'
    readonly numeroDocumento: string
  }): Promise<void> {
    if (consultandoPadron) return
    setConsultandoPadron(true)
    try {
      const existente = await leerClientePorDocumento(datos.numeroDocumento)
      if (existente !== null) {
        // Registrado: fijar al pedido de inmediato (sin panel de confirmación).
        pedido.fijarCliente({
          tipoDocumento:
            existente.tipoDocumento === 'RUC' ||
            existente.tipoDocumento === 'DNI'
              ? existente.tipoDocumento
              : datos.tipoDocumento,
          numeroDocumento: existente.numeroDocumento,
          denominacion: existente.denominacion,
          ...(existente.direccion !== undefined &&
          existente.direccion.trim() !== ''
            ? { direccion: existente.direccion }
            : {}),
        })
        return
      }

      // No registrado: consulta padrón y abre el diálogo de alta (FR-022).
      const respuesta = await consultarContribuyenteFn({
        data: {
          tipoDocumento: datos.tipoDocumento,
          numeroDocumento: datos.numeroDocumento,
        },
      })
      const decision = decidirTrasConsultaContribuyente(respuesta, {
        tipoDocumento: datos.tipoDocumento,
        numeroDocumento: datos.numeroDocumento,
      })
      if (decision.tipo === 'confirmar') {
        abrirAltaRevisionTrasConsulta(decision.datos)
        return
      }
      abrirAltaManualTrasConsulta({
        tipoDocumento: decision.tipoDocumento,
        numeroDocumento: decision.numeroDocumento,
        mensaje: decision.mensaje,
      })
    } catch {
      abrirAltaManualTrasConsulta({
        tipoDocumento: datos.tipoDocumento,
        numeroDocumento: datos.numeroDocumento,
        mensaje: mensajeDeConsultaIndisponible(),
      })
    } finally {
      setConsultandoPadron(false)
    }
  }

  function alNombreListo(nombre: string): void {
    // Nombre: se fija al pedido de inmediato (sin panel de confirmación).
    pedido.fijarCliente({
      tipoDocumento: 'DNI',
      numeroDocumento: DOCUMENTO_CLIENTE_POR_NOMBRE,
      denominacion: nombre.trim(),
    })
  }

  const faseDelBoton: FaseDelBoton =
    fase.nombre === 'en_vuelo'
      ? 'emitiendo'
      : fase.nombre === 'emitida' || fase.nombre === 'encadenando_guia'
        ? 'emitido'
        : motivoDeBloqueo !== null
          ? 'inhabilitado'
          : 'listo'

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Buscador + tabs: cabecera fija; el scroll vive en la lista del tab. */}
      <div className="z-20 w-full shrink-0 border-b border-borde bg-papel">
        <Entrada
          ref={entradaRef}
          termino={termino}
          onTerminoCambia={(siguiente) => {
            setTermino(siguiente)
            usarBusqueda.getState().recordar(siguiente)
          }}
          ultimaBusqueda={ultimaBusqueda}
          resultado={resultado}
          onElegirProducto={agregar}
          onElegirProductos={agregarVarios}
          onEjecutarComando={(texto) => void ejecutarComando(texto)}
          asistenciaDisponible={asistenciaDisponible}
          motivoAsistenciaInerte={motivoAsistenciaInerte}
          onDictar={() => {
            setPanelFoto(false)
            setPanelDictado(true)
            if (pestana === 'cotizaciones') setPestana('pedido')
          }}
          onFotografiar={() => {
            setPanelDictado(false)
            setPanelFoto(true)
            if (pestana === 'cotizaciones') setPestana('pedido')
          }}
        />
        <PestanasMostrador
          activa={pestana}
          slotPedido={pedido.slotActivo}
          segundoAbierto={pedido.segundoAbierto}
          onSlotPedido={() => {
            const activo = usarPedido.getState().slotActivo
            usarCaptura.getState().guardarEnSlot(activo)
            if (usarPedido.getState().segundoAbierto) {
              usarPedido.getState().conmutarSlot()
            } else {
              usarPedido.getState().abrirSegundo()
            }
            usarCaptura.getState().cargarDeSlot(usarPedido.getState().slotActivo)
          }}
          onCambiar={(siguiente) => {
            setAvisoCotizacion(null)
            setPestana(siguiente)
          }}
        />
        {faseCaptura === 'revision_texto' && (
          <BarraPasoTextoExtraido
            onContinuar={() => {
              /* fase pasa a revision en el store */
            }}
            onCancelar={() => {
              cancelarCaptura()
              setPanelFoto(false)
            }}
          />
        )}
      </div>

      <PanelDictado
        termino={termino}
        abierto={panelDictado}
        onCerrar={() => setPanelDictado(false)}
        contexto={
          pestana === 'lista'
            ? 'lista'
            : pestana === 'vecinos'
              ? 'vecino'
              : 'pedido'
        }
        vecinoId={pestana === 'vecinos' ? vecinoActivoId : null}
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

      {faseCaptura === 'revision_texto' || faseCaptura === 'revision' ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {faseCaptura === 'revision_texto' ? (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <ListaPasoTextoExtraido />
            </div>
          ) : (
            <RevisionCaptura
              onAprobada={(lineas, textos, capturaId) =>
                alAprobarCaptura(lineas, textos, capturaId)
              }
              onDescartar={() => {
                setPanelDictado(false)
                setPanelFoto(false)
              }}
            />
          )}
        </div>
      ) : null}

      {pestana === 'pedido' &&
        faseCaptura !== 'revision' &&
        faseCaptura !== 'revision_texto' && (
        <CuerpoPestana id="pedido" modo="interno">
          <CabeceraDocumento
            modo={modoCabecera}
            onCambiarModo={alCambiarModoCabecera}
            series={seriesCabecera}
            cliente={pedido.cliente}
            onAgregarClienteNuevo={() => {
              setConsultaClienteInicial(null)
              setAltaManualInicial(null)
              setAltaRevisionInicial(null)
              setAltaClienteAbierta(true)
            }}
            onQuitarCliente={() => {
              pedido.fijarCliente(null)
            }}
            onDocumentoCompleto={(datos) => {
              void alDocumentoCompleto(datos)
            }}
            onNombreListo={alNombreListo}
            consultandoPadron={consultandoPadron}
            total={total}
            umbral={umbral}
          />

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
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
                  onVolverAlBuscador={() => entradaRef.current?.enfocar()}
                  resaltar={
                    lineaSenalada?.tipo === 'existente' &&
                    lineaSenalada.codigo === linea.codigo
                  }
                  onFinResalte={() => {
                    setLineaSenalada((prev) =>
                      prev?.tipo === 'existente' &&
                      prev.codigo === linea.codigo
                        ? null
                        : prev,
                    )
                  }}
                  enfocarCantidad={
                    lineaSenalada?.tipo === 'nueva' &&
                    lineaSenalada.codigo === linea.codigo
                  }
                  senal={lineaSenalada?.vez ?? 0}
                  avisoInventario={avisosInventario.get(linea.codigo) ?? null}
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
            motivoDeBloqueo={
              modoCotizacion ? motivoPrecioBajo : motivoDeBloqueo
            }
            onEmitir={() => void lanzarEmision()}
            modoCotizacion={modoCotizacion}
            onGuardarCotizacion={() => void lanzarGuardadoDeCotizacion()}
            guardandoCotizacion={guardandoCotizacion}
            puedeGuardarCotizacion={
              pedido.lineas.length > 0 && !hayPrecioBajoCatalogo
            }
            proveedorCaido={proveedorCaido}
            sinRed={sinRed}
          />

          <EstadoDeEmision
            fase={fase}
            onCerrar={() => {
              cerrarEmision()
              setEncadenarGuia(false)
            }}
            onReintentar={() => void lanzarEmision()}
            onImprimir={(id) => void reimprimir(id)}
            onCompartir={(id) => void compartirComprobante(id)}
          />
        </CuerpoPestana>
      )}

      {pestana === 'cotizaciones' && (
        <CuerpoPestana id="cotizaciones" modo="pagina">
          <PanelDeCotizaciones
            onRecuperada={() => {
              pedido.fijarModoCotizacion(true)
              setPestana('pedido')
            }}
          />
        </CuerpoPestana>
      )}

      {pestana === 'vecinos' && (
        <CuerpoPestana id="vecinos" modo="interno">
          <PanelDeVecinos
            activaId={vecinoActivoId}
            onCambiarActiva={setVecinoActivoId}
            onConvertir={convertirVecinoEnPedido}
            aviso={avisoVecino}
            onVolverAlBuscador={() => entradaRef.current?.enfocar()}
            creandoVecino={creandoVecino}
            onCrearDesdeModal={(propuesta) => {
              void confirmarCrearVecino(propuesta)
            }}
          />
        </CuerpoPestana>
      )}

      {pestana === 'lista' && (
        <CuerpoPestana id="lista" modo="interno">
          <PanelDeListaRequerimiento />
        </CuerpoPestana>
      )}

      <ResultadosDeComando
        resultado={resultadoComando}
        onCerrar={() => setResultadoComando(null)}
      />
      <InstruccionIncompleta
        abierta={comandoIncompleto !== null}
        operacion={comandoIncompleto?.operacion ?? null}
        faltantes={comandoIncompleto?.faltantes ?? []}
        onCerrar={() => setComandoIncompleto(null)}
        onCompletar={(argumentos) => {
          const prefijo = comandoIncompleto?.prefijo ?? ''
          setComandoIncompleto(null)
          void ejecutarComando(`${prefijo} ${argumentos.join(' ')}`)
        }}
      />
      <PapeletaDeGuia
        abierta={papeletaGuiaAbierta}
        onCerrar={() => {
          const eraEncadenada = fase.nombre === 'encadenando_guia'
          setPapeletaGuiaAbierta(false)
          setBorradorGuia(null)
          if (eraEncadenada) {
            promoverEncadenado()
            setEncadenarGuia(false)
          }
        }}
        cliente={pedido.cliente}
        lineas={pedido.lineas}
        comprobanteOrigenId={pedido.comprobanteOrigenId}
        etiquetaOrigen={pedido.comprobanteOrigenEtiqueta}
        urlPdfOrigen={
          fase.nombre === 'encadenando_guia'
            ? fase.comprobante.archivos.pdf
            : null
        }
        borradorInicial={borradorGuia}
        onEmitida={(respuesta) => {
          if (fase.nombre === 'encadenando_guia' && !respuesta.ok) {
            return
          }
          resolverEmision(respuesta)
          if (respuesta.ok) {
            setEncadenarGuia(false)
          }
        }}
        onRechazoDefinitivo={(borrador) => {
          setBorradorGuia(borrador)
          setPapeletaGuiaAbierta(true)
        }}
      />
      <AltaTransportista
        abierta={altaTransportistaRuc !== null}
        rucInicial={altaTransportistaRuc ?? ''}
        onCerrar={() => setAltaTransportistaRuc(null)}
        onCreado={(denominacion, ruc) => {
          usarNotificaciones.getState().mostrar({
            tono: 'exito',
            mensaje: `Transportista ${denominacion} (${ruc}) listo para la guía.`,
          })
        }}
      />
      <AltaClienteEnContexto
        abierta={altaClienteAbierta}
        onCerrar={() => {
          setAltaClienteAbierta(false)
          setConsultaClienteInicial(null)
          setAltaManualInicial(null)
          setAltaRevisionInicial(null)
          setPendienteAltaVecino(null)
        }}
        modoDocumento={
          pendienteAltaVecino !== null
            ? 'cotizacion'
            : tipoFiscalDeModo(modoCabecera) === 'cotizacion'
              ? 'cotizacion'
              : tipoFiscalDeModo(modoCabecera)
        }
        indiceDeClientes={catalogo.clientes}
        onClienteElegido={(cliente) => {
          if (pendienteAltaVecino !== null && sesion.uid !== null) {
            const propuesta = pendienteAltaVecino
            const uid = sesion.uid
            setPendienteAltaVecino(null)
            setAltaClienteAbierta(false)
            setConsultaClienteInicial(null)
            setAltaManualInicial(null)
            setAltaRevisionInicial(null)
            void (async () => {
              setCreandoVecino(true)
              try {
                await aplicarClienteAlVecino(propuesta, cliente, uid)
              } finally {
                setCreandoVecino(false)
              }
            })()
            return
          }
          pedido.fijarCliente(cliente)
        }}
        onClienteCreadoEnIndice={(entrada) =>
          usarCatalogo.getState().incorporarCliente(entrada)
        }
        consultaInicial={consultaClienteInicial}
        arranqueManual={altaManualInicial}
        arranqueRevision={altaRevisionInicial}
      />

      <Modal
        abierta={propuestaVecino !== null}
        alCambiar={(abierta) => {
          if (!abierta && !creandoVecino) setPropuestaVecino(null)
        }}
        titulo="Crear vecino"
        descripcion="Confirma para crear la cotización del vecino. Sin confirmar no se escribe nada."
        pie={
          <div className="flex flex-wrap justify-end gap-2">
            <Boton
              variante="secundario"
              disabled={creandoVecino}
              onClick={() => setPropuestaVecino(null)}
            >
              Cancelar
            </Boton>
            <Boton
              variante="principal"
              disabled={creandoVecino || propuestaVecino === null}
              onClick={() => {
                if (propuestaVecino !== null) {
                  void confirmarCrearVecino(propuestaVecino)
                }
              }}
            >
              {creandoVecino ? 'Creando…' : 'Confirmar'}
            </Boton>
          </div>
        }
      >
        {propuestaVecino !== null ? (
          <dl className="space-y-2 text-cuerpo text-tinta">
            <div>
              <dt className="font-mono text-etiqueta uppercase text-desvaida">
                Alias
              </dt>
              <dd className="font-bold">{propuestaVecino.alias}</dd>
            </div>
            <div>
              <dt className="font-mono text-etiqueta uppercase text-desvaida">
                {propuestaVecino.tipoDocumento}
              </dt>
              <dd className="font-mono font-bold">
                {propuestaVecino.numeroDocumento}
              </dd>
            </div>
            {propuestaVecino.telefono !== undefined ? (
              <div>
                <dt className="font-mono text-etiqueta uppercase text-desvaida">
                  Teléfono
                </dt>
                <dd className="font-mono font-bold">
                  {propuestaVecino.telefono}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </Modal>
    </div>
  )
}
