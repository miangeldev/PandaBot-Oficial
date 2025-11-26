import { registrarPizzeria } from "../PandaLove/pizzeria.js";
import { checkAchievements, initializeAchievements, unlockAchievement } from '../data/achievementsDB.js';
import { cargarDatabase, guardarDatabase } from '../data/database.js';

export const command = 'regpizzeria';
export const aliases = ['registrarpizzeria', 'iniciarpizzeria'];
export async function run(sock, msg, args) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;

  const db = cargarDatabase();
  
  // ✅ Inicializar achievements si no existen
  if (!db.users[sender]?.achievements) {
    initializeAchievements(sender);
  }

  const loadingMsg = await sock.sendMessage(from, { text: `🍕 Registrando tu pizzería...` });

  try {
    const response = await registrarPizzeria(sender);

    if (response.number === 200) {
      // ✅ USUARIO NUEVO - Registrar pizzería
      if (db.users[sender]) {
        db.users[sender].pizzeria = {
          registered: true,
          level: 1,
          registered_date: Date.now()
        };
        guardarDatabase(db);
      }

      // 🔥 DESBLOQUEAR LOGRO PARA USUARIO NUEVO
      const achievementResult = unlockAchievement(sender, 'pizzero_1', sock, from);
      
      await sock.sendMessage(from, { 
        text: `*✅ ¡Felicidades! Tu pizzería ha sido registrada con éxito. Asegúrate de usar .pzzname para darle un nombre a tu Pizzeria.*` 
      }, { quoted: loadingMsg });

    } else {
      // ✅ USUARIO EXISTENTE - Verificar si ya tiene el logro
      const user = db.users[sender];
      
      // Si ya tiene pizzería pero no tiene el logro, desbloquearlo
      if (user && user.pizzeria && user.pizzeria.registered) {
        const hasAchievement = user.achievements?.unlocked?.includes('pizzero_1');
        
        if (!hasAchievement) {
          // 🔥 DESBLOQUEAR LOGRO PARA USUARIO EXISTENTE
          const achievementResult = unlockAchievement(sender, 'pizzero_1', sock, from);
          
          await sock.sendMessage(from, { 
            text: `*🍕 ¡Ya tienes una pizzería registrada! Y como buen pizzero, has desbloqueado un logro especial. 🎉*` 
          }, { quoted: loadingMsg });
        } else {
          await sock.sendMessage(from, { 
            text: `*🍕 Ya tienes una pizzería registrada y has obtenido todos los logros relacionados. ¡Sigue cocinando! 🐼*` 
          }, { quoted: loadingMsg });
        }
      } else {
        await sock.sendMessage(from, { 
          text: `*🍕 Ya tienes una pizzería registrada. 🐼*` 
        }, { quoted: loadingMsg });
      }
    }
  } catch (error) {
    console.error('❌ Error al conectar con la API de la pizzería:', error);
    await sock.sendMessage(from, { 
      text: `*❌ Hubo un error de conexión con la API de la pizzería. Inténtalo más tarde.*` 
    });
  }
}
