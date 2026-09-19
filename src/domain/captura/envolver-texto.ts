/**
 * Parte un texto en renglones que caben en `maxAncho` según `medir`.
 * Palabras que no caben se cortan por caracteres (sin truncar el contenido).
 */
export function envolverTextoPorAncho(
  texto: string,
  maxAncho: number,
  medir: (fragmento: string) => number,
): readonly string[] {
  const recortado = texto.trim()
  if (recortado === '') return ['']
  if (maxAncho <= 0) return [recortado]

  const renglones: string[] = []
  let actual = ''

  function cortarPalabraLarga(palabra: string): void {
    let resto = palabra
    while (resto.length > 0) {
      if (medir(resto) <= maxAncho) {
        actual = resto
        return
      }
      let corte = 1
      while (
        corte < resto.length &&
        medir(resto.slice(0, corte + 1)) <= maxAncho
      ) {
        corte += 1
      }
      renglones.push(resto.slice(0, corte))
      resto = resto.slice(corte)
    }
  }

  for (const palabra of recortado.split(/\s+/)) {
    const candidato = actual === '' ? palabra : `${actual} ${palabra}`
    if (medir(candidato) <= maxAncho) {
      actual = candidato
      continue
    }
    if (actual !== '') {
      renglones.push(actual)
      actual = ''
    }
    if (medir(palabra) <= maxAncho) {
      actual = palabra
    } else {
      cortarPalabraLarga(palabra)
    }
  }
  if (actual !== '') renglones.push(actual)
  return renglones.length > 0 ? renglones : ['']
}
