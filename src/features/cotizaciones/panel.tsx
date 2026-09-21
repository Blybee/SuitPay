import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Loader2, Search, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import { CLAVES_DE_CONSULTA } from '../../infra/consultas/cliente.ts'
import { ZonaDeCarga, clasificarArchivo } from '../../ui/componentes/ZonaDeCarga.tsx'
import { Modal } from '../../ui/componentes/Modal.tsx'
import { Boton, Campo, Etiqueta } from '../../ui/componentes/primitivas.tsx'
import { EstadoVacio } from '../../ui/componentes/EstadoVacio.tsx'
import { IndicadorDeCarga } from '../../ui/componentes/IndicadorDeCarga.tsx'
import { usarCaptura } from '../captura/estado.ts'
import { usarCatalogo } from '../catalogo/almacen.ts'
import { DOCUMENTO_CLIENTE_POR_NOMBRE } from '../clientes/documento-marcador.ts'
import { usarDegradacion } from '../degradacion/estado.ts'
import { usarPedido } from '../pedido/almacen.ts'
import type { ClienteDelPedido } from '../pedido/almacen.ts'
import { DetalleDeCotizacion } from './detalle.tsx'
import { eliminarCotizacion } from './eliminar.ts'
import { formatearFechaCortaCotizacion } from './fecha.ts'
import {
  buscarCotizacionPorNumero,
  listarCotizacionesPendientes,
} from './leer.ts'
import { procesarRequerimientoDeCotizar } from './procesar-pdf.ts'
import { etiquetaDeClaseMedio, usarPropuestasPdf } from './propuestas.ts'
import type { PropuestaPdf } from './propuestas.ts'
import type { Cotizacion } from './tipos.ts'
import { filtrarPendientes } from './filtrar.ts'
import { abrirPdfDeCotizacion } from './pdf.ts'
import { YaUsada } from './ya-usada.tsx'
import { buscarCoincidenciasDeCliente } from '../clientes/coincidencias.ts'
import { leerClientePorDocumento } from '../clientes/existencia.ts'
import type { ClienteExistente } from '../clientes/existencia.ts'
import { actualizarClienteFn } from '../clientes/clientes.funciones.ts'

/**
 * Lista y recuperación de cotizaciones (FR-017, FR-018, FR-019a).
 * Montable en el tab del mostrador y en `/cotizaciones`.
 */
