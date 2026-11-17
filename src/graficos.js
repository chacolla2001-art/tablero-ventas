// Gráficos en SVG hechos a mano (sin librerías): línea con área, barras horizontales y dona.
import { arcoDona, deFecha, escala, formato, rutaLinea, topeRedondo } from './logica.js'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const corta = (f) => `${deFecha(f).getDate()} ${MESES[deFecha(f).getMonth()]}`
export const COLORES = ['#38bdf8', '#818cf8', '#f472b6', '#34d399', '#fbbf24', '#fb7185']

/** Línea de ingresos por día con su media móvil. Devuelve el SVG y los puntos (para el indicador al pasar el cursor). */
export function graficoLinea(serie, suavizada, ancho = 760, alto = 280) {
  const m = { arriba: 16, derecha: 14, abajo: 28, izquierda: 62 }
  const tope = topeRedondo(Math.max(...serie.map((p) => p.valor), 1))
  const x = escala([0, Math.max(serie.length - 1, 1)], [m.izquierda, ancho - m.derecha])
  const y = escala([0, tope], [alto - m.abajo, m.arriba])
  const puntos = serie.map((p, i) => [x(i), y(p.valor)])
  const linea = rutaLinea(puntos)
  const area = `${linea} L${puntos.at(-1)[0].toFixed(1)} ${y(0)} L${puntos[0][0].toFixed(1)} ${y(0)} Z`
  const media = rutaLinea(suavizada.map((p, i) => [x(i), y(p.valor)]))
  const guias = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => `<line x1="${m.izquierda}" x2="${ancho - m.derecha}" y1="${y(tope * f)}" y2="${y(tope * f)}" class="guia"/><text x="${m.izquierda - 8}" y="${y(tope * f) + 4}" class="eje" text-anchor="end">${formato(tope * f, true)}</text>`)
    .join('')
  const cada = Math.max(1, Math.ceil(serie.length / 7))
  const fechas = serie.map((p, i) => (i % cada === 0 || i === serie.length - 1 ? `<text x="${x(i)}" y="${alto - 8}" class="eje" text-anchor="middle">${corta(p.fecha)}</text>` : '')).join('')
  const svg = `<svg viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Ingresos por día">
    <defs><linearGradient id="relleno" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--acento)" stop-opacity=".45"/><stop offset="1" stop-color="var(--acento)" stop-opacity="0"/></linearGradient>
    <linearGradient id="trazo" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--acento)"/><stop offset="1" stop-color="var(--acento-2)"/></linearGradient></defs>
    ${guias}${fechas}
    <path d="${area}" fill="url(#relleno)" class="area"/>
    <path d="${linea}" fill="none" stroke="url(#trazo)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" pathLength="1" class="trazo"/>
    <path d="${media}" fill="none" stroke="var(--suave)" stroke-width="1.5" stroke-dasharray="5 5" class="media"/>
    <line id="cursor-linea" y1="${m.arriba}" y2="${alto - m.abajo}" class="cursor" visibility="hidden"/>
    <circle id="cursor-punto" r="5" class="punto" visibility="hidden"/>
  </svg>`
  return { svg, puntos, ancho }
}

export function graficoBarras(grupos) {
  const max = grupos[0]?.valor || 1
  return (
    grupos
      .map(
        (g, i) => `<div class="barra" style="--p:${(g.valor / max) * 100}%; --c:${COLORES[i % COLORES.length]}; animation-delay:${i * 70}ms">
          <span>${esc(g.nombre)}</span><b>${formato(g.valor, true)}</b><i></i></div>`,
      )
      .join('') || '<p class="suave">Sin ventas en este periodo.</p>'
  )
}

export function graficoDona(grupos, total) {
  let acumulado = 0
  const arcos = grupos
    .map((g, i) => {
      const desde = acumulado
      acumulado += g.valor / (total || 1)
      return `<path d="${arcoDona(desde, acumulado, 62, 80, 80)}" fill="none" stroke="${COLORES[i % COLORES.length]}" stroke-width="22" pathLength="1" class="arco" style="animation-delay:${i * 120}ms"><title>${esc(g.nombre)}: ${g.parte.toLocaleString('es-BO')} %</title></path>`
    })
    .join('')
  const leyenda = grupos.map((g, i) => `<li><i style="background:${COLORES[i % COLORES.length]}"></i><span>${esc(g.nombre)}</span><b>${g.parte.toLocaleString('es-BO')} %</b></li>`).join('')
  return `<svg viewBox="0 0 160 160" role="img" aria-label="Ingresos por categoría">${arcos}
    <text x="80" y="76" text-anchor="middle" class="dona-total">${formato(total, true)}</text><text x="80" y="94" text-anchor="middle" class="eje">total</text></svg><ul class="leyenda">${leyenda}</ul>`
}
