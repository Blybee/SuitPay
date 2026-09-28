import { createFileRoute } from '@tanstack/react-router'
import { PanelFichaje } from '../features/fichaje/panel.tsx'
import { fuentesDeFichaje } from '../features/fichaje/fuentes.ts'
import { GuardaSesion } from '../features/sesion/GuardaSesion.tsx'

export const Route = createFileRoute('/fichaje')({
  head: () => ({
    meta: [{ title: 'Fichaje — SuitPay' }],
    links: fuentesDeFichaje,
  }),
  component: () => (
    <GuardaSesion roles={['jefe']}>
      <PanelFichaje />
    </GuardaSesion>
  ),
})
