import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, Plus, TriangleAlert, Upload } from 'lucide-react'
import { CabeceraAdmin } from '../../features/administracion/cabecera-admin.tsx'
import { leerCatalogoPublicadoFn } from '../../features/catalogo/catalogo.funciones.ts'
import { GrillaRevision } from '../../features/catalogo/grilla-revision.tsx'
import type { ModoDeGrilla } from '../../features/catalogo/grilla-revision.tsx'
import {
  importarCatalogoFn,
  interpretarCatalogoDocumentoFn,
} from '../../features/catalogo/importar.funciones.ts'
import type { ResumenDeImportacion } from '../../features/catalogo/importar.funciones.ts'
import { listarAlertasInventarioFn } from '../../features/inventario/inventario.funciones.ts'
import { PanelCantidad } from '../../features/inventario/panel-cantidad.tsx'
import { usarNotificaciones } from '../../features/notificaciones/almacen.ts'
import { usarSesion } from '../../features/sesion/almacen.ts'
import { GuardaSesion } from '../../features/sesion/GuardaSesion.tsx'
import { detectarConflictos } from '../../domain/catalogo/conflictos.ts'
import type {
  CategoriaDeCatalogo,
  Producto,
} from '../../domain/esquemas/comunes.ts'
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
 * Catálogo maestro (lista publicada) + importación en disclosure.
 * Cantidad orientativa: popover perezoso por fila, no viaja en catalogo/actual.
 */

export const Route = createFileRoute('/administracion/catalogo')({
  component: () => (
    <GuardaSesion roles={['administrador', 'jefe']}>
      <PantallaDeCatalogo />
    </GuardaSesion>
  ),
})

interface InstantaneaMaestra {
  readonly productos: readonly Producto[]
  readonly categorias: readonly CategoriaDeCatalogo[]
  readonly version: number | null
}

function comportamientoDeScroll(): ScrollBehavior {
  const reducido =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return reducido ? 'auto' : 'smooth'
}

function productoNuevo(): Producto {
  return {
    codigo: `N-${crypto.randomUUID().slice(0, 8)}`,
    descripcion: 'Nuevo producto',
    unidad: 'NIU',
    precio: 0,
    activo: true,
    marca: '',
  }
}

