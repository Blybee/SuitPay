import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { diaEnLima, ZONA_HORARIA } from '../../domain/anulacion/ventana.ts'
import {
  armarMes,
  cantidadDeDias,
  esDomingoEnLima,
  inicialesDe,
  isoDeDia,
  minutosDelDiaEnLima,
  sumarTotales,
  totalesDeCeldas,
} from '../../domain/fichaje/reglas.ts'
import type { EstadoDeMarca } from '../../domain/fichaje/reglas.ts'
import {
  aprobarFichajesFn,
  editarMarcaFn,
  eliminarHistorialFn,
  eliminarMarcaFn,
  quitarDelEquipoFn,
  rechazarFichajeFn,
  registrarManualFn,
} from './fichaje.funciones.ts'
import type { RespuestaDeFichaje } from './fichaje.funciones.ts'
import {
  usarColaFichaje,
  usarMesFichaje,
  usarRosterFichaje,
  usarUltimoFichaje,
} from './leer.ts'
import type { MarcaAprobada } from './leer.ts'
import './fichaje.css'

type Vista = 'aprobaciones' | 'manual' | 'historico'

const VISTAS: readonly {
  id: Vista
  indice: number
  numero: string
  etiqueta: string
}[] = [
  { id: 'aprobaciones', indice: 0, numero: '01', etiqueta: 'Aprobaciones' },
  { id: 'manual', indice: 1, numero: '02', etiqueta: 'Registro manual' },
  { id: 'historico', indice: 2, numero: '03', etiqueta: 'Histórico' },
]

const ESTADOS: readonly { id: EstadoDeMarca; etiqueta: string }[] = [
  { id: 'presente', etiqueta: 'Presente' },
  { id: 'tardanza', etiqueta: 'Tardanza' },
  { id: 'falta', etiqueta: 'Falta' },
  { id: 'justificado', etiqueta: 'Justificado' },
]

const ETIQUETA_DE_ESTADO: Record<EstadoDeMarca, string> = {
  presente: 'Presente',
  tardanza: 'Tardanza',
  falta: 'Falta',
  justificado: 'Justificado',
}

function horaCorta(instante: Date): string {
  const minutos = minutosDelDiaEnLima(instante)
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return `${String(horas).padStart(2, '0')}:${String(resto).padStart(2, '0')}`
}

function etiquetaMes(anio: number, mes: number): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: ZONA_HORARIA,
    month: 'long',
    year: 'numeric',
  })
    .format(new Date(`${isoDeDia(anio, mes, 1)}T12:00:00-05:00`))
    .toUpperCase()
}

function mesCorto(anio: number, mes: number): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: ZONA_HORARIA,
    month: 'short',
  })
    .format(new Date(`${isoDeDia(anio, mes, 1)}T12:00:00-05:00`))
    .replace('.', '')
    .toUpperCase()
}

function desplazar(
  anio: number,
  mes: number,
  delta: number,
): { anio: number; mes: number } {
  const fecha = new Date(Date.UTC(anio, mes - 1 + delta, 1))
  return { anio: fecha.getUTCFullYear(), mes: fecha.getUTCMonth() + 1 }
}

function folioDe(numero: number): string {
  return String(numero).padStart(5, '0')
}

function mensajeDe(respuesta: RespuestaDeFichaje): string {
  return respuesta.error?.mensaje ?? 'No se pudo completar. Inténtalo de nuevo.'
}

function partirHoy(iso: string): { anio: number; mes: number; dia: number } {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return { anio: anio ?? 2026, mes: mes ?? 1, dia: dia ?? 1 }
}

function filasDelMes(
  marcas: readonly MarcaAprobada[],
  anio: number,
  mes: number,
  hoy: string,
) {
  const porClave = new Map<
    string,
    { nombre: string; marcas: Record<number, EstadoDeMarca> }
  >()
  const ordenadas = [...marcas].sort(
    (una, otra) =>
      (una.horaEntrada?.getTime() ?? 0) - (otra.horaEntrada?.getTime() ?? 0),
  )
  for (const marca of ordenadas) {
    const dia = Number(marca.diaLima.slice(8, 10))
    const actual = porClave.get(marca.nombreClave) ?? {
      nombre: marca.nombre,
      marcas: {},
    }
    actual.nombre = marca.nombre
    actual.marcas[dia] = marca.estadoDia
    porClave.set(marca.nombreClave, actual)
  }
  return [...porClave.entries()]
    .map(([nombreClave, persona]) => {
      const celdas = armarMes({ anio, mes, hoy, marcas: persona.marcas })
      return {
        nombre: persona.nombre,
        nombreClave,
        celdas,
        totales: totalesDeCeldas(celdas),
      }
    })
    .sort((una, otra) => una.nombre.localeCompare(otra.nombre, 'es'))
}

function columnaLunes(iso: string): number {
  const nombre = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA,
    weekday: 'short',
  }).format(new Date(`${iso}T12:00:00-05:00`))
  const orden: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  }
  return orden[nombre] ?? 0
}

function claseVisual(clase: string): string {
  if (clase === 'domingo') return 'x'
  if (clase === 'proximo') return 'n'
  if (clase === 'presente') return 'p'
  if (clase === 'tardanza') return 't'
  if (clase === 'falta') return 'f'
  if (clase === 'justificado') return 'j'
  return 'n'
}

