export const command = 'sexoconmiguelito';

export async function run(sock, msg) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  
  const message = `Estás teniendo sexo con Miguel🔥`;
  
  await sock.sendMessage(from, { text: message });
}