export const command = 'formartrio';
export const aliases = ['trio', 'trío', 'threesome'];
const emoji = '👀';

export async function run(sock, msg, args) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid || [];

  if (mentionedJid.length !== 2) {
    await sock.sendMessage(from, {
      text: `${emoji} Menciona a *2 usuarios* más, para calcular la compatibilidad.`,
    }, { quoted: msg });
    return;
  }

  const [person1, person2] = mentionedJid;
  const person3 = sender;

  const getName = (jid) => sock.getName?.(jid) || `@${jid.split('@')[0]}`;

  const name1 = getName(person1);
  const name2 = getName(person2);
  const name3 = getName(person3);

  const comp1_2 = Math.floor(Math.random() * 100);
  const comp1_3 = Math.floor(Math.random() * 100);
  const comp2_3 = Math.floor(Math.random() * 100);

  const trio = `\t\t*TRIO VIOLENTOOOOO!*

*${name1}* y *${name2}* tienen un *${comp1_2}%* de compatibilidad como pareja.
Mientras que *${name1}* y *${name3}* tienen un *${comp1_3}%* de compatibilidad.
Y *${name2}* y *${name3}* tienen un *${comp2_3}%* de compatibilidad.

*¿Qué opinas de un trío?* 😏`;

  await sock.sendMessage(from, {
    text: trio,
    mentions: [person1, person2, person3]
  }, { quoted: msg });
}
