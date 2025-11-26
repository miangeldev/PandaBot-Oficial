import { cargarDatabase, guardarDatabase } from '../data/database.js';
import { ownerNumber } from '../config.js';
import fs from 'fs';

const premiosAdviento = {
  1: { tipo: 'pandacoins', cantidad: 10000000000, mensaje: "🎄 ¡Primer día de Adviento! 🎁 10,000,000,000 pandacoins" },
  2: { tipo: 'titulo', titulo: "🍀 Suertudo", mensaje: "🎄 Día 2 - Título especial: 🍀 Suertudo" },
  3: { tipo: 'vip', duracion: 24, mensaje: "🎄 Día 3 - 24 horas de VIP ⭐" },
  4: { tipo: 'pandacoins', cantidad: 20000000000, mensaje: "🎄 Día 4 - 20,000,000,000 pandacoins" },
  5: { tipo: 'personaje', personaje: "Everything", mensaje: "🎄 Día 5 - Personaje exclusivo: usa .misps para ver qué te tocó" },
  6: { tipo: 'giros', cantidad: 500, mensaje: "🎄 Día 6 - 500 tiros en Coin Master System 🎯" },
  7: { tipo: 'creditos', cantidad: 2000, mensaje: "🎄 Día 7 - 2,000 créditos en Coin Master System 💰" },
  8: { tipo: 'vip', duracion: 24, mensaje: "🎄 Día 8 - 24 horas de VIP ⭐" },
  9: { tipo: 'pandacoins', cantidad: 30000000000, mensaje: "🎄 Día 9 - 30,000,000,000 Pandacoins" },
  10: { tipo: 'diamantes', cantidad: 30, mensaje: "🎄 Día 10 - 30 diamantes 💎" },
  11: { tipo: 'titulo', titulo: "🤡 Payaso", mensaje: "🎄 Día 11 - Título especial: 🤡 Payaso" },
  12: { tipo: 'nada', mensaje: "🎄 Día 12 - Encontraste un chocolate con hongos 🍫🍄\n(No ganaste nada, mejor suerte mañana)" },
  13: { tipo: 'pandacoins', cantidad: 20000000000, mensaje: "🎄 Día 13 - 20,000,000,000 Pandacoins" },
  14: { tipo: 'personaje', personaje: "Santa Claus Legendario", mensaje: "🎄 Día 14 - Personaje: usa .misps para ver qué te tocó." },
  15: { tipo: 'giros', cantidad: 500, mensaje: "🎄 Día 15 - 500 tiros en Coin Master System 🎯" },
  16: { tipo: 'pandacoins', cantidad: 15000000000, mensaje: "🎄 Día 16 - 15,000,000,000 Pandacoins" },
  17: { tipo: 'vip', duracion: 48, mensaje: "🎄 Día 17 - 48 horas de VIP ⭐" },
  18: { tipo: 'titulo', titulo: "🎁 Regalero", mensaje: "🎄 Día 18 - Título especial: 🎁 Regalero" },
  19: { tipo: 'personaje', personaje: "Rodolfo el Reno", mensaje: "🎄 Día 19 - Personaje festivo: usa .misps para ver qué te tocó." },
  20: { tipo: 'nada', mensaje: "🎄 Día 20 - El Grinch visitó tu calendario... ¡No ganaste nada! 🎄" },
  21: { tipo: 'diamantes', cantidad: 50, mensaje: "🎄 Día 21 - 50 diamantes 💎" },
  22: { tipo: 'pandacoins', cantidad: 25000000000, mensaje: "🎄 Día 22 - 25,000,000,000 Pandacoins" },
  23: { tipo: 'giros', cantidad: 1000, mensaje: "🎄 Día 23 - 1,000 tiros en Coin Master System 🎯" },
  24: { tipo: 'premio_especial', mensaje: "🎄 ¡FELIZ NAVIDAD! 🎅 - Premio Especial Navideño: 100,000,000,000 Pandacoins + 100 diamantes + Título 🎄 Navideño ✨" }
};

