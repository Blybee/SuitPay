import { createFileRoute } from '@tanstack/react-router'
import { Loader2, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CabeceraAdmin } from '../../features/administracion/cabecera-admin.tsx'
import { leerIndiceDeTransportistasFn } from '../../features/guia/guia.funciones.ts'
import {
  usarImportacionDePadron,
  textoDeResumen,
} from '../../features/padron/almacen.ts'
import {
  confirmarGuardado,
  diffDeBorrador,
  esSucia,
  filaDesdeIndice,
  filaNueva,
  reconciliarConIndice,
} from '../../features/padron/borrador.ts'
import type { FilaDeBorrador, VistaDePadron } from '../../features/padron/borrador.ts'
import {
  leerFichaDeCliente,
  leerFichaDeTransportista,
} from '../../features/padron/ficha.ts'
import { GrillaDePadron } from '../../features/padron/grilla.tsx'
import { GrupoDeVista } from '../../features/padron/grupo-vista.tsx'
import { PanelFicha } from '../../features/padron/panel-ficha.tsx'
import {
  aplicarEdicionDePadronFn,
  leerIndiceDeClientesFn,
} from '../../features/padron/padron.funciones.ts'
import { mostrarNotificacion } from '../../features/notificaciones/almacen.ts'
import { GuardaSesion } from '../../features/sesion/GuardaSesion.tsx'
import { Boton } from '../../ui/componentes/primitivas.tsx'
import {
  ZonaDeCarga,
  clasificarArchivo,
} from '../../ui/componentes/ZonaDeCarga.tsx'
import type {
  ArchivoElegido,
  EstadoDeCarga,
} from '../../ui/componentes/ZonaDeCarga.tsx'

export const Route = createFileRoute('/administracion/clientes-transporte')({
  component: () => (
    <GuardaSesion roles={['administrador']}>
      <PantallaDePadron />
    </GuardaSesion>
  ),
})

interface EstadoDeVista {
  readonly filas: readonly FilaDeBorrador[]
  readonly cargado: boolean
  readonly consulta: string
}

function vistasVacias(): Record<VistaDePadron, EstadoDeVista> {
  return {
    clientes: { filas: [], cargado: false, consulta: '' },
    transportistas: { filas: [], cargado: false, consulta: '' },
  }
}

function fichaDe(archivo: File): ArchivoElegido {
  return {
    nombre: archivo.name,
    bytes: archivo.size,
    clase: clasificarArchivo(archivo) ?? 'pdf',
  }
}

