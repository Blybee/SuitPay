import { createFileRoute } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CabeceraAdmin } from '../../features/administracion/cabecera-admin.tsx'
import {
  autorizarRevisionMemoriaFn,
  leerLoteAprendizajeFn,
  leerMemoriaAprendizajeFn,
  listarLotesAprendizajeFn,
  proponerRevisionMemoriaFn,
} from '../../features/aprendizaje/aprendizaje.funciones.ts'
import { EntrenarAprendizaje } from '../../features/aprendizaje/entrenar.tsx'
import type { CambioDeRevision, DiffDeProducto } from '../../domain/aprendizaje/memoria.ts'
import { TAMANO_PAGINA_MEMORIA } from '../../domain/aprendizaje/memoria.ts'
import type { MapaDeMarcas } from '../../domain/aprendizaje/priores.ts'
import { usarNotificaciones } from '../../features/notificaciones/almacen.ts'
import { GuardaSesion } from '../../features/sesion/GuardaSesion.tsx'
import { Boton } from '../../ui/componentes/primitivas.tsx'

/**
 * Entrenar + monitor: memoria viva al montar; detalle de lote al clic.
 */

export const Route = createFileRoute('/administracion/aprendizaje')({
  component: () => (
    <GuardaSesion roles={['administrador', 'jefe']}>
      <PantallaDeAprendizaje />
    </GuardaSesion>
  ),
})

