// Posiciones de los anuncios "in-feed" dentro de un listado de tarjetas.
// Devuelve los índices (0-based) de las tarjetas tras las que se inserta un anuncio.
const FIRST_AFTER = 3
const EVERY = 8
const MAX_ADS = 3

export function getFeedAdPositions(total: number): Set<number> {
  const positions = new Set<number>()
  if (total < 2) return positions

  // Listas cortas: un único anuncio al final, nunca intercalado entre dos o tres tarjetas.
  if (total <= FIRST_AFTER) {
    positions.add(total - 1)
    return positions
  }

  // Listas largas: tras la tercera tarjeta y luego cada ocho, sin cerrar la lista con un anuncio.
  for (let after = FIRST_AFTER; after < total && positions.size < MAX_ADS; after += EVERY) {
    positions.add(after - 1)
  }
  return positions
}
