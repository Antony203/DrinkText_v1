/*
 * Pruebas de regresión de DrinkText (sin dependencias externas).
 * Uso: node pruebas_drinktext.js
 * Ubica este archivo junto a logica.js (o logica(1).js).
 * Algunos casos FALLAN deliberadamente con la versión recibida:
 * son fallos/objetivos de compatibilidad para las correcciones futuras.
 * Estas pruebas verifican la lógica; impresión/CSS deben probarse además
 * en un navegador (ver auditoria_drinktext.md).
 */
'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ubicacion = ['logica.js', 'logica(1).js']
  .map(f => path.join(__dirname, f)).find(f => fs.existsSync(f));
if (!ubicacion) {
  console.error('No se encuentra logica.js o logica(1).js en esta carpeta.');
  process.exit(2);
}
const contexto = vm.createContext({});
vm.runInContext(fs.readFileSync(ubicacion, 'utf8'), contexto, {filename: ubicacion});
if (typeof contexto.analizarDocumento !== 'function') {
  console.error('No está definida la función analizarDocumento(codigo).');
  process.exit(2);
}
const casos = [];
const prueba = (grupo, nombre, entrada, valido) => casos.push({grupo,nombre,entrada,valido});
const correcto = (partes, excluidas=[]) => r => r.errores.length===0 && partes.every(p=>r.html.includes(p)) && excluidas.every(p=>!r.html.includes(p));
const errorContiene = frag => r => r.errores.some(e => e.mensaje.includes(frag));
const sinHTMLPeligroso = r => r.errores.length===0 && !/<(img|script|svg|iframe)\b/i.test(r.html) && r.html.includes('&lt;');

// Capacidades actuales que no deberían dejar de funcionar.
prueba('BÁSICO','Título', 'TITULO: Demo', correcto(['<h1>Demo</h1>']));
prueba('BÁSICO','Autor', 'AUTOR: Ana', correcto(['class="autor"','Ana']));
prueba('BÁSICO','Sección', 'SECCION: Prueba', correcto(['<h2>Prueba</h2>']));
prueba('BÁSICO','Texto', 'TEXTO: Hola', correcto(['<p>Hola</p>']));
prueba('BÁSICO','Fracción', 'FORMULA: frac(1;2)', correcto(['class="fraccion"','<span>1</span>','<span>2</span>']));
prueba('BÁSICO','Potencia', 'FORMULA: pot(x;2)', correcto(['class="potencia"','<sup>2</sup>']));
prueba('BÁSICO','Raíz', 'FORMULA: raiz(9)', correcto(['class="raiz"','>√</span>']));
prueba('BÁSICO','Integral', 'FORMULA: integral(0;5;x;x)', correcto(['class="integral"',' dx']));
prueba('BÁSICO','Fracción anidada', 'FORMULA: frac(1;raiz(4))', correcto(['class="fraccion"','class="raiz"']));
prueba('BÁSICO','Anidación triple', 'FORMULA: frac(pot(x;2);raiz(9))', correcto(['class="fraccion"','class="potencia"','class="raiz"']));
prueba('BÁSICO','Comando en mayúsculas', 'FORMULA: FRAC(1;2)', correcto(['class="fraccion"']));
prueba('BÁSICO','Comando con espacios interiores', 'FORMULA: frac( 1 ; 2 )', correcto(['class="fraccion"']));
prueba('BÁSICO','Texto con dos puntos', 'TEXTO: https://ejemplo.com:8080', correcto(['https://ejemplo.com:8080']));
prueba('BÁSICO','Saltos de línea Windows', 'TITULO: Uno\r\nTEXTO: Dos', correcto(['<h1>Uno</h1>','<p>Dos</p>']));
prueba('BÁSICO','Sustituciones de símbolos', 'FORMULA: 2 por pi mas infinito', correcto(['2 × π + ∞']));
prueba('BÁSICO','Fracción en español sin tilde', 'FORMULA: fraccion 1 sobre 2', correcto(['class="fraccion"']));
prueba('BÁSICO','Raíz en español sin tilde', 'FORMULA: raiz de (9 mas 7)', correcto(['class="raiz"','9 + 7']));
prueba('BÁSICO','Potencia en español', 'FORMULA: x elevado a 2', correcto(['class="potencia"']));
prueba('BÁSICO','Integral en español con variable', 'FORMULA: integral desde 0 hasta 5 de x elevado a 2 respecto a x', correcto(['class="integral"','class="potencia"',' dx']));
prueba('BÁSICO','Paréntesis comunes equilibrados', 'FORMULA: 2*(x+1)', correcto(['(x+1)']));

