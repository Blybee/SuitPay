import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Search, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import { CLAVES_DE_CONSULTA } from '../../infra/consultas/cliente.ts'
import { ZonaDeCarga } from '../../ui/componentes/ZonaDeCarga.tsx'
import { Modal } from '../../ui/componentes/Modal.tsx'
import { Boton, Campo, Etiqueta } from '../../ui/componentes/primitivas.tsx'
import { usarCaptura } from '../captura/estado.ts'
import { usarCatalogo } from '../catalogo/almacen.ts'
import { usarDegradacion } from '../degradacion/estado.ts'
import { usarPedido } from '../pedido/almacen.ts'
import { diferenciasContraCatalogo } from './diferencias.ts'
import type { DiferenciaDeCotizacion } from './diferencias.ts'
import { eliminarCotizacion } from './eliminar.ts'
import {
  buscarCotizacionPorNumero,
  listarCotizacionesPendientes,
} from './leer.ts'
import { procesarRequerimientoDeCotizar } from './procesar-pdf.ts'
import { usarPropuestasPdf } from './propuestas.ts'
import type { PropuestaPdf } from './propuestas.ts'
import type { Cotizacion } from './tipos.ts'
import { YaUsada } from './ya-usada.tsx'
import { buscarCoincidenciasDeCliente } from '../clientes/coincidencias.ts'
import {
  leerClientePorDocumento,
  type ClienteExistente,
} from '../clientes/existencia.ts'
import { actualizarClienteFn } from '../clientes/clientes.funciones.ts'
import { clasificarArchivo } from '../../ui/componentes/ZonaDeCarga.tsx'

/**
 * Lista y recuperación de cotizaciones (FR-017, FR-018, FR-019a).
 * Montable en el tab del mostrador y en `/cotizaciones`.
 */
