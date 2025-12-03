import { cargarDatabase, guardarDatabase } from '../data/database.js';

export const command = 'titles';
export const aliases = ['mytitles', 'mistitulos', 'title', 'titulos'];

export async function run(sock, msg, args) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;

  const db = cargarDatabase();
  const user = db.users[sender];
  
  if (!user) {
    await sock.sendMessage(from, { 
      text: '❌ No tienes títulos disponibles.\n\n💡 Desbloquea títulos con logros o compra algunos en la tienda:\n.shop' 
    });
    return;
  }

  // Asegurar que achievements existe
  if (!user.achievements) {
    user.achievements = {
      unlocked: [],
      progress: {},
      points: 0,
      titles: [],
      selectedTitle: null,
      stats: {}
    };
    guardarDatabase(db);
  }

  const titles = user.achievements.titles || [];
  const selectedTitle = user.achievements.selectedTitle;

  // Subcomando: inventario
  if (args[0]?.toLowerCase() === 'inventario') {
    await mostrarInventario(sock, from, titles, selectedTitle);
    return;
  }

  // Detectar si el comando usado fue .title (sin arguments)
  const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
  const isTitleCommand = messageText.startsWith('.title') && args.length === 0;

  // Si usan .title sin argumentos, mostrar ayuda
  if (isTitleCommand) {
    await sock.sendMessage(from, {
      text: `👑 *SELECCIONAR TÍTULO*\n\n💡 Usa:\n• .titles inventario - Para ver tu lista de títulos\n• .title <número> - Para equipar un título\n• .title off - Para quitar el título actual\n\n🛒 Compra más títulos con: .shop`
    });
    return;
  }

  // Comando principal: mostrar lista de títulos (por defecto)
  if (args.length === 0) {
    await mostrarInventario(sock, from, titles, selectedTitle);
    return;
  }

  // SELECCIONAR/QUITAR TÍTULO
  const action = args[0].toLowerCase();

  if (action === 'off' || action === '0' || action === 'none') {
    user.achievements.selectedTitle = null;
    guardarDatabase(db);
    await sock.sendMessage(from, { 
      text: `✅ *Título removido*\n\n👤 Ahora aparecerás sin título.` 
    });
    return;
  }

  // Seleccionar por número
  const titleIndex = parseInt(action) - 1;
  
  if (isNaN(titleIndex) || titleIndex < 0 || titleIndex >= titles.length) {
    await sock.sendMessage(from, {
      text: `❌ Número inválido. Usa un número del 1 al ${titles.length}.\n\n💡 Usa .titles inventario para ver tu lista.`
    });
    return;
  }

  const selected = titles[titleIndex];
  user.achievements.selectedTitle = selected;
  guardarDatabase(db);

  await sock.sendMessage(from, {
    text: `✅ *Título seleccionado*\n\n👑 ${selected}\n\n💫 Ahora aparecerás con este título en tu perfil.`
  });
}

// Función para mostrar el inventario de títulos
async function mostrarInventario(sock, from, titles, selectedTitle) {
  if (titles.length === 0) {
    await sock.sendMessage(from, {
      text: `📭 *NO TIENES TÍTULOS*\n\n💡 Puedes:\n• Desbloquear títulos con logros\n• Comprar títulos en la tienda: .shop\n• Ganar títulos especiales con eventos`
    });
    return;
  }

  let mensaje = `👑 *INVENTARIO DE TÍTULOS* 👑\n\n`;
  mensaje += `📊 Total: ${titles.length} títulos\n`;
  mensaje += `⭐ Seleccionado: ${selectedTitle || "Ninguno"}\n\n`;
  
  // Mostrar títulos en columnas de 2 para mejor visualización
  titles.forEach((title, index) => {
    const isSelected = title === selectedTitle;
    const numero = index + 1;
    const emoji = isSelected ? "✅" : "📌";
    
    // Formato en columnas
    if (index % 2 === 0) {
      // Primera columna
      mensaje += `${emoji} ${numero}. ${title}`;
      if (index + 1 < titles.length) {
        // Si hay siguiente título, dejar espacio para segunda columna
        mensaje += ' '.repeat(Math.max(1, 25 - title.length));
      } else {
        mensaje += '\n';
      }
    } else {
      // Segunda columna
      mensaje += `${emoji} ${numero}. ${title}\n`;
    }
  });

  mensaje += `\n💡 *Comandos:*\n`;
  mensaje += `• .title <número> - Seleccionar título\n`;
  mensaje += `• .title off - Quitar título\n`;
  mensaje += `• .shop - Tienda de títulos\n\n`;
  mensaje += `🎯 *Ejemplos:*\n`;
  mensaje += `.title 1 - Equipar primer título\n`;
  mensaje += `.title off - Quitar título actual`;

  await sock.sendMessage(from, { text: mensaje });
}
