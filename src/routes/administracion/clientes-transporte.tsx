import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { CabeceraAdmin } from '../../features/administracion/cabecera-admin.tsx'
import {
  usarImportacionDePadron,
  textoDeResumen,
} from '../../features/padron/almacen.ts'
import { GuardaSesion } from '../../features/sesion/GuardaSesion.tsx'
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

  const detalle =
    fase === 'leyendo'
      ? `Leyendo página ${hecho} de ${total || '…'}`
      : fase === 'guardando'
        ? `Guardando ${hecho} de ${total || '…'}`
        : null
  const porcentaje =
    total > 0 ? Math.min(100, Math.round((hecho / total) * 100)) : 0

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

  return (
    <div className="flex min-h-full flex-col gap-6 px-6 py-8">
      <CabeceraAdmin
        titulo="Clientes y Empresas de Transporte"
        descripcion="Importa las listas en PDF. Quien ya está registrado no se pisa: solo se completan los campos vacíos."
      />

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

      <div className="grid gap-4 lg:grid-cols-2">
        <ZonaDeCarga
          titulo="Lista de clientes"
          etiqueta="PDF de clientes"
          nota="Nº, RUC o DNI, nombre y teléfono. La línea del vendedor se ignora."
          archivo={clientes}
          estado={estadoDe('clientes', clientes)}
          mensaje={mensajeDe('clientes')}
          aceptados={['pdf']}
          deshabilitado={ocupado}
          onArchivo={(archivo) => {
            setClientes(fichaDe(archivo))
            void iniciar('clientes', archivo)
          }}
          onQuitar={() => {
            if (ocupado) return
            setClientes(null)
          }}
        />
        <ZonaDeCarga
          titulo="Empresas de transporte"
          etiqueta="PDF de transportistas"
          nota="Código, razón social y RUC. Las filas sin RUC válido se descartan."
          archivo={transportistas}
          estado={estadoDe('transportistas', transportistas)}
          mensaje={mensajeDe('transportistas')}
          aceptados={['pdf']}
          deshabilitado={ocupado}
          onArchivo={(archivo) => {
            setTransportistas(fichaDe(archivo))
            void iniciar('transportistas', archivo)
          }}
          onQuitar={() => {
            if (ocupado) return
            setTransportistas(null)
          }}
        />
      </div>
    </div>
  )
}