export function PanelDeCotizaciones({
  numeroInicial,
  onRecuperada,
}: {
  readonly numeroInicial?: number | null
  readonly onRecuperada?: () => void
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
  const [yaUsada, setYaUsada] = useState(false)
  const [diferencias, setDiferencias] = useState<
    readonly DiferenciaDeCotizacion[]
  >([])
  const [aviso, setAviso] = useState<string | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [aEliminar, setAEliminar] = useState<Cotizacion | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [zonaPdf, setZonaPdf] = useState(false)
  const [archivoCotizar, setArchivoCotizar] = useState<File | null>(null)
  const [textoWhatsapp, setTextoWhatsapp] = useState('')
  const [mostrarTexto, setMostrarTexto] = useState(false)
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

  useEffect(() => {
    if (buscada === null) return
    setDiferencias(
      diferenciasContraCatalogo(buscada.lineas, (codigo) =>
        catalogo.productoPorCodigo(codigo),
      ),
    )
  }, [buscada, catalogo.listo, catalogo.version])

  async function recuperarPorNumero(numero: number): Promise<void> {
    setBuscando(true)
    setAviso(null)
    setBuscada(null)
    setYaUsada(false)
    setDiferencias([])
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
      setBuscada(hallada)
    } finally {
      setBuscando(false)
    }
  }

  function presentar(cotizacion: Cotizacion): void {
    setYaUsada(false)
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
      lineas: cotizacion.lineas,
      cliente: cotizacion.cliente,
    })
    void queryClient.invalidateQueries({
      queryKey: CLAVES_DE_CONSULTA.cotizacionesPendientes,
    })
    onRecuperada?.()
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

  async function lanzarCotizar(): Promise<void> {
    if (enviandoCotizar) return
    setEnviandoCotizar(true)
    try {
      await procesarRequerimientoDeCotizar({
        archivo: archivoCotizar,
        texto: textoWhatsapp,
        clienteId: clienteElegido?.numeroDocumento,
      })
      setArchivoCotizar(null)
      setTextoWhatsapp('')
      setMostrarTexto(false)
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
        className="flex flex-wrap items-end gap-3"
        onSubmit={(evento) => {
          evento.preventDefault()
          const numero = Number.parseInt(consulta.trim(), 10)
          if (!Number.isFinite(numero) || numero <= 0) {
            setAviso('Escribe un número de cotización válido.')
            return
          }
          void recuperarPorNumero(numero)
        }}
      >
        <div className="min-w-40 flex-1">
          <Etiqueta htmlFor="numero-cotizacion">Número</Etiqueta>
          <div className="relative">
            <Campo
              id="numero-cotizacion"
              inputMode="numeric"
              value={consulta}
              onChange={(evento) => setConsulta(evento.target.value)}
              placeholder="ej. 1042"
              autoComplete="off"
              className="pr-12"
            />
            <button
              type="submit"
              className="absolute top-1/2 right-1 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-tinta transition-[opacity,transform] duration-rapida ease-salida hover:bg-mesa focus-visible:border focus-visible:border-tinta focus-visible:outline-none disabled:opacity-50"
              aria-label={buscando ? 'Buscando cotización' : 'Recuperar cotización'}
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
            <button
              type="button"
              className="self-start rounded-full px-3 py-1.5 text-cuerpo font-bold text-tinta transition-colors duration-rapida ease-salida hover:bg-mesa"
              onClick={() => setMostrarTexto((v) => !v)}
              aria-expanded={mostrarTexto}
            >
              {mostrarTexto ? 'Ocultar mensaje' : 'Pegar mensaje de WhatsApp'}
            </button>
            <div
              className="grid transition-[grid-template-rows] duration-media ease-salida motion-reduce:transition-none"
              style={{ gridTemplateRows: mostrarTexto ? '1fr' : '0fr' }}
            >
              <div className="min-h-0 overflow-hidden">
                <Etiqueta htmlFor="texto-whatsapp-cotizar">
                  Mensaje del cliente
                </Etiqueta>
                <textarea
                  id="texto-whatsapp-cotizar"
                  value={textoWhatsapp}
                  onChange={(evento) => setTextoWhatsapp(evento.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-2xl border border-borde bg-papel px-3 py-2 text-cuerpo text-tinta"
                  placeholder="Pega aquí el mensaje…"
                />
              </div>
            </div>
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

      {buscada !== null ? (
        <article className="rounded-3xl border border-borde bg-papel p-5 shadow-sm">
          <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-entrada font-bold text-tinta">
              Cotización {buscada.numero}
            </h3>
            <p className="font-mono tabular-nums text-cuerpo font-bold text-tinta">
              {formatearImporte(buscada.total)}
            </p>
          </header>

          {diferencias.length > 0 ? (
            <div
              className="mb-3 rounded-2xl border border-aviso px-3 py-2"
              role="status"
            >
              <p className="text-cuerpo font-bold text-aviso">
                Hay cambios respecto al catálogo actual
              </p>
              <ul className="mt-1 list-disc pl-5 text-cuerpo text-tinta">
                {diferencias.map((cada) => (
                  <li key={`${cada.codigo}-${cada.indice}`}>
                    {cada.clase === 'producto_desaparecido'
                      ? `${cada.descripcion} (${cada.codigo}) ya no está en el catálogo.`
                      : `${cada.descripcion}: precio guardado ${formatearImporte(cada.precioGuardado)}, actual ${formatearImporte(cada.precioActual ?? 0)}.`}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <ul className="mb-4 space-y-1 text-cuerpo text-tinta">
            {buscada.lineas.map((linea, indice) => (
              <li key={`${linea.codigo}-${indice}`}>
                {linea.cantidad} × {linea.descripcion} —{' '}
                {formatearImporte(linea.precio)}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2">
            <Boton
              variante="principal"
              onClick={() => abrirEnPedido(buscada)}
            >
              Abrir en el pedido
            </Boton>
            <Boton
              variante="secundario"
              onClick={() => setAEliminar(buscada)}
            >
              Eliminar
            </Boton>
          </div>
        </article>
      ) : null}

      <section>
        <h3 className="mb-2 font-mono text-etiqueta uppercase text-desvaida">
          Pendientes recientes
        </h3>
        {pendientes.isLoading ? (
          <p className="text-cuerpo text-desvaida">Cargando…</p>
        ) : null}
        {pendientes.isError ? (
          <p className="text-cuerpo font-bold text-aviso" role="alert">
            No se pudieron cargar las cotizaciones.
            {pendientes.error instanceof Error && pendientes.error.message
              ? ` (${pendientes.error.message})`
              : null}
          </p>
        ) : null}
        {(pendientes.data?.length ?? 0) === 0 &&
        propuestasPdf.length === 0 &&
        !pendientes.isLoading ? (
          <p className="text-cuerpo text-desvaida">
            No hay cotizaciones pendientes.
          </p>
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
                <span className="font-mono font-bold text-tinta">PDF</span>
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
          {(pendientes.data ?? []).map((cada) => (
            <li key={cada.id} className="flex items-stretch gap-2">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-2xl border border-borde bg-papel px-4 py-3 text-left hover:bg-mesa"
                onClick={() => {
                  presentar(cada)
                  setConsulta(String(cada.numero))
                }}
              >
                <span className="font-mono font-bold text-tinta">
                  #{cada.numero}
                </span>
                <span className="truncate text-cuerpo text-desvaida">
                  {cada.cliente?.denominacion ?? 'Sin cliente'} ·{' '}
                  {cada.lineas.length}{' '}
                  {cada.lineas.length === 1 ? 'línea' : 'líneas'}
                </span>
                <span className="shrink-0 font-mono tabular-nums font-bold text-tinta">
                  {formatearImporte(cada.total)}
                </span>
              </button>
              <button
                type="button"
                className={[
                  'inline-flex size-11 shrink-0 items-center justify-center self-center rounded-full',
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
            </li>
          ))}
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
