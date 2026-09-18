import {
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { ButtonHTMLAttributes, CSSProperties, Ref } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Camera, EllipsisVertical, Eye, Mic, Search } from 'lucide-react'
import {
  comandosCoincidentes,
  esModoComando,
  pistaDeComando,
  placeholderDelBuscador,
  textoAlElegirComando,
} from '../../features/comandos/pistas.ts'
import type { DefinicionDeComando } from '../../features/comandos/pistas.ts'
import type { Cotizacion } from '../../features/cotizaciones/tipos.ts'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import type {
  ProductoBuscable,
  ResultadoDeBusqueda,
} from '../../domain/busqueda/productos.ts'
import { Casilla } from './primitivas.tsx'

/**
 * Cinta de herramientas del mostrador: un campo + dictado/foto.
 * El marco sticky lo pone el padre junto a los tabs (sin separación visible).
 * Soft-Pill: cápsulas, borde sutil, full-bleed del área de trabajo.
 *
 * Las sugerencias flotan sobre el contenido (no lo desplazan) y se pueden
 * ocultar; al ocultar, un ojo al final del campo las restaura.
 * Con `/` (modo comando): lista seleccionable del catálogo + fantasma de parámetros.
 */

export interface MangoDeEntrada {
  readonly enfocar: () => void
}

export interface PropsDeEntrada {
  readonly resultado: ResultadoDeBusqueda<ProductoBuscable>
  readonly termino: string
  readonly onTerminoCambia: (termino: string) => void
  readonly onElegirProducto: (producto: ProductoBuscable) => void
  /** Lote desde multi-select; si falta, se llama `onElegirProducto` por cada uno. */
  readonly onElegirProductos?: (productos: readonly ProductoBuscable[]) => void
  readonly asistenciaDisponible: boolean
  /** Motivo visible cuando mic/cámara están inertes (T127). */
  readonly motivoAsistenciaInerte?: string | null
  readonly onDictar?: () => void
  readonly onFotografiar?: () => void
  readonly enfocarAlMontar?: boolean
  /** Último término de producto de la sesión; se restaura con Enter en vacío. */
  readonly ultimaBusqueda?: string
  /** Ejecuta un comando ya escrito (no completa el prefijo). */
  readonly onEjecutarComando?: (texto: string) => void
  /**
   * Resultado diferido de `/coti {nombre}` (null = aún no se buscó).
   * Va encima de las pistas de comando.
   */
  readonly cotizacionesSugeridas?: ResultadoDeBusqueda<Cotizacion> | null
  readonly onElegirCotizacion?: (cotizacion: Cotizacion) => void
  /** La consulta del listbox aún no alcanzó el término que se ve en el campo. */
  readonly consultaPendiente?: boolean
  /** Imperative handle (React 19 ref-as-prop) para return focus to search. */
  readonly ref?: Ref<MangoDeEntrada>
}

