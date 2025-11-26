import { cargarDatabase, guardarDatabase } from '../data/database.js';
import { initializeAchievements } from '../data/achievementsDB.js';

export const command = 'fixstats';

export async function run(sock, msg) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  
  const db = cargarDatabase();
  const user = db.users[sender];
  
  if (!user) {
    await sock.sendMessage(from, { text: '❌ Usuario no encontrado' });
    return;
  }

  if (!user.achievements) {
    initializeAchievements(sender);
    await sock.sendMessage(from, { text: '✅ Achievements inicializados desde cero' });
    return;
  }

  // FIXEAR STATS EXISTENTES
  const stats = user.achievements.stats;
  let fixed = [];
  
  if (stats.paja_count === undefined) {
    stats.paja_count = 0;
    fixed.push('paja_count');
  }
  if (stats.sexo_count === undefined) {
    stats.sexo_count = 0;
    fixed.push('sexo_count');
  }
  if (stats.dildear_count === undefined) {
    stats.dildear_count = 0;
    fixed.push('dildear_count');
  }

  if (fixed.length > 0) {
    guardarDatabase(db);
    await sock.sendMessage(from, { 
      text: `✅ Stats fixeados: ${fixed.join(', ')}\n\nAhora usa .paja y debería funcionar.` 
    });
  } else {
    await sock.sendMessage(from, { 
      text: `ℹ️ Todos los stats ya existen. El problema está en otra parte.` 
    });
  }
}
