import { cargarDatabase, guardarDatabase } from '../data/database.js';
import { ownerNumber } from '../config.js';

export const command = 'penalizarps';

export async function run(sock, msg, args) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const senderNumber = sender.replace(/[^0-9]/g, '');

  // Validación de owner
  if (!ownerNumber.includes(`+${senderNumber}`)) {
    await sock.sendMessage(from, { text: '❌ Solo los owners pueden usar este comando.' });
    return;
  }

  // Validación de argumentos
  if (args.length < 2 || !msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
    await sock.sendMessage(from, {
      text: '❌ Uso incorrecto.\nFormato: *.penalizarps <Nombre> @usuario*'
    }, { quoted: msg });
    return;
  }

  const nombrePS = args.slice(0, -1).join(' ').toLowerCase();
  const target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];

  const db = cargarDatabase();
  db.users = db.users || {};
  const targetUser = db.users[target] = db.users[target] || {};
  targetUser.personajes = targetUser.personajes || [];

  const index = targetUser.personajes.findIndex(p => p.toLowerCase() === nombrePS);

  if (index === -1) {
    await sock.sendMessage(from, {
      text: `❌ El usuario no tiene el personaje *${nombrePS}*.`
    }, { quoted: msg });
    return;
  }

  // Eliminar personaje
  const eliminado = targetUser.personajes.splice(index, 1)[0];
  guardarDatabase(db);

  await sock.sendMessage(from, {
    text: `⚠️ El personaje *${eliminado}* ha sido eliminado del inventario de @${target.split('@')[0]}.`,
    mentions: [target]
  });
}
