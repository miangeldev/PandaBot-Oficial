import fs from 'fs';
import { ownerNumber } from '../config.js';

export const command = 'modoowner';
export const groupOnly = true;

const FILE = './data/modoowner.json';

function load() {
  if (!fs.existsSync(FILE)) return {};
  return JSON.parse(fs.readFileSync(FILE, 'utf8'));
}

function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export async function run(sock, msg, args) {
  const from = msg.key.remoteJid;

  const sender = msg.key.participant || msg.key.remoteJid;
  const senderNumber = sender.split('@')[0];
  const isOwner = ownerNumber.includes(`+${senderNumber}`);

  if (!isOwner) {
    await sock.sendMessage(from, { text: '❌ Solo los Owners pueden usar este comando.' });
    return;
  }

  if (!args[0] || !['on', 'off'].includes(args[0])) {
    return sock.sendMessage(from, {
      text: '⚙️ Uso correcto:\n.modoowner on\n.modoowner off'
    });
  }

  const db = load();

  if (args[0] === 'on') {
    db[from] = true;
    save(db);
    return sock.sendMessage(from, { text: '🔒 *Modo Owner ACTIVADO*\nSolo el owner del grupo y Owners globales pueden usar comandos.' });
  }

  if (args[0] === 'off') {
    delete db[from];
    save(db);
    return sock.sendMessage(from, { text: '✅ *Modo Owner DESACTIVADO*\nTodos pueden usar comandos.' });
  }
}
