import {
  useDeferredValue,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { Ref } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type {
  ProductoBuscable,
  ResultadoDeBusqueda,
} from '../../domain/busqueda/productos.ts'
import { buscarCotizacionesPorNombre } from '../../domain/busqueda/cotizaciones.ts'
import { usarBusqueda } from '../busqueda/almacen.ts'
import { usarCatalogo } from '../catalogo/almacen.ts'
import { nombreTrasCoti } from '../comandos/pistas.ts'
import { listarCotizacionesPendientes } from '../cotizaciones/leer.ts'
import type { Cotizacion } from '../cotizaciones/tipos.ts'
import { CLAVES_DE_CONSULTA } from '../../infra/consultas/cliente.ts'
import {
  Entrada,
  type MangoDeEntrada,
} from '../../ui/componentes/Entrada.tsx'

export interface MangoDeCinta {
  readonly enfocar: () => void
  readonly vaciar: () => void
}

export function CintaDeBusqueda({
  onElegirProducto,
  onElegirProductos,
  onEjecutarComando,
  onElegirCotizacion,
  asistenciaDisponible,
  motivoAsistenciaInerte,
  onDictar,
  onFotografiar,
  ref,
}: {
  readonly onElegirProducto: (producto: ProductoBuscable) => void
  readonly onElegirProductos: (productos: readonly ProductoBuscable[]) => void
  readonly onEjecutarComando: (texto: string) => void
  readonly onElegirCotizacion: (cotizacion: Cotizacion) => void
  readonly asistenciaDisponible: boolean
  readonly motivoAsistenciaInerte?: string | null
  readonly onDictar?: () => void
  readonly onFotografiar?: () => void
  readonly ref?: Ref<MangoDeCinta>
}) {
  const queryClient = useQueryClient()
  const entradaRef = useRef<MangoDeEntrada>(null)
  const [termino, setTermino] = useState('')
  const [cotizacionesSugeridas, setCotizacionesSugeridas] =
    useState<ResultadoDeBusqueda<Cotizacion> | null>(null)
  const terminoDiferido = useDeferredValue(termino)
  const buscar = usarCatalogo((estado) => estado.buscar)
  const version = usarCatalogo((estado) => estado.version)
  const facetas = usarCatalogo((estado) => estado.facetas)
  const ultimaBusqueda = usarBusqueda((estado) => estado.ultima)

  const resultado = useMemo(
    () => buscar(terminoDiferido),
    [buscar, terminoDiferido, version, facetas],
  )

  useImperativeHandle(ref, () => ({
    enfocar: () => {
      entradaRef.current?.enfocar()
    },
    vaciar: () => {
      setTermino('')
      setCotizacionesSugeridas(null)
    },
  }))

  async function ejecutarDesdeCampo(texto: string): Promise<void> {
    const nombreCoti = nombreTrasCoti(texto.trim())
    if (nombreCoti !== null) {
      const pendientes = await queryClient.ensureQueryData({
        queryKey: CLAVES_DE_CONSULTA.cotizacionesPendientes,
        queryFn: () => listarCotizacionesPendientes('general'),
        staleTime: 30_000,
      })
      setCotizacionesSugeridas(
        buscarCotizacionesPorNombre(pendientes, nombreCoti),
      )
      return
    }
    onEjecutarComando(texto)
  }

  return (
    <Entrada
      ref={entradaRef}
      termino={termino}
      onTerminoCambia={(siguiente) => {
        setTermino(siguiente)
        setCotizacionesSugeridas(null)
        usarBusqueda.getState().recordar(siguiente)
      }}
      ultimaBusqueda={ultimaBusqueda}
      resultado={resultado}
      consultaPendiente={termino !== terminoDiferido}
      onElegirProducto={onElegirProducto}
      onElegirProductos={onElegirProductos}
      onEjecutarComando={(texto) => void ejecutarDesdeCampo(texto)}
      cotizacionesSugeridas={cotizacionesSugeridas}
      onElegirCotizacion={(cotizacion) => {
        setTermino('')
        setCotizacionesSugeridas(null)
        onElegirCotizacion(cotizacion)
      }}
      asistenciaDisponible={asistenciaDisponible}
      motivoAsistenciaInerte={motivoAsistenciaInerte}
      onDictar={onDictar}
      onFotografiar={onFotografiar}
    />
  )
}
