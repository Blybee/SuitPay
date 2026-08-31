import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { CabeceraAdmin } from '../../features/administracion/cabecera-admin.tsx'
import {
  leerLoteAprendizajeFn,
  leerMemoriaAprendizajeFn,
  listarLotesAprendizajeFn,
} from '../../features/aprendizaje/aprendizaje.funciones.ts'
import type { DiffDeProducto } from '../../domain/aprendizaje/memoria.ts'
import { GuardaSesion } from '../../features/sesion/GuardaSesion.tsx'

/**
 * Monitor de aprendizaje: memoria viva al montar; detalle de lote al clic.
 */

export const Route = createFileRoute('/administracion/aprendizaje')({
  component: () => (
    <GuardaSesion roles={['administrador', 'jefe']}>
      <PantallaDeAprendizaje />
    </GuardaSesion>
  ),
})

function PantallaDeAprendizaje() {
  const [productos, setProductos] = useState<
    Record<string, { aliases: readonly string[]; etiquetas: readonly string[] }>
  >({})
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

  useEffect(() => {
    void (async () => {
      setOcupado(true)
      const [memoria, lista] = await Promise.all([
        leerMemoriaAprendizajeFn(),
        listarLotesAprendizajeFn(),
      ])
      if (!memoria.ok) {
        setError(memoria.error?.mensaje ?? 'No se leyó la memoria.')
        setOcupado(false)
        return
      }
      if (!lista.ok) {
        setError(lista.error?.mensaje ?? 'No se leyeron los lotes.')
        setOcupado(false)
        return
      }
      setProductos(memoria.productos)
      setLotes(lista.lotes)
      setOcupado(false)
    })()
  }, [])

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
    if (!respuesta.ok || respuesta.lote === null || respuesta.lote === undefined) {
      setDiffs([])
      return
    }
    setDiffs(respuesta.lote.diffs)
  }

  const entradas = Object.entries(productos).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="flex min-h-full flex-col gap-8 px-6 py-8">
      <CabeceraAdmin
        titulo="Aprendizaje"
        descripcion="Alias y etiquetas que alimentan la asistencia. Sin datos de clientes."
      />

      {error !== null ? (
        <p className="text-cuerpo font-bold text-aviso" role="alert">
          {error}
        </p>
      ) : null}

      {ocupado ? (
        <p className="text-cuerpo text-desvaida">Cargando memoria…</p>
      ) : (
        <section>
          <h2 className="mb-3 font-mono text-etiqueta uppercase text-desvaida">
            Memoria consolidada
          </h2>
          {entradas.length === 0 ? (
            <p className="text-cuerpo text-desvaida">
              Todavía no hay alias aprendidos.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {entradas.map(([codigo, entrada]) => (
                <li
                  key={codigo}
                  className="rounded-2xl border border-borde bg-papel px-4 py-3"
                >
                  <p className="font-mono font-bold text-tinta">{codigo}</p>
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
                {loteAbierto === lote.diaLima ? (
                  <div className="mt-2 rounded-2xl border border-borde bg-mesa/40 px-4 py-3">
                    {cargandoDiff ? (
                      <p className="text-cuerpo text-desvaida">Cargando diff…</p>
                    ) : (diffs ?? []).length === 0 ? (
                      <p className="text-cuerpo text-desvaida">
                        Sin cambios ese día.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-2 text-cuerpo">
                        {(diffs ?? []).map((diff) => (
                          <li key={diff.codigo}>
                            <span className="font-mono font-bold">{diff.codigo}</span>
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
