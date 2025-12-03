export const command = '👃';

export async function run(sock, msg) {
  const from = msg.key.remoteJid;
  
  const message = `che`;
  
  await sock.sendMessage(from, { text: message });
}