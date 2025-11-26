import { cargarDatabase } from '../data/database.js';

export const command = 'debugstats';

export async function run(sock, msg) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  
  const db = cargarDatabase();
  const user = db.users[sender];
  
  if (!user) {
    await sock.sendMessage(from, { text: '❌ Usuario no encontrado en la base de datos' });
    return;
  }
  
  if (!user.achievements) {
    await sock.sendMessage(from, { text: '❌ Usuario no tiene sistema de logros inicializado' });
    return;
  }
  
  const stats = user.achievements.stats || {};
  const mensaje = `
📊 *ESTADÍSTICAS DEBUG - ${sender.split('@')[0]}*

🔞 *COMANDOS NUEVOS:*
✊ paja_count: ${stats.paja_count || 0}
😏 sexo_count: ${stats.sexo_count || 0}  
🦄 dildear_count: ${stats.dildear_count || 0}

💰 *ECONOMÍA:*
⛏️ minar_count: ${stats.minar_count || 0}
👷 trabajar_count: ${stats.trabajar_count || 0}
🛒 buy_count: ${stats.buy_count || 0}

🎮 *JUEGOS:*
🎰 apostar_count: ${stats.apostar_count || 0}
🥷 robos_exitosos: ${stats.robos_exitosos || 0}
❌ robos_fallidos: ${stats.robos_fallidos || 0}
🎡 cm_tiradas: ${stats.cm_tiradas || 0}
⚔️ cm_ataques: ${stats.cm_ataques || 0}

🎵 *MÚSICA:*
🎧 spotify_count: ${stats.spotify_count || 0}

📅 *OTROS:*
⌨️ commands_used: ${stats.commands_used || 0}
📅 registered_date: ${new Date(stats.registered_date || Date.now()).toLocaleDateString()}
💸 was_broke: ${stats.was_broke ? 'Sí' : 'No'}
📈 comeback: ${stats.comeback ? 'Sí' : 'No'}

💡 *LOGROS DESBLOQUEADOS:* ${user.achievements.unlocked?.length || 0}
⭐ *PUNTOS TOTALES:* ${user.achievements.points || 0}
  `.trim();
  
  await sock.sendMessage(from, { text: mensaje });
}
