import { cargarDatabase, guardarDatabase } from '../data/database.js';

export const command = 'fixallstats';

export async function run(sock, msg) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  
  // Verificar si es admin/owner
  if (!sender.includes('123456789') && !sender.includes('166164298780822')) { // Cambia por tus IDs
    await sock.sendMessage(from, { text: '❌ Solo owners pueden usar este comando.' });
    return;
  }

  const db = cargarDatabase();
  let fixedUsers = 0;
  let totalUsers = 0;

  for (const [userId, userData] of Object.entries(db.users)) {
    totalUsers++;
    if (userData.achievements && userData.achievements.stats) {
      const stats = userData.achievements.stats;
      let updated = false;

      // Añadir stats faltantes
      if (stats.paja_count === undefined) {
        stats.paja_count = 0;
        updated = true;
      }
      if (stats.sexo_count === undefined) {
        stats.sexo_count = 0;
        updated = true;
      }
      if (stats.dildear_count === undefined) {
        stats.dildear_count = 0;
        updated = true;
      }

      if (updated) {
        fixedUsers++;
        console.log(`✅ Fixed stats for: ${userId.split('@')[0]}`);
      }
    }
  }

  if (fixedUsers > 0) {
    guardarDatabase(db);
    await sock.sendMessage(from, {
      text: `✅ *FIX COMPLETADO*\n\n📊 Usuarios fixeados: ${fixedUsers}/${totalUsers}\n\nLos nuevos logros de .paja, .sexo y .dildear ahora funcionarán para todos.`
    });
  } else {
    await sock.sendMessage(from, {
      text: `ℹ️ Todos los usuarios ya tienen los stats necesarios.`
    });
  }
}
