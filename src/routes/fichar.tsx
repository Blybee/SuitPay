import { createFileRoute } from '@tanstack/react-router'
import { fuentesDeFichaje } from '../features/fichaje/fuentes.ts'
import { PaginaSolicitarEntrada } from '../features/fichaje/solicitar.tsx'

export const Route = createFileRoute('/fichar')({
  head: () => ({
    meta: [
      { title: 'Solicitar entrada — Fichaje' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
    links: fuentesDeFichaje,
  }),
  component: PaginaSolicitarEntrada,
})