function PantallaDePadron() {
  const fase = usarImportacionDePadron((s) => s.fase)
  const tipo = usarImportacionDePadron((s) => s.tipo)
  const hecho = usarImportacionDePadron((s) => s.hecho)
  const total = usarImportacionDePadron((s) => s.total)
  const resumen = usarImportacionDePadron((s) => s.resumen)
  const mensajeError = usarImportacionDePadron((s) => s.mensajeError)
  const iniciar = usarImportacionDePadron((s) => s.iniciar)
  const ocupado = fase === 'leyendo' || fase === 'guardando'

  const [clientes, setClientes] = useState<ArchivoElegido | null>(null)
  const [transportistas, setTransportistas] = useState<ArchivoElegido | null>(
    null,
  )
  const [vista, setVista] = useState<VistaDePadron>('clientes')
  const [porVista, setPorVista] = useState(vistasVacias)
  const [claveAbierta, setClaveAbierta] = useState<string | null>(null)
  const [claveAEnfocar, setClaveAEnfocar] = useState<string | null>(null)
  const [cargandoFicha, setCargandoFicha] = useState(false)
  const [errorFicha, setErrorFicha] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const anclaFicha = useRef<HTMLDivElement>(null)
  const pedidoFicha = useRef(0)
  const faseAnterior = useRef(fase)

  const estado = porVista[vista]
  const filas = estado.filas
  const haySucias = filas.some(esSucia)
  const filaAbierta =
    claveAbierta === null
      ? null
      : (filas.find((fila) => fila.clave === claveAbierta) ?? null)

  const detalle =
    fase === 'leyendo'
      ? `Leyendo página ${hecho} de ${total || '…'}`
      : fase === 'guardando'
        ? `Guardando ${hecho} de ${total || '…'}`
        : null
  const porcentaje =
    total > 0 ? Math.min(100, Math.round((hecho / total) * 100)) : 0

  useEffect(() => {
    if (estado.cargado) return
    let vivo = true
    void leerIndice(vista)
      .then((leidas) => {
        if (!vivo) return
        setPorVista((previo) => ({
          ...previo,
          [vista]: { ...previo[vista], filas: leidas, cargado: true },
        }))
      })
      .catch(() => {
        if (!vivo) return
        mostrarNotificacion({
          tono: 'error',
          mensaje: 'No se pudo cargar la lista.',
        })
      })
    return () => {
      vivo = false
    }
  }, [vista, estado.cargado])

  useEffect(() => {
    const antes = faseAnterior.current
    faseAnterior.current = fase
    if (antes === 'listo' || fase !== 'listo' || tipo === null) return
    let vivo = true
    void leerIndice(tipo)
      .then((leidas) => {
        if (!vivo) return
        setPorVista((previo) => ({
          ...previo,
          [tipo]: {
            ...previo[tipo],
            cargado: true,
            filas: reconciliarConIndice(
              previo[tipo].filas,
              leidas.map((fila) => ({
                numeroDocumento: fila.numeroDocumento,
                denominacion: fila.denominacionOrigen,
              })),
            ),
          },
        }))
      })
      .catch(() => {
        if (!vivo) return
        mostrarNotificacion({
          tono: 'error',
          mensaje: 'La importación terminó, pero no se pudo refrescar la lista.',
        })
      })
    return () => {
      vivo = false
    }
  }, [fase, tipo])

  useEffect(() => {
    if (claveAbierta === null) return
    const reducido =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const marco = window.requestAnimationFrame(() => {
      anclaFicha.current?.scrollIntoView({
        behavior: reducido ? 'auto' : 'smooth',
        block: 'nearest',
      })
    })
    return () => window.cancelAnimationFrame(marco)
  }, [claveAbierta])

  function estadoDe(
    cual: 'clientes' | 'transportistas',
    archivo: ArchivoElegido | null,
  ): EstadoDeCarga {
    if (tipo === cual && fase === 'error') return 'error'
    if (tipo === cual && (fase === 'leyendo' || fase === 'guardando')) {
      return 'procesando'
    }
    if (tipo === cual && fase === 'listo') return 'listo'
    return archivo === null ? 'vacio' : 'listo'
  }

  function mensajeDe(cual: 'clientes' | 'transportistas'): string | null {
    if (tipo !== cual) return null
    if (fase === 'error') return mensajeError
    if (fase === 'listo' && resumen !== null) {
      return textoDeResumen(cual, resumen)
    }
    return detalle
  }

  function cambiarVista(siguiente: VistaDePadron): void {
    pedidoFicha.current += 1
    setVista(siguiente)
    setClaveAbierta(null)
    setErrorFicha(null)
    setCargandoFicha(false)
  }

  function actualizarFilas(siguientes: readonly FilaDeBorrador[]): void {
    setPorVista((previo) => ({
      ...previo,
      [vista]: { ...previo[vista], filas: siguientes },
    }))
  }

  function actualizarConsulta(consulta: string): void {
    setPorVista((previo) => ({
      ...previo,
      [vista]: { ...previo[vista], consulta },
    }))
  }

  function agregarNuevo(): void {
    const fila = filaNueva(vista)
    setPorVista((previo) => ({
      ...previo,
      [vista]: {
        ...previo[vista],
        consulta: '',
        filas: [fila, ...previo[vista].filas],
      },
    }))
    setClaveAEnfocar(fila.clave)
    mostrarNotificacion({
      tono: 'info',
      mensaje: 'Fila al inicio de la lista. Complétala y pulsa Guardar.',
    })
  }

  function abrirFicha(clave: string): void {
    if (claveAbierta === clave) {
      setClaveAbierta(null)
      setErrorFicha(null)
      return
    }
    const fila = filas.find((cada) => cada.clave === clave)
    if (fila === undefined) return
    const pedido = pedidoFicha.current + 1
    pedidoFicha.current = pedido
    setClaveAbierta(clave)
    setErrorFicha(null)
    if (fila.nueva || fila.ficha !== null) {
      setCargandoFicha(false)
      return
    }
    setCargandoFicha(true)
    void (vista === 'clientes'
      ? leerFichaDeCliente(fila.numeroDocumento)
      : leerFichaDeTransportista(fila.numeroDocumento)
    )
      .then((ficha) => {
        if (pedidoFicha.current !== pedido) return
        if (ficha === null) {
          setErrorFicha('No hay ficha guardada para ese documento.')
          setCargandoFicha(false)
          return
        }
        setPorVista((previo) => ({
          ...previo,
          [vista]: {
            ...previo[vista],
            filas: previo[vista].filas.map((cada) =>
              cada.clave === clave && cada.ficha === null
                ? { ...cada, ficha, fichaOrigen: ficha }
                : cada,
            ),
          },
        }))
        setCargandoFicha(false)
      })
      .catch(() => {
        if (pedidoFicha.current !== pedido) return
        setErrorFicha('No se pudo leer la ficha.')
        setCargandoFicha(false)
      })
  }

  function cambiarFicha(ficha: NonNullable<FilaDeBorrador['ficha']>): void {
    if (claveAbierta === null) return
    setPorVista((previo) => ({
      ...previo,
      [vista]: {
        ...previo[vista],
        filas: previo[vista].filas.map((fila) =>
          fila.clave === claveAbierta ? { ...fila, ficha } : fila,
        ),
      },
    }))
  }

  async function guardar(): Promise<void> {
    const diff = diffDeBorrador(vista, filas)
    if (diff.errores.length > 0) {
      mostrarNotificacion({
        tono: 'error',
        mensaje: diff.errores.slice(0, 3).join(' '),
      })
      return
    }
    if (diff.altas.length === 0 && diff.cambios.length === 0) return
    setGuardando(true)
    try {
      const respuesta = await aplicarEdicionDePadronFn({
        data:
          diff.tipo === 'clientes'
            ? {
                tipo: 'clientes',
                altas: [...diff.altas],
                cambios: [...diff.cambios],
              }
            : {
                tipo: 'transportistas',
                altas: [...diff.altas],
                cambios: [...diff.cambios],
              },
      })
      if (!respuesta.ok) {
        mostrarNotificacion({
          tono: 'error',
          mensaje: mensajeDeGuardado(respuesta.error),
        })
        return
      }
      const confirmado = confirmarGuardado(filas)
      setPorVista((previo) => ({
        ...previo,
        [vista]: { ...previo[vista], filas: confirmado.filas },
      }))
      setClaveAbierta((actual) => {
        if (actual === null) return null
        const siguiente = confirmado.claves.get(actual)
        return siguiente === undefined || siguiente === '' ? null : siguiente
      })
      mostrarNotificacion({ tono: 'exito', mensaje: 'Cambios guardados.' })
    } finally {
      setGuardando(false)
    }
  }

  const archivo = vista === 'clientes' ? clientes : transportistas

  return (
    <div className="flex min-h-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <CabeceraAdmin
            titulo="Clientes y Empresas de Transporte"
            descripcion="Importa las listas en PDF. Quien ya está registrado no se pisa: solo se completan los campos vacíos."
          />
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <GrupoDeVista
            vista={vista}
            deshabilitado={guardando}
            onCambiar={cambiarVista}
          />
          <Boton disabled={guardando || ocupado} onClick={agregarNuevo}>
            <Plus className="size-4" aria-hidden />
            Nuevo
          </Boton>
          <Boton
            variante="principal"
            disabled={!haySucias || guardando || ocupado}
            aria-busy={guardando || undefined}
            onClick={() => void guardar()}
          >
            {guardando ? (
              <Loader2
                className="size-5 animate-spin motion-reduce:animate-none"
                aria-hidden
              />
            ) : null}
            {guardando ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-media ease-salida motion-reduce:transition-none"
        style={{ gridTemplateRows: ocupado ? '1fr' : '0fr' }}
      >
        <div className="min-h-0 overflow-hidden">
          <section
            className="rounded-3xl border border-borde bg-papel p-5 shadow-sm"
            aria-live="polite"
            data-testid="progreso-importacion"
          >
            <p className="font-bold text-tinta">
              {tipo === 'transportistas'
                ? 'Importando transportistas'
                : 'Importando clientes'}
            </p>
            <p className="mt-1 text-cuerpo text-desvaida">
              {detalle}. Puedes ir a otra pantalla; el aviso sigue arriba.
            </p>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-mesa"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total || 1}
              aria-valuenow={hecho}
              aria-valuetext={detalle ?? ''}
            >
              <div
                className="h-full bg-tinta transition-[width] duration-media ease-salida motion-reduce:transition-none"
                style={{ width: `${porcentaje}%` }}
              />
            </div>
          </section>
        </div>
      </div>

      <ZonaDeCarga
        titulo={
          vista === 'clientes' ? 'Lista de clientes' : 'Empresas de transporte'
        }
        etiqueta={
          vista === 'clientes' ? 'PDF de clientes' : 'PDF de transportistas'
        }
        nota={
          vista === 'clientes'
            ? 'Nº, RUC o DNI, nombre y teléfono. La línea del vendedor se ignora.'
            : 'Código, razón social y RUC. Las filas sin RUC válido se descartan.'
        }
        archivo={archivo}
        estado={estadoDe(vista, archivo)}
        mensaje={mensajeDe(vista)}
        aceptados={['pdf']}
        deshabilitado={ocupado}
        onArchivo={(siguiente) => {
          if (vista === 'clientes') setClientes(fichaDe(siguiente))
          else setTransportistas(fichaDe(siguiente))
          void iniciar(vista, siguiente)
        }}
        onQuitar={() => {
          if (ocupado) return
          if (vista === 'clientes') setClientes(null)
          else setTransportistas(null)
        }}
      />

      <div
        ref={anclaFicha}
        className="grid transition-[grid-template-rows] duration-media ease-salida motion-reduce:transition-none"
        style={{ gridTemplateRows: filaAbierta !== null ? '1fr' : '0fr' }}
      >
        <div className="min-h-0 overflow-hidden">
          {filaAbierta !== null ? (
            <div className="pb-1">
              <PanelFicha
                vista={vista}
                numero={filaAbierta.numeroDocumento}
                denominacion={filaAbierta.denominacion}
                ficha={filaAbierta.ficha}
                cargando={cargandoFicha}
                error={errorFicha}
                onCerrar={() => {
                  setClaveAbierta(null)
                  setErrorFicha(null)
                }}
                onCambiar={cambiarFicha}
              />
            </div>
          ) : null}
        </div>
      </div>

      <GrillaDePadron
        vista={vista}
        filas={filas}
        consulta={estado.consulta}
        cargando={!estado.cargado}
        claveAbierta={claveAbierta}
        claveAEnfocar={claveAEnfocar}
        onConsulta={actualizarConsulta}
        onFilas={actualizarFilas}
        onAbrirFicha={abrirFicha}
        onEnfocada={() => setClaveAEnfocar(null)}
      />
    </div>
  )
}

async function leerIndice(
  vista: VistaDePadron,
): Promise<readonly FilaDeBorrador[]> {
  if (vista === 'clientes') {
    const respuesta = await leerIndiceDeClientesFn()
    return respuesta.clientes.map(filaDesdeIndice)
  }
  const respuesta = await leerIndiceDeTransportistasFn()
  return respuesta.transportistas.map(filaDesdeIndice)
}

function mensajeDeGuardado(
  error:
    | {
        readonly mensaje?: string
        readonly detalle?: Readonly<
          Record<string, string | number | boolean | null>
        >
      }
    | undefined,
): string {
  const motivo = error?.detalle?.['motivo']
  const numero = error?.detalle?.['numeroDocumento']
  if (motivo === 'ya_existia') {
    return `El documento ${String(numero ?? '')} ya está registrado.`
  }
  if (motivo === 'indice_demasiado_grande') {
    return 'El índice no cabe en un documento. No se guardó nada.'
  }
  return error?.mensaje ?? 'No se pudo guardar.'
}
