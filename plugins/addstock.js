import fs from 'fs';
import { ownerNumber } from '../config.js';

const stockFile = './data/stock.json';

export function cargarStock() {
  if (!fs.existsSync(stockFile)) fs.writeFileSync(stockFile, '{}');
  return JSON.parse(fs.readFileSync(stockFile));
}

export function guardarStock(data) {
  fs.writeFileSync(stockFile, JSON.stringify(data, null, 2));
}

export const command = 'addstock';

export async function run(sock, msg, args) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const senderId = sender.split('@')[0];
  const nombreowner = msg.pushName || 'Usuario';
  if (!ownerNumber.includes(`+${senderId}`)) {
    await sock.sendMessage(from, {
      text: '❌ Este comando solo puede ser usado por los owners.'
    }, { quoted: msg });
    return;
  }

  const cantidad = parseInt(args[0]);
  const nombre = args.slice(1).join(' ').toLowerCase();

  if (isNaN(cantidad) || cantidad < 0 || !nombre) {
    await sock.sendMessage(from, {
      text: '❌ Uso incorrecto. Ejemplo: `.addstock 5 Pikachu`'
    }, { quoted: msg });
    return;
  }

  const stock = cargarStock();
stock[nombre] = {
  cantidad,
  ultimoReset: Date.now()
};
  guardarStock(stock);

  await sock.sendMessage(from, {
    text: `✅ ${nombreowner} ha definido un stock de *${cantidad}* unidades para *${nombre}*.`
  }, { quoted: msg });
}
export function migrarStockPlano() {
  const stock = cargarStock();
  const ahora = Date.now();
  let cambiado = false;

  for (const nombre in stock) {
    if (typeof stock[nombre] === 'number') {
      stock[nombre] = {
        cantidad: stock[nombre],
        ultimoReset: ahora
      };
      cambiado = true;
    }
  }

  if (cambiado) guardarStock(stock);
}
export function reiniciarStock() {
  const stock = cargarStock();
  const ahora = Date.now();

  for (const nombre in stock) {
    const item = stock[nombre];
    const tiempoPasado = ahora - (item.ultimoReset || 0);

    if (item.cantidad === 0 && tiempoPasado >= 30 * 60 * 1000) {
      stock[nombre] = {
        cantidad: 30,
        ultimoReset: ahora
      };
    }
  }

  guardarStock(stock);
}
export function consumirStock(nombre) {
  const stock = cargarStock();
  if (!stock[nombre] || stock[nombre].cantidad <= 0) return false;

  stock[nombre].cantidad -= 1;
  guardarStock(stock);
  return true;
}

