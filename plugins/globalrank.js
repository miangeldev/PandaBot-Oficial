import { cargarDatabase } from '../data/database.js';

export const command = 'globalrank';

export async function run(sock, msg) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;

  // Enviar mensaje de carga estético
  const loadingMsg = await sock.sendMessage(from, {
    text: `🔄 *Cargando base de datos...*\n⏳ *Esto puede tomar unos segundos...*\n\n📊 *Buscando los rankings globales...*`
  }, { quoted: msg });

  const db = cargarDatabase();
  db.users = db.users || {};

  // Normalizamos y eliminamos duplicados
  const usuariosMap = new Map();

  for (const [jid, data] of Object.entries(db.users)) {
    if (!jid) continue;
    const cleanJid = jid.replace(/:.+/, ''); // elimina parte "lid:" o similar
    const userData = usuariosMap.get(cleanJid) || { 
      pandacoins: 0,
      achievements: data.achievements || null
    };
    userData.pandacoins = Math.max(userData.pandacoins, data.pandacoins || 0);
    // Mantener los achievements del usuario
    if (data.achievements && !userData.achievements) {
      userData.achievements = data.achievements;
    }
    usuariosMap.set(cleanJid, userData);
  }

  const usuarios = [...usuariosMap.entries()]
    .map(([jid, data]) => ({ 
      jid, 
      pandacoins: data.pandacoins,
      title: data.achievements?.selectedTitle || null
    }))
    .sort((a, b) => b.pandacoins - a.pandacoins);

  if (usuarios.length === 0) {
    await sock.sendMessage(from, { text: '❌ No hay usuarios registrados aún.' }, { quoted: msg });
    return;
  }

  // Encontrar posición del usuario actual
  const userPosition = usuarios.findIndex(u => u.jid === sender) + 1;
  const topUsuarios = usuarios.slice(0, 10);

  let texto = `🏆 *TOP 10 GLOBAL - PANDACOINS* 🏆\n\n`;
  texto += `📍 *Tu posición actual:* #${userPosition || "No rankeado"}\n\n`;
  
  const mentions = [];

  for (let i = 0; i < topUsuarios.length; i++) {
    const u = topUsuarios[i];
    const rankEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🔹';
    const nombre = await obtenerNombre(sock, u.jid);
    
    texto += `${rankEmoji} *${i + 1}.* ${nombre}\n`;
    
    // Añadir título si tiene uno equipado
    if (u.title) {
      texto += `   🎖️ ~ ${u.title}\n`;
    }
    
    texto += `   💰 ${u.pandacoins.toLocaleString()} Pandacoins\n\n`;
    mentions.push(u.jid);
  }

  const footer = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🐼 *¡Sigue consiguiendo Pandacoins para subir en el ranking!*`;

  // Editar el mensaje de carga con el resultado final
  await sock.sendMessage(from, {
    text: texto + footer,
    mentions
  }, { 
    edit: loadingMsg.key 
  });
}

async function obtenerNombre(sock, jid) {
  try {
    const contacto = await sock.onWhatsApp(jid);
    const id = contacto?.[0]?.jid || jid;
    const info = await sock.fetchStatus(id).catch(() => null);
    const nameData = await sock.contactSave?.[id] || {};
    const nombre = nameData.name || info?.status || id.split('@')[0];
    return `@${nombre}`;
  } catch {
    return `@${jid.split('@')[0]}`;
  }
}
