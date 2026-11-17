// Ventas de ejemplo: se generan con un azar de semilla fija, así el tablero muestra siempre los mismos números de muestra.
import { aFecha, deFecha, sumarDias } from './logica.js'

const CATALOGO = [
  ['Café americano', 'Bebidas', 1200, 9],
  ['Capuchino', 'Bebidas', 1800, 7],
  ['Jugo natural', 'Bebidas', 1500, 5],
  ['Té con leche', 'Bebidas', 1000, 3],
  ['Empanada de queso', 'Panadería', 600, 8],
  ['Medialuna', 'Panadería', 500, 6],
  ['Torta por porción', 'Repostería', 2200, 4],
  ['Brownie', 'Repostería', 1400, 4],
  ['Sándwich de pollo', 'Comidas', 2500, 5],
  ['Ensalada', 'Comidas', 2800, 2],
  ['Salteña', 'Comidas', 900, 7],
]

// Generador de números pseudoaleatorios con semilla (mulberry32): mismo resultado en cada carga.
function azar(semilla) {
  let a = semilla
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Ventas de los últimos `dias` días: más movimiento los fines de semana y una leve tendencia al alza. */
export function ventasDeEjemplo(hoy = new Date(), dias = 120) {
  const r = azar(20261116)
  const fin = aFecha(hoy)
  const ventas = []
  for (let i = dias - 1; i >= 0; i--) {
    const fecha = sumarDias(fin, -i)
    const dia = deFecha(fecha).getDay()
    const factor = (dia === 6 ? 1.5 : dia === 0 ? 1.25 : dia === 1 ? 0.8 : 1) * (0.75 + ((dias - i) / dias) * 0.5)
    for (const [producto, categoria, precio, peso] of CATALOGO) {
      const cantidad = Math.round(peso * factor * (0.5 + r()))
      if (cantidad > 0) ventas.push({ fecha, producto, categoria, cantidad, importe: precio * cantidad })
    }
  }
  return ventas
}

export const CSV_DE_EJEMPLO = `fecha,producto,categoria,cantidad,precio
2026-11-10,Café americano,Bebidas,12,12.00
2026-11-10,Empanada de queso,Panadería,20,6.00
2026-11-11,"Torta, porción",Repostería,6,22.00
2026-11-11,Café americano,Bebidas,15,12.00
2026-11-12,Sándwich de pollo,Comidas,9,25.00
2026-11-13,Jugo natural,Bebidas,11,15.00
2026-11-14,Salteña,Comidas,30,9.00
2026-11-15,Capuchino,Bebidas,14,18.00
2026-11-16,Medialuna,Panadería,25,5.00
`
