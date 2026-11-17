// Pantalla del tablero: filtros, indicadores animados y gráficos. Los cálculos están en logica.js.
import { aFecha, agrupar, deFecha, filtrar, formato, indicadores, leerCsv, mediaMovil, porDia, sumarDias } from './logica.js'
import { CSV_DE_EJEMPLO, ventasDeEjemplo } from './datos.js'
import { graficoBarras, graficoDona, graficoLinea } from './graficos.js'

const $ = (s) => document.querySelector(s)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const sinAnimacion = matchMedia('(prefers-reduced-motion: reduce)').matches || location.hash === '#captura'
if (sinAnimacion) document.documentElement.classList.add('quieto')

let ventas = ventasDeEjemplo()
let dias = 30
let categoria = 'Todas'
let serieActual = []
let puntosActuales = []

// El rango termina en la última fecha con datos (para un CSV antiguo también hay algo que ver).
const ultimaFecha = () => ventas.reduce((m, v) => (v.fecha > m ? v.fecha : m), ventas[0]?.fecha ?? aFecha(new Date()))

/** Cuenta desde cero hasta el valor, para que el número «suba» al aparecer. */
function contar(elemento, hasta, dar) {
  if (sinAnimacion) return (elemento.textContent = dar(hasta))
  const inicio = performance.now()
  const paso = (t) => {
    const f = Math.min(1, (t - inicio) / 700)
    elemento.textContent = dar(Math.round(hasta * (1 - (1 - f) ** 3)))
    if (f < 1) requestAnimationFrame(paso)
  }
  requestAnimationFrame(paso)
}

function dibujar() {
  const hasta = ultimaFecha()
  const desde = sumarDias(hasta, -(dias - 1))
  const k = indicadores(ventas, { desde, hasta, categoria })
  const delPeriodo = filtrar(ventas, { desde, hasta, categoria })

  const tarjetas = [
    ['ingresos', 'Ingresos', (n) => formato(n, true)],
    ['ventas', 'Ventas registradas', (n) => n.toLocaleString('es-BO')],
    ['unidades', 'Unidades vendidas', (n) => n.toLocaleString('es-BO')],
    ['ticket', 'Importe promedio por venta', (n) => formato(n)],
  ]
  $('#kpis').innerHTML = tarjetas
    .map(([clave, etiqueta], i) => {
      const v = k.variacion[clave]
      const chip = v == null ? '' : `<em class="${v >= 0 ? 'sube' : 'baja'}">${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toLocaleString('es-BO')} %</em>`
      return `<div class="kpi entra" style="animation-delay:${i * 70}ms"><b data-kpi="${clave}">0</b><span>${etiqueta}${chip}</span></div>`
    })
    .join('')
  for (const [clave, , dar] of tarjetas) contar($(`[data-kpi="${clave}"]`), k[clave], dar)

  serieActual = porDia(delPeriodo, desde, hasta)
  const g = graficoLinea(serieActual, mediaMovil(serieActual, 7))
  puntosActuales = g.puntos
  $('#linea').innerHTML = g.svg
  $('#globo').hidden = true

  $('#barras').innerHTML = graficoBarras(agrupar(delPeriodo, 'producto', 6))
  $('#dona').innerHTML = delPeriodo.length ? graficoDona(agrupar(delPeriodo, 'categoria'), k.ingresos) : '<p class="suave">Sin ventas en este periodo.</p>'
}

function dibujarCategorias() {
  const lista = ['Todas', ...new Set(ventas.map((v) => v.categoria))]
  if (!lista.includes(categoria)) categoria = 'Todas'
  $('#categoria').innerHTML = lista.map((c) => `<option ${c === categoria ? 'selected' : ''}>${esc(c)}</option>`).join('')
}

// Indicador al pasar el cursor por la línea: muestra la fecha y el ingreso del día más cercano.
$('#linea').addEventListener('pointermove', (e) => {
  const svg = $('#linea svg')
  if (!svg || !puntosActuales.length) return
  const caja = svg.getBoundingClientRect()
  const x = ((e.clientX - caja.left) / caja.width) * 760
  let i = 0
  for (let j = 1; j < puntosActuales.length; j++) if (Math.abs(puntosActuales[j][0] - x) < Math.abs(puntosActuales[i][0] - x)) i = j
  const [px, py] = puntosActuales[i]
  const linea = $('#cursor-linea')
  const punto = $('#cursor-punto')
  linea.setAttribute('x1', px)
  linea.setAttribute('x2', px)
  punto.setAttribute('cx', px)
  punto.setAttribute('cy', py)
  linea.setAttribute('visibility', 'visible')
  punto.setAttribute('visibility', 'visible')
  const f = deFecha(serieActual[i].fecha)
  const globo = $('#globo')
  globo.hidden = false
  globo.innerHTML = `${f.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })}<b>${formato(serieActual[i].valor)}</b>`
  globo.style.left = `${$('#linea').offsetLeft + (px / 760) * caja.width}px`
  globo.style.top = `${$('#linea').offsetTop + (py / 280) * caja.height}px`
})
$('#linea').addEventListener('pointerleave', () => {
  $('#globo').hidden = true
  $('#cursor-linea')?.setAttribute('visibility', 'hidden')
  $('#cursor-punto')?.setAttribute('visibility', 'hidden')
})

document.querySelectorAll('[data-dias]').forEach((b) =>
  b.addEventListener('click', () => {
    dias = Number(b.dataset.dias)
    document.querySelectorAll('[data-dias]').forEach((x) => x.setAttribute('aria-selected', String(x === b)))
    dibujar()
  }),
)
$('#categoria').addEventListener('change', (e) => {
  categoria = e.target.value
  dibujar()
})

$('#archivo').addEventListener('change', async (e) => {
  const archivo = e.target.files[0]
  e.target.value = ''
  if (!archivo) return
  const { ventas: nuevas, errores } = leerCsv(await archivo.text())
  $('#errores').innerHTML = errores.slice(0, 8).map((x) => `<li>${esc(x)}</li>`).join('') + (errores.length > 8 ? `<li>…y ${errores.length - 8} más.</li>` : '')
  if (!nuevas.length) return
  ventas = nuevas
  $('#origen').textContent = `${archivo.name} · ${nuevas.length} filas`
  $('#restaurar').hidden = false
  dibujarCategorias()
  dibujar()
})
$('#restaurar').addEventListener('click', () => {
  ventas = ventasDeEjemplo()
  $('#origen').textContent = 'Datos de ejemplo'
  $('#restaurar').hidden = true
  $('#errores').innerHTML = ''
  dibujarCategorias()
  dibujar()
})
$('#descargar-ejemplo').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob(['﻿' + CSV_DE_EJEMPLO], { type: 'text/csv;charset=utf-8' }))
  Object.assign(document.createElement('a'), { href: url, download: 'ventas-ejemplo.csv' }).click()
  URL.revokeObjectURL(url)
})

dibujarCategorias()
dibujar()
