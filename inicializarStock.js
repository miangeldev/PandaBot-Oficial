// inicializarStock.js
import fs from 'fs';

const personajesPath = './data/personajes.json';
const stockPath = './data/stock.json';

function inicializarStock() {
  if (!fs.existsSync(personajesPath)) {
    console.error('❌ No se encontró el archivo de personajes.');
    return;
  }

  const personajesData = JSON.parse(fs.readFileSync(personajesPath, 'utf8'));
  const personajes = personajesData.characters || [];
  const ahora = Date.now();

  const stock = {};

  for (const personaje of personajes) {
    const nombre = personaje.nombre.toLowerCase();
    stock[nombre] = {
      cantidad: 30,
      ultimoReset: ahora
    };
  }

  fs.writeFileSync(stockPath, JSON.stringify(stock, null, 2));
  console.log(`✅ Stock inicializado para ${personajes.length} personajes con 30 unidades cada uno.`);
}

inicializarStock();
