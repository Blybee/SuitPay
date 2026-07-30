import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { importarCatalogoFn } from '../../features/catalogo/importar.funciones.ts'
import type { ResumenDeImportacion } from '../../features/catalogo/importar.funciones.ts'
import { GuardaSesion } from '../../features/sesion/GuardaSesion.tsx'
import { formatearImporte } from '../../domain/totales/calculo.ts'

/**
 * Carga del catálogo (US2 / FR-009, FR-010, FR-011).
 *
 * El administrador sube el JSON de la tienda, revisa el resumen y las
 * diferencias, y solo entonces confirma la publicación.
 */

export const Route = createFileRoute('/administracion/catalogo')({
  component: () => (
    <GuardaSesion roles={['administrador']}>
      <PantallaDeCatalogo />
    </GuardaSesion>
  ),
})

function PantallaDeCatalogo() {
  const [archivoNombre, setArchivoNombre] = useState<string | null>(null)
  const [contenido, setContenido] = useState<string | null>(null)
  const [resumen, setResumen] = useState<ResumenDeImportacion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function leerArchivo(archivo: File): Promise<void> {
    setError(null)
    setResumen(null)
    setArchivoNombre(archivo.name)
    const texto = await archivo.text()
    setContenido(texto)
  }

  async function validar(): Promise<void> {
    if (contenido === null) return
    setOcupado(true)
    setError(null)
    try {
      const resultado = await importarCatalogoFn({
        data: {
          contenido,
          formato: 'json_tienda',
          modo: 'validar',
        },
      })
      if (!resultado.ok || resultado.resumen === undefined) {
        setError(resultado.error?.mensaje ?? 'No se pudo validar el catálogo.')
        return
      }
      setResumen(resultado.resumen)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setOcupado(false)
    }
  }

  async function publicar(): Promise<void> {
    if (contenido === null) return
    setOcupado(true)
    setError(null)
    try {
      const resultado = await importarCatalogoFn({
        data: {
          contenido,
          formato: 'json_tienda',
          modo: 'publicar',
        },
      })
      if (!resultado.ok || resultado.resumen === undefined) {
        setError(resultado.error?.mensaje ?? 'No se pudo publicar el catálogo.')
        return
      }
      setResumen(resultado.resumen)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setOcupado(false)
    }
  }

  const bloqueado =
    resumen !== null &&
    resumen.conflictos.some((c) => c.tipo === 'codigo_duplicado')

  return (
    <div className="flex min-h-full flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="text-cabecera font-bold text-tinta">Catálogo</h1>
        <p className="mt-2 max-w-2xl text-cuerpo text-desvaida">
          Carga el JSON exportado de la tienda. Revisa el resumen antes de
          publicar: nada se aplica hasta que confirmes.
        </p>
      </header>

      <section className="rounded-3xl border border-borde bg-papel p-6 shadow-sm">
        <label className="flex cursor-pointer flex-col gap-2">
          <span className="font-mono text-etiqueta uppercase text-desvaida">
            Archivo JSON
          </span>
          <input
            type="file"
            accept="application/json,.json,.js"
            className="text-cuerpo text-tinta file:mr-4 file:rounded-full file:border-0 file:bg-marca/15 file:px-4 file:py-2 file:font-bold file:text-marca"
            onChange={(evento) => {
              const archivo = evento.target.files?.[0]
              if (archivo) void leerArchivo(archivo)
            }}
          />
        </label>
        {archivoNombre !== null && (
          <p className="mt-3 text-cuerpo text-tinta">
            Seleccionado: <strong>{archivoNombre}</strong>
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={contenido === null || ocupado}
            onClick={() => void validar()}
            className="rounded-full bg-marca px-5 py-2.5 font-bold text-papel disabled:opacity-40"
          >
            {ocupado ? 'Procesando…' : 'Validar'}
          </button>
          <button
            type="button"
            disabled={contenido === null || ocupado || bloqueado}
            onClick={() => void publicar()}
            className="rounded-full border border-borde px-5 py-2.5 font-bold text-tinta disabled:opacity-40"
          >
            Publicar
          </button>
        </div>
      </section>

      {error !== null && (
        <p className="rounded-2xl bg-aviso/15 px-4 py-3 font-bold text-aviso">
          {error}
        </p>
      )}

      {resumen !== null && <Resumen resumen={resumen} />}
    </div>
  )
}

function Resumen({ resumen }: { readonly resumen: ResumenDeImportacion }) {
  const diff = resumen.diferencias

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-3xl border border-borde bg-papel p-6 shadow-sm">
        <h2 className="text-subtitulo font-bold text-tinta">Resumen</h2>
        <ul className="mt-3 space-y-1 text-cuerpo text-tinta">
          <li>
            Productos reconocidos:{' '}
            <strong>{resumen.reconocidos}</strong>
          </li>
          <li>
            Conflictos: <strong>{resumen.conflictos.length}</strong>
          </li>
          {resumen.publicado && (
            <li>
              Publicado como versión <strong>{resumen.version}</strong>
            </li>
          )}
        </ul>
      </div>

      {resumen.conflictos.length > 0 && (
        <div className="rounded-3xl border border-aviso/40 bg-aviso/10 p-6">
          <h2 className="text-subtitulo font-bold text-aviso">Conflictos</h2>
          <p className="mt-1 text-cuerpo text-desvaida">
            El sistema no los resuelve por ti. Corrige el archivo y vuelve a
            validar.
          </p>
          <ul className="mt-3 space-y-2 text-cuerpo text-tinta">
            {resumen.conflictos.map((conflicto) => (
              <li key={`${conflicto.tipo}-${conflicto.codigo}`}>
                <span className="font-mono text-etiqueta">
                  {conflicto.codigo}
                </span>
                {' — '}
                {conflicto.detalle}
              </li>
            ))}
          </ul>
        </div>
      )}

      {diff !== null && (
        <div className="rounded-3xl border border-borde bg-papel p-6 shadow-sm">
          <h2 className="text-subtitulo font-bold text-tinta">Diferencias</h2>
          <ul className="mt-3 space-y-1 text-cuerpo text-tinta">
            <li>
              Nuevos: <strong>{diff.nuevos.length}</strong>
            </li>
            <li>
              Cambiados: <strong>{diff.cambiados.length}</strong>
            </li>
            <li>
              Desaparecen: <strong>{diff.desaparecidos.length}</strong>
            </li>
          </ul>

          {diff.cambiados.length > 0 && (
            <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto text-cuerpo">
              {diff.cambiados.slice(0, 40).map((cambio) => (
                <li key={cambio.siguiente.codigo}>
                  <span className="font-mono text-etiqueta">
                    {cambio.siguiente.codigo}
                  </span>{' '}
                  {cambio.anterior.descripcion}:{' '}
                  <span className="text-desvaida line-through">
                    {formatearImporte(cambio.anterior.precio)}
                  </span>{' '}
                  → {formatearImporte(cambio.siguiente.precio)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

function mensajeDeError(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    if (
      'mensajeParaVendedor' in error &&
      typeof error.mensajeParaVendedor === 'string'
    ) {
      return error.mensajeParaVendedor
    }
    if ('message' in error && typeof error.message === 'string') {
      return error.message
    }
  }
  return 'No se pudo importar el catálogo.'
}