function getPremioRandomizado(dia) {
  const premiosPosibles = [
    { tipo: 'pandacoins', cantidad: 10000000000 + (dia * 1000000000), probabilidad: 0.3 },
    { tipo: 'vip', duracion: 24, probabilidad: 0.1 },
    { tipo: 'giros', cantidad: 200 + (dia * 20), probabilidad: 0.15 },
    { tipo: 'diamantes', cantidad: 10 + dia, probabilidad: 0.1 },
    { tipo: 'nada', probabilidad: 0.05 },
    { tipo: 'titulo', titulo: getTituloRandom(), probabilidad: 0.1 },
    { tipo: 'personaje', personaje: getPersonajeRandom(), probabilidad: 0.1 },
    { tipo: 'creditos', cantidad: 1000 + (dia * 100), probabilidad: 0.1 }
  ];

  return premiosAdviento[dia] || premiosAdviento[1];
}

function getTituloRandom() {
  const titulos = ["🎄 Navideño", "⭐ Estrella", "🎁 Regalero", "❄️ Nevado", "🔥 Hogareño"];
  return titulos[Math.floor(Math.random() * titulos.length)];
}

function getPersonajeRandom() {
  const personajes = ["Xmas Nyan Cat", "Xmas Everything", "Xmas Lukas", "Rodolfo el Reno"];
  return personajes[Math.floor(Math.random() * personajes.length)];
}

export const command = 'adviento';
export const aliases = ['calendario', 'navidad'];

export async function run(sock, msg, args) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const senderNumber = sender.split('@')[0];

  // CORREGIDO: Verificación simple como en el ejemplo
  const isOwner = ownerNumber.includes('+' + senderNumber);

  if (!isOwner) {
    await sock.sendMessage(from, {
      text: '🎄 El calendario de adviento estará disponible en *Diciembre*.\n\n¡Vuelve en Navidad! 🎅'
    }, { quoted: msg });
    return;
  }

  const db = cargarDatabase();

  if (!db.adviento) {
    db.adviento = {
      activo: true,
      año: new Date().getFullYear(),
      usuarios: {}
    };
  }

  if (!args[0]) {
    await mostrarInfoAdviento(sock, from, sender, db);
    return;
  }

  const diaSolicitado = parseInt(args[0]);

  if (isNaN(diaSolicitado) || diaSolicitado < 1 || diaSolicitado > 24) {
    await sock.sendMessage(from, {
      text: '❌ Día inválido. Usa: *.adviento <1-24>*\nEjemplo: *.adviento 5*'
    }, { quoted: msg });
    return;
  }

  await reclamarDiaAdviento(sock, from, sender, db, diaSolicitado);
}

async function mostrarInfoAdviento(sock, from, sender, db) {
  const usuario = db.adviento.usuarios[sender] || { diasReclamados: [] };
  const diasReclamados = usuario.diasReclamados || [];

  let texto = `🎄 *CALENDARIO DE ADVIENTO NAVIDEÑO* 🎅\n\n`;
  texto += `📅 Sistema de prueba para owners\n`;
  texto += `🎁 Días reclamados: *${diasReclamados.length}/24*\n\n`;

  texto += `📋 *Cómo funciona:*\n`;
  texto += `• Usa *.adviento <día>* para reclamar premios\n`;
  texto += `• En diciembre solo podrás reclamar días pasados\n`;
  texto += `• ¡Cada día tiene una sorpresa diferente!\n\n`;

  if (diasReclamados.length > 0) {
    texto += `✅ *Días reclamados:* ${diasReclamados.sort((a, b) => a - b).join(', ')}\n\n`;
  }

  texto += `🎯 *Comando:* .adviento <1-24>\n`;
  texto += `Ejemplo: .adviento 1`;

  await sock.sendMessage(from, { text: texto });
}