// Errores que sí deben advertirse.
prueba('VALIDACIÓN','Fracción con argumentos insuficientes', 'FORMULA: frac(1)', errorContiene('necesita'));
prueba('VALIDACIÓN','Fracción con demasiados argumentos', 'FORMULA: frac(1;2;3)', errorContiene('necesita'));
prueba('VALIDACIÓN','Raíz vacía', 'FORMULA: raiz()', errorContiene('vacío'));
prueba('VALIDACIÓN','Paréntesis de comando sin cerrar', 'FORMULA: frac(1;2', errorContiene('cerrar'));
prueba('VALIDACIÓN','Paréntesis sobrante', 'FORMULA: x)', errorContiene('sobrante'));
prueba('VALIDACIÓN','Punto y coma fuera de comando', 'FORMULA: x;y', errorContiene('punto y coma'));
prueba('VALIDACIÓN','Instrucción desconocida', 'MATRIZ: 1 2', errorContiene('Instrucción desconocida'));
prueba('VALIDACIÓN','Instrucción sin contenido', 'AUTOR:', errorContiene('vacío'));
prueba('VALIDACIÓN','Comando matemático no implementado', 'FORMULA: sum(i;1;n;i)', errorContiene('Comando desconocido'));
prueba('VALIDACIÓN','Máximo de profundidad', 'FORMULA: '+'raiz('.repeat(22)+'x'+')'.repeat(22), errorContiene('20 niveles'));
prueba('SEGURIDAD','Escapado de HTML de texto', 'TEXTO: <img src=x onerror=alert(1)>', sinHTMLPeligroso);
prueba('SEGURIDAD','Escapado HTML en fórmula', 'FORMULA: frac(<b>;2)', correcto(['&lt;b&gt;'],['<b>']));
prueba('SEGURIDAD','Escapado de ampersand', 'TEXTO: A & B', correcto(['A &amp; B']));
prueba('SEGURIDAD','Escape de comillas', 'TEXTO: "Hola" y \'adiós\'', correcto(['&quot;Hola&quot;','&#39;adiós&#39;']));

// Mejoras recomendadas: fallan con la versión actual hasta que se arreglen.
prueba('MEJORA','Raíz con tilde', 'FORMULA: raíz de 9', correcto(['class="raiz"']));
prueba('MEJORA','Fracción con tilde', 'FORMULA: fracción 1 sobre 2', correcto(['class="fraccion"']));
prueba('MEJORA','Potencia con exponente negativo en español', 'FORMULA: x elevado a -2', correcto(['class="potencia"','<sup>-2</sup>']));
prueba('MEJORA','Fracción con numerador negativo en español', 'FORMULA: fraccion -1 sobre 2', correcto(['class="fraccion"']));
prueba('MEJORA','Raíz negativa en español', 'FORMULA: raiz de -9', correcto(['class="raiz"']));
prueba('MEJORA','Potencia de base compuesta agrupada', 'FORMULA: pot(x+1;3)', correcto(['<sup>3</sup>','(x+1)']));
prueba('MEJORA','Raíz de fracción descrita en español', 'FORMULA: raiz de (x mas fraccion 1 sobre 2)', correcto(['class="raiz"','class="fraccion"']));
prueba('MEJORA','Función matemática f(x) válida como texto', 'FORMULA: f(x)', correcto(['f(x)']));
prueba('MEJORA','Función convencional sin(x) válida como texto', 'FORMULA: sin(x)', correcto(['sin(x)']));
prueba('MEJORA','Nombre constructor tratado como comando desconocido', 'FORMULA: constructor(1)', errorContiene('Comando desconocido'));
prueba('MEJORA','Potencia de exponente compuesto en español', 'FORMULA: x elevado a (n mas 1)', correcto(['class="potencia"']));
prueba('MEJORA','Raíz y potencia ambiguas: interpretar bien o advertir', 'FORMULA: raiz de x elevado a 2', r => r.errores.length>0 || (r.html.includes('<span class="radicando"><span class="potencia">') && r.html.includes('class="raiz"')));

let aprobadas=0, fallidas=0;
for (const t of casos) {
 let resultado;
 try { resultado=contexto.analizarDocumento(t.entrada); }
 catch(e) {resultado={html:'',errores:[{mensaje:'Excepción inesperada: '+e.message}]};}
 let ok=false;
 try { ok=t.valido(resultado); } catch {};
 if(ok) aprobadas++; else fallidas++;
 console.log(`${ok?'OK   ':'FALLA'} [${t.grupo}] ${t.nombre}`);
 if(!ok) console.log(`     Entrada: ${t.entrada.slice(0,120)}\n     Errores: ${resultado.errores.map(e=>e.mensaje).join(' | ')||'ninguno'}\n     Salida: ${resultado.html.slice(0,220)}`);
}
console.log(`\nResultado: ${aprobadas} correctas, ${fallidas} pendientes, ${casos.length} totales.`);
console.log('Las pruebas de CSS e impresión requieren además un navegador.');
if(fallidas) process.exitCode=1;
