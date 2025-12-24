import { trackProgress } from '../data/achievementsDB.js';
import { cargarDatabase } from '../data/database.js';

export const command = 'paja';
export const aliases = ['pajear'];
export async function run(sock, msg, args) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const who = sender;

  
  const dbBefore = cargarDatabase();
  const userBefore = dbBefore.users[sender];
  const pajaCountBefore = userBefore?.achievements?.stats?.paja_count || 0;
  console.log(`🔴 paja.js - ANTES: paja_count = ${pajaCountBefore}`);

  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
  const target = mentioned || who;
  const name = mentioned ? `@${mentioned.split('@')[0]}` : `@${who.split('@')[0]}`;

  const frames = [
    `Iniciando paja...`,
    '╭━━╮╭╭╭╮\n┃▔╲┣╈╈╈╈━━━╮\n┃┈┈▏.╰╯╯╯╭╮━┫\n┃┈--.╭━━━━╈╈━╯\n╰━━╯-.                ╰╯',
    '╭━━╮.    ╭╭╭╮\n┃▔╲┣━━╈╈╈╈━━╮\n┃┈┈▏.    .╰╯╯╯╭╮┫\n┃┈--.╭━━━━━━╈╈╯\n╰━━╯-.           . ╰╯',
    `              .               .   ╭\n╭━━╮╭╭╭╮.           ╭ ╯\n┃▔╲┣╈╈╈╈━━━╮╭╯╭\n┃┈┈▏.╰╯╯╯╭╮━┫  \n┃┈--.╭━━━━╈╈━╯╰╮╰\n╰━━╯-.        ╰╯...-    ╰ ╮\n   .         . .  .  .. . . .  . .. .  ╰\n\n*🔥 @${who.split('@')[0]} SE LA JALÓ PENSANDO EN ${name}.*`
  ];

  const { key } = await sock.sendMessage(from, {
    text: frames[0],
    mentions: [who, ...(mentioned ? [mentioned] : [])]
  });

  for (let i = 1; i < frames.length; i++) {
    await new Promise(res => setTimeout(res, 1000));
    await sock.sendMessage(from, {
      text: frames[i],
      edit: key,
      mentions: [who, ...(mentioned ? [mentioned] : [])]
    });
  }

  
  console.log(`🟡 paja.js - Llamando trackProgress directamente...`);
  trackProgress(sender, 'paja_count', 1, sock, from);
  console.log(`🟡 paja.js - trackProgress llamado`);

 
  setTimeout(() => {
    const dbAfter = cargarDatabase();
    const userAfter = dbAfter.users[sender];
    const pajaCountAfter = userAfter?.achievements?.stats?.paja_count || 0;
    console.log(`🟢 paja.js - DESPUÉS: paja_count = ${pajaCountAfter}`);
    console.log(`🟢 paja.js - ¿Cambió?: ${pajaCountAfter > pajaCountBefore ? 'SÍ' : 'NO'}`);
  }, 2000);
}
