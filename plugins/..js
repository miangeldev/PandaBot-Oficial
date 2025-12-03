
export const command = '.';

export async function run(sock, msg) {
  const from = msg.key.remoteJid;
  
  const message = `Aprende a usar el bot, niño rata`;
  
  await sock.sendMessage(from, { text: message });
}
