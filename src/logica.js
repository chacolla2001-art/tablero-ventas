// Cálculos del tablero, sin nada de pantalla: lectura de CSV, filtros, indicadores y geometría de los gráficos.
// Los importes van en centavos enteros.

const dos = (n) => String(n).padStart(2, '0')
export const aFecha = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
export const deFecha = (s) => {
  const [a, m, d] = s.split('-').map(Number)
  return new Date(a, m - 1, d)
}
export const sumarDias = (fecha, n) => {
  const d = deFecha(fecha)
  d.setDate(d.getDate() + n)
  return aFecha(d)
}
export const diasEntre = (a, b) => Math.round((deFecha(b) - deFecha(a)) / 86400000)

/** Separa una línea de CSV respetando comillas ("a, b" es un solo campo; "" es una comilla). */
export function separarLinea(linea, separador = ',') {
  const campos = []
  let actual = ''
  let entreComillas = false
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i]
    if (entreComillas) {
      if (c === '"' && linea[i + 1] === '"') {
        actual += '"'
        i++
      } else if (c === '"') entreComillas = false
      else actual += c
    } else if (c === '"') entreComillas = true
    else if (c === separador) {
      campos.push(actual)
      actual = ''
    } else actual += c
  }
  campos.push(actual)
  return campos.map((x) => x.trim())
}

/**
 * Lee un CSV con columnas fecha, producto, categoria, cantidad y precio (unitario).
 * Devuelve las ventas válidas y la lista de filas con error, para mostrarlas sin detener la carga.
 */
export function leerCsv(texto) {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim())
  if (!lineas.length) return { ventas: [], errores: ['El archivo está vacío.'] }
  const separador = lineas[0].includes(';') && !lineas[0].includes(',') ? ';' : ','
  const cabecera = separarLinea(lineas[0], separador).map((c) => c.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))
  const columnas = ['fecha', 'producto', 'categoria', 'cantidad', 'precio']
  const faltan = columnas.filter((c) => !cabecera.includes(c))
  if (faltan.length) return { ventas: [], errores: [`Faltan columnas: ${faltan.join(', ')}.`] }
  const indice = Object.fromEntries(columnas.map((c) => [c, cabecera.indexOf(c)]))
  const ventas = []
  const errores = []
  lineas.slice(1).forEach((linea, n) => {
    const campos = separarLinea(linea, separador)
    const fecha = campos[indice.fecha]
    const cantidad = Number(campos[indice.cantidad])
    const precio = Number(String(campos[indice.precio]).replace(',', '.'))
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(deFecha(fecha).getTime())) return errores.push(`Fila ${n + 2}: fecha inválida (use AAAA-MM-DD).`)
    if (!Number.isInteger(cantidad) || cantidad <= 0) return errores.push(`Fila ${n + 2}: la cantidad debe ser un entero mayor que cero.`)
    if (!(precio >= 0)) return errores.push(`Fila ${n + 2}: precio inválido.`)
    ventas.push({ fecha, producto: campos[indice.producto] || 'Sin nombre', categoria: campos[indice.categoria] || 'Sin categoría', cantidad, importe: Math.round(precio * 100) * cantidad })
  })
  return { ventas, errores }
}

export function filtrar(ventas, { desde, hasta, categoria } = {}) {
  return ventas.filter((v) => (!desde || v.fecha >= desde) && (!hasta || v.fecha <= hasta) && (!categoria || categoria === 'Todas' || v.categoria === categoria))
}

const sumar = (ventas, campo) => ventas.reduce((s, v) => s + v[campo], 0)

/** Variación porcentual frente al periodo anterior; null si no hay con qué comparar. */
export const variacion = (actual, anterior) => (anterior ? Math.round(((actual - anterior) / anterior) * 1000) / 10 : null)