function PantallaDeCatalogo() {
  const rol = usarSesion((s) => s.rol)
  const puedeEscribir = rol === 'administrador'
  const idImportar = useId()

  const [cargando, setCargando] = useState(true)
  const [modo, setModo] = useState<ModoDeGrilla>('maestro')
  const [importarAbierto, setImportarAbierto] = useState(false)
  const [archivo, setArchivo] = useState<ArchivoElegido | null>(null)
  const [estadoCarga, setEstadoCarga] = useState<EstadoDeCarga>('vacio')
  const [mensajeCarga, setMensajeCarga] = useState<string | null>(null)
  const [resumen, setResumen] = useState<ResumenDeImportacion | null>(null)
  const [productos, setProductos] = useState<readonly Producto[]>([])
  const [categorias, setCategorias] = useState<readonly CategoriaDeCatalogo[]>(
    [],
  )
  const [version, setVersion] = useState<number | null>(null)
  const [snapshot, setSnapshot] = useState<InstantaneaMaestra | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [codigoCantidad, setCodigoCantidad] = useState<string | null>(null)
  const [codigoAEnfocar, setCodigoAEnfocar] = useState<string | null>(null)
  const anclaCantidad = useRef<HTMLDivElement>(null)
  const [codigosEnAlerta, setCodigosEnAlerta] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [soloAlertas, setSoloAlertas] = useState(false)

  async function refrescarAlertas(): Promise<void> {
    const respuesta = await listarAlertasInventarioFn()
    if (!respuesta?.ok || respuesta.alertas === undefined) return
    setCodigosEnAlerta(new Set(respuesta.alertas.map((cada) => cada.codigo)))
  }

  useEffect(() => {
    let vivo = true
    void (async () => {
      try {
        const catalogo = await leerCatalogoPublicadoFn()
        await refrescarAlertas()
        if (!vivo) return
        if (!catalogo?.ok) {
          usarNotificaciones.getState().mostrar({
            tono: 'error',
            mensaje:
              catalogo?.error?.mensaje ?? 'No se pudo leer el catálogo.',
          })
          setImportarAbierto(true)
          return
        }
        const publicado = catalogo.catalogo
        if (publicado === null || publicado === undefined) {
          setProductos([])
          setCategorias([])
          setVersion(null)
          setImportarAbierto(true)
          return
        }
        setProductos(publicado.productos)
        setCategorias(publicado.categorias)
        setVersion(publicado.version)
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => {
      vivo = false
    }
  }, [])

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
  }

  function cancelarLote(): void {
    if (ocupado || publicando) return
    const previa = snapshot
    setModo('maestro')
    setImportarAbierto(false)
    setArchivo(null)
    setEstadoCarga('vacio')
    setMensajeCarga(null)
    setResumen(null)
    if (previa !== null) {
      setProductos(previa.productos)
      setCategorias(previa.categorias)
      setVersion(previa.version)
    }
    setSnapshot(null)
  }

  function abrirImportar(): void {
    if (!puedeEscribir) return
    setImportarAbierto((abierto) => {
      const siguiente = !abierto
      if (siguiente && modo === 'maestro') {
        setSnapshot({ productos, categorias, version })
      }
      return siguiente
    })
  }

  async function leerArchivo(elegido: File): Promise<void> {
    const clase = clasificarArchivo(elegido)
    if (clase === null) {
      fallarCarga('Solo se aceptan JSON o PDF.')
      return
    }
    if (modo === 'maestro') {
      setSnapshot({ productos, categorias, version })
    }
    setResumen(null)
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
    if (!resultado?.ok || resultado.resumen === undefined) {
      fallarCarga(resultado?.error?.mensaje ?? 'No se pudo validar el catálogo.')
      return
    }
    aplicarValidacion(resultado.resumen)
    setEstadoCarga('listo')
    usarNotificaciones.getState().mostrar({
      tono: 'info',
      mensaje:
        'Validación lista. Revisa y asigna categorías antes de publicar.',
    })
  }

  async function leerPdf(archivo: File): Promise<void> {
    const contenidoBase64 = await archivoABase64(archivo)
    const interpretado = await interpretarCatalogoDocumentoFn({
      data: { contenidoBase64, nombreArchivo: archivo.name },
    })
    if (
      interpretado == null ||
      !interpretado.ok ||
      interpretado.filas === undefined
    ) {
      fallarCarga(
        interpretado?.error?.mensaje ??
          'No se pudo interpretar el PDF. Si el archivo es grande, espera un momento y vuelve a intentar.',
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
    if (!resultado?.ok || resultado.resumen === undefined) {
      setProductos(interpretado.filas)
      setModo('revision')
      fallarCarga(
        resultado?.error?.mensaje ??
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
    setModo('revision')
  }

  async function publicarLote(): Promise<void> {
    await persistir('publicar')
  }

  async function guardarMaestro(): Promise<void> {
    await persistir('guardar')
  }

  async function persistir(origen: 'publicar' | 'guardar'): Promise<void> {
    if (productos.length === 0 || !puedeEscribir) return
    setPublicando(true)
    try {
      const resultado = await importarCatalogoFn({
        data: {
          contenido: JSON.stringify({ productos, categorias }),
          formato: 'productos_revisados',
          modo: 'publicar',
        },
      })
      if (!resultado?.ok || resultado.resumen === undefined) {
        usarNotificaciones.getState().mostrar({
          tono: 'error',
          mensaje:
            resultado?.error?.mensaje ?? 'No se pudo publicar el catálogo.',
        })
        return
      }
      setResumen(resultado.resumen)
      setProductos(resultado.resumen.propuestos)
      setCategorias(resultado.resumen.categorias)
      setVersion(resultado.resumen.version)
      setModo('maestro')
      setImportarAbierto(false)
      setArchivo(null)
      setEstadoCarga('vacio')
      setSnapshot(null)
      usarNotificaciones.getState().mostrar({
        tono: 'exito',
        mensaje:
          origen === 'guardar' ? 'Catálogo guardado.' : 'Catálogo publicado.',
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
  const vacio =
    !cargando && modo === 'maestro' && productos.length === 0
  const descripcionCantidad =
    productos.find((p) => p.codigo === codigoCantidad)?.descripcion ?? ''

  function agregarNuevo(): void {
    const nuevo = productoNuevo()
    setSoloAlertas(false)
    setProductos((actual) => [nuevo, ...actual])
    setCodigoAEnfocar(nuevo.codigo)
    usarNotificaciones.getState().mostrar({
      tono: 'info',
      mensaje:
        'Producto al inicio de la lista. Complétalo y pulsa Guardar.',
    })
  }

  useEffect(() => {
    if (codigoCantidad === null) return
    anclaCantidad.current?.scrollIntoView({
      block: 'start',
      behavior: comportamientoDeScroll(),
    })
  }, [codigoCantidad])

  return (
    <div className="flex min-h-full flex-col gap-3 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <CabeceraAdmin titulo="Catálogo" />
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {modo === 'maestro' ? (
            <Boton
              variante={soloAlertas ? 'peligro' : 'secundario'}
              aria-pressed={soloAlertas}
              disabled={codigosEnAlerta.size === 0 && !soloAlertas}
              onClick={() => setSoloAlertas((actual) => !actual)}
            >
              En alerta
              {codigosEnAlerta.size > 0 ? ` (${codigosEnAlerta.size})` : ''}
            </Boton>
          ) : null}
          {puedeEscribir && modo === 'maestro' ? (
            <Boton onClick={agregarNuevo}>
              <Plus className="size-4" aria-hidden />
              Nuevo
            </Boton>
          ) : null}
          {puedeEscribir ? (
            <Boton
              variante="principal"
              aria-expanded={importarAbierto}
              aria-controls={idImportar}
              onClick={abrirImportar}
            >
              <Upload className="size-4" aria-hidden />
              Importar
            </Boton>
          ) : null}
          {puedeEscribir && modo === 'maestro' ? (
            <Boton
              variante="principal"
              disabled={
                productos.length === 0 || publicando || ocupado || bloqueado
              }
              aria-busy={publicando || undefined}
              onClick={() => void guardarMaestro()}
            >
              {publicando ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : null}
              {publicando ? 'Guardando…' : 'Guardar'}
            </Boton>
          ) : null}
          {puedeEscribir && modo === 'revision' ? (
            <>
              <Boton
                variante="discreto"
                disabled={ocupado || publicando}
                onClick={cancelarLote}
              >
                Cancelar
              </Boton>
              <Boton
                variante="principal"
                disabled={
                  productos.length === 0 || ocupado || publicando || bloqueado
                }
                aria-busy={publicando || undefined}
                onClick={() => void publicarLote()}
              >
                {publicando ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                ) : null}
                {publicando ? 'Publicando…' : 'Publicar'}
              </Boton>
            </>
          ) : null}
        </div>
      </div>

      <div>
        <div
          id={idImportar}
          className="grid transition-[grid-template-rows] duration-media ease-salida motion-reduce:transition-none"
          style={{ gridTemplateRows: importarAbierto ? '1fr' : '0fr' }}
        >
          <div className="min-h-0 overflow-hidden">
            <section className="rounded-3xl border border-borde bg-papel p-6 shadow-sm">
              <ZonaDeCarga
                titulo="Importar productos"
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
                ocultarEstadoSinError
                deshabilitado={ocupado || publicando || !puedeEscribir}
                onArchivo={(elegido) => {
                  void leerArchivo(elegido)
                }}
                onQuitar={quitarArchivo}
              />
              {bloqueado && modo === 'revision' ? (
                <AvisoPublicacionBloqueada />
              ) : null}
            </section>
          </div>
        </div>

        <div
          ref={anclaCantidad}
          className="grid transition-[grid-template-rows] duration-media ease-salida motion-reduce:transition-none"
          style={{ gridTemplateRows: codigoCantidad !== null ? '1fr' : '0fr' }}
        >
          <div className="min-h-0 overflow-hidden">
            {codigoCantidad !== null ? (
              <div className="pb-1">
                <PanelCantidad
                  codigo={codigoCantidad}
                  descripcion={descripcionCantidad}
                  puedeEscribir={puedeEscribir}
                  onCerrar={() => setCodigoCantidad(null)}
                  onGuardado={() => void refrescarAlertas()}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {cargando ? (
        <p className="flex items-center gap-2 text-cuerpo text-desvaida">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          Cargando catálogo…
        </p>
      ) : null}

      {vacio ? (
        <p className="text-cuerpo text-desvaida">
          Aún no hay catálogo publicado. Importa un JSON o un PDF para empezar.
        </p>
      ) : null}

      {!cargando && productos.length > 0 ? (
        <GrillaRevision
          productos={productos}
          categorias={categorias}
          modo={modo}
          puedeEscribir={puedeEscribir}
          mostrarInactivos={mostrarInactivos}
          onMostrarInactivos={setMostrarInactivos}
          onPedirCantidad={setCodigoCantidad}
          codigoAEnfocar={codigoAEnfocar}
          onCodigoEnfocado={() => setCodigoAEnfocar(null)}
          soloAlertas={soloAlertas}
          codigosEnAlerta={codigosEnAlerta}
          balance={{
            reconocidos: resumen?.reconocidos ?? productos.length,
            nuevos: resumen?.diferencias?.nuevos.length ?? 0,
            cambiados: resumen?.diferencias?.cambiados.length ?? 0,
            desaparecen: resumen?.diferencias?.desaparecidos.length ?? 0,
            version: resumen?.version ?? version,
            publicado:
              modo === 'maestro'
                ? version !== null
                : (resumen?.publicado ?? false),
          }}
          onProductos={setProductos}
          onCategorias={setCategorias}
        />
      ) : null}

      {bloqueado && modo === 'maestro' ? <AvisoPublicacionBloqueada /> : null}
    </div>
  )
}

function AvisoPublicacionBloqueada() {
  return (
    <aside
      role="alert"
      className="flex items-start gap-3 rounded-2xl bg-aviso/10 px-4 py-3 text-aviso"
    >
      <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="font-bold">Publicación bloqueada</p>
        <p className="text-cuerpo">
          Hay filas con problema. Corrígelas en la grilla antes de guardar.
        </p>
      </div>
    </aside>
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
      const texto = error.message
      if (
        texto.length === 0 ||
        texto.startsWith('Cannot read') ||
        texto.includes('Invariant failed') ||
        texto === 'Internal Server Error'
      ) {
        return 'No se pudo importar el catálogo. El servidor no completó la lectura del PDF.'
      }
      return texto
    }
  }
  return 'No se pudo importar el catálogo.'
}
