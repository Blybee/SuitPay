import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { CabeceraAdmin } from '../../features/administracion/cabecera-admin.tsx'
import { GrillaRevision } from '../../features/catalogo/grilla-revision.tsx'
import {
  importarCatalogoFn,
  interpretarCatalogoDocumentoFn,
} from '../../features/catalogo/importar.funciones.ts'
import type { ResumenDeImportacion } from '../../features/catalogo/importar.funciones.ts'
import { usarNotificaciones } from '../../features/notificaciones/almacen.ts'
import { GuardaSesion } from '../../features/sesion/GuardaSesion.tsx'
import { formatearImporte } from '../../domain/totales/calculo.ts'
import type { CategoriaDeCatalogo, Producto } from '../../domain/esquemas/comunes.ts'

/**
 * Carga del catálogo (US2 / FR-009, FR-009b, FR-010, FR-011, FR-009c, FR-009d).
 *
 * El administrador sube el JSON de la tienda o el PDF de lista de precios,
 * revisa filas y categorías, y solo entonces confirma la publicación.
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
  const [resumen, setResumen] = useState<ResumenDeImportacion | null>(null)
  const [productos, setProductos] = useState<readonly Producto[]>([])
  const [categorias, setCategorias] = useState<readonly CategoriaDeCatalogo[]>(
    [],
  )
  const [ocupado, setOcupado] = useState(false)

  async function leerArchivo(archivo: File): Promise<void> {
    setResumen(null)
    setProductos([])
    setCategorias([])
    setArchivoNombre(archivo.name)
    const esPdf =
      archivo.type === 'application/pdf' ||
      archivo.name.toLowerCase().endsWith('.pdf')
    setOcupado(true)
    try {
      if (esPdf) {
        await leerPdf(archivo)
        return
      }
      await leerJson(archivo)
    } catch (err) {
      usarNotificaciones.getState().mostrar({
        tono: 'error',
        mensaje: mensajeDeError(err),
      })
    } finally {
      setOcupado(false)
    }
  }

  async function leerJson(archivo: File): Promise<void> {
    const texto = await archivo.text()
    const resultado = await importarCatalogoFn({
      data: {
        contenido: texto,
        formato: 'json_tienda',
        modo: 'validar',
      },
    })
    if (!resultado.ok || resultado.resumen === undefined) {
      usarNotificaciones.getState().mostrar({
        tono: 'error',
        mensaje: resultado.error?.mensaje ?? 'No se pudo validar el catálogo.',
      })
      return
    }
    aplicarValidacion(resultado.resumen)
    usarNotificaciones.getState().mostrar({
      tono: 'info',
      mensaje: 'Validación lista. Revisa y asigna categorías antes de publicar.',
    })
  }

  async function leerPdf(archivo: File): Promise<void> {
    const contenidoBase64 = await archivoABase64(archivo)
    const interpretado = await interpretarCatalogoDocumentoFn({
      data: { contenidoBase64, nombreArchivo: archivo.name },
    })
    if (!interpretado.ok || interpretado.filas === undefined) {
      usarNotificaciones.getState().mostrar({
        tono: 'error',
        mensaje:
          interpretado.error?.mensaje ?? 'No se pudo interpretar el PDF.',
      })
      return
    }
    const resultado = await importarCatalogoFn({
      data: {
        contenido: JSON.stringify({
          productos: interpretado.filas,
          categorias: [],
        }),
        formato: 'productos_revisados',
        modo: 'validar',
      },
    })
    if (!resultado.ok || resultado.resumen === undefined) {
      setProductos(interpretado.filas)
      usarNotificaciones.getState().mostrar({
        tono: 'error',
        mensaje:
          resultado.error?.mensaje ??
          'El PDF se interpretó, pero no se pudo validar.',
      })
      return
    }
    aplicarValidacion(resultado.resumen)
    usarNotificaciones.getState().mostrar({
      tono: 'info',
      mensaje: `PDF: ${interpretado.reconocidos ?? interpretado.filas.length} filas, ${interpretado.omitidos ?? 0} omitidas. Revisa unidades desconocidas antes de publicar.`,
    })
  }

  function aplicarValidacion(resumen: ResumenDeImportacion): void {
    setResumen(resumen)
    setProductos(resumen.propuestos)
    setCategorias(resumen.categorias)
  }

  async function publicar(): Promise<void> {
    if (productos.length === 0) return
    setOcupado(true)
    try {
      const resultado = await importarCatalogoFn({
        data: {
          contenido: JSON.stringify({ productos, categorias }),
          formato: 'productos_revisados',
          modo: 'publicar',
        },
      })
      if (!resultado.ok || resultado.resumen === undefined) {
        usarNotificaciones.getState().mostrar({
          tono: 'error',
          mensaje:
            resultado.error?.mensaje ?? 'No se pudo publicar el catálogo.',
        })
        return
      }
      setResumen(resultado.resumen)
      usarNotificaciones.getState().mostrar({
        tono: 'exito',
        mensaje: 'Catálogo publicado.',
      })
    } catch (err) {
      usarNotificaciones.getState().mostrar({
        tono: 'error',
        mensaje: mensajeDeError(err),
      })
    } finally {
      setOcupado(false)
    }
  }

  const bloqueado =
    resumen !== null &&
    resumen.conflictos.some((c) => c.tipo === 'codigo_duplicado')

  return (
    <div className="flex min-h-full flex-col gap-6 px-6 py-8">
      <CabeceraAdmin
        titulo="Catálogo"
        descripcion="Carga el JSON de la tienda o el PDF de lista de precios. Revisa el resumen y las categorías antes de publicar: nada se aplica hasta que confirmes."
      />

      <section className="rounded-3xl border border-borde bg-papel p-6 shadow-sm">
        <label className="flex cursor-pointer flex-col gap-2">
          <span className="font-mono text-etiqueta uppercase text-desvaida">
            Archivo JSON o PDF
          </span>
          <input
            type="file"
            accept="application/json,.json,.js,application/pdf,.pdf"
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
            disabled={productos.length === 0 || ocupado || bloqueado}
            onClick={() => void publicar()}
            className="rounded-full bg-marca px-5 py-2.5 font-bold text-papel disabled:opacity-40"
          >
            {ocupado ? 'Procesando…' : 'Publicar'}
          </button>
        </div>
      </section>

      {productos.length > 0 && (
        <GrillaRevision
          productos={productos}
          categorias={categorias}
          onProductos={setProductos}
          onCategorias={setCategorias}
        />
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
            {resumen.conflictos.slice(0, 60).map((conflicto) => (
              <li key={`${conflicto.tipo}-${conflicto.codigo}`}>
                <span className="font-mono text-etiqueta">
                  {conflicto.codigo}
                </span>
                {' — '}
                {conflicto.detalle}
              </li>
            ))}
          </ul>
          {resumen.conflictos.length > 60 ? (
            <p className="mt-2 font-mono text-etiqueta text-desvaida">
              … y {resumen.conflictos.length - 60} más. Corrígelos en la grilla
              (unidad o duplicado) antes de publicar.
            </p>
          ) : null}
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
                  <span className="uppercase">
                    {cambio.anterior.descripcion}
                  </span>
                  :{' '}
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

function archivoABase64(archivo: File): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onload = () => {
      const bruto = String(lector.result ?? '')
      const coma = bruto.indexOf(',')
      resolver(coma >= 0 ? bruto.slice(coma + 1) : bruto)
    }
    lector.onerror = () => rechazar(lector.error ?? new Error('lectura'))
    lector.readAsDataURL(archivo)
  })
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
