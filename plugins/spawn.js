import fs from 'fs';
import { cargarDatabase, guardarDatabase } from '../data/database.js';
import { ownerNumber } from '../config.js';
export const command = 'spawn';

export async function run(sock, msg, args) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const data = JSON.parse(fs.readFileSync('./data/personajes.json', 'utf8'));
  const personajes = data.characters;
  const db = cargarDatabase();
  db.users = db.users || {};
  const user = db.users[sender] = db.users[sender] || {};
  const senderNumber = sender.split('@')[0];
  const isOwner = ownerNumber.includes(`+${senderNumber}`);

  if (!isOwner) {
    await sock.sendMessage(from, { text: '❌ Solo los Owners pueden usar este comando.' });
    return;
  }

  if (args.length === 0) {
    await sock.sendMessage(from, { text: '❌ Usa .spawn <nombre del personaje>' });
    return;
  }

  const nombre = args.join(' ').toLowerCase();
  const personaje = personajes.find(p => p.nombre.toLowerCase() === nombre);

  if (!personaje) {
    await sock.sendMessage(from, { text: '❌ No se encontró ese personaje.' });
    return;
  }

global.psSpawn = {
  activo: true,
  personaje,
  grupo: '120363402403091432@g.us',
  reclamadoPor: null,
  timestamp: Date.now(),
  forzadoPorOwner: isOwner
};

  await sock.sendMessage(global.psSpawn.grupo, {
    text: `> Este personaje está protegido durante 30 segundos por el Creador\n🌀 A SECRET PS HAS SPAWNED IN THIS GROUP!\nUse *.claim* to get *${personaje.nombre}* before anyone else!`
  });
}
