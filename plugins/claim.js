import { cargarDatabase, guardarDatabase } from '../data/database.js';
import { ownerNumber } from '../config.js';

export const command = 'claim';

export async function run(sock, msg) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const senderNumber = sender.replace(/[^0-9]/g, '');

  if (!global.psSpawn.activo || from !== global.psSpawn.grupo) {
    await sock.sendMessage(from, { text: '❌ No hay ningún PS secreto disponible para reclamar.' });
    return;
  }

  if (global.psSpawn.reclamadoPor) {
    await sock.sendMessage(from, {
      text: `❌ El personaje ya fue reclamado por @${global.psSpawn.reclamadoPor.split('@')[0]}`,
      mentions: [global.psSpawn.reclamadoPor]
    });
    return;
  }

  const db = cargarDatabase();
  db.users = db.users || {};
  const user = db.users[sender] = db.users[sender] || {};
  user.personajes = user.personajes || [];
  user.pandacoins = user.pandacoins || 0;
  user.intentosFallidosClaim = user.intentosFallidosClaim || 0;

  const ahora = Date.now();
  const tiempoDesdeSpawn = ahora - (global.psSpawn.timestamp || 0);

  // Protección de 10 segundos para todos
  if (global.psSpawn.forzadoPorOwner && tiempoDesdeSpawn < 30_000) {
    user.intentosFallidosClaim += 1;
    const penalización = user.intentosFallidosClaim * 100_000_000;
    user.pandacoins = Math.max(0, user.pandacoins - penalización);

    guardarDatabase(db);

    await sock.sendMessage(from, {
      text: `⛔ Este personaje está protegido por 30 segundos.\nHas perdido ${penalización.toLocaleString()} PandaCoins por intentar reclamarlo antes de tiempo.`
    });
    return;
  }

  // Reclamo exitoso
  user.personajes.push(global.psSpawn.personaje.nombre);
  user.intentosFallidosClaim = 0;
  global.psSpawn.reclamadoPor = sender;
  global.psSpawn.activo = false;

  guardarDatabase(db);

  await sock.sendMessage(from, {
    text: `✅ @${sender.split('@')[0]} ha reclamado a *${global.psSpawn.personaje.nombre}* exitosamente!`,
    mentions: [sender]
  });
}
