export const command = 'randomuser';
export const aliases = ['usuariorandom', 'usuariocasual'];
export async function run(sock, msg) {
  const from = msg.key.remoteJid;

 
  if (!from.endsWith('@g.us')) {
    await sock.sendMessage(from, {
      text: `❌ Este comando solo funciona en grupos.`
    }, { quoted: msg });
    return;
  }

  
  let metadata;
  try {
    metadata = await sock.groupMetadata(from);
  } catch (e) {
    await sock.sendMessage(from, {
      text: `⚠️ No se pudo obtener la lista de usuarios del grupo.`
    }, { quoted: msg });
    return;
  }

  const participantes = metadata.participants
    .filter(p => !p.admin)
    .map(p => p.id);

  if (participantes.length === 0) {
    await sock.sendMessage(from, {
      text: `⚠️ No hay usuarios disponibles para seleccionar.`
    }, { quoted: msg });
    return;
  }

 
  const elegido = participantes[Math.floor(Math.random() * participantes.length)];

  await sock.sendMessage(from, {
    text: `🎯 Usuario aleatorio seleccionado:\n@${elegido.split('@')[0]}`,
    mentions: [elegido]
  }, { quoted: msg });
}
