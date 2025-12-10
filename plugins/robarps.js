import fs from 'fs';
import { ownerNumber } from '../config.js';
import { cargarDatabase, guardarDatabase } from '../data/database.js';
import { puedeRobar, puedeSerRobado, registrarRoboPrevenido } from '../plugins/afk.js';

const data = JSON.parse(fs.readFileSync('./data/personajes.json', 'utf8'));
const personajes = data.characters;

export const command = 'robarps';

export async function run(sock, msg, args) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const senderId = sender.split('@')[0];
  const esOwner = ownerNumber.includes(`+${senderId}`);

  if (!puedeRobar(sender)) {
    return await sock.sendMessage(from, {
      text: `❌ No puedes robar personajes mientras estás en modo AFK.\n\n` +
            `🔒 Tu protección AFK está activa.\n` +
            `💎 Para desactivar: .afk off\n` +
            `📊 Ver tu estado: .afk estado`
    }, { quoted: msg });
  }

  const db = cargarDatabase();
  db.users = db.users || {};
  const user = db.users[sender];

  if (!user) {
    await sock.sendMessage(from, { text: '❌ No estás registrado. Usa .minar primero.' });
    return;
  }

  const now = Date.now();
  const cooldown = 2 * 60 * 1000;
  user.robarpsCooldown = user.robarpsCooldown || 0;

  if (now - user.robarpsCooldown < cooldown) {
    const restante = cooldown - (now - user.robarpsCooldown);
    const minutos = Math.floor(restante / 60000);
    const segundos = Math.floor((restante % 60000) / 1000);
    await sock.sendMessage(from, {
      text: `⏳ Debes esperar *${minutos}m ${segundos}s* para volver a usar este comando.`
    });
    return;
  }

  if (!args.length) {
    await sock.sendMessage(from, { text: '❌ Usa `.robarps lista` o `.robarps @usuario`' });
    return;
  }

  let success = false;
  let robado = null;
  let mencionado = null;

  if (args[0].toLowerCase() === 'lista') {
    const chance = Math.random();
    const probabilidad = esOwner ? 0.8 : 0.5;

    if (chance <= probabilidad) {
      const randomPersonaje = personajes[Math.floor(Math.random() * personajes.length)];
      user.personajes = user.personajes || [];

      if (!user.personajes.includes(randomPersonaje.nombre)) {
        user.personajes.push(randomPersonaje.nombre);
        robado = randomPersonaje.nombre;
        success = true;
      }
    }
  } else {
    mencionado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mencionado) {
      await sock.sendMessage(from, { text: '❌ Debes mencionar al usuario al que quieres robar.' });
      return;
    }

    if (!puedeSerRobado(mencionado)) {
      registrarRoboPrevenido(mencionado);
      
      return await sock.sendMessage(from, {
        text: `🛡️ *PROTECCIÓN AFK ACTIVA*\n\n` +
              `No puedes robar personajes a @${mencionado.split('@')[0]} porque está en modo AFK.\n\n` +
              `🔒 *Protección VIP activa*\n` +
              `🎭 Personajes protegidos\n` +
              `💰 Pandacoins protegidos\n\n` +
              `💎 El modo AFK es una protección exclusiva para usuarios VIP.`,
        mentions: [mencionado]
      }, { quoted: msg });
    }

    const target = db.users[mencionado];
    if (!target || !target.personajes || target.personajes.length === 0) {
      await sock.sendMessage(from, { text: '❌ El usuario mencionado no tiene personajes para robar.' });
      return;
    }

    const chance = Math.random();
    const probabilidad = esOwner ? 0.8 : 0.3;

    if (chance <= probabilidad) {
      const randomIndex = Math.floor(Math.random() * target.personajes.length);
      const personajeRobado = target.personajes[randomIndex];

      target.personajes.splice(randomIndex, 1);

      const posiciones = target.alineacion?.posiciones || {};
      for (const pos in posiciones) {
        if (posiciones[pos] === personajeRobado) {
          delete posiciones[pos];
        }
      }

      user.personajes = user.personajes || [];
      user.personajes.push(personajeRobado);
      robado = personajeRobado;
      success = true;
    }
  }

  user.robarpsCooldown = now;
  guardarDatabase(db);

  if (success) {
    if (args[0].toLowerCase() === 'lista') {
      await sock.sendMessage(from, { text: `✅ ¡Robaste con éxito a *${robado}* de la lista global!` });
    } else {
      await sock.sendMessage(from, { 
        text: `✅ ¡Robaste con éxito a *${robado}* de @${mencionado.split('@')[0]}!`,
        mentions: [mencionado]
      });
    }
  } else {
    if (args[0].toLowerCase() === 'lista') {
      await sock.sendMessage(from, { text: '❌ El robo de la lista global falló. Mejor suerte la próxima vez.' });
    } else {
      await sock.sendMessage(from, { 
        text: `❌ El robo a @${mencionado.split('@')[0]} falló. Mejor suerte la próxima vez.`,
        mentions: [mencionado]
      });
    }
  }
}
