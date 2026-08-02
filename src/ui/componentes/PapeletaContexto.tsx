/**
 * Alias histórico de {@link Modal}.
 *
 * Los flujos nuevos deben importar `Modal`. Se mantiene este nombre para no
 * romper imports mientras se migran pantallas; la implementación es la misma.
 */
export { Modal as PapeletaContexto } from './Modal.tsx'
export type { PropsDeModal as PropsDePapeletaContexto } from './Modal.tsx'
