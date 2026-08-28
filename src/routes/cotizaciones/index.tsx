import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { PanelDeCotizaciones } from '../../features/cotizaciones/panel.tsx'
import { GuardaSesion } from '../../features/sesion/GuardaSesion.tsx'

const busqueda = z.object({
  numero: z.coerce.number().int().positive().optional(),
})

export const Route = createFileRoute('/cotizaciones/')({
  validateSearch: busqueda,
  component: CotizacionesConGuarda,
})

function CotizacionesConGuarda() {
  return (
    <GuardaSesion>
      <PaginaCotizaciones />
    </GuardaSesion>
  )
}

function PaginaCotizaciones() {
  const { numero } = Route.useSearch()
  const navigate = useNavigate()
  return (
    <main className="min-h-full">
      <PanelDeCotizaciones
        numeroInicial={numero ?? null}
        onRecuperada={() => {
          void navigate({ to: '/' })
        }}
      />
    </main>
  )
}
