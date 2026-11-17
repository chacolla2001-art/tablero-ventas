import { test } from 'node:test'
import assert from 'node:assert/strict'
import { agrupar, arcoDona, diasEntre, escala, filtrar, indicadores, leerCsv, mediaMovil, porDia, rutaLinea, separarLinea, sumarDias, topeRedondo, variacion } from '../src/logica.js'

const v = (fecha, producto, categoria, cantidad, importe) => ({ fecha, producto, categoria, cantidad, importe })
const VENTAS = [
  v('2026-11-01', 'Café', 'Bebidas', 2, 2400),
  v('2026-11-01', 'Pan', 'Panadería', 10, 500),
  v('2026-11-03', 'Café', 'Bebidas', 1, 1200),
  v('2026-11-08', 'Torta', 'Panadería', 1, 9000),
  v('2026-11-09', 'Café', 'Bebidas', 3, 3600),
]

test('separa una línea de CSV respetando comillas', () => {
  assert.deepEqual(separarLinea('2026-11-01,"Pan, integral",Panadería,2,1.5'), ['2026-11-01', 'Pan, integral', 'Panadería', '2', '1.5'])
  assert.deepEqual(separarLinea('a,"dijo ""hola""",c'), ['a', 'dijo "hola"', 'c'])
  assert.deepEqual(separarLinea('a;b;c', ';'), ['a', 'b', 'c'])
})

test('lee un CSV válido y calcula el importe en centavos', () => {
  const { ventas, errores } = leerCsv('﻿Fecha,Producto,Categoría,Cantidad,Precio\n2026-11-01,Café,Bebidas,2,12.50\n2026-11-02,"Pan, integral",Panadería,3,0.5\n')
  assert.deepEqual(errores, [])
  assert.deepEqual(ventas[0], { fecha: '2026-11-01', producto: 'Café', categoria: 'Bebidas', cantidad: 2, importe: 2500 })
  assert.equal(ventas[1].importe, 150)
})

test('acepta punto y coma como separador y coma decimal', () => {
  const { ventas } = leerCsv('fecha;producto;categoria;cantidad;precio\n2026-11-01;Té;Bebidas;1;8,5')
  assert.equal(ventas[0].importe, 850)
})

test('informa las filas con error sin detener la carga', () => {
  const { ventas, errores } = leerCsv('fecha,producto,categoria,cantidad,precio\n01/11/2026,Café,Bebidas,1,12\n2026-11-01,Café,Bebidas,0,12\n2026-11-01,Café,Bebidas,1,abc\n2026-11-02,Pan,Panadería,4,0.5')
  assert.equal(ventas.length, 1)
  assert.equal(errores.length, 3)
  assert.match(errores[0], /Fila 2: fecha inválida/)
})

test('rechaza archivos sin las columnas necesarias', () => {
  assert.match(leerCsv('fecha,producto\n2026-11-01,Café').errores[0], /Faltan columnas: categoria, cantidad, precio/)
  assert.match(leerCsv('').errores[0], /vacío/)
})

test('filtra por rango de fechas y categoría', () => {
  assert.equal(filtrar(VENTAS, { desde: '2026-11-03', hasta: '2026-11-08' }).length, 2)
  assert.equal(filtrar(VENTAS, { categoria: 'Bebidas' }).length, 3)
  assert.equal(filtrar(VENTAS, { categoria: 'Todas' }).length, 5)
})

test('indicadores del periodo con variación frente al anterior', () => {
  const r = indicadores(VENTAS, { desde: '2026-11-08', hasta: '2026-11-14' })
  assert.deepEqual([r.ingresos, r.ventas, r.unidades, r.ticket], [12600, 2, 4, 6300])
  // periodo anterior: 1 al 7 de noviembre → 4100 en 3 ventas
  assert.equal(r.variacion.ingresos, 207.3)
  assert.equal(r.variacion.ventas, -33.3)
})

test('la variación es nula cuando no hay periodo anterior', () => {
  assert.equal(variacion(100, 0), null)
  assert.equal(variacion(150, 100), 50)
})

test('la serie por día incluye los días sin ventas', () => {
  const serie = porDia(VENTAS, '2026-11-01', '2026-11-04')
  assert.deepEqual(serie.map((p) => p.valor), [2900, 0, 1200, 0])
  assert.equal(diasEntre('2026-11-01', '2026-11-04'), 3)
  assert.equal(sumarDias('2026-02-28', 1), '2026-03-01')
})

test('media móvil suaviza la serie', () => {
  const serie = [10, 20, 30, 40].map((valor, i) => ({ fecha: `d${i}`, valor }))
  assert.deepEqual(mediaMovil(serie, 2).map((p) => p.valor), [10, 15, 25, 35])
})

test('agrupa por producto y categoría con su parte del total', () => {
  assert.deepEqual(agrupar(VENTAS, 'producto', 2), [
    { nombre: 'Torta', valor: 9000, parte: 53.9 },
    { nombre: 'Café', valor: 7200, parte: 43.1 },
  ])
  assert.deepEqual(agrupar(VENTAS, 'categoria').map((g) => g.nombre), ['Panadería', 'Bebidas'])
})

test('escala y tope del eje', () => {
  const y = escala([0, 100], [200, 0])
  assert.equal(y(0), 200)
  assert.equal(y(50), 100)
  assert.equal(escala([5, 5], [0, 10])(5), 5)
  assert.deepEqual([topeRedondo(0), topeRedondo(7), topeRedondo(18), topeRedondo(43), topeRedondo(5100)], [1, 10, 20, 50, 10000])
})

test('geometría: línea y arco de dona', () => {
  assert.equal(rutaLinea([[0, 10], [5, 0], [10, 7.25]]), 'M0.0 10.0 L5.0 0.0 L10.0 7.3')
  assert.equal(arcoDona(0, 0.25, 10), 'M0.00 -10.00 A10 10 0 0 1 10.00 -0.00')
  assert.match(arcoDona(0, 0.75, 10), /A10 10 0 1 1/)
})
