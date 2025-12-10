export const command = 'adivinapetera';

export async function run(sock, msg) {
  const from = msg.key.remoteJid;
  
  const message = `No Miguel, no.`;
  
  await sock.sendMessage(from, { text: message });
}