function SelectorDeVista({
  vista,
  pendientes,
  onElegir,
}: {
  readonly vista: Vista
  readonly pendientes: number
  readonly onElegir: (vista: Vista) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(0)
  const raiz = useRef<HTMLDivElement>(null)
  const listaId = useId()
  const actual = VISTAS.find((cada) => cada.id === vista) ?? VISTAS[0]

  useEffect(() => {
    if (!abierto) return
    const cerrar = (evento: PointerEvent) => {
      if (raiz.current === null || raiz.current.contains(evento.target as Node)) {
        return
      }
      setAbierto(false)
    }
    document.addEventListener('pointerdown', cerrar)
    return () => document.removeEventListener('pointerdown', cerrar)
  }, [abierto])

  function etiqueta(cada: (typeof VISTAS)[number]): string {
    if (cada.id === 'aprobaciones') return `${cada.etiqueta} (${pendientes})`
    return cada.etiqueta
  }

  return (
    <div className="vista-movil" ref={raiz}>
      <button
        type="button"
        className="vista-disparador"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={listaId}
        onClick={() => {
          setActivo(Math.max(0, VISTAS.findIndex((cada) => cada.id === vista)))
          setAbierto((esta) => !esta)
        }}
        onKeyDown={(evento) => {
          if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
            evento.preventDefault()
            if (!abierto) {
              setAbierto(true)
              return
            }
            setActivo((indiceActual) => {
              const paso = evento.key === 'ArrowDown' ? 1 : -1
              return (indiceActual + paso + VISTAS.length) % VISTAS.length
            })
          } else if (evento.key === 'Enter' && abierto) {
            evento.preventDefault()
            const elegido = VISTAS[activo]
            if (elegido !== undefined) onElegir(elegido.id)
            setAbierto(false)
          } else if (evento.key === 'Escape') {
            setAbierto(false)
          }
        }}
      >
        <span>{actual === undefined ? 'Vista' : etiqueta(actual)}</span>
        <span
          className={abierto ? 'vista-chevron abierto' : 'vista-chevron'}
          aria-hidden="true"
        >
          <svg viewBox="0 0 16 16" width="1em" height="1em">
            <path
              d="M3 6l5 5 5-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="square"
            />
          </svg>
        </span>
      </button>
      {abierto ? (
        <ul className="combo-lista" id={listaId} role="listbox">
          {VISTAS.map((cada, indiceVista) => (
            <li key={cada.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={cada.id === vista || indiceVista === activo}
                onMouseDown={(evento) => {
                  evento.preventDefault()
                  onElegir(cada.id)
                  setAbierto(false)
                }}
              >
                {etiqueta(cada)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function PanelFichaje() {
  const [ahora, setAhora] = useState(() => new Date())
  const [vista, setVista] = useState<Vista>('aprobaciones')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const hoy = diaEnLima(ahora)
  const partesHoy = partirHoy(hoy)
  const [mesVista, setMesVista] = useState({
    anio: partesHoy.anio,
    mes: partesHoy.mes,
  })
  const cola = usarColaFichaje()
  const delMes = usarMesFichaje(mesVista.anio, mesVista.mes)
  const deHoy = usarMesFichaje(partesHoy.anio, partesHoy.mes)
  const roster = usarRosterFichaje()
  const ultimo = usarUltimoFichaje()
  const tablaRef = useRef<HTMLDivElement>(null)
  const idTabs = useId()

  useEffect(() => {
    const relojId = window.setInterval(() => setAhora(new Date()), 1000)
    return () => window.clearInterval(relojId)
  }, [])

  const filas = useMemo(
    () => filasDelMes(delMes.marcas, mesVista.anio, mesVista.mes, hoy),
    [delMes.marcas, mesVista.anio, mesVista.mes, hoy],
  )
  const globales = sumarTotales(filas.map((fila) => fila.totales))
  const fichajesDelMes = delMes.marcas.filter(
    (marca) => marca.estadoDia !== 'falta',
  ).length
  const indice = VISTAS.find((cada) => cada.id === vista)?.indice ?? 0
  const anterior = desplazar(mesVista.anio, mesVista.mes, -1)
  const siguiente = desplazar(mesVista.anio, mesVista.mes, 1)

  async function aprobar(ids: readonly string[], clave: string): Promise<void> {
    setError(null)
    setOcupado(clave)
    try {
      const respuesta = await aprobarFichajesFn({ data: { ids: [...ids] } })
      if (!respuesta.ok) setError(mensajeDe(respuesta))
    } finally {
      setOcupado(null)
    }
  }

  async function rechazar(id: string): Promise<void> {
    setError(null)
    setOcupado(`no-${id}`)
    try {
      const respuesta = await rechazarFichajeFn({ data: { id } })
      if (!respuesta.ok) setError(mensajeDe(respuesta))
    } finally {
      setOcupado(null)
    }
  }

  function exportar(): void {
    const lineas = ['trabajador,dia,estado']
    for (const fila of filas) {
      for (const celda of fila.celdas) {
        if (celda.clase === 'domingo' || celda.clase === 'proximo') {
          continue
        }
        const iso = isoDeDia(mesVista.anio, mesVista.mes, celda.dia)
        lineas.push(`${fila.nombre},${iso},${celda.clase}`)
      }
    }
    const blob = new Blob([lineas.join('\n')], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `fichaje-${isoDeDia(mesVista.anio, mesVista.mes, 1).slice(0, 7)}.csv`
    enlace.click()
    URL.revokeObjectURL(url)
  }

  const marcasDeHoy = new Map<string, MarcaAprobada>()
  for (const marca of deHoy.marcas) {
    if (marca.diaLima === hoy) marcasDeHoy.set(marca.nombreClave, marca)
  }

  return (
    <div className="fichaje">
      <h1 className="sr">Fichaje</h1>
      <div className="wrap app">
        <nav className="nav" aria-label="Cambio de vista">
          <div
            className="seg"
            role="tablist"
            style={{ '--indice': indice } as CSSProperties}
          >
            {VISTAS.map((cada) => (
              <button
                key={cada.id}
                type="button"
                role="tab"
                id={`${idTabs}-${cada.id}`}
                aria-selected={vista === cada.id}
                aria-controls={`${idTabs}-panel-${cada.id}`}
                onClick={() => {
                  setVista(cada.id)
                  setError(null)
                }}
              >
                <b>{cada.numero}</b> {cada.etiqueta}
                {cada.id === 'aprobaciones' ? (
                  <span className="badge">{cola.solicitudes.length}</span>
                ) : null}
              </button>
            ))}
          </div>
          <SelectorDeVista
            vista={vista}
            pendientes={cola.solicitudes.length}
            onElegir={(elegida) => {
              setVista(elegida)
              setError(null)
            }}
          />
          <div className="nav-acciones">
            <a
              className="user"
              href="/fichar"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Solicitar entrada"
            >
              <span className="user-texto">Solicitar entrada</span>
              <span className="user-icono" aria-hidden="true">
                <IconoEnlace />
              </span>
            </a>
            <button
              type="button"
              className="icono"
              aria-label="Compartir por WhatsApp"
              onClick={() => {
                const enlace = `${window.location.origin}/fichar`
                const texto = `Solicita tu entrada: ${enlace}`
                window.open(
                  `https://wa.me/?text=${encodeURIComponent(texto)}`,
                  '_blank',
                  'noopener,noreferrer',
                )
              }}
            >
              <IconoWhatsApp />
            </button>
          </div>
        </nav>

        <main>
          {vista === 'aprobaciones' ? (
            <section
              className="view v1"
              role="tabpanel"
              id={`${idTabs}-panel-aprobaciones`}
              aria-labelledby={`${idTabs}-aprobaciones`}
            >
              <div className="inner">
                <div className="view-head">
                  <div>
                    <h2>
                      Solicitudes de <em>entrada</em>
                    </h2>
                    <p className="sub">
                      Los trabajadores piden fichar desde el teléfono. La hora
                      de entrada es la de tu aprobación, no la del envío.
                    </p>
                  </div>
                  <div className="counter">
                    <span className="big">
                      {String(cola.solicitudes.length).padStart(2, '0')}
                    </span>
                    <span className="lbl">Pendientes</span>
                    <span className="live">En espera</span>
                  </div>
                </div>
                <div className="queue-head">
                  <p>Recientes</p>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={cola.solicitudes.length === 0 || ocupado !== null}
                    aria-busy={ocupado === 'todas'}
                    onClick={() =>
                      void aprobar(
                        cola.solicitudes.map((solicitud) => solicitud.id),
                        'todas',
                      )
                    }
                  >
                    Aprobar todas ✓
                  </button>
                </div>
                {cola.listo && cola.solicitudes.length === 0 ? (
                  <p className="vacio">No hay solicitudes pendientes</p>
                ) : (
                  <ol className="queue">
                    {cola.solicitudes.map((solicitud, indiceFila) => {
                      const filaOcupada =
                        ocupado === solicitud.id ||
                        ocupado === `no-${solicitud.id}` ||
                        ocupado === 'todas'
                      return (
                      <li
                        className={filaOcupada ? 'req bloqueada' : 'req'}
                        key={solicitud.id}
                        aria-busy={filaOcupada}
                      >
                        <span className="idx">
                          {String(indiceFila + 1).padStart(2, '0')}
                        </span>
                        <span className="ava">
                          {inicialesDe(solicitud.nombre)}
                        </span>
                        <div className="who">
                          <h3>{solicitud.nombre}</h3>
                          <p className="sub">Solicitud de entrada</p>
                        </div>
                        <div className="when">
                          <span className="time">
                            {solicitud.solicitadaEn === null
                              ? '—'
                              : horaCorta(solicitud.solicitadaEn)}
                          </span>
                        </div>
                        <div className="acts">
                          <button
                            type="button"
                            className="btn ok"
                            aria-busy={ocupado === solicitud.id}
                            disabled={ocupado !== null}
                            onClick={() =>
                              void aprobar([solicitud.id], solicitud.id)
                            }
                          >
                            ✓ Aprobar
                          </button>
                          <button
                            type="button"
                            className="btn no"
                            aria-busy={ocupado === `no-${solicitud.id}`}
                            disabled={ocupado !== null}
                            onClick={() => void rechazar(solicitud.id)}
                          >
                            ✕ Rechazar
                          </button>
                        </div>
                      </li>
                      )
                    })}
                  </ol>
                )}
                {error !== null ? (
                  <p className="alerta" role="alert">
                    {error}
                  </p>
                ) : (
                  <p className="q-note">
                    ■ Hasta las 10:15 es presente · Después es tardanza · 3
                    tardanzas = 1 falta
                  </p>
                )}
              </div>
            </section>
          ) : null}

          {vista === 'manual' ? (
            <FormularioManual
              idTabs={idTabs}
              ahora={ahora}
              hoy={hoy}
              roster={roster.map((persona) => persona.nombre)}
              ultimo={ultimo}
              marcasDeHoy={marcasDeHoy}
              nombresRoster={roster}
              error={error}
              onError={setError}
              ocupado={ocupado === 'manual'}
              onOcupado={(valor) => setOcupado(valor ? 'manual' : null)}
            />
          ) : null}

          {vista === 'historico' ? (
            <section
              className="view v3"
              role="tabpanel"
              id={`${idTabs}-panel-historico`}
              aria-labelledby={`${idTabs}-historico`}
            >
              <div className="view-head">
                <div>
                  <h2>
                    Histórico del <em>mes</em>
                  </h2>
                  <p className="sub">
                    Lunes a sábado. El domingo queda en gris. Cada 3 tardanzas
                    del mes cuentan como 1 falta en los totales.
                  </p>
                </div>
                <div className="mnav">
                  <button
                    type="button"
                    title="Mes anterior"
                    onClick={() => setMesVista(anterior)}
                  >
                    ◀ {mesCorto(anterior.anio, anterior.mes)}
                  </button>
                  <span className="cur">
                    {etiquetaMes(mesVista.anio, mesVista.mes)}
                  </span>
                  <button
                    type="button"
                    title="Mes siguiente"
                    onClick={() => setMesVista(siguiente)}
                  >
                    {mesCorto(siguiente.anio, siguiente.mes)} ▶
                  </button>
                </div>
              </div>
              <div className="h-tools">
                <div className="legend">
                  <span>
                    <i className="sw p" />
                    Presente
                  </span>
                  <span>
                    <i className="sw t" />
                    Tardanza
                  </span>
                  <span>
                    <i className="sw f" />
                    Falta
                  </span>
                  <span>
                    <i className="sw j" />
                    Justificado
                  </span>
                  <span>
                    <i className="sw x" />
                    Domingo
                  </span>
                  <span>
                    <i className="sw n" />
                    Próximo
                  </span>
                </div>
              </div>
              <div className="stats">
                <div className="stat">
                  <span className="n">{fichajesDelMes}</span>
                  <span className="l">Fichajes del mes</span>
                </div>
                <div className="stat">
                  <span className="n">{globales.porcentaje}%</span>
                  <span className="l">Asistencia global</span>
                  <div className="mini-bar">
                    <i style={{ width: `${globales.porcentaje}%` }} />
                  </div>
                </div>
                <div className="stat t">
                  <span className="n">
                    {String(globales.tardanzas).padStart(2, '0')}
                  </span>
                  <span className="l">Tardanzas</span>
                </div>
                <div className="stat f">
                  <span className="n">
                    {String(globales.faltas).padStart(2, '0')}
                  </span>
                  <span className="l">Faltas</span>
                </div>
              </div>
              <div className="historial" ref={tablaRef}>
                <div className="panel table-wrap mes-ancho">
                  <table>
                    <thead>
                      <tr>
                        <th>Trabajador</th>
                        <th className="days-h">
                          {Array.from(
                            {
                              length: cantidadDeDias(
                                mesVista.anio,
                                mesVista.mes,
                              ),
                            },
                            (_, indiceDia) => {
                              const dia = indiceDia + 1
                              const iso = isoDeDia(
                                mesVista.anio,
                                mesVista.mes,
                                dia,
                              )
                              return (
                                <span
                                  key={iso}
                                  className={
                                    esDomingoEnLima(iso) ? 'dh wk' : 'dh'
                                  }
                                >
                                  {String(dia).padStart(2, '0')}
                                </span>
                              )
                            },
                          )}
                        </th>
                        <th className="cnt">P</th>
                        <th className="cnt">T</th>
                        <th className="cnt">F</th>
                        <th className="cnt">J</th>
                        <th>% Asist.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((fila) => (
                        <tr key={fila.nombre}>
                          <td className="name">
                            {fila.nombre}
                            {fila.totales.tardanzas === 0 &&
                            fila.totales.faltas === 0 &&
                            fila.totales.presentes + fila.totales.justificados >
                              0 ? (
                              <span className="perf">◆ Perfecto</span>
                            ) : null}
                          </td>
                          <td className="days">
                            {fila.celdas.map((celda) => (
                              <span
                                key={celda.dia}
                                className={`d ${claseVisual(celda.clase)}`}
                                title={`${celda.dia} · ${celda.clase}`}
                              />
                            ))}
                          </td>
                          <td className="cnt">{fila.totales.presentes}</td>
                          <td className="cnt t">{fila.totales.tardanzas}</td>
                          <td className="cnt f">{fila.totales.faltas}</td>
                          <td className="cnt j">{fila.totales.justificados}</td>
                          <td className="pct">
                            <b>{fila.totales.porcentaje}%</b>
                            <div className="bar">
                              <i
                                style={{ width: `${fila.totales.porcentaje}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="tfoot">
                    <span>
                      ■ {filas.length} trabajadores ·{' '}
                      {diasLaboralesPasados(mesVista.anio, mesVista.mes, hoy)}{' '}
                      días laborales transcurridos
                    </span>
                    <span className="tfoot-acts">
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={exportar}
                      >
                        Exportar CSV
                      </button>
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() =>
                          tablaRef.current?.scrollIntoView({ block: 'nearest' })
                        }
                      >
                        Ver detalle
                      </button>
                    </span>
                  </div>
                </div>
                <HistoricoEstrecho
                  filas={filas}
                  anio={mesVista.anio}
                  mes={mesVista.mes}
                  diasLaborales={diasLaboralesPasados(
                    mesVista.anio,
                    mesVista.mes,
                    hoy,
                  )}
                  onExportar={exportar}
                />
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  )
}

function diasLaboralesPasados(anio: number, mes: number, hoy: string): number {
  let cuenta = 0
  const total = cantidadDeDias(anio, mes)
  for (let dia = 1; dia <= total; dia += 1) {
    const iso = isoDeDia(anio, mes, dia)
    if (iso >= hoy) break
    if (!esDomingoEnLima(iso)) cuenta += 1
  }
  return cuenta
}

function FormularioManual({
  idTabs,
  ahora,
  hoy,
  roster,
  ultimo,
  marcasDeHoy,
  nombresRoster,
  error,
  onError,
  ocupado,
  onOcupado,
}: {
  readonly idTabs: string
  readonly ahora: Date
  readonly hoy: string
  readonly roster: readonly string[]
  readonly ultimo: ReturnType<typeof usarUltimoFichaje>
  readonly marcasDeHoy: ReadonlyMap<string, MarcaAprobada>
  readonly nombresRoster: readonly { clave: string; nombre: string }[]
  readonly error: string | null
  readonly onError: (mensaje: string | null) => void
  readonly ocupado: boolean
  readonly onOcupado: (valor: boolean) => void
}) {
  const [nombre, setNombre] = useState('')
  const [fecha, setFecha] = useState(hoy)
  const [hora, setHora] = useState(horaCorta(ahora))
  const [estado, setEstado] = useState<EstadoDeMarca>('presente')
  const [observacion, setObservacion] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(0)
  const listaId = useId()
  const coincidencias = roster.filter((cada) =>
    cada
      .toLocaleLowerCase('es-PE')
      .includes(nombre.trim().toLocaleLowerCase('es-PE')),
  )

  async function enviar(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    onError(null)
    onOcupado(true)
    try {
      const respuesta = await registrarManualFn({
        data: { nombre, fecha, hora, estado, observacion },
      })
      if (!respuesta.ok) {
        onError(mensajeDe(respuesta))
        return
      }
      setNombre('')
      setObservacion('')
      setEstado('presente')
    } finally {
      onOcupado(false)
    }
  }

  return (
    <section
      className="view v2"
      role="tabpanel"
      id={`${idTabs}-panel-manual`}
      aria-labelledby={`${idTabs}-manual`}
    >
      <div className="view-head">
        <div>
          <h2>
            Fichaje <em>manual</em>
          </h2>
          <p className="sub">
            Registra la entrada de un trabajador cuando no pudo enviar la
            solicitud desde el teléfono.
          </p>
        </div>
      </div>
      <div className="v2-grid">
        <form className="panel" onSubmit={(evento) => void enviar(evento)}>
          <div className="panel-h">
            <span>Nuevo fichaje manual</span>
          </div>
          <div className="form-cuerpo">
            <div className="field">
              <label htmlFor="f-trab">Trabajador</label>
              <input
                id="f-trab"
                type="text"
                role="combobox"
                aria-expanded={abierto}
                aria-controls={listaId}
                aria-autocomplete="list"
                autoComplete="off"
                required
                value={nombre}
                disabled={ocupado}
                onChange={(evento) => {
                  setNombre(evento.target.value)
                  setAbierto(true)
                  setActivo(0)
                }}
                onFocus={() => setAbierto(true)}
                onBlur={() => setAbierto(false)}
                onKeyDown={(evento) => {
                  if (!abierto || coincidencias.length === 0) return
                  if (evento.key === 'ArrowDown') {
                    evento.preventDefault()
                    setActivo((actual) => (actual + 1) % coincidencias.length)
                  } else if (evento.key === 'ArrowUp') {
                    evento.preventDefault()
                    setActivo(
                      (actual) =>
                        (actual - 1 + coincidencias.length) %
                        coincidencias.length,
                    )
                  } else if (evento.key === 'Enter') {
                    const elegido = coincidencias[activo]
                    if (elegido !== undefined && nombre.trim() !== elegido) {
                      evento.preventDefault()
                      setNombre(elegido)
                      setAbierto(false)
                    }
                  } else if (evento.key === 'Escape') {
                    setAbierto(false)
                  }
                }}
              />
              {abierto && coincidencias.length > 0 ? (
                <ul className="combo-lista" id={listaId} role="listbox">
                  {coincidencias.map((cada, indiceNombre) => (
                    <li key={cada} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={indiceNombre === activo}
                        onMouseDown={(evento) => {
                          evento.preventDefault()
                          setNombre(cada)
                          setAbierto(false)
                        }}
                      >
                        {cada}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="row2">
              <div className="field">
                <label htmlFor="f-fecha">Fecha</label>
                <input
                  id="f-fecha"
                  type="date"
                  required
                  value={fecha}
                  disabled={ocupado}
                  onChange={(evento) => setFecha(evento.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="f-hora">Hora</label>
                <input
                  id="f-hora"
                  type="time"
                  required
                  value={hora}
                  disabled={ocupado}
                  onChange={(evento) => setHora(evento.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <span className="lbl" id="estado-manual">
                Estado
              </span>
              <div
                className="pills"
                role="radiogroup"
                aria-labelledby="estado-manual"
              >
                {ESTADOS.map((cada) => (
                  <span key={cada.id}>
                    <input
                      type="radio"
                      name="estado-manual"
                      id={`estado-${cada.id}`}
                      checked={estado === cada.id}
                      onChange={() => setEstado(cada.id)}
                    />
                    <label htmlFor={`estado-${cada.id}`} data-estado={cada.id}>
                      {cada.etiqueta}
                    </label>
                  </span>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="f-obs">Observaciones</label>
              <textarea
                id="f-obs"
                value={observacion}
                maxLength={400}
                placeholder="Motivo del registro manual, incidencias, etc."
                onChange={(evento) => setObservacion(evento.target.value)}
              />
            </div>
            {error !== null ? (
              <p className="alerta" role="alert">
                {error}
              </p>
            ) : null}
            <div className="form-acts">
              <button
                type="submit"
                className="btn primary"
                aria-busy={ocupado}
                disabled={ocupado}
              >
                Registrar fichaje →
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setNombre('')
                  setObservacion('')
                  setEstado('presente')
                  onError(null)
                }}
              >
                Limpiar
              </button>
            </div>
          </div>
        </form>
        <aside className="v2-side">
          <div className="panel ticket">
            {ultimo === null ? (
              <>
                <div className="tk-top">
                  <span>Último registro</span>
                  <span>—</span>
                </div>
                <div className="tk-name">Sin registros</div>
                <p className="tk-line">La primera entrada aparecerá aquí.</p>
              </>
            ) : (
              <>
                <div className="tk-top">
                  <span>Último registro</span>
                  <span>{folioDe(ultimo.folio)}</span>
                </div>
                <div className="tk-name">{ultimo.nombre}</div>
                <p className="tk-line">Entrada</p>
                <hr className="dash" />
                <p className="tk-line">
                  {ultimo.diaLima} · {ultimo.hora}
                </p>
                <p className="tk-line">Tipo: ENTRADA</p>
                <hr className="dash" />
                <span className={`stamp ${ultimo.estadoDia}`}>
                  {ETIQUETA_DE_ESTADO[ultimo.estadoDia]}
                </span>
                <div className="bc" />
                <p className="bc-n">{folioDe(ultimo.folio)}</p>
              </>
            )}
          </div>
          <EquipoDeHoy nombres={nombresRoster} marcas={marcasDeHoy} />
        </aside>
      </div>
    </section>
  )
}

const DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const

function HistoricoEstrecho({
  filas,
  anio,
  mes,
  diasLaborales,
  onExportar,
}: {
  readonly filas: readonly {
    nombre: string
    nombreClave: string
    celdas: readonly { dia: number; clase: string }[]
    totales: {
      presentes: number
      tardanzas: number
      faltas: number
      justificados: number
      porcentaje: number
    }
  }[]
  readonly anio: number
  readonly mes: number
  readonly diasLaborales: number
  readonly onExportar: () => void
}) {
  const huecos = columnaLunes(isoDeDia(anio, mes, 1))

  return (
    <div className="mes-estrecho">
      {filas.length === 0 ? (
        <p className="vacio">Sin fichajes en este mes</p>
      ) : (
        filas.map((fila) => (
          <FichaDeMes key={fila.nombreClave} fila={fila} huecos={huecos} />
        ))
      )}
      <div className="panel tfoot">
        <span>
          ■ {filas.length} trabajadores · {diasLaborales} días laborales
          transcurridos
        </span>
        <button type="button" className="btn ghost" onClick={onExportar}>
          Exportar CSV
        </button>
      </div>
    </div>
  )
}

function FichaDeMes({
  fila,
  huecos,
}: {
  readonly fila: {
    nombre: string
    nombreClave: string
    celdas: readonly { dia: number; clase: string }[]
    totales: {
      presentes: number
      tardanzas: number
      faltas: number
      justificados: number
      porcentaje: number
    }
  }
  readonly huecos: number
}) {
  const [confirmar, setConfirmar] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function borrar(): Promise<void> {
    setOcupado(true)
    setError(null)
    try {
      const respuesta = await eliminarHistorialFn({
        data: { clave: fila.nombreClave },
      })
      if (!respuesta.ok) {
        setError(mensajeDe(respuesta))
        setOcupado(false)
      }
    } catch {
      setError('No se pudo eliminar el historial.')
      setOcupado(false)
    }
  }

  return (
    <article className="panel ficha-mes">
      <div className="ficha-top">
        <b>{fila.nombre}</b>
        <span className="mono">{fila.totales.porcentaje}%</span>
      </div>
      <div className="semana-nombres" aria-hidden="true">
        {DIAS_CORTOS.map((letra, indiceLetra) => (
          <span key={`${letra}-${indiceLetra}`}>{letra}</span>
        ))}
      </div>
      <div className="semana">
        {Array.from({ length: huecos }, (_, indiceHueco) => (
          <span key={`hueco-${indiceHueco}`} className="celda hueco" />
        ))}
        {fila.celdas.map((celda) => (
          <span
            key={celda.dia}
            className={`celda ${claseVisual(celda.clase)}`}
            title={`${celda.dia} · ${celda.clase}`}
          >
            {celda.dia}
          </span>
        ))}
      </div>
      <div className="ficha-pie">
        <p className="ficha-totales">
          <span>P {fila.totales.presentes}</span>
          <span>T {fila.totales.tardanzas}</span>
          <span>F {fila.totales.faltas}</span>
          <span>J {fila.totales.justificados}</span>
        </p>
        <button
          type="button"
          className="tacho"
          aria-label={`Eliminar historial de ${fila.nombre}`}
          aria-expanded={confirmar}
          disabled={ocupado}
          onClick={() => {
            setError(null)
            setConfirmar((esta) => !esta)
          }}
        >
          <IconoQuitar />
        </button>
      </div>
      <div className={confirmar ? 'roster-panel abierto' : 'roster-panel'}>
        <div>
          {confirmar ? (
            <div className="roster-form">
              <p className="sub">
                Se borra el historial de {fila.nombre}. Esta ficha desaparece.
              </p>
              {error !== null ? (
                <p className="alerta" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="form-acts">
                <button
                  type="button"
                  className="btn no"
                  aria-busy={ocupado}
                  disabled={ocupado}
                  onClick={() => void borrar()}
                >
                  Eliminar historial
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={ocupado}
                  onClick={() => setConfirmar(false)}
                >
                  Volver
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function IconoEnlace() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        d="M14 5h5v5M19 5l-8 8M10 5H5v14h14v-5"
      />
    </svg>
  )
}

function IconoWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20.5 3.5A11 11 0 0 0 2.1 17.2L1 23l6-1.6A11 11 0 0 0 20.5 3.5zM12 20.4a9.2 9.2 0 0 1-4.7-1.3l-.3-.2-3.6.9.9-3.5-.2-.3A9.2 9.2 0 1 1 12 20.4zm5.1-6.9c-.3-.1-1.6-.8-1.8-.9s-.4-.1-.6.2-.7.9-.9 1.1-.3.2-.6.1a7.6 7.6 0 0 1-2.2-1.4 8.4 8.4 0 0 1-1.5-1.9c-.2-.3 0-.4.1-.6l.4-.5.2-.3a.5.5 0 0 0 0-.5c-.1-.1-.6-1.5-.8-2s-.4-.5-.6-.5h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-1 2.2 5.3 5.3 0 0 0 1.1 2.8 12 12 0 0 0 4.6 4.1 5 5 0 0 0 2.2.6 2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.3c-.1-.2-.3-.2-.6-.3z"
      />
    </svg>
  )
}

function EquipoDeHoy({
  nombres,
  marcas,
}: {
  readonly nombres: readonly { clave: string; nombre: string }[]
  readonly marcas: ReadonlyMap<string, MarcaAprobada>
}) {
  const vistos = new Set(nombres.map((persona) => persona.clave))
  const extras = [...marcas.values()].filter(
    (marca) => !vistos.has(marca.nombreClave),
  )
  const filas = [
    ...nombres.map((persona) => ({
      clave: persona.clave,
      nombre: persona.nombre,
      marca: marcas.get(persona.clave) ?? null,
    })),
    ...extras.map((marca) => ({
      clave: marca.nombreClave,
      nombre: marca.nombre,
      marca,
    })),
  ]

  return (
    <div className="panel roster">
      <div className="panel-h">
        <span>Equipo en turno</span>
        <span>{filas.length}</span>
      </div>
      {filas.length === 0 ? (
        <p className="vacio">Todavía no hay trabajadores</p>
      ) : (
        <ul>
          {filas.map((fila) => (
            <FilaDeEquipo key={fila.clave} fila={fila} />
          ))}
        </ul>
      )}
    </div>
  )
}

function FilaDeEquipo({
  fila,
}: {
  readonly fila: {
    clave: string
    nombre: string
    marca: MarcaAprobada | null
  }
}) {
  const [modo, setModo] = useState<'ver' | 'editar' | 'borrar' | 'sacar'>('ver')
  const [hora, setHora] = useState('10:00')
  const [estado, setEstado] = useState<EstadoDeMarca>('presente')
  const [observacion, setObservacion] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const marca = fila.marca
  const clase = marca === null ? 'n' : claseVisual(marca.estadoDia)
  const texto =
    marca === null
      ? 'sin fichar'
      : marca.horaEntrada === null
        ? ETIQUETA_DE_ESTADO[marca.estadoDia]
        : horaCorta(marca.horaEntrada)

  function abrirEdicion(): void {
    if (marca === null) return
    setHora(marca.horaEntrada === null ? '10:00' : horaCorta(marca.horaEntrada))
    setEstado(marca.estadoDia)
    setObservacion(marca.observacion ?? '')
    setError(null)
    setModo('editar')
  }

  async function guardar(): Promise<void> {
    if (marca === null) return
    setOcupado(true)
    setError(null)
    try {
      const respuesta = await editarMarcaFn({
        data: { id: marca.id, hora, estado, observacion },
      })
      if (!respuesta.ok) {
        setError(mensajeDe(respuesta))
        return
      }
      setModo('ver')
    } finally {
      setOcupado(false)
    }
  }

  async function sacarDelEquipo(): Promise<void> {
    setOcupado(true)
    setError(null)
    try {
      const respuesta = await quitarDelEquipoFn({ data: { clave: fila.clave } })
      if (!respuesta.ok) {
        setError(mensajeDe(respuesta))
        return
      }
      setModo('ver')
    } finally {
      setOcupado(false)
    }
  }

  async function quitar(): Promise<void> {
    if (marca === null) return
    setOcupado(true)
    setError(null)
    try {
      const respuesta = await eliminarMarcaFn({ data: { id: marca.id } })
      if (!respuesta.ok) {
        setError(mensajeDe(respuesta))
        return
      }
      setModo('ver')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <li>
      <div className="roster-fila">
        <span className="mini">{inicialesDe(fila.nombre)}</span>
        <span className="n">{fila.nombre}</span>
        <span className={`st ${clase}`}>
          <i />
          {texto}
        </span>
        {marca === null ? (
          <span className="roster-acciones">
            <button
              type="button"
              className="icono peligro"
              aria-label={`Quitar a ${fila.nombre} del equipo`}
              aria-expanded={modo === 'sacar'}
              onClick={() => {
                setError(null)
                setModo(modo === 'sacar' ? 'ver' : 'sacar')
              }}
            >
              <IconoQuitar />
            </button>
          </span>
        ) : (
          <span className="roster-acciones">
            <button
              type="button"
              className="icono"
              aria-label={`Editar entrada de ${fila.nombre}`}
              aria-expanded={modo === 'editar'}
              onClick={() => {
                if (modo === 'editar') setModo('ver')
                else abrirEdicion()
              }}
            >
              <IconoLapiz />
            </button>
            <button
              type="button"
              className="icono peligro"
              aria-label={`Quitar entrada de ${fila.nombre}`}
              aria-expanded={modo === 'borrar'}
              onClick={() => {
                setError(null)
                setModo(modo === 'borrar' ? 'ver' : 'borrar')
              }}
            >
              <IconoQuitar />
            </button>
          </span>
        )}
      </div>
      <div className={modo === 'ver' ? 'roster-panel' : 'roster-panel abierto'}>
        <div>
          {modo === 'editar' ? (
            <div className="roster-form">
              <div className="field">
                <label htmlFor={`hora-${fila.clave}`}>Hora</label>
                <input
                  id={`hora-${fila.clave}`}
                  type="time"
                  value={hora}
                  disabled={ocupado}
                  onChange={(evento) => setHora(evento.target.value)}
                />
              </div>
              <div className="pills" role="radiogroup" aria-label="Estado">
                {ESTADOS.map((cada) => (
                  <span key={cada.id}>
                    <input
                      type="radio"
                      name={`estado-${fila.clave}`}
                      id={`eq-${fila.clave}-${cada.id}`}
                      checked={estado === cada.id}
                      onChange={() => setEstado(cada.id)}
                    />
                    <label
                      htmlFor={`eq-${fila.clave}-${cada.id}`}
                      data-estado={cada.id}
                    >
                      {cada.etiqueta}
                    </label>
                  </span>
                ))}
              </div>
              {error !== null ? (
                <p className="alerta" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="form-acts">
                <button
                  type="button"
                  className="btn primary"
                  aria-busy={ocupado}
                  disabled={ocupado}
                  onClick={() => void guardar()}
                >
                  Guardar
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setModo('ver')}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}
          {modo === 'borrar' ? (
            <div className="roster-form">
              <p className="sub">
                Se quita la entrada de hoy. {fila.nombre} queda sin fichar.
              </p>
              {error !== null ? (
                <p className="alerta" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="form-acts">
                <button
                  type="button"
                  className="btn no"
                  aria-busy={ocupado}
                  disabled={ocupado}
                  onClick={() => void quitar()}
                >
                  Quitar entrada
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setModo('ver')}
                >
                  Volver
                </button>
              </div>
            </div>
          ) : null}
          {modo === 'sacar' ? (
            <div className="roster-form">
              <p className="sub">
                {fila.nombre} sale del equipo. El histórico del mes se conserva.
              </p>
              {error !== null ? (
                <p className="alerta" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="form-acts">
                <button
                  type="button"
                  className="btn no"
                  aria-busy={ocupado}
                  disabled={ocupado}
                  onClick={() => void sacarDelEquipo()}
                >
                  Quitar del equipo
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setModo('ver')}
                >
                  Volver
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  )
}

function IconoLapiz() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        d="M4 20h4l10-10-4-4L4 16v4zM13 7l4 4"
      />
    </svg>
  )
}

function IconoQuitar() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        d="M5 7h14M9 7V5h6v2M8 7l1 13h6l1-13"
      />
    </svg>
  )
}