export function Entrada({
  resultado,
  termino,
  onTerminoCambia,
  onElegirProducto,
  onElegirProductos,
  asistenciaDisponible,
  motivoAsistenciaInerte = null,
  onDictar,
  onFotografiar,
  enfocarAlMontar = true,
  ultimaBusqueda = '',
  onEjecutarComando,
  cotizacionesSugeridas = null,
  onElegirCotizacion,
  consultaPendiente = false,
  ref,
}: PropsDeEntrada) {
  const campo = useRef<HTMLInputElement>(null)
  const [resaltado, setResaltado] = useState(0)
  const [minimizado, setMinimizado] = useState(false)
  const [seleccionados, setSeleccionados] = useState<ReadonlySet<string>>(
    () => new Set(),
  )

  useImperativeHandle(ref, () => ({
    enfocar: () => {
      campo.current?.focus()
    },
  }))

  useEffect(() => {
    if (enfocarAlMontar) campo.current?.focus()
  }, [enfocarAlMontar])

  useEffect(() => {
    setResaltado(0)
    setMinimizado(false)
    setSeleccionados(new Set())
  }, [termino, cotizacionesSugeridas])

  const modoComando = esModoComando(termino)
  const pista = modoComando ? pistaDeComando(termino) : null
  const comandos = modoComando
    ? cotizacionesSugeridas !== null
      ? comandosCoincidentes('/coti')
      : comandosCoincidentes(termino)
    : []
  const cotizacionesHalladas = cotizacionesSugeridas?.coincidencias ?? []
  const itemsComando = cotizacionesHalladas.length + comandos.length
  const sugiriendoProducto = termino.length > 0 && !modoComando
  const sugiriendoComando = modoComando
  const coincidencias = resultado.coincidencias
  const panelProductoAbierto = sugiriendoProducto && !minimizado
  const panelComandoAbierto = sugiriendoComando && !minimizado
  const panelAbierto = panelProductoAbierto || panelComandoAbierto
  const mostrarOjo =
    (sugiriendoProducto || sugiriendoComando) && minimizado
  const placeholder = placeholderDelBuscador(termino)
  const cantidadSeleccionada = seleccionados.size

  function restaurarUltimaSiVacio(): void {
    if (termino.length > 0) return
    if (ultimaBusqueda.trim().length === 0) return
    if (esModoComando(ultimaBusqueda)) return
    onTerminoCambia(ultimaBusqueda)
  }

  function elegirProducto(indice: number): void {
    const elegida = coincidencias[indice]
    if (elegida === undefined) return
    onElegirProducto(elegida.elemento)
    onTerminoCambia('')
    setSeleccionados(new Set())
    setMinimizado(false)
    campo.current?.focus()
  }

  function alternarSeleccion(codigo: string): void {
    setSeleccionados((actual) => {
      const siguiente = new Set(actual)
      if (siguiente.has(codigo)) siguiente.delete(codigo)
      else siguiente.add(codigo)
      return siguiente
    })
  }

  function agregarSeleccionados(): void {
    if (cantidadSeleccionada === 0) return
    const productos = coincidencias
      .filter((cada) => seleccionados.has(cada.elemento.codigo))
      .map((cada) => cada.elemento)
    if (onElegirProductos !== undefined) {
      onElegirProductos(productos)
    } else {
      for (const producto of productos) onElegirProducto(producto)
    }
    onTerminoCambia('')
    setSeleccionados(new Set())
    setMinimizado(false)
    campo.current?.focus()
  }

  function elegirComando(indice: number): void {
    const elegida = comandos[indice]
    if (elegida === undefined) return
    onTerminoCambia(textoAlElegirComando(elegida))
    setMinimizado(false)
    setResaltado(0)
    campo.current?.focus()
  }

  function elegirCotizacion(indice: number): void {
    const elegida = cotizacionesHalladas[indice]
    if (elegida === undefined) return
    onElegirCotizacion?.(elegida.elemento)
    onTerminoCambia('')
    setMinimizado(false)
    campo.current?.focus()
  }

  function elegirItemComando(indice: number): void {
    if (indice < cotizacionesHalladas.length) {
      elegirCotizacion(indice)
      return
    }
    elegirComando(indice - cotizacionesHalladas.length)
  }

  function alPulsarTecla(evento: React.KeyboardEvent<HTMLInputElement>): void {
    if (modoComando) {
      if (evento.key === 'Escape') {
        onTerminoCambia('')
        setMinimizado(false)
        return
      }
      if (minimizado) {
        if (evento.key === 'ArrowDown') {
          evento.preventDefault()
          setMinimizado(false)
        }
        return
      }
      if (itemsComando === 0) return
      if (evento.key === 'ArrowDown') {
        evento.preventDefault()
        setResaltado((actual) => (actual + 1) % itemsComando)
      } else if (evento.key === 'ArrowUp') {
        evento.preventDefault()
        setResaltado(
          (actual) => (actual - 1 + itemsComando) % itemsComando,
        )
      } else if (evento.key === 'Enter' || evento.key === 'Tab') {
        // Completar prefijo desde la lista; no ejecuta el comando.
        if (comandos.length > 0 && termino.trim() === '/') {
          evento.preventDefault()
          elegirComando(resaltado)
        } else if (
          evento.key === 'Tab' &&
          comandos.length > 0 &&
          !termino.includes(' ')
        ) {
          evento.preventDefault()
          elegirComando(resaltado)
        } else if (evento.key === 'Enter') {
          evento.preventDefault()
          if (cotizacionesSugeridas !== null && itemsComando > 0) {
            elegirItemComando(resaltado)
          } else {
            onEjecutarComando?.(termino)
          }
        }
      }
      return
    }

    if (!sugiriendoProducto) {
      if (evento.key === 'Enter' && termino.length === 0) {
        if (
          ultimaBusqueda.trim().length > 0 &&
          !esModoComando(ultimaBusqueda)
        ) {
          evento.preventDefault()
          restaurarUltimaSiVacio()
        }
      }
      return
    }

    if (evento.key === 'Escape') {
      onTerminoCambia('')
      setMinimizado(false)
      return
    }

    if (minimizado) {
      if (evento.key === 'ArrowDown') {
        evento.preventDefault()
        setMinimizado(false)
      }
      return
    }

    if (coincidencias.length === 0) return

    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      setResaltado((actual) => (actual + 1) % coincidencias.length)
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      setResaltado(
        (actual) => (actual - 1 + coincidencias.length) % coincidencias.length,
      )
    } else if (evento.key === 'Enter') {
      evento.preventDefault()
      elegirProducto(resaltado)
    }
  }

  return (
    <div className="w-full bg-papel">
      <div className="relative">
        <div className="flex w-full items-stretch gap-2 px-4 pt-2 pb-1">
          <div
            className={[
              'relative flex flex-1 items-center rounded-full border border-borde bg-mesa shadow-sm',
              'focus-within:border-tinta',
            ].join(' ')}
          >
            <Search
              className="pointer-events-none absolute left-4 z-10 size-5 text-desvaida"
              aria-hidden
            />
            {/* Fantasma de parámetros (modo comando): detrás del input transparente. */}
            {modoComando &&
            pista !== null &&
            pista.fantasma.length > 0 &&
            termino.length > 0 ? (
              <div
                aria-hidden
                className={[
                  'pointer-events-none absolute inset-0 flex items-center overflow-hidden',
                  'pl-12',
                  mostrarOjo ? 'pr-14' : 'pr-4',
                  'text-entrada',
                ].join(' ')}
              >
                <span className="whitespace-pre text-transparent">{termino}</span>
                <span className="whitespace-pre text-desvaida">
                  {pista.fantasma}
                </span>
              </div>
            ) : null}
            <input
              ref={campo}
              value={termino}
              onChange={(evento) => onTerminoCambia(evento.target.value)}
              onKeyDown={alPulsarTecla}
              placeholder={placeholder}
              aria-label="Buscar producto o escribir un comando"
              aria-autocomplete="list"
              aria-expanded={panelAbierto}
              aria-controls={
                panelComandoAbierto
                  ? 'sugerencias-de-comando'
                  : panelProductoAbierto
                    ? 'sugerencias-de-producto'
                    : undefined
              }
              aria-activedescendant={
                panelComandoAbierto && itemsComando > 0
                  ? `comando-item-${resaltado}`
                  : panelProductoAbierto && coincidencias.length > 0
                    ? `sugerencia-${resaltado}`
                    : undefined
              }
              aria-describedby={
                modoComando && pista?.plantilla ? 'pista-comando' : undefined
              }
              role="combobox"
              className={[
                'relative z-[1] min-h-14 w-full rounded-full border-0 bg-transparent pl-12',
                mostrarOjo ? 'pr-14' : 'pr-4',
                'text-entrada text-tinta placeholder:text-desvaida',
                'focus-visible:outline-none',
              ].join(' ')}
            />
            {modoComando && pista?.plantilla ? (
              <span id="pista-comando" className="sr-only">
                Comando: {pista.plantilla}
              </span>
            ) : null}
            {mostrarOjo && (
              <button
                type="button"
                aria-label="Mostrar resultados de búsqueda"
                title="Mostrar resultados"
                onClick={() => {
                  setMinimizado(false)
                  campo.current?.focus()
                }}
                className={[
                  'absolute right-2 z-10 flex size-10 items-center justify-center',
                  'rounded-full text-tinta hover:bg-papel',
                  'focus-visible:outline-none focus-visible:border focus-visible:border-tinta',
                ].join(' ')}
              >
                <Eye className="size-5" aria-hidden />
              </button>
            )}
          </div>

          <BotonDeCaptura
            className="hidden md:flex"
            etiqueta="Dictar el pedido"
            disponible={asistenciaDisponible}
            motivoInerte={motivoAsistenciaInerte}
            onClick={onDictar}
          >
            <Mic className="size-6" aria-hidden />
          </BotonDeCaptura>

          <BotonDeCaptura
            className="hidden md:flex"
            etiqueta="Fotografiar el pedido"
            disponible={asistenciaDisponible}
            motivoInerte={motivoAsistenciaInerte}
            onClick={onFotografiar}
          >
            <Camera className="size-6" aria-hidden />
          </BotonDeCaptura>

          <MenuDeCapturaMovil
            disponible={asistenciaDisponible}
            motivoInerte={motivoAsistenciaInerte}
            onDictar={onDictar}
            onFotografiar={onFotografiar}
          />
        </div>

        {/* El motivo vive en la banda global (BandaDegradacion) y en title/aria
            de los botones; no se repite aquí bajo el buscador. */}
        {!asistenciaDisponible && (
          <span data-testid="asistencia-inerte" className="sr-only">
            {motivoAsistenciaInerte ??
              'Dictado y fotografía no disponibles. Puedes escribir el pedido.'}
          </span>
        )}

        {panelAbierto && (
          <div
            className={[
              'absolute left-0 right-0 top-full z-30',
              'border-b border-borde bg-papel shadow-lg',
            ].join(' ')}
          >
            <div className="relative flex items-center justify-center border-b border-borde px-2 py-1">
              {panelProductoAbierto && cantidadSeleccionada > 0 ? (
                <button
                  type="button"
                  onClick={agregarSeleccionados}
                  className={[
                    'absolute left-2 inline-flex min-h-9 items-center rounded-full',
                    'bg-tinta px-3 text-etiqueta font-bold text-papel',
                    'hover:opacity-90',
                    'focus-visible:outline-none focus-visible:border focus-visible:border-tinta',
                  ].join(' ')}
                >
                  Agregar {cantidadSeleccionada}{' '}
                  {cantidadSeleccionada === 1 ? 'producto' : 'productos'}
                </button>
              ) : null}
              <button
                type="button"
                aria-label="Ocultar resultados de búsqueda"
                title="Ocultar resultados"
                onClick={() => {
                  setMinimizado(true)
                  campo.current?.focus()
                }}
                className={[
                  'flex size-9 items-center justify-center rounded-full',
                  'text-desvaida hover:bg-mesa hover:text-tinta',
                  'focus-visible:outline-none focus-visible:border focus-visible:border-tinta',
                ].join(' ')}
              >
                <Eye className="size-5" aria-hidden />
              </button>
            </div>
            {panelComandoAbierto ? (
              <SugerenciasDeComando
                cotizaciones={cotizacionesHalladas}
                busquedaCoti={cotizacionesSugeridas}
                comandos={comandos}
                resaltado={resaltado}
                onElegirCotizacion={elegirCotizacion}
                onElegirComando={elegirComando}
                onResaltar={setResaltado}
              />
            ) : (
              <Sugerencias
                resultado={resultado}
                resaltado={resaltado}
                seleccionados={seleccionados}
                consultaPendiente={consultaPendiente}
                onAlternarSeleccion={alternarSeleccion}
                onElegir={elegirProducto}
                onResaltar={setResaltado}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function BotonDeCaptura({
  etiqueta,
  disponible,
  motivoInerte,
  onClick,
  children,
  className,
  ref,
  ...resto
}: {
  readonly etiqueta: string
  readonly disponible: boolean
  readonly motivoInerte?: string | null
  readonly onClick: (() => void) | undefined
  readonly children: React.ReactNode
  readonly className?: string
  readonly ref?: Ref<HTMLButtonElement>
} & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  | 'children'
  | 'className'
  | 'disabled'
  | 'onClick'
  | 'type'
  | 'aria-label'
  | 'title'
  | 'ref'
>) {
  const titulo = disponible
    ? etiqueta
    : `${etiqueta} — ${motivoInerte ?? 'no disponible'}`
  return (
    <button
      {...resto}
      ref={ref}
      type="button"
      aria-label={titulo}
      title={titulo}
      disabled={!disponible}
      onClick={onClick}
      className={[
        className ?? 'flex',
        'min-h-14 w-14 shrink-0 items-center justify-center rounded-full border',
        'focus-visible:outline-none focus-visible:border-tinta',
        disponible
          ? 'border-borde bg-papel text-tinta shadow-sm hover:bg-tinta hover:text-papel'
          : 'cursor-not-allowed border-borde bg-mesa text-desvaida',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function AccionDeCaptura({
  etiqueta,
  disponible,
  motivoInerte,
  onClick,
  children,
}: {
  readonly etiqueta: string
  readonly disponible: boolean
  readonly motivoInerte?: string | null
  readonly onClick: () => void
  readonly children: React.ReactNode
}) {
  const titulo = disponible
    ? etiqueta
    : `${etiqueta} — ${motivoInerte ?? 'no disponible'}`
  return (
    <button
      type="button"
      aria-label={titulo}
      title={titulo}
      disabled={!disponible}
      onClick={onClick}
      className={[
        'flex min-h-11 w-full items-center gap-3 rounded-full px-4 text-left text-cuerpo font-bold',
        'focus-visible:outline-none focus-visible:border focus-visible:border-tinta',
        disponible
          ? 'text-tinta hover:bg-mesa'
          : 'cursor-not-allowed text-desvaida',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function MenuDeCapturaMovil({
  disponible,
  motivoInerte,
  onDictar,
  onFotografiar,
}: {
  readonly disponible: boolean
  readonly motivoInerte?: string | null
  readonly onDictar: (() => void) | undefined
  readonly onFotografiar: (() => void) | undefined
}) {
  const idMenu = useId()
  const [abierto, setAbierto] = useState(false)
  const cajaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    function alPuntero(evento: PointerEvent): void {
      if (cajaRef.current?.contains(evento.target as Node)) return
      setAbierto(false)
    }
    function alTecla(evento: KeyboardEvent): void {
      if (evento.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('pointerdown', alPuntero)
    document.addEventListener('keydown', alTecla)
    return () => {
      document.removeEventListener('pointerdown', alPuntero)
      document.removeEventListener('keydown', alTecla)
    }
  }, [abierto])

  function elegir(accion: (() => void) | undefined): void {
    setAbierto(false)
    accion?.()
  }

  return (
    <div ref={cajaRef} className="relative flex md:hidden">
      <BotonDeCaptura
        className="flex"
        etiqueta={
          abierto ? 'Cerrar formas de capturar' : 'Más formas de capturar'
        }
        disponible
        data-testid="menu-captura"
        aria-expanded={abierto}
        aria-controls={idMenu}
        onClick={() => setAbierto((actual) => !actual)}
      >
        <EllipsisVertical className="size-6" aria-hidden />
      </BotonDeCaptura>
      <div
        id={idMenu}
        data-testid="menu-captura-panel"
        data-open={abierto ? 'true' : undefined}
        className="menu-captura-entrada absolute top-full right-0 z-40 mt-2 min-w-56 flex-col gap-1 rounded-2xl border border-borde bg-papel p-2 shadow-md"
      >
        <AccionDeCaptura
          etiqueta="Dictar el pedido"
          disponible={disponible}
          motivoInerte={motivoInerte}
          onClick={() => elegir(onDictar)}
        >
          <Mic className="size-5 shrink-0" aria-hidden />
          Dictar
        </AccionDeCaptura>
        <AccionDeCaptura
          etiqueta="Fotografiar el pedido"
          disponible={disponible}
          motivoInerte={motivoInerte}
          onClick={() => elegir(onFotografiar)}
        >
          <Camera className="size-5 shrink-0" aria-hidden />
          Fotografiar
        </AccionDeCaptura>
      </div>
    </div>
  )
}

function SugerenciasDeComando({
  cotizaciones,
  busquedaCoti,
  comandos,
  resaltado,
  onElegirCotizacion,
  onElegirComando,
  onResaltar,
}: {
  readonly cotizaciones: ResultadoDeBusqueda<Cotizacion>['coincidencias']
  readonly busquedaCoti: ResultadoDeBusqueda<Cotizacion> | null
  readonly comandos: readonly DefinicionDeComando[]
  readonly resaltado: number
  readonly onElegirCotizacion: (indice: number) => void
  readonly onElegirComando: (indice: number) => void
  readonly onResaltar: (indice: number) => void
}) {
  if (comandos.length === 0 && cotizaciones.length === 0 && busquedaCoti === null) {
    return (
      <div className="w-full bg-papel px-4 py-3">
        <p className="text-cuerpo font-bold text-aviso">
          Ningún comando coincide
        </p>
        <p className="text-cuerpo text-desvaida">
          Escribe `/ayuda` o elige otro prefijo del catálogo.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full bg-papel">
      {busquedaCoti !== null && busquedaCoti.sinCoincidencias ? (
        <p className="border-b border-borde px-4 py-2 text-cuerpo font-bold text-aviso">
          No hay cotizaciones con el nombre «{busquedaCoti.termino}»
        </p>
      ) : null}
      <ul
        id="sugerencias-de-comando"
        role="listbox"
        aria-label="Cotizaciones y comandos"
        className="max-h-80 overflow-y-auto"
      >
        {cotizaciones.map((coincidencia, indice) => {
          const cotizacion = coincidencia.elemento
          const activo = indice === resaltado
          return (
            <li
              key={cotizacion.id}
              id={`comando-item-${indice}`}
              role="option"
              aria-selected={activo}
            >
              <button
                type="button"
                onMouseEnter={() => onResaltar(indice)}
                onClick={() => onElegirCotizacion(indice)}
                className={[
                  'flex min-h-11 w-full items-baseline justify-between gap-3 px-4 py-2 text-left',
                  activo ? 'bg-tinta text-papel' : 'text-tinta hover:bg-mesa',
                ].join(' ')}
              >
                <span className="min-w-0">
                  <span className="block truncate text-cuerpo font-bold">
                    #{cotizacion.numero} ·{' '}
                    {cotizacion.cliente?.denominacion ?? 'Sin cliente'}
                  </span>
                  <span
                    className={[
                      'block font-mono text-etiqueta',
                      activo ? 'text-papel/70' : 'text-desvaida',
                    ].join(' ')}
                  >
                    {cotizacion.lineas.length}{' '}
                    {cotizacion.lineas.length === 1 ? 'línea' : 'líneas'}
                  </span>
                </span>
                <span className="shrink-0 font-mono tabular-nums text-cuerpo font-bold">
                  {formatearImporte(cotizacion.total)}
                </span>
              </button>
            </li>
          )
        })}
        {comandos.map((comando, indice) => {
          const indiceGlobal = cotizaciones.length + indice
          const plantilla =
            comando.parametros.length === 0
              ? comando.prefijo
              : `${comando.prefijo} ${comando.parametros.join(' ')}`
          const activo = indiceGlobal === resaltado
          return (
            <li
              key={comando.id}
              id={`comando-item-${indiceGlobal}`}
              role="option"
              aria-selected={activo}
            >
              <button
                type="button"
                onMouseEnter={() => onResaltar(indiceGlobal)}
                onClick={() => onElegirComando(indice)}
                className={[
                  'flex min-h-11 w-full flex-col items-start gap-0.5 px-4 py-2 text-left',
                  activo
                    ? 'bg-tinta text-papel'
                    : 'text-tinta hover:bg-mesa',
                ].join(' ')}
              >
                <span className="font-mono text-cuerpo font-bold">
                  {plantilla}
                </span>
                <span
                  className={[
                    'text-etiqueta',
                    activo ? 'text-papel/70' : 'text-desvaida',
                  ].join(' ')}
                >
                  {comando.descripcion}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const OVERSCAN_LISTBOX = 6
const ALTO_FILA_SUGERENCIA = 56

function textoDeRecuento(cantidad: number): string {
  return cantidad === 1 ? '1 coincidencia' : `${cantidad} coincidencias`
}

function FilaSugerencia({
  coincidencia,
  indice,
  activo,
  marcado,
  estilo,
  onAlternarSeleccion,
  onElegir,
  onResaltar,
}: {
  readonly coincidencia: ResultadoDeBusqueda<ProductoBuscable>['coincidencias'][number]
  readonly indice: number
  readonly activo: boolean
  readonly marcado: boolean
  readonly estilo?: CSSProperties
  readonly onAlternarSeleccion: (codigo: string) => void
  readonly onElegir: (indice: number) => void
  readonly onResaltar: (indice: number) => void
}) {
  const codigo = coincidencia.elemento.codigo
  return (
    <div
      id={`sugerencia-${indice}`}
      role="option"
      aria-selected={marcado || activo}
      style={estilo}
      onMouseEnter={() => onResaltar(indice)}
      className={[
        'flex h-14 w-full items-center gap-2 overflow-hidden px-2',
        activo ? 'bg-tinta text-papel' : 'text-tinta hover:bg-mesa',
      ].join(' ')}
    >
      <Casilla
        checked={marcado}
        onCheckedChange={() => onAlternarSeleccion(codigo)}
        onClick={(evento) => evento.stopPropagation()}
        aria-label={`Seleccionar ${coincidencia.elemento.descripcion}`}
        className={
          activo
            ? 'border-papel/40 bg-papel/10 data-[state=checked]:bg-papel'
            : undefined
        }
      />
      <button
        type="button"
        onClick={() => onElegir(indice)}
        className={[
          'flex min-w-0 flex-1 items-baseline justify-between gap-3 px-2 text-left',
          'focus-visible:outline-none',
        ].join(' ')}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-cuerpo uppercase">
            {coincidencia.elemento.descripcion}
          </span>
          <span
            className={[
              'block truncate font-mono text-etiqueta uppercase',
              activo ? 'text-papel/70' : 'text-desvaida',
            ].join(' ')}
          >
            {codigo} · {coincidencia.elemento.unidad}
            {coincidencia.grado === 'aproximada' && ' · aproximado'}
          </span>
        </span>
        <span className="font-mono tabular-nums text-cuerpo font-bold">
          {formatearImporte(coincidencia.elemento.precio)}
        </span>
      </button>
    </div>
  )
}

function Sugerencias({
  resultado,
  resaltado,
  seleccionados,
  consultaPendiente,
  onAlternarSeleccion,
  onElegir,
  onResaltar,
}: {
  readonly resultado: ResultadoDeBusqueda<ProductoBuscable>
  readonly resaltado: number
  readonly seleccionados: ReadonlySet<string>
  readonly consultaPendiente: boolean
  readonly onAlternarSeleccion: (codigo: string) => void
  readonly onElegir: (indice: number) => void
  readonly onResaltar: (indice: number) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const coincidencias = resultado.coincidencias
  const virtualizador = useVirtualizer({
    count: coincidencias.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ALTO_FILA_SUGERENCIA,
    overscan: OVERSCAN_LISTBOX,
    initialRect: { width: 640, height: 384 },
    getItemKey: (indice) => coincidencias[indice]?.elemento.codigo ?? indice,
  })

  useLayoutEffect(() => {
    if (resultado.sinCoincidencias || coincidencias.length === 0) return
    virtualizador.scrollToIndex(resaltado, {
      align: 'auto',
      behavior: 'auto',
    })
  }, [
    coincidencias.length,
    resaltado,
    resultado.sinCoincidencias,
    virtualizador,
  ])

  if (resultado.sinCoincidencias) {
    return (
      <div className="w-full bg-papel px-4 py-3">
        <p className="text-cuerpo font-bold text-aviso">
          No hay ningún producto que coincida con «{resultado.termino}»
        </p>
        <p className="text-cuerpo text-desvaida">
          Revisa cómo se escribe, o pídele al administrador que lo cargue.
        </p>
      </div>
    )
  }

  return (
    <div
      className="sugerencias-consulta w-full bg-papel"
      data-pendiente={consultaPendiente ? 'true' : undefined}
    >
      <p className="border-b border-borde px-4 py-1.5 font-mono text-etiqueta font-bold uppercase text-desvaida">
        {textoDeRecuento(coincidencias.length)}
      </p>
      {resultado.soloAproximadas && (
        <p className="border-b border-aviso px-4 py-1.5 font-mono text-etiqueta font-bold uppercase text-aviso">
          Nada coincide con exactitud. Comprueba antes de aceptar.
        </p>
      )}
      <div
        ref={scrollRef}
        id="sugerencias-de-producto"
        role="listbox"
        aria-busy={consultaPendiente || undefined}
        aria-multiselectable="true"
        className="max-h-[min(24rem,50dvh)] overflow-y-auto"
      >
        <div
          className="relative w-full"
          style={{ height: virtualizador.getTotalSize() }}
        >
          {virtualizador.getVirtualItems().map((virtual) => {
            const coincidencia = coincidencias[virtual.index]
            if (coincidencia === undefined) return null
            return (
              <FilaSugerencia
                key={virtual.key}
                coincidencia={coincidencia}
                indice={virtual.index}
                activo={virtual.index === resaltado}
                marcado={seleccionados.has(coincidencia.elemento.codigo)}
                estilo={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: virtual.size,
                  transform: `translateY(${virtual.start}px)`,
                }}
                onAlternarSeleccion={onAlternarSeleccion}
                onElegir={onElegir}
                onResaltar={onResaltar}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