async function reclamarDiaAdviento(sock, from, sender, db, diaSolicitado) {
  if (!db.adviento.usuarios[sender]) {
    db.adviento.usuarios[sender] = {
      diasReclamados: [],
      primerReclamo: new Date().toISOString(),
      ultimoReclamo: new Date().toISOString()
    };
  }

  const usuario = db.adviento.usuarios[sender];
  const diasReclamados = usuario.diasReclamados || [];

  if (diasReclamados.includes(diaSolicitado)) {
    const premio = premiosAdviento[diaSolicitado];
    await sock.sendMessage(from, {
      text: `✅ Ya reclamaste el premio del día *${diaSolicitado}*:\n${premio.mensaje}`
    }, { quoted: msg });
    return;
  }

  const premio = premiosAdviento[diaSolicitado];
  if (!premio) {
    await sock.sendMessage(from, {
      text: `❌ No hay premio configurado para el día ${diaSolicitado}.`
    }, { quoted: msg });
    return;
  }

  if (!db.users) db.users = {};
  if (!db.users[sender]) {
    db.users[sender] = {
      pandacoins: 0,
      inventory: {},
      achievements: {
        titles: [],
        selectedTitle: null
      },
      personajes: []
    };
  }

  const user = db.users[sender];

  let mensajePremio = '';
  let recompensaAplicada = false;

  try {
    switch (premio.tipo) {
      case 'pandacoins':
        user.pandacoins = (user.pandacoins || 0) + premio.cantidad;
        mensajePremio = `💰 +${premio.cantidad.toLocaleString()} pandacoins`;
        recompensaAplicada = true;
        break;

      case 'titulo':
        if (!user.achievements) user.achievements = { titles: [], selectedTitle: null };
        if (!user.achievements.titles.includes(premio.titulo)) {
          user.achievements.titles.push(premio.titulo);
          mensajePremio = `👑 Título: "${premio.titulo}"`;
          recompensaAplicada = true;
        } else {
          mensajePremio = `⚠️ Ya tenías el título "${premio.titulo}"`;
        }
        break;

      case 'vip':
        const expirationTime = Date.now() + (premio.duracion * 60 * 60 * 1000);
        user.vip = true;
        user.vipExpiration = expirationTime;
        const expirationDate = new Date(expirationTime).toLocaleString();
        mensajePremio = `⭐ VIP por ${premio.duracion} horas (hasta ${expirationDate})`;
        recompensaAplicada = true;
        break;

      case 'personaje':
        if (!user.personajes) user.personajes = [];
        if (!user.personajes.includes(premio.personaje)) {
          user.personajes.push(premio.personaje);
          mensajePremio = `🎭 Personaje: "${premio.personaje}"`;
          recompensaAplicada = true;
        } else {
          mensajePremio = `⚠️ Ya tenías el personaje "${premio.personaje}"`;
        }
        break;

      case 'giros':
        if (!global.cmDB) global.cmDB = {};
        const userId = sender.split('@')[0];
        if (!global.cmDB[userId]) {
          global.cmDB[userId] = { spins: 0, coins: 0 };
        }
        global.cmDB[userId].spins = (global.cmDB[userId].spins || 0) + premio.cantidad;
        global.guardarCM();
        mensajePremio = `🎯 +${premio.cantidad} tiros en Coin Master`;
        recompensaAplicada = true;
        break;

      case 'creditos':
        if (!global.cmDB) global.cmDB = {};
        const cmUserId = sender.split('@')[0];
        if (!global.cmDB[cmUserId]) {
          global.cmDB[cmUserId] = { spins: 0, coins: 0 };
        }
        global.cmDB[cmUserId].coins = (global.cmDB[cmUserId].coins || 0) + premio.cantidad;
        global.guardarCM();
        mensajePremio = `💳 +${premio.cantidad} créditos en Coin Master`;
        recompensaAplicada = true;
        break;

      case 'diamantes':
        user.diamantes = (user.diamantes || 0) + premio.cantidad;
        mensajePremio = `💎 +${premio.cantidad} diamantes`;
        recompensaAplicada = true;
        break;

      case 'nada':
        mensajePremio = `🍫 Chocolate con hongos - No ganaste nada`;
        recompensaAplicada = true;
        break;

      case 'premio_especial':
        user.pandacoins = (user.pandacoins || 0) + 100000000000;
        user.diamantes = (user.diamantes || 0) + 100;
        if (!user.achievements) user.achievements = { titles: [], selectedTitle: null };
        const tituloNavidad = "🎄 Navideño";
        if (!user.achievements.titles.includes(tituloNavidad)) {
          user.achievements.titles.push(tituloNavidad);
        }
        mensajePremio = `✨ PREMIO ESPECIAL: 100B pandacoins + 100 diamantes + Título "🎄 Navideño"`;
        recompensaAplicada = true;
        break;
    }

    if (recompensaAplicada) {
      diasReclamados.push(diaSolicitado);
      usuario.diasReclamados = diasReclamados;
      usuario.ultimoReclamo = new Date().toISOString();

      guardarDatabase(db);

      let texto = `🎄 *¡Premio de Adviento Reclamado!* 🎁\n\n`;
      texto += `📅 Día: *${diaSolicitado} de Diciembre*\n`;
      texto += `${premio.mensaje}\n`;
      texto += `📦 Recompensa: ${mensajePremio}\n\n`;

      const totalReclamados = diasReclamados.length;
      texto += `📊 Progreso: ${totalReclamados}/24 días\n`;

      if (totalReclamados === 24) {
        texto += `🎉 ¡FELICIDADES! Has completado todo el calendario de adviento! ✨`;
      }

      await sock.sendMessage(from, { text: texto });
    } else {
      await sock.sendMessage(from, {
        text: `❌ Error al aplicar la recompensa del día ${diaSolicitado}.`
      });
    }

  } catch (error) {
    console.error('Error aplicando premio de adviento:', error);
    await sock.sendMessage(from, {
      text: `❌ Error técnico al procesar el premio del día ${diaSolicitado}.`
    });
  }
}