function PantallaDeAprendizaje() {
  const mostrar = usarNotificaciones((estado) => estado.mostrar)
  const [entradas, setEntradas] = useState<
    readonly {
      codigo: string
      aliases: readonly string[]
      etiquetas: readonly string[]
    }[]
  >([])
  const [marcas, setMarcas] = useState<MapaDeMarcas>({})
  const [cursores, setCursores] = useState<readonly (string | undefined)[]>([
    undefined,
  ])
  const [hayMas, setHayMas] = useState(false)
  const [cursorSiguiente, setCursorSiguiente] = useState<string | null>(null)
  const [superaPresupuesto, setSuperaPresupuesto] = useState(false)
  const [documentoLleno, setDocumentoLleno] = useState(false)
  const [lotes, setLotes] = useState<
    readonly {
      id: string
      diaLima: string
      pares: number
      modelo: string
      cerradoEn: string | null
    }[]
  >([])
  const [ocupado, setOcupado] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loteAbierto, setLoteAbierto] = useState<string | null>(null)
  const [diffs, setDiffs] = useState<readonly DiffDeProducto[] | null>(null)
  const [cargandoDiff, setCargandoDiff] = useState(false)
  const [revisando, setRevisando] = useState(false)
  const [autorizando, setAutorizando] = useState(false)
  const [propuesta, setPropuesta] = useState<readonly CambioDeRevision[] | null>(
    null,
  )
  const [mensajeRevision, setMensajeRevision] = useState<string | null>(null)
  const [paginaPropuesta, setPaginaPropuesta] = useState(0)
  const propuestaRef = useRef<HTMLDivElement>(null)

  const cursorActual = cursores[cursores.length - 1]
  const propuestaVisible = propuesta !== null && propuesta.length > 0
  const avisoRevision =
    !propuestaVisible && mensajeRevision !== null && mensajeRevision !== ''

  useEffect(() => {
    if (!propuestaVisible && !avisoRevision) return
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    propuestaRef.current?.scrollIntoView({
      block: 'nearest',
      behavior: reducido ? 'auto' : 'smooth',
    })
  }, [propuestaVisible, avisoRevision, propuesta])

  const cargarMemoria = useCallback(
    async (cursor?: string, reiniciar = false): Promise<void> => {
      const [memoria, lista] = await Promise.all([
        leerMemoriaAprendizajeFn({ data: { cursor } }),
        listarLotesAprendizajeFn(),
      ])
      if (!memoria.ok) {
        setError(memoria.error.mensaje)
        return
      }
      if (!lista.ok) {
        setError(lista.error.mensaje)
        return
      }
      setEntradas(memoria.entradas)
      setHayMas(memoria.hayMas)
      setCursorSiguiente(memoria.cursorSiguiente)
      setMarcas(memoria.marcas)
      setSuperaPresupuesto(memoria.superaPresupuesto)
      setDocumentoLleno(memoria.documentoLleno)
      setLotes(lista.lotes)
      setError(null)
      if (reiniciar) setCursores([undefined])
    },
    [],
  )

  useEffect(() => {
    void (async () => {
      setOcupado(true)
      await cargarMemoria(undefined, true)
      setOcupado(false)
    })()
  }, [cargarMemoria])

  async function abrirLote(diaLima: string): Promise<void> {
    if (loteAbierto === diaLima) {
      setLoteAbierto(null)
      setDiffs(null)
      return
    }
    setLoteAbierto(diaLima)
    setCargandoDiff(true)
    const respuesta = await leerLoteAprendizajeFn({ data: { diaLima } })
    setCargandoDiff(false)
    if (!respuesta.ok || respuesta.lote === null) {
      setDiffs([])
      return
    }
    setDiffs(respuesta.lote.diffs)
  }

  async function irSiguiente(): Promise<void> {
    if (cursorSiguiente === null) return
    const destino = cursorSiguiente
    await cargarMemoria(destino)
    setCursores((previos) => [...previos, destino])
  }

  async function irAnterior(): Promise<void> {
    if (cursores.length <= 1) return
    const previos = cursores.slice(0, -1)
    const cursor = previos[previos.length - 1]
    await cargarMemoria(cursor)
    setCursores(previos)
  }

  async function revisar(): Promise<void> {
    setRevisando(true)
    setPropuesta(null)
    setMensajeRevision(null)
    const respuesta = await proponerRevisionMemoriaFn()
    setRevisando(false)
    if (!respuesta.ok) {
      mostrar({ tono: 'error', mensaje: respuesta.error.mensaje })
      return
    }
    setPaginaPropuesta(0)
    setPropuesta(respuesta.cambios)
    setMensajeRevision(respuesta.mensaje)
  }

  async function autorizar(): Promise<void> {
    if (propuesta === null || propuesta.length === 0) return
    setAutorizando(true)
    const respuesta = await autorizarRevisionMemoriaFn({
      data: {
        cambios: propuesta.map((cambio) => ({
          codigo: cambio.codigo,
          aliases: [...cambio.aliases],
          etiquetas: [...cambio.etiquetas],
          quitados: [...cambio.quitados],
          motivo: cambio.motivo,
        })),
      },
    })
    setAutorizando(false)
    if (!respuesta.ok) {
      mostrar({ tono: 'error', mensaje: respuesta.error.mensaje })
      return
    }
    setPropuesta(null)
    setMensajeRevision(null)
    mostrar({ tono: 'exito', mensaje: 'Revisión autorizada. La memoria quedó actualizada.' })
    setOcupado(true)
    await cargarMemoria(undefined, true)
    setOcupado(false)
  }

  function denegar(): void {
    setPropuesta(null)
    setMensajeRevision(null)
    setPaginaPropuesta(0)
  }

  const entradasMarca = Object.entries(marcas).sort(([a], [b]) =>
    a.localeCompare(b),
  )
  const pagina = cursores.length
  const inicioPropuesta = paginaPropuesta * TAMANO_PAGINA_MEMORIA
  const cambiosVisibles = (propuesta ?? []).slice(
    inicioPropuesta,
    inicioPropuesta + TAMANO_PAGINA_MEMORIA,
  )
  const hayMasPropuesta =
    propuesta !== null &&
    inicioPropuesta + TAMANO_PAGINA_MEMORIA < propuesta.length

  return (
    <div className="flex min-h-full flex-col gap-8 px-6 py-8">
      <CabeceraAdmin titulo="Aprendizaje" />

      {error !== null ? (
        <p className="text-cuerpo font-bold text-aviso" role="alert">
          {error}
        </p>
      ) : null}

      <EntrenarAprendizaje
        onConfirmado={() => {
          void (async () => {
            setOcupado(true)
            await cargarMemoria(undefined, true)
            setOcupado(false)
          })()
        }}
      />

      {ocupado ? (
        <p className="text-cuerpo text-desvaida">Cargando memoria…</p>
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-mono text-etiqueta uppercase text-desvaida">
              Memoria consolidada
            </h2>
            <Boton
              variante="secundario"
              disabled={revisando}
              aria-busy={revisando}
              onClick={() => void revisar()}
            >
              {revisando ? (
                <Loader2
                  className="size-5 animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
              ) : null}
              Revisar
            </Boton>
          </div>
          <div
            ref={propuestaRef}
            className="grid transition-[grid-template-rows] duration-media ease-salida motion-reduce:transition-none"
            style={{
              gridTemplateRows: propuestaVisible || avisoRevision ? '1fr' : '0fr',
            }}
          >
            <div className="min-h-0 overflow-hidden">
              {avisoRevision ? (
                <p className="mb-6 text-cuerpo text-desvaida" role="status">
                  {mensajeRevision}
                </p>
              ) : null}
              {propuestaVisible ? (
                <div className="mb-6 rounded-2xl border border-borde bg-mesa/40 px-4 py-4">
                  <h3 className="mb-3 font-mono text-etiqueta uppercase text-desvaida">
                    Propuesta
                  </h3>
                  {mensajeRevision !== null && mensajeRevision !== '' ? (
                    <p className="mb-3 text-cuerpo text-desvaida">{mensajeRevision}</p>
                  ) : null}
                  <ul className="flex flex-col gap-2">
                    {cambiosVisibles.map((cambio) => (
                      <li
                        key={cambio.codigo}
                        className="rounded-2xl border border-borde bg-papel px-4 py-3"
                      >
                        <p className="font-mono font-bold text-tinta">{cambio.codigo}</p>
                        <p className="text-cuerpo text-tinta">
                          {cambio.aliases.join(' · ') || 'Sin alias'}
                        </p>
                        <p className="text-cuerpo text-aviso">
                          Quita: {cambio.quitados.join(' · ')}
                        </p>
                        <p className="font-mono text-etiqueta text-desvaida">
                          {cambio.motivo}
                        </p>
                      </li>
                    ))}
                  </ul>
                  {propuesta.length > TAMANO_PAGINA_MEMORIA ? (
                    <div className="mt-3 flex justify-end gap-2">
                      <Boton
                        variante="discreto"
                        disabled={paginaPropuesta === 0}
                        onClick={() => setPaginaPropuesta((n) => n - 1)}
                      >
                        Anterior
                      </Boton>
                      <Boton
                        variante="discreto"
                        disabled={!hayMasPropuesta}
                        onClick={() => setPaginaPropuesta((n) => n + 1)}
                      >
                        Siguiente
                      </Boton>
                    </div>
                  ) : null}
                  <div className="mt-4 flex gap-2">
                    <Boton
                      variante="principal"
                      disabled={autorizando}
                      aria-busy={autorizando}
                      onClick={() => void autorizar()}
                    >
                      {autorizando ? (
                        <Loader2
                          className="size-5 animate-spin motion-reduce:animate-none"
                          aria-hidden
                        />
                      ) : null}
                      Autorizar
                    </Boton>
                    <Boton
                      variante="peligro"
                      disabled={autorizando}
                      onClick={denegar}
                    >
                      Denegar
                    </Boton>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          {superaPresupuesto ? (
            <p className="mb-3 text-cuerpo text-aviso" role="status">
              El bloque aprendido superó el margen del prompt. La memoria sigue
              enviándose completa.
            </p>
          ) : null}
          {documentoLleno ? (
            <p className="mb-3 text-cuerpo text-aviso" role="status">
              La memoria llegó al límite de guardado. Autoriza una revisión
              antes de sumar alias.
            </p>
          ) : null}
          {entradas.length === 0 ? (
            <p className="text-cuerpo text-desvaida">
              Todavía no hay alias aprendidos.
            </p>
          ) : (
            <ul
              key={cursorActual ?? 'inicio'}
              className="flex flex-col gap-2 opacity-100 transition-opacity duration-rapida ease-salida motion-reduce:transition-none starting:opacity-0"
            >
              {entradas.map((entrada) => (
                <li
                  key={entrada.codigo}
                  className="rounded-2xl border border-borde bg-papel px-4 py-3"
                >
                  <p className="font-mono font-bold text-tinta">{entrada.codigo}</p>
                  <p className="text-cuerpo text-tinta">
                    {entrada.aliases.length > 0
                      ? entrada.aliases.join(' · ')
                      : 'Sin alias'}
                  </p>
                  {entrada.etiquetas.length > 0 ? (
                    <p className="font-mono text-etiqueta text-desvaida">
                      {entrada.etiquetas.join(' · ')}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {entradas.length > 0 ? (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="font-mono text-etiqueta text-desvaida">
                Página {pagina}
              </p>
              <div className="flex gap-2">
                <Boton
                  variante="discreto"
                  disabled={cursores.length <= 1}
                  onClick={() => void irAnterior()}
                >
                  Anterior
                </Boton>
                <Boton
                  variante="discreto"
                  disabled={!hayMas}
                  onClick={() => void irSiguiente()}
                >
                  Siguiente
                </Boton>
              </div>
            </div>
          ) : null}
          {entradasMarca.length > 0 ? (
            <div className="mt-6">
              <h3 className="mb-3 font-mono text-etiqueta uppercase text-desvaida">
                Priores de marca
              </h3>
              <ul className="flex flex-col gap-2">
                {entradasMarca.map(([familia, grupo]) => (
                  <li
                    key={familia}
                    className="rounded-2xl border border-borde bg-papel px-4 py-3"
                  >
                    <p className="font-mono font-bold text-tinta">{familia}</p>
                    <p className="text-cuerpo text-desvaida">
                      {Object.entries(grupo)
                        .sort((a, b) => b[1].peso - a[1].peso)
                        .map(([marca, c]) => `${marca} (${c.peso})`)
                        .join(' · ')}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      )}

      <section>
        <h2 className="mb-3 font-mono text-etiqueta uppercase text-desvaida">
          Lotes recientes
        </h2>
        {lotes.length === 0 && !ocupado ? (
          <p className="text-cuerpo text-desvaida">No hay lotes vigentes.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lotes.map((lote) => (
              <li key={lote.id}>
                <button
                  type="button"
                  className="w-full rounded-2xl border border-borde bg-papel px-4 py-3 text-left transition-colors duration-rapida ease-salida hover:bg-mesa"
                  onClick={() => void abrirLote(lote.diaLima)}
                  aria-expanded={loteAbierto === lote.diaLima}
                >
                  <span className="font-mono font-bold text-tinta">
                    {lote.diaLima}
                  </span>
                  <span className="ml-3 text-cuerpo text-desvaida">
                    {lote.pares} pares · {lote.modelo || 'sin modelo'}
                  </span>
                </button>
                <div
                  className="grid transition-[grid-template-rows] duration-media ease-salida motion-reduce:transition-none"
                  style={{
                    gridTemplateRows:
                      loteAbierto === lote.diaLima ? '1fr' : '0fr',
                  }}
                >
                  <div className="min-h-0 overflow-hidden">
                    {loteAbierto === lote.diaLima ? (
                      <div className="mt-2 rounded-2xl border border-borde bg-mesa/40 px-4 py-3">
                        {cargandoDiff ? (
                          <p className="text-cuerpo text-desvaida">
                            Cargando diff…
                          </p>
                        ) : (diffs ?? []).length === 0 ? (
                          <p className="text-cuerpo text-desvaida">
                            Sin cambios ese día.
                          </p>
                        ) : (
                          <ul className="flex flex-col gap-2 text-cuerpo">
                            {(diffs ?? []).map((diff) => (
                              <li key={diff.codigo}>
                                <span className="font-mono font-bold">
                                  {diff.codigo}
                                </span>
                                {diff.agregados.length > 0 ? (
                                  <span> + {diff.agregados.join(', ')}</span>
                                ) : null}
                                {diff.quitados.length > 0 ? (
                                  <span> − {diff.quitados.join(', ')}</span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
