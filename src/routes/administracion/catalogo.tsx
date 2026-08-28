import { useMemo, useState } from 'react'
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
import { detectarConflictos } from '../../domain/catalogo/conflictos.ts'
import type { CategoriaDeCatalogo, Producto } from '../../domain/esquemas/comunes.ts'
import { DestinoDeNota, Nota } from '../../ui/componentes/Nota.tsx'
import { Boton } from '../../ui/componentes/primitivas.tsx'
import {
  clasificarArchivo,
  ZonaDeCarga,
} from '../../ui/componentes/ZonaDeCarga.tsx'
import type {
  ArchivoElegido,
  EstadoDeCarga,
} from '../../ui/componentes/ZonaDeCarga.tsx'

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
  const [archivo, setArchivo] = useState<ArchivoElegido | null>(null)
  const [estadoCarga, setEstadoCarga] = useState<EstadoDeCarga>('vacio')
  const [mensajeCarga, setMensajeCarga] = useState<string | null>(null)
  const [resumen, setResumen] = useState<ResumenDeImportacion | null>(null)
  const [productos, setProductos] = useState<readonly Producto[]>([])
  const [categorias, setCategorias] = useState<readonly CategoriaDeCatalogo[]>(
    [],
  )
  const [ocupado, setOcupado] = useState(false)
  const [publicando, setPublicando] = useState(false)

  function fallarCarga(mensaje: string): void {
    setEstadoCarga('error')
    setMensajeCarga(mensaje)
    usarNotificaciones.getState().mostrar({
      tono: 'error',
      mensaje,
    })
  }

  function quitarArchivo(): void {
    if (ocupado || publicando) return
    setArchivo(null)
    setEstadoCarga('vacio')
    setMensajeCarga(null)
    setResumen(null)
    setProductos([])
    setCategorias([])
  }

  async function leerArchivo(elegido: File): Promise<void> {
    const clase = clasificarArchivo(elegido)
    if (clase === null) {
      fallarCarga('Solo se aceptan JSON o PDF.')
      return
    }
    setResumen(null)
    setProductos([])
    setCategorias([])
    setArchivo({
      nombre: elegido.name,
      bytes: elegido.size,
      clase,
    })
    setEstadoCarga('procesando')
    setMensajeCarga(null)
    setOcupado(true)
    try {
      if (clase === 'pdf') {
        await leerPdf(elegido)
        return
      }
      await leerJson(elegido)
    } catch (err) {
      fallarCarga(mensajeDeError(err))
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
      fallarCarga(
        resultado.error?.mensaje ?? 'No se pudo validar el catálogo.',
      )
      return
    }
    aplicarValidacion(resultado.resumen)
    setEstadoCarga('listo')
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
      fallarCarga(
        interpretado.error?.mensaje ?? 'No se pudo interpretar el PDF.',
      )
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
      fallarCarga(
        resultado.error?.mensaje ??
          'El PDF se interpretó, pero no se pudo validar.',
      )
      return
    }
    aplicarValidacion(resultado.resumen)
    setEstadoCarga('listo')
    usarNotificaciones.getState().mostrar({
      tono: 'info',
      mensaje: `PDF: ${interpretado.reconocidos ?? interpretado.filas.length} filas, ${interpretado.omitidos ?? 0} omitidas. Revisa y confirma antes de publicar.`,
    })
  }

  function aplicarValidacion(resumen: ResumenDeImportacion): void {
    setResumen(resumen)
    setProductos(resumen.propuestos)
    setCategorias(resumen.categorias)
  }

  async function publicar(): Promise<void> {
    if (productos.length === 0) return
    setPublicando(true)
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
      setPublicando(false)
    }
  }

  const conflictos = useMemo(() => detectarConflictos(productos), [productos])
  const bloqueado = conflictos.length > 0

  return (
    <div className="flex min-h-full flex-col gap-6 px-6 py-8">
      <CabeceraAdmin titulo="Catálogo" />

      <section className="rounded-3xl border border-borde bg-papel p-6 shadow-sm">
        <ZonaDeCarga
          titulo="Importar Productos"
          etiqueta="Archivo JSON o PDF"
          nota={
            <Nota linea="Descarga la lista de productos en:">
              <DestinoDeNota origen="Tienda virtual" formato="JSON" />
              <DestinoDeNota origen="SICO" formato="PDF" />
            </Nota>
          }
          archivo={archivo}
          estado={estadoCarga}
          mensaje={mensajeCarga}
          deshabilitado={ocupado || publicando}
          onArchivo={(elegido) => {
            void leerArchivo(elegido)
          }}
          onQuitar={quitarArchivo}
        />

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-cuerpo text-desvaida">
            {bloqueado
              ? 'Hay filas con problema. Corrígelas en la grilla antes de publicar.'
              : 'El catálogo no se actualiza hasta que confirmes.'}
          </p>
          <Boton
            variante="principal"
            disabled={productos.length === 0 || ocupado || publicando || bloqueado}
            onClick={() => void publicar()}
          >
            {publicando ? 'Publicando…' : 'Publicar'}
          </Boton>
        </div>
      </section>

      {productos.length > 0 && (
        <GrillaRevision
          productos={productos}
          categorias={categorias}
          balance={{
            reconocidos: resumen?.reconocidos ?? productos.length,
            nuevos: resumen?.diferencias?.nuevos.length ?? 0,
            cambiados: resumen?.diferencias?.cambiados.length ?? 0,
            desaparecen: resumen?.diferencias?.desaparecidos.length ?? 0,
            version: resumen?.version ?? null,
            publicado: resumen?.publicado ?? false,
          }}
          onProductos={setProductos}
          onCategorias={setCategorias}
        />
      )}
    </div>
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
