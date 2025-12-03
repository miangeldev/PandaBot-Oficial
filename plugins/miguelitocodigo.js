export const command = 'miguelitocodigo';

export async function run(sock, msg) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  
  const message = `.code MIGUELITO2`;
  
  await sock.sendMessage(from, { text: message });
}