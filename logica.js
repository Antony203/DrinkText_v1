// DrinkText v1.2: intérprete propio, sin bibliotecas externas.
const MAX_DOCUMENTO = 30000; // Caracteres permitidos en un documento.
const MAX_FORMULA = 500;     // Caracteres permitidos en una fórmula.
const COMANDOS = { frac: 2, pot: 2, raiz: 1, integral: 4 };

function limpiar(texto) {
  return String(texto).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function error(mensaje) { throw new Error(mensaje); }

// Convierte «raiz de (...)» respetando paréntesis internos.
function raicesEnEspanol(texto) {
  const patron = /ra[ií]z de\s*\(/gi;
  let coincidencia;
  while ((coincidencia = patron.exec(texto)) !== null) {
    const inicio = coincidencia.index;
    let nivel = 1;
    let fin = patron.lastIndex;
    while (fin < texto.length && nivel > 0) {
      if (texto[fin] === '(') nivel++;
      if (texto[fin] === ')') nivel--;
      fin++;
    }
    if (nivel !== 0) error('Falta cerrar un paréntesis en la raíz.');
    const interior = texto.slice(patron.lastIndex, fin - 1);
    texto = texto.slice(0, inicio) + 'raiz(' + interior + ')' + texto.slice(fin);
    patron.lastIndex = inicio + 5 + interior.length + 1;
  }
  return texto;
}

// Traduce solo patrones sencillos de español. Los demás se rechazan.
function normalizar(texto) {
  texto = texto
    .replace(/fracci[oó]n\s+\(([^()]*)\)\s+sobre\s+\(([^()]*)\)/gi, 'frac($1;$2)')
    .replace(/fracci[oó]n\s+(-?[\w.]+)\s+sobre\s+(-?[\w.]+)/gi, 'frac($1;$2)')
    .replace(/([\w.]+)\s+elevado a\s+\(([^()]*)\)/gi, 'pot($1;$2)')
    .replace(/([\w.]+)\s+elevado a\s+(-?[\w.]+)/gi, 'pot($1;$2)');
  texto = raicesEnEspanol(texto)
    .replace(/ra[ií]z de\s+(-?[\w.]+)/gi, 'raiz($1)')
    .replace(/integral desde\s+(\w+)\s+hasta\s+(\w+)\s+de\s+(.+?)\s+respecto a\s+(\w+)$/gi, 'integral($1;$2;$3;$4)')
    .replace(/integral desde\s+(\w+)\s+hasta\s+(\w+)\s+de\s+(.+)$/gi, 'integral($1;$2;$3;x)')
    .replace(/\bintegral de\s+(.+)/gi, '∫ $1')
    .replace(/\bmas\b/gi, '+').replace(/\bmenos\b/gi, '−')
    .replace(/\bpor\b/gi, '×').replace(/\bpi\b/gi, 'π')
    .replace(/\binfinito\b/gi, '∞');
  if (/\b(fracci[oó]n|ra[ií]z de|elevado a|integral desde)\b/i.test(texto))
    error('Expresión en español no reconocida completamente. Usa frac(), pot(), raiz() o integral().');
  return texto;
}

// Separa los argumentos por punto y coma, excepto dentro de paréntesis.
function argumentos(contenido) {
  const partes = [];
  let actual = '', nivel = 0;
  for (const caracter of contenido) {
    if (caracter === '(') nivel++;
    if (caracter === ')') nivel--;
    if (caracter === ';' && nivel === 0) {
      partes.push(actual.trim()); actual = '';
    } else actual += caracter;
  }
  partes.push(actual.trim());
  return partes;
}

// Agrupa bases compuestas: pot(x+1;3) debe verse como (x+1)³.
function baseCompuesta(texto) {
  if (texto.startsWith('(') && texto.endsWith(')')) return false;
  let nivel = 0;
  for (const letra of texto) {
    if (letra === '(') nivel++;
    if (letra === ')') nivel--;
    if (nivel === 0 && '+-−×/='.includes(letra)) return true;
  }
  return false;
}

function dibujar(texto, profundidad = 0) {
  if (profundidad > 20) error('La fórmula supera 20 niveles de anidación.');
  let salida = '', i = 0;
  while (i < texto.length) {
    let comando = null;
    // No hace falta revisar la palabra entera en cada letra: evita lentitud.
    if (/[a-zA-Z]/.test(texto[i]) && (i === 0 || !/[\w]/.test(texto[i - 1]))) {
      comando = texto.slice(i).match(/^([a-zA-Z]+)\s*\(/);
    }
    if (comando) {
      const nombre = comando[1].toLowerCase();
      // Estas funciones matemáticas ordinarias se muestran como texto.
      if (['f', 'sin', 'cos', 'tan', 'ln', 'log'].includes(nombre)) {
        salida += limpiar(texto.slice(i, i + comando[1].length));
        i += comando[1].length;
        continue;
      }
      if (!Object.prototype.hasOwnProperty.call(COMANDOS, nombre))
        error('Comando desconocido: ' + nombre + '().');
      const desde = i + comando[0].length;
      let nivel = 1, fin = desde;
      while (fin < texto.length && nivel > 0) {
        if (texto[fin] === '(') nivel++;
        if (texto[fin] === ')') nivel--;
        fin++;
      }
      if (nivel) error('Falta cerrar un paréntesis en ' + nombre + '().');
      const partes = argumentos(texto.slice(desde, fin - 1));
      if (partes.length !== COMANDOS[nombre])
        error(nombre + '() necesita ' + COMANDOS[nombre] + ' argumento(s) separados por punto y coma (;).');
      if (partes.some(p => !p)) error(nombre + '() tiene un argumento vacío.');
      const a = partes.map(p => dibujar(p, profundidad + 1));
      if (nombre === 'frac') salida += '<span class="fraccion"><span>' + a[0] + '</span><span>' + a[1] + '</span></span>';
      if (nombre === 'pot') {
        const base = baseCompuesta(partes[0]) ? '(' + a[0] + ')' : a[0];
        salida += '<span class="potencia"><span class="base-potencia">' + base + '</span><sup>' + a[1] + '</sup></span>';
      }
      if (nombre === 'raiz') salida += '<span class="raiz"><span class="simbolo-raiz">√</span><span class="radicando">' + a[0] + '</span></span>';
      if (nombre === 'integral') salida += '<span class="integral"><span>' + a[1] + '</span><span>∫</span><span>' + a[0] + '</span></span> ' + a[2] + ' d' + a[3];
      i = fin;
    } else if (texto[i] === '(') {
      let nivel = 1, fin = i + 1;
      while (fin < texto.length && nivel > 0) {
        if (texto[fin] === '(') nivel++;
        if (texto[fin] === ')') nivel--;
        fin++;
      }
      if (nivel) error('Hay un paréntesis sin cerrar.');
      salida += '(' + dibujar(texto.slice(i + 1, fin - 1), profundidad + 1) + ')';
      i = fin;
    } else {
      if (texto[i] === ')') error('Hay un paréntesis de cierre sobrante.');
      if (texto[i] === ';') error('El punto y coma (;) solo separa argumentos dentro de un comando.');
      salida += limpiar(texto[i]);
      i++;
    }
  }
  return salida;
}

function matematica(formula) {
  if (formula.length > MAX_FORMULA)
    error('Fórmula demasiado larga (máximo ' + MAX_FORMULA + ' caracteres).');
  return dibujar(normalizar(formula.trim()));
}

// Convierte líneas en HTML y guarda los errores con su número de línea.
function analizarDocumento(codigo) {
  const errores = [];
  let html = '';
  if (codigo.length > MAX_DOCUMENTO)
    return { html: '', errores: [{ linea: 1, mensaje: 'Documento demasiado largo (máximo ' + MAX_DOCUMENTO + ' caracteres).' }] };
  const lineas = codigo.split('\n');
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i].trim();
    if (!linea) continue;
    const posicion = linea.indexOf(':');
    const tipo = posicion >= 0 ? linea.slice(0, posicion).trim().toUpperCase() : '';
    const contenido = posicion >= 0 ? linea.slice(posicion + 1).trim() : '';
    if (!['TITULO', 'AUTOR', 'SECCION', 'TEXTO', 'FORMULA'].includes(tipo)) {
      errores.push({ linea: i + 1, mensaje: 'Instrucción desconocida. Usa TITULO:, AUTOR:, SECCION:, TEXTO: o FORMULA:.' });
      continue;
    }
    if (!contenido) {
      errores.push({ linea: i + 1, mensaje: tipo + ': no puede estar vacío.' });
      continue;
    }
    if (tipo === 'TITULO') html += '<h1>' + limpiar(contenido) + '</h1>';
    if (tipo === 'AUTOR') html += '<p class="autor">' + limpiar(contenido) + '</p>';
    if (tipo === 'SECCION') html += '<h2>' + limpiar(contenido) + '</h2>';
    if (tipo === 'TEXTO') html += '<p>' + limpiar(contenido) + '</p>';
    if (tipo === 'FORMULA') {
      try { html += '<div class="formula">' + matematica(contenido) + '</div>'; }
      catch (e) {
        errores.push({ linea: i + 1, mensaje: e.message });
        html += '<div class="formula formula-invalida"><span class="error-formula">Error en línea ' + (i + 1) + ': ' + limpiar(e.message) + '</span></div>';
      }
    }
  }
  return { html, errores };
}

function interpretar(codigo) { return analizarDocumento(codigo).html; }