export async function adminAdviento(sock, msg, args) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const senderNumber = sender.split('@')[0];

  // CORREGIDO: Verificación simple como en el ejemplo
  const isOwner = ownerNumber.includes('+' + senderNumber);

  if (!isOwner) {
    await sock.sendMessage(from, {
      text: '❌ Solo los administradores pueden usar este comando.'
    }, { quoted: msg });
    return;
  }

  const db = cargarDatabase();

  if (!db.adviento) {
    await sock.sendMessage(from, {
      text: '❌ El sistema de adviento no está inicializado.'
    });
    return;
  }

  const usuarios = Object.keys(db.adviento.usuarios);
  const totalUsuarios = usuarios.length;
  let totalReclamaciones = 0;

  usuarios.forEach(userId => {
    totalReclamaciones += db.adviento.usuarios[userId].diasReclamados.length;
  });

  let texto = `📊 *ESTADÍSTICAS ADVIENTO - MODO PRUEBA* 🎄\n\n`;
  texto += `👥 Usuarios en prueba: ${totalUsuarios}\n`;
  texto += `🎁 Total reclamaciones: ${totalReclamaciones}\n\n`;

  texto += `🏆 Top participantes:\n`;

  const topUsuarios = usuarios
    .map(userId => ({
      userId,
      dias: db.adviento.usuarios[userId].diasReclamados.length
    }))
    .sort((a, b) => b.dias - a.dias)
    .slice(0, 5);

  if (topUsuarios.length > 0) {
    topUsuarios.forEach((user, index) => {
      const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🔹';
      texto += `${emoji} ${user.dias} días - @${user.userId.split('@')[0]}\n`;
    });
  } else {
    texto += `📝 Aún no hay participantes\n`;
  }

  await sock.sendMessage(from, {
    text: texto,
    mentions: topUsuarios.map(user => user.userId)
  });
}
