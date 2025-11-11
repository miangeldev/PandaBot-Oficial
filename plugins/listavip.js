import { cargarDatabase } from '../data/database.js';

export const command = 'listavip';

const cooldowns = {};

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}m ${s}s`;
}

export async function run(sock, msg) {
  const from = msg.key.remoteJid;
  const now = Date.now();

  const db = cargarDatabase();
  db.users = db.users || {};

  const vipEntries = Object.entries(db.users)
    .filter(([jid, user]) => user.vip && user.vipExpiration > now);

  if (vipEntries.length === 0) {
    await sock.sendMessage(from, {
      text: '📭 No hay usuarios VIP activos en este momento.'
    }, { quoted: msg });
    return;
  }

  const vipList = vipEntries.map(([jid, user]) => {
    const restante = user.vipExpiration - now;
    const alias = user.alias || jid.split('@')[0];
    return `• ${alias} → ${formatTime(restante)} restante`;
  });

  const mentions = vipEntries.map(([jid]) => jid);

  const texto = `👑 *Lista de usuarios VIP activos:*\n\n${vipList.join('\n')}`;

  await sock.sendMessage(from, {
    text: texto,
    mentions
  }, { quoted: msg });
}
