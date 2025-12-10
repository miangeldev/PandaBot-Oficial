import { cargarDatabase, guardarDatabase } from '../data/database.js';
import { isVip } from '../utils/vip.js';
import { trackRoboExitoso, trackRoboFallido, checkSpecialAchievements } from '../middleware/trackAchievements.js';
import { initializeAchievements } from '../data/achievementsDB.js';
import { ownerNumber } from '../config.js';
import { puedeRobar, puedeSerRobado, registrarRoboPrevenido } from '../plugins/afk.js';

const cooldowns = {};

export const command = 'robar';

export async function run(sock, msg, args) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const senderNumber = (msg.key.participant || msg.key.remoteJid).split('@')[0];
  const now = Date.now();
  const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos

  if (cooldowns[sender] && now - cooldowns[sender] < COOLDOWN_MS) {
    const restante = COOLDOWN_MS - (now - cooldowns[sender]);
    const minutos = Math.floor(restante / 60000);
    const segundos = Math.floor((restante % 60000) / 1000);
    await sock.sendMessage(from, {
      text: `⏳ Debes esperar *${minutos}m ${segundos}s* antes de volver a robar.`,
    }, { quoted: msg });
    return;
  }

  if (!puedeRobar(sender)) {
    return await sock.sendMessage(from, {
      text: `❌ No puedes robar mientras estás en modo AFK.\n\n` +
            `🔒 Tu protección AFK está activa.\n` +
            `💎 Para desactivar y poder robar: .afk off\n` +
            `📊 Ver tu estado: .afk estado`
    }, { quoted: msg });
  }

  let mencionado = null;
  
  if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
    mencionado = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
  }
  else if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
    const menciones = msg.message.extendedTextMessage.contextInfo.mentionedJid;
    if (menciones.length > 0) {
      mencionado = menciones[0];
    }
  }
  else if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
    const quotedParticipant = msg.message.extendedTextMessage.contextInfo.participant;
    if (quotedParticipant && quotedParticipant !== sender) {
      mencionado = quotedParticipant;
    }
  }
  else if (args.length > 0) {
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (mentionedJid) {
      mencionado = mentionedJid;
    }
  }

  if (!mencionado || mencionado === sender) {
    await sock.sendMessage(from, {
      text: `❌ Debes mencionar a alguien para robarle.\n\n💡 *Formas de usar:*\n1. .robar @usuario\n2. Responder a un mensaje con .robar\n3. .robar (mencionando en el texto)`,
    }, { quoted: msg });
    return;
  }

  if (!puedeSerRobado(mencionado)) {
    registrarRoboPrevenido(mencionado);
    
    return await sock.sendMessage(from, {
      text: `🛡️ *PROTECCIÓN AFK ACTIVA*\n\n` +
            `No puedes robar a @${mencionado.split('@')[0]} porque está en modo AFK.\n\n` +
            `🔒 *Protección VIP activa*\n` +
            `💰 Pandacoins protegidos\n` +
            `🎭 Personajes protegidos\n\n` +
            `💎 El modo AFK es una protección exclusiva para usuarios VIP.`,
      mentions: [mencionado]
    }, { quoted: msg });
  }

  const db = cargarDatabase();
  
  if (!db.users) db.users = {};
  
  if (!db.users[sender]) {
    db.users[sender] = { 
      pandacoins: 0,
      robos: { exitosos: 0, fallidos: 0 },
      achievements: {}
    };
  }
  
  if (!db.users[mencionado]) {
    db.users[mencionado] = { 
      pandacoins: 0,
      robos: { exitosos: 0, fallidos: 0 },
      achievements: {}
    };
  }

  if (!db.users[sender].achievements) {
    initializeAchievements(sender);
  }

  const atacante = db.users[sender];
  const victima = db.users[mencionado];

  if (!atacante.robos) {
    atacante.robos = { exitosos: 0, fallidos: 0 };
  }

  const esOwner = ownerNumber.includes('+' + senderNumber);
  const vip = isVip(sender);

  let probabilidadExito;
  if (esOwner) {
    probabilidadExito = 0.99;
  } else if (vip) {
    probabilidadExito = 0.7;
  } else {
    probabilidadExito = 0.5;
  }

  const resultado = Math.random() < probabilidadExito;

  const maximoRobo = Math.floor(victima.pandacoins * 0.10);
  const cantidad = Math.floor(Math.random() * maximoRobo) + 1;

  let texto = '';
  let robosExitososPrevios = atacante.robos.exitosos || 0;
  let robosFallidosPrevios = atacante.robos.fallidos || 0;
  let nuevoLogro = false;

  if (resultado) {
    const robado = Math.min(cantidad, victima.pandacoins);

    if (victima.pandacoins <= 0 || robado <= 0) {
      await sock.sendMessage(from, {
        text: `❌ @${mencionado.split('@')[0]} no tiene suficientes pandacoins para robar.`,
        mentions: [mencionado]
      }, { quoted: msg });
      return;
    }

    atacante.pandacoins += robado;
    victima.pandacoins -= robado;
    
    atacante.robos.exitosos = robosExitososPrevios + 1;

    texto = `🕵️‍♂️ *Robo exitoso*\n\n`;
    texto += `@${sender.split('@')[0]} robó *${robado.toLocaleString()} pandacoins* a @${mencionado.split('@')[0]}.\n`;
    texto += `💰 Máximo posible: ${maximoRobo.toLocaleString()} (10% del total)\n`;
    texto += `📊 Robos exitosos totales: ${atacante.robos.exitosos}\n`;

    if (esOwner) {
      texto += '👑 *OWNER DEL BOT* - 99% de probabilidad (prioridad máxima)\n';
    } else if (vip) {
      texto += '⭐ *USUARIO VIP* - 70% de probabilidad\n';
    } else {
      texto += '🎲 *Usuario normal* - 50% de probabilidad\n';
    }

    if (robosExitososPrevios === 0) {
      nuevoLogro = true;
    }
    
  } else {
    const maximoMulta = Math.floor(atacante.pandacoins * 0.1);
    const perdido = Math.floor(Math.random() * maximoMulta) + 1;

    atacante.pandacoins = Math.max(0, atacante.pandacoins - perdido);
    
    atacante.robos.fallidos = robosFallidosPrevios + 1;

    texto = `🚨 *Robo fallido*\n\n`;
    texto += `La policía atrapó a @${sender.split('@')[0]} intentando robar a @${mencionado.split('@')[0]}.\n`;
    texto += `💸 Multa: *${perdido.toLocaleString()} pandacoins*\n`;
    texto += `📊 Robos fallidos totales: ${atacante.robos.fallidos}\n`;

    if (esOwner) {
      texto += '👑 *OWNER DEL BOT* - Aunque tenías 99% de probabilidad, fuiste el 1% desafortunado\n';
    } else if (vip) {
      texto += '⭐ *USUARIO VIP* - 30% de probabilidad de fallar\n';
    } else {
      texto += '🎲 *Usuario normal* - 50% de probabilidad de fallar\n';
    }
  }

  guardarDatabase(db);
  
  cooldowns[sender] = now;

  await sock.sendMessage(from, {
    text: texto.trim(),
    mentions: [sender, mencionado],
  }, { quoted: msg });

  if (resultado && robosExitososPrevios === 0) {
    await sock.sendMessage(from, {
      text: `🎉 *¡LOGRO DESBLOQUEADO!*\n🏆 *Primer robo exitoso*\n✨ Has completado tu primer robo exitoso. ¡Sigue así!\n\n💎 Recompensa: +100 pandacoins`,
      mentions: [sender]
    });
    
    atacante.pandacoins += 100;
    guardarDatabase(db);
  }

  try {
    if (resultado) {
      trackRoboExitoso(sender, sock, from, atacante.robos.exitosos);
    } else {
      trackRoboFallido(sender, sock, from, atacante.robos.fallidos);
    }
  } catch (error) {
    console.log(`⚠️ Error en tracking de robos: ${error.message}`);
  }
}