export function PanelDeCotizaciones({
  numeroInicial,
  onRecuperada,
}: {
  readonly numeroInicial?: number | null
  readonly onRecuperada?: (origen?: { readonly numero: number }) => void
}) {
  const queryClient = useQueryClient()
  const catalogo = usarCatalogo()
  const cargarDesdeCotizacion = usarPedido((s) => s.cargarDesdeCotizacion)

  const [consulta, setConsulta] = useState(
    numeroInicial !== null && numeroInicial !== undefined
      ? String(numeroInicial)
      : '',
  )
  const [buscada, setBuscada] = useState<Cotizacion | null>(null)
  const [detalleRetenido, setDetalleRetenido] = useState<Cotizacion | null>(
    null,
  )
  const [yaUsada, setYaUsada] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [aEliminar, setAEliminar] = useState<Cotizacion | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [zonaPdf, setZonaPdf] = useState(false)
  const [archivoCotizar, setArchivoCotizar] = useState<File | null>(null)
  const [textoWhatsapp, setTextoWhatsapp] = useState('')
  const [consultaCliente, setConsultaCliente] = useState('')
  const [clienteElegido, setClienteElegido] = useState<ClienteExistente | null>(
    null,
  )
  const [notas, setNotas] = useState<string[]>([])
  const [notaNueva, setNotaNueva] = useState('')
  const [enviandoCotizar, setEnviandoCotizar] = useState(false)

  const asistenciaCaida = usarDegradacion((s) =>
    s.activas.some((d) => d.causa === 'asistencia'),
  )
  const propuestasPdf = usarPropuestasPdf((s) => s.propuestas)

  const pendientes = useQuery({
    queryKey: CLAVES_DE_CONSULTA.cotizacionesPendientes,
    queryFn: () => listarCotizacionesPendientes('general'),
    staleTime: 30_000,
  })
  const pendientesFiltrados = filtrarPendientes(
    pendientes.data ?? [],
    consulta,
  )

  const deepLinkHecho = useRef(false)
  useEffect(() => {
    if (
      deepLinkHecho.current ||
      numeroInicial === null ||
      numeroInicial === undefined
    ) {
      return
    }
    deepLinkHecho.current = true
    void recuperarPorNumero(numeroInicial)
  }, [numeroInicial])

  async function recuperarPorNumero(numero: number): Promise<void> {
    setBuscando(true)
    setAviso(null)
    setBuscada(null)
    setYaUsada(false)
    try {
      const hallada = await buscarCotizacionPorNumero(numero)
      if (hallada === null) {
        setYaUsada(true)
        setAviso(`No hay cotización con el número ${numero}.`)
        return
      }
      if (hallada.canal === 'vecino') {
        setAviso(
          `La cotización ${numero} pertenece al canal Vecinos. Ábrela desde ese tab.`,
        )
        return
      }
      setDetalleRetenido(hallada)
      setBuscada(hallada)
    } finally {
      setBuscando(false)
    }
  }

  function presentar(cotizacion: Cotizacion): void {
    setYaUsada(false)
    setDetalleRetenido(cotizacion)
    setBuscada(cotizacion)
  }

  function revisarPdf(propuesta: PropuestaPdf): void {
    if (
      propuesta.fase !== 'lista' ||
      propuesta.lineas === undefined ||
      propuesta.capturaId === undefined
    ) {
      return
    }
    usarPedido.getState().fijarModoCotizacion(true)
    usarCaptura.getState().recibirPropuesta({
      capturaId: propuesta.capturaId,
      medioUrl: propuesta.medioUrl ?? '',
      medioObjectUrl: null,
      tipo: 'pdf',
      lineas: propuesta.lineas,
      clientePropuesto: propuesta.cliente ?? null,
    })
    usarPropuestasPdf.getState().quitar(propuesta.id)
    onRecuperada?.()
  }

  function abrirEnPedido(cotizacion: Cotizacion): void {
    usarPedido.getState().fijarModoCotizacion(true)
    cargarDesdeCotizacion({
      cotizacionId: cotizacion.id,
      generacionPedido: cotizacion.generacionPedido,
      lineas: cotizacion.lineas,
      cliente: cotizacion.cliente,
    })
    void queryClient.invalidateQueries({
      queryKey: CLAVES_DE_CONSULTA.cotizacionesPendientes,
    })
    onRecuperada?.({ numero: cotizacion.numero })
  }

  async function confirmarEliminacion(): Promise<void> {
    if (aEliminar === null) return
    setEliminando(true)
    try {
      const resultado = await eliminarCotizacion(aEliminar.id)
      if (!resultado.ok) {
        setAviso(resultado.mensaje ?? 'No se pudo eliminar.')
        return
      }
      if (buscada?.id === aEliminar.id) {
        setBuscada(null)
      }
      setAEliminar(null)
      void queryClient.invalidateQueries({
        queryKey: CLAVES_DE_CONSULTA.cotizacionesPendientes,
      })
    } finally {
      setEliminando(false)
    }
  }

  async function elegirClientePorDocumento(
    numeroDocumento: string,
  ): Promise<void> {
    const existente = await leerClientePorDocumento(numeroDocumento)
    if (existente === null) {
      setAviso('No se encontró ese cliente.')
      return
    }
    setClienteElegido(existente)
    setConsultaCliente(existente.denominacion)
    setNotas([...(existente.instruccionesCotizacion ?? [])])
  }

  async function persistirNotas(siguientes: string[]): Promise<void> {
    if (clienteElegido === null) return
    setNotas(siguientes)
    await actualizarClienteFn({
      data: {
        tipoDocumento: clienteElegido.tipoDocumento,
        numeroDocumento: clienteElegido.numeroDocumento,
        denominacion: clienteElegido.denominacion,
        direccion: clienteElegido.direccion,
        ubigeo: clienteElegido.ubigeo,
        condicion: clienteElegido.condicion,
        instruccionesCotizacion: siguientes,
      },
    })
  }

  function clienteIndicado(): ClienteDelPedido | null {
    if (clienteElegido !== null) {
      return {
        tipoDocumento: clienteElegido.tipoDocumento,
        numeroDocumento: clienteElegido.numeroDocumento,
        denominacion: clienteElegido.denominacion,
        direccion: clienteElegido.direccion,
      }
    }
    const nombre = consultaCliente.trim()
    if (nombre === '') return null
    return {
      tipoDocumento: 'DNI',
      numeroDocumento: DOCUMENTO_CLIENTE_POR_NOMBRE,
      denominacion: nombre,
    }
  }

  function intentarAbrirPdf(cotizacion: Cotizacion): void {
    const resultado = abrirPdfDeCotizacion(cotizacion)
    if (!resultado.ok) {
      setAviso(
        resultado.motivo === 'no_se_pudo_abrir'
          ? 'No se pudo abrir el PDF. Revisa el bloqueador de ventanas.'
          : 'No se pudo generar el PDF de la cotización.',
      )
    }
  }

  async function lanzarCotizar(): Promise<void> {
    if (enviandoCotizar) return
    setEnviandoCotizar(true)
    try {
      await procesarRequerimientoDeCotizar({
        archivo: archivoCotizar,
        texto: textoWhatsapp,
        clienteId: clienteElegido?.numeroDocumento,
        clienteIndicado: clienteIndicado(),
      })
      setArchivoCotizar(null)
      setTextoWhatsapp('')
    } finally {
      setEnviandoCotizar(false)
    }
  }

  const coincidenciasCliente = buscarCoincidenciasDeCliente(
    consultaCliente,
    catalogo.clientes,
  )
  const archivoElegido =
    archivoCotizar === null
      ? null
      : {
          nombre: archivoCotizar.name,
          bytes: archivoCotizar.size,
          clase: clasificarArchivo(archivoCotizar) ?? 'pdf',
        }

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-6">
      <form
        className="flex flex-wrap items-center gap-3"
        onSubmit={(evento) => {
          evento.preventDefault()
          const recortado = consulta.trim()
          const numero = Number.parseInt(recortado, 10)
          if (Number.isFinite(numero) && numero > 0 && String(numero) === recortado) {
            void recuperarPorNumero(numero)
            return
          }
          if (recortado.length === 0) {
            setAviso('Escribe un número, un nombre o un monto.')
          }
        }}
      >
        <div className="min-w-40 flex-1">
          <div className="relative">
            <Campo
              id="numero-cotizacion"
              value={consulta}
              onChange={(evento) => setConsulta(evento.target.value)}
              placeholder="#numero-coti, nombre o monto"
              aria-label="#numero-coti, nombre o monto"
              autoComplete="off"
              className="pr-12"
            />
            <button
              type="submit"
              className="absolute top-1/2 right-1 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-tinta transition-[opacity,transform] duration-rapida ease-salida hover:bg-mesa focus-visible:border focus-visible:border-tinta focus-visible:outline-none disabled:opacity-50"
              aria-label={
                buscando ? 'Buscando cotización' : 'Buscar cotización'
              }
              aria-busy={buscando || undefined}
              disabled={buscando}
            >
              {buscando ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <Search className="size-5" aria-hidden />
              )}
            </button>
          </div>
        </div>
        <Boton
          variante="principal"
          type="button"
          disabled={asistenciaCaida}
          title={
            asistenciaCaida
              ? 'La asistencia no está disponible. Escribe el pedido.'
              : undefined
          }
          onClick={() => setZonaPdf((abierta) => !abierta)}
        >
          Cotizar
        </Boton>
      </form>

      <div
        className="grid transition-[grid-template-rows] duration-media ease-salida motion-reduce:transition-none"
        style={{ gridTemplateRows: zonaPdf ? '1fr' : '0fr' }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-4 pt-2 pb-1">
            <ZonaDeCarga
              etiqueta="PDF o imagen de requerimiento"
              ocultarEtiqueta
              accept="application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              aceptados={['pdf', 'imagen']}
              archivo={archivoElegido}
              estado={archivoCotizar === null ? 'vacio' : 'listo'}
              mensaje={null}
              deshabilitado={asistenciaCaida || enviandoCotizar}
              nota={
                <p className="text-center text-cuerpo text-desvaida">
                  Lista del cliente. El tab sigue usable mientras se lee.
                </p>
              }
              onArchivo={(archivo) => setArchivoCotizar(archivo)}
              onQuitar={() => setArchivoCotizar(null)}
            />
            <textarea
              id="texto-whatsapp-cotizar"
              value={textoWhatsapp}
              onChange={(evento) => setTextoWhatsapp(evento.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-borde bg-papel px-3 py-2 text-cuerpo text-tinta"
              placeholder="Pega aquí el mensaje de WhatsApp"
              aria-label="Pega aquí el mensaje de WhatsApp"
            />
            <div>
              <Etiqueta htmlFor="cliente-cotizar">Cliente (opcional)</Etiqueta>
              <input
                id="cliente-cotizar"
                role="combobox"
                aria-expanded={coincidenciasCliente.length > 0}
                aria-controls="lista-clientes-cotizar"
                aria-autocomplete="list"
                value={consultaCliente}
                onChange={(evento) => {
                  setConsultaCliente(evento.target.value)
                  setClienteElegido(null)
                }}
                autoComplete="off"
                className="mt-1 w-full rounded-2xl border border-borde bg-papel px-3 py-2 text-cuerpo text-tinta"
                placeholder="Razón social o documento"
              />
              {coincidenciasCliente.length > 0 && clienteElegido === null ? (
                <ul
                  id="lista-clientes-cotizar"
                  role="listbox"
                  className="mt-1 rounded-2xl border border-borde bg-papel"
                >
                  {coincidenciasCliente.map((cada) => (
                    <li key={cada.numeroDocumento}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-cuerpo hover:bg-mesa"
                        onClick={() =>
                          void elegirClientePorDocumento(cada.numeroDocumento)
                        }
                      >
                        {cada.denominacion} · {cada.numeroDocumento}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {clienteElegido !== null ? (
              <div className="rounded-2xl border border-borde bg-mesa/40 p-3">
                <p className="mb-2 text-cuerpo font-bold text-tinta">
                  Notas de {clienteElegido.denominacion}
                </p>
                <ul className="mb-2 flex flex-col gap-2">
                  {notas.map((nota, indice) => (
                    <li key={`${indice}-${nota.slice(0, 12)}`} className="flex gap-2">
                      <input
                        aria-label={`Nota ${indice + 1}`}
                        value={nota}
                        onChange={(evento) => {
                          const siguientes = notas.map((n, i) =>
                            i === indice ? evento.target.value : n,
                          )
                          setNotas(siguientes)
                        }}
                        onBlur={() => void persistirNotas(notas)}
                        className="min-w-0 flex-1 rounded-xl border border-borde bg-papel px-2 py-1 text-cuerpo"
                      />
                      <Boton
                        variante="discreto"
                        type="button"
                        onClick={() =>
                          void persistirNotas(notas.filter((_, i) => i !== indice))
                        }
                      >
                        Quitar
                      </Boton>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <input
                    value={notaNueva}
                    onChange={(evento) => setNotaNueva(evento.target.value)}
                    placeholder="Nueva nota de instrucción"
                    className="min-w-0 flex-1 rounded-xl border border-borde bg-papel px-2 py-1 text-cuerpo"
                  />
                  <Boton
                    variante="secundario"
                    type="button"
                    disabled={notaNueva.trim() === ''}
                    onClick={() => {
                      const texto = notaNueva.trim()
                      if (texto === '') return
                      setNotaNueva('')
                      void persistirNotas([...notas, texto])
                    }}
                  >
                    Añadir
                  </Boton>
                </div>
              </div>
            ) : (
              <p className="text-cuerpo text-desvaida">
                Elige un cliente para ver o crear notas de cotización.
              </p>
            )}
            <Boton
              variante="principal"
              type="button"
              disabled={
                asistenciaCaida ||
                enviandoCotizar ||
                (archivoCotizar === null && textoWhatsapp.trim() === '')
              }
              aria-busy={enviandoCotizar || undefined}
              onClick={() => void lanzarCotizar()}
            >
              Interpretar
            </Boton>
          </div>
        </div>
      </div>

      {aviso !== null ? (
        <p className="text-cuerpo font-bold text-aviso" role="alert">
          {aviso}
        </p>
      ) : null}

      {yaUsada && buscada === null ? (
        <div className="rounded-3xl border border-borde bg-papel p-5 shadow-sm">
          <YaUsada
            mensaje={
              aviso ??
              'No se encontró esa cotización. Puede haberse convertido o eliminado.'
            }
          />
        </div>
      ) : null}

      {buscando ? (
        <IndicadorDeCarga mensaje="Cargando cotizaciones…" />
      ) : null}

      <section>
        <div
          className="hidden md:grid transition-[grid-template-rows] duration-media ease-salida motion-reduce:transition-none"
          style={{
            gridTemplateRows:
              buscada !== null && !buscando ? '1fr' : '0fr',
          }}
        >
          <div className="min-h-0 overflow-hidden">
            {detalleRetenido !== null && !buscando ? (
              <div className="pb-6">
                <DetalleDeCotizacion
                  cotizacion={detalleRetenido}
                  onAbrirPedido={() => abrirEnPedido(detalleRetenido)}
                  onEliminar={() => setAEliminar(detalleRetenido)}
                  onPdf={() => intentarAbrirPdf(detalleRetenido)}
                  onCerrar={() => setBuscada(null)}
                />
              </div>
            ) : null}
          </div>
        </div>
        {pendientes.isLoading ? (
          <IndicadorDeCarga mensaje="Cargando cotizaciones…" />
        ) : null}
        {pendientes.isError ? (
          <p className="text-cuerpo font-bold text-aviso" role="alert">
            No se pudieron cargar las cotizaciones.
            {pendientes.error instanceof Error && pendientes.error.message
              ? ` (${pendientes.error.message})`
              : null}
          </p>
        ) : null}
        {pendientesFiltrados.length === 0 &&
        propuestasPdf.length === 0 &&
        !pendientes.isLoading ? (
          <EstadoVacio
            titulo={
              consulta.trim().length > 0
                ? 'Ninguna pendiente coincide con esa búsqueda.'
                : 'No hay cotizaciones pendientes.'
            }
          />
        ) : null}
        <ul className="flex flex-col gap-2">
          {propuestasPdf.map((cada) => (
            <li
              key={cada.id}
              className="fila-entrada flex items-stretch gap-2"
            >
              <div
                className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-2xl border border-borde bg-papel px-4 py-3"
                aria-busy={cada.fase === 'procesando' || undefined}
              >
                <span className="font-mono font-bold text-tinta">
                  {etiquetaDeClaseMedio(cada.claseMedio)}
                </span>
                <span
                  className="truncate text-cuerpo text-desvaida"
                  aria-live={cada.fase === 'procesando' ? 'polite' : undefined}
                >
                  {cada.fase === 'procesando'
                    ? 'El sistema está cotizando.'
                    : cada.fase === 'error'
                      ? (cada.mensajeError ?? 'No se pudo leer')
                      : `${cada.etiquetaCliente ?? 'Sin cliente'} · ${cada.lineas?.length ?? 0} ${(cada.lineas?.length ?? 0) === 1 ? 'línea' : 'líneas'}`}
                </span>
                {cada.fase === 'lista' ? (
                  <Boton
                    variante="principal"
                    className="shrink-0"
                    onClick={() => revisarPdf(cada)}
                  >
                    Revisar cotización
                  </Boton>
                ) : cada.fase === 'procesando' ? (
                  <Loader2
                    className="size-5 shrink-0 animate-spin text-tinta"
                    aria-hidden
                  />
                ) : (
                  <span className="shrink-0 text-cuerpo font-bold text-aviso">
                    Error
                  </span>
                )}
              </div>
            </li>
          ))}
          {pendientesFiltrados.map((cada) => {
            const abierta = buscada?.id === cada.id
            const fecha = formatearFechaCortaCotizacion(
              cada.actualizadoEn ?? cada.creadoEn,
            )
            return (
              <li key={cada.id} className="flex flex-col gap-2">
                <div className="flex items-stretch gap-2">
                  <button
                    type="button"
                    className={[
                      'flex min-w-0 flex-1 items-start justify-between gap-3 rounded-2xl border bg-papel px-4 py-3 text-left hover:bg-mesa md:items-center',
                      abierta ? 'border-sello' : 'border-borde',
                    ].join(' ')}
                    aria-expanded={abierta}
                    onClick={() => {
                      if (abierta) {
                        setBuscada(null)
                        return
                      }
                      presentar(cada)
                    }}
                  >
                    <span className="flex min-w-0 items-start gap-3 md:items-center">
                      <span className="shrink-0 font-mono font-bold text-tinta">
                        #{cada.numero}
                      </span>
                      <span className="min-w-0 text-cuerpo text-desvaida">
                        <span className="block truncate md:inline">
                          {cada.cliente?.denominacion ?? 'Sin cliente'} ·{' '}
                          {cada.lineas.length}{' '}
                          {cada.lineas.length === 1 ? 'línea' : 'líneas'}
                        </span>
                        <span className="block md:ml-1 md:inline">{fecha}</span>
                      </span>
                    </span>
                    <span className="shrink-0 font-mono tabular-nums font-bold text-tinta">
                      {formatearImporte(cada.total)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={[
                      'hidden size-11 shrink-0 items-center justify-center self-center rounded-full md:inline-flex',
                      'text-desvaida transition-colors duration-rapida ease-salida',
                      'hover:bg-mesa hover:text-tinta',
                      'focus-visible:outline-none focus-visible:border focus-visible:border-tinta',
                    ].join(' ')}
                    aria-label={`Abrir PDF de la cotización ${cada.numero}`}
                    title="Abrir PDF"
                    onClick={() => intentarAbrirPdf(cada)}
                  >
                    <FileText className="size-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={[
                      'hidden size-11 shrink-0 items-center justify-center self-center rounded-full md:inline-flex',
                      'text-desvaida transition-colors',
                      'hover:bg-aviso/15 hover:text-aviso',
                      'focus-visible:outline-none focus-visible:border focus-visible:border-tinta',
                    ].join(' ')}
                    aria-label={`Eliminar cotización ${cada.numero}`}
                    title="Eliminar cotización"
                    onClick={() => setAEliminar(cada)}
                  >
                    <Trash2 className="size-5" aria-hidden />
                  </button>
                </div>
                <div
                  className="grid md:hidden transition-[grid-template-rows] duration-media ease-salida motion-reduce:transition-none"
                  style={{ gridTemplateRows: abierta ? '1fr' : '0fr' }}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div className="pt-0 pb-1">
                      {detalleRetenido?.id === cada.id ? (
                        <DetalleDeCotizacion
                          compacto
                          cotizacion={cada}
                          onAbrirPedido={() => abrirEnPedido(cada)}
                          onEliminar={() => setAEliminar(cada)}
                          onPdf={() => intentarAbrirPdf(cada)}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <Modal
        abierta={aEliminar !== null}
        alCambiar={(abierta) => {
          if (!abierta && !eliminando) setAEliminar(null)
        }}
        titulo="Eliminar cotización"
        descripcion={
          aEliminar !== null
            ? `Se eliminará la cotización #${aEliminar.numero}. Esta acción no se puede deshacer.`
            : undefined
        }
        pie={
          <div className="flex flex-wrap justify-end gap-2">
            <Boton
              variante="secundario"
              disabled={eliminando}
              onClick={() => setAEliminar(null)}
            >
              Cancelar
            </Boton>
            <Boton
              variante="principal"
              disabled={eliminando}
              onClick={() => void confirmarEliminacion()}
            >
              {eliminando ? 'Eliminando…' : 'Confirmar'}
            </Boton>
          </div>
        }
      >
        <p className="text-cuerpo text-tinta">
          {aEliminar !== null
            ? `${aEliminar.cliente?.denominacion ?? 'Sin cliente'} · ${aEliminar.lineas.length} líneas · ${formatearImporte(aEliminar.total)}`
            : null}
        </p>
      </Modal>
    </div>
  )
}
