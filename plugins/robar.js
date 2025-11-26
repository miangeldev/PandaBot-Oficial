import { cargarDatabase, guardarDatabase } from '../data/database.js';
import { isVip } from '../utils/vip.js';
import { trackRoboExitoso, trackRoboFallido, checkSpecialAchievements } from '../middleware/trackAchievements.js';
import { initializeAchievements } from '../data/achievementsDB.js';
import { ownerNumber } from '../config.js';

const cooldowns = {};

export const command = 'robar';

export async function run(sock, msg, args) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const senderNumber = (msg.key.participant || msg.key.remoteJid).split('@')[0];
  const now = Date.now();
  const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos reducido

  if (cooldowns[sender] && now - cooldowns[sender] < COOLDOWN_MS) {
    const restante = COOLDOWN_MS - (now - cooldowns[sender]);
    const minutos = Math.floor(restante / 60000);
    const segundos = Math.floor((restante % 60000) / 1000);
    await sock.sendMessage(from, {
      text: `⏳ Debes esperar *${minutos}m ${segundos}s* antes de volver a robar.`,
    }, { quoted: msg });
    return;
  }

  const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
  const mencionado = msg.mentionedJid?.[0] || contextInfo?.mentionedJid?.[0];

  if (!mencionado || mencionado === sender) {
    await sock.sendMessage(from, {
      text: `❌ Especifica a quién le quieres robar usando una mención.`,
    }, { quoted: msg });
    return;
  }

  const db = cargarDatabase();
  db.users = db.users || {};
  db.users[sender] = db.users[sender] || { pandacoins: 0 };
  db.users[mencionado] = db.users[mencionado] || { pandacoins: 0 };
  
  // ✅ Inicializar achievements si no existen
  if (!db.users[sender].achievements) {
    initializeAchievements(sender);
  }

  const atacante = db.users[sender];
  const victima = db.users[mencionado];

  // ✅ CORREGIDO: Inicializar contador de robos SIN SOBREESCRIBIR
  if (!atacante.robos) {
    atacante.robos = { exitosos: 0, fallidos: 0 };
  }

  // Verificar si el atacante es el owner
  const esOwner = ownerNumber.includes('+' + senderNumber);
  const vip = isVip(sender);
  
  // Calcular probabilidad de éxito según el tipo de usuario
  let probabilidadExito;
  let tipoUsuario = '';
  
  if (esOwner) {
    probabilidadExito = 0.99; // 99% para owner
    tipoUsuario = 'OWNER';
  } else if (vip) {
    probabilidadExito = 0.7; // 70% para VIP
    tipoUsuario = 'VIP';
  } else {
    probabilidadExito = 0.5; // 50% para normal
    tipoUsuario = 'NORMAL';
  }

  const resultado = Math.random() < probabilidadExito;

  // Calcular cantidad a robar (hasta 10% del total de la víctima)
  const maximoRobo = Math.floor(victima.pandacoins * 0.10);
  const cantidad = Math.floor(Math.random() * maximoRobo) + 1;

  let texto = '';
  if (resultado) {
    const robado = Math.min(cantidad, victima.pandacoins);
    
    // Verificar que la víctima tenga suficientes pandacoins
    if (victima.pandacoins <= 0 || robado <= 0) {
      await sock.sendMessage(from, {
        text: `❌ @${mencionado.split('@')[0]} no tiene suficientes pandacoins para robar.`,
        mentions: [mencionado]
      }, { quoted: msg });
      return;
    }

    atacante.pandacoins += robado;
    victima.pandacoins -= robado;
    
    // ✅ CORREGIDO: Incrementar contador existente
    atacante.robos.exitosos = (atacante.robos.exitosos || 0) + 1;
    
    texto = `🕵️‍♂️ *Robo exitoso*\n\n`;
    texto += `@${sender.split('@')[0]} robó *${robado.toLocaleString()} pandacoins* a @${mencionado.split('@')[0]}.\n`;
    texto += `💰 Máximo posible: ${maximoRobo.toLocaleString()} (10% del total)\n`;
    texto += `📊 Robos exitosos: ${atacante.robos.exitosos}\n`;
    
    if (esOwner) {
      texto += '👑 *OWNER DEL BOT* - 99% de probabilidad (prioridad máxima)\n';
    } else if (vip) {
      texto += '⭐ *USUARIO VIP* - 70% de probabilidad\n';
    } else {
      texto += '🎲 *Usuario normal* - 50% de probabilidad\n';
    }
    
    // ✅ Trackear robo exitoso
    trackRoboExitoso(sender, sock, from);
  } else {
    // Calcular multa (hasta 5% de los pandacoins del atacante)
    const maximoMulta = Math.floor(atacante.pandacoins * 0.05);
    const perdido = Math.floor(Math.random() * maximoMulta) + 1;
    
    atacante.pandacoins = Math.max(0, atacante.pandacoins - perdido);
    
    // ✅ CORREGIDO: Incrementar contador existente
    atacante.robos.fallidos = (atacante.robos.fallidos || 0) + 1;
    
    texto = `🚨 *Robo fallido*\n\n`;
    texto += `La policía atrapó a @${sender.split('@')[0]} intentando robar a @${mencionado.split('@')[0]}.\n`;
    texto += `💸 Multa: *${perdido.toLocaleString()} pandacoins*\n`;
    texto += `📊 Robos fallidos: ${atacante.robos.fallidos}\n`;
    
    if (esOwner) {
      texto += '👑 *OWNER DEL BOT* - Aunque tenías 99% de probabilidad, fuiste el 1% desafortunado\n';
    } else if (vip) {
      texto += '⭐ *USUARIO VIP* - 30% de probabilidad de fallar\n';
    } else {
      texto += '🎲 *Usuario normal* - 50% de probabilidad de fallar\n';
    }
    
    // ✅ Trackear robo fallido
    trackRoboFallido(sender, sock, from);
  }

  guardarDatabase(db);
  cooldowns[sender] = now;

  await sock.sendMessage(from, {
    text: texto.trim(),
    mentions: [sender, mencionado],
  }, { quoted: msg });

  // ✅ Verificar logros especiales
  checkSpecialAchievements(sender, sock, from);
}