/** Indicadores del periodo y su variación frente al periodo anterior de la misma duración. */
export function indicadores(ventas, { desde, hasta, categoria }) {
  const actuales = filtrar(ventas, { desde, hasta, categoria })
  const dias = diasEntre(desde, hasta) + 1
  const previas = filtrar(ventas, { desde: sumarDias(desde, -dias), hasta: sumarDias(desde, -1), categoria })
  const armar = (lista) => {
    const ingresos = sumar(lista, 'importe')
    return { ingresos, ventas: lista.length, unidades: sumar(lista, 'cantidad'), ticket: lista.length ? Math.round(ingresos / lista.length) : 0 }
  }
  const a = armar(actuales)
  const p = armar(previas)
  return { ...a, variacion: { ingresos: variacion(a.ingresos, p.ingresos), ventas: variacion(a.ventas, p.ventas), unidades: variacion(a.unidades, p.unidades), ticket: variacion(a.ticket, p.ticket) } }
}

/** Ingresos de cada día del rango, incluidos los días sin ventas (con cero), para que la línea no salte. */
export function porDia(ventas, desde, hasta) {
  const totales = new Map()
  for (const v of ventas) totales.set(v.fecha, (totales.get(v.fecha) ?? 0) + v.importe)
  const serie = []
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) serie.push({ fecha: f, valor: totales.get(f) ?? 0 })
  return serie
}

/** Media móvil: suaviza la serie promediando cada punto con los anteriores (ventana de n días). */
export function mediaMovil(serie, n = 7) {
  return serie.map((p, i) => {
    const ventana = serie.slice(Math.max(0, i - n + 1), i + 1)
    return { fecha: p.fecha, valor: Math.round(ventana.reduce((s, x) => s + x.valor, 0) / ventana.length) }
  })
}

/** Agrupa por un campo (producto o categoría) y devuelve los mayores, con su parte del total. */
export function agrupar(ventas, campo, limite = Infinity) {
  const mapa = new Map()
  for (const v of ventas) mapa.set(v[campo], (mapa.get(v[campo]) ?? 0) + v.importe)
  const total = sumar(ventas, 'importe') || 1
  return [...mapa.entries()]
    .map(([nombre, valor]) => ({ nombre, valor, parte: Math.round((valor / total) * 1000) / 10 }))
    .sort((a, b) => b.valor - a.valor || a.nombre.localeCompare(b.nombre))
    .slice(0, limite)
}

// ---------- geometría de los gráficos (SVG) ----------
/** Convierte un valor del dominio [d0, d1] a una posición del rango [r0, r1]. */
export const escala = ([d0, d1], [r0, r1]) => (v) => (d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0))

/** Tope «redondo» para el eje vertical (1, 2 o 5 por una potencia de 10). */
export function topeRedondo(maximo) {
  if (maximo <= 0) return 1
  const potencia = 10 ** Math.floor(Math.log10(maximo))
  const fraccion = maximo / potencia
  return (fraccion <= 1 ? 1 : fraccion <= 2 ? 2 : fraccion <= 5 ? 5 : 10) * potencia
}

/** Ruta SVG de una línea que pasa por los puntos [[x, y], …]. */
export const rutaLinea = (puntos) => puntos.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')

/** Arco de dona entre dos fracciones del círculo (0 a 1), empezando arriba y en sentido horario. */
export function arcoDona(desde, hasta, radio, cx = 0, cy = 0) {
  const punto = (f) => [cx + radio * Math.sin(2 * Math.PI * f), cy - radio * Math.cos(2 * Math.PI * f)]
  const [x0, y0] = punto(desde)
  const [x1, y1] = punto(Math.min(hasta, desde + 0.9999))
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${radio} ${radio} 0 ${hasta - desde > 0.5 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

export function formato(centavos, corto = false) {
  const bs = centavos / 100
  if (corto && Math.abs(bs) >= 1000) return `Bs ${(bs / 1000).toLocaleString('es-BO', { maximumFractionDigits: 1 })} mil`
  return `Bs ${bs.toLocaleString('es-BO', { minimumFractionDigits: corto ? 0 : 2, maximumFractionDigits: corto ? 0 : 2 })}`
}
