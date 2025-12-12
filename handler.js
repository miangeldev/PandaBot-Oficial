import chalk from 'chalk';
import { cargarDatabase, guardarDatabase } from './data/database.js';
import { DateTime } from 'luxon';
import fs from 'fs';
import path from 'path';
import { prefix, ownerNumber } from './config.js';
import { trackCommand } from './middleware/trackAchievements.js';
import { initializeAchievements } from './data/achievementsDB.js';

// ⚡ NUEVO: Importar función para desactivar AFK automáticamente
import { desactivarAFKAutomatico } from './plugins/afk.js';

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.timestamps = new Map();
  }

  set(key, value, ttl = 5000) {
    this.cache.set(key, value);
    this.timestamps.set(key, Date.now() + ttl);
  }

  get(key) {
    const timestamp = this.timestamps.get(key);
    if (timestamp && Date.now() > timestamp) {
      this.delete(key);
      return null;
    }
    return this.cache.get(key);
  }

  delete(key) {
    this.cache.delete(key);
    this.timestamps.delete(key);
  }

  clear() {
    this.cache.clear();
    this.timestamps.clear();
  }
}

const cache = new CacheManager();

const pluginsMap = new Map();
const aliasMap = new Map();

async function loadPlugins() {
  console.log(chalk.yellow('📦 CARGANDO PLUGINS...'));

  const pluginsPath = path.join(process.cwd(), 'plugins');
  const files = fs.readdirSync(pluginsPath).filter(f => f.endsWith('.js'));

  let loaded = 0;
  let errors = [];

  const loadPromises = files.map(async (file) => {
    try {
      const filePath = `./plugins/${file}`;
      const plugin = await import(filePath);

      if (plugin.command) {
        pluginsMap.set(plugin.command.toLowerCase(), plugin);
        loaded++;

        if (plugin.aliases) {
          for (const alias of plugin.aliases) {
            aliasMap.set(alias.toLowerCase(), plugin.command.toLowerCase());
          }
        }

        console.log(chalk.green(`✅ ${file}`));
      }
    } catch (error) {
      errors.push({ file, error: error.message });
      console.error(chalk.red(`❌ ${file}: ${error.message}`));
    }
  });

  await Promise.allSettled(loadPromises);

  console.log(chalk.yellow(`\n📊 RESUMEN: ${loaded} plugins cargados, ${errors.length} errores`));
}

await loadPlugins();

function getConfig() {
  const cached = cache.get('config');
  if (cached) return cached;

  const configPath = './config.json';
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  cache.set('config', config, 10000);
  return config;
}

function getBlockedWords() {
  const cached = cache.get('blockedWords');
  if (cached) return cached;

  const blockedWordsPath = path.resolve('./data/blockedWords.json');
  if (!fs.existsSync(blockedWordsPath)) {
    cache.set('blockedWords', {}, 5000);
    return {};
  }

  const data = JSON.parse(fs.readFileSync(blockedWordsPath, 'utf8'));
  cache.set('blockedWords', data, 5000);
  return data;
}

function getAfkData() {
  const cached = cache.get('afkData');
  if (cached) return cached;

  const afkFile = './data/afk.json';
  if (!fs.existsSync(afkFile)) {
    cache.set('afkData', {}, 3000);
    return {};
  }

  const data = JSON.parse(fs.readFileSync(afkFile, 'utf8'));
  cache.set('afkData', data, 3000);
  return data;
}

function getMuteados() {
  const cached = cache.get('muteados');
  if (cached) return cached;

  const muteadosFile = './data/muteados.json';
  if (!fs.existsSync(muteadosFile)) {
    fs.writeFileSync(muteadosFile, '{}');
    cache.set('muteados', {}, 3000);
    return {};
  }

  const data = JSON.parse(fs.readFileSync(muteadosFile, 'utf8'));
  cache.set('muteados', data, 3000);
  return data;
}

function normalizeNumber(raw) {
  return raw.split('@')[0].replace(/[^\d+]/g, '');
}

function extractMessageBody(msg) {
  if (msg.message?.conversation) return msg.message.conversation;
  if (msg.message?.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
  if (msg.message?.imageMessage?.caption) return msg.message.imageMessage.caption;
  if (msg.message?.videoMessage?.caption) return msg.message.videoMessage.caption;
  return '';
}

const userCooldowns = new Map();
const COMMAND_COOLDOWN = 1000;

function checkCooldown(sender) {
  const now = Date.now();
  const lastCommand = userCooldowns.get(sender);

  if (lastCommand && (now - lastCommand) < COMMAND_COOLDOWN) {
    return false;
  }

  userCooldowns.set(sender, now);
  return true;
}

export async function handleMessage(sock, msg) {
  if (msg.key.fromMe) return;

  const body = extractMessageBody(msg);
  if (!body) return;

  const from = msg.key.remoteJid;
  const isGroup = from.endsWith('@g.us');
  const sender = msg.key.participant || msg.key.remoteJid;
  const senderNumber = normalizeNumber(sender);

  // ⚡ NUEVO: Desactivar AFK automáticamente si el usuario envía mensaje
  try {
    const fueDesactivado = await desactivarAFKAutomatico(sender, from, sock);
    if (fueDesactivado) {
      console.log(chalk.cyan(`🔄 AFK desactivado automáticamente para ${senderNumber}`));
    }
  } catch (error) {
    console.error(chalk.yellow('⚠️ Error al verificar AFK:'), error.message);
  }

  const db = cargarDatabase();
  db.users = db.users || {};
  db.bannedUsers = db.bannedUsers || [];

  if (db.bannedUsers.includes(sender)) {
    console.log(chalk.red(`🚫 Baneado: ${senderNumber}`));
    return;
  }

  const isCommand = body.startsWith(prefix);
  if (!isCommand) {
    return;
  }

  if (!checkCooldown(sender)) {
    console.log(chalk.yellow(`⏰ Ratelimit: ${senderNumber}`));
    return;
  }

  if (isGroup) {
    const muteados = getMuteados();
    if (muteados[from]?.includes(sender)) {
      await sock.sendMessage(from, { delete: msg.key }).catch(() => {});
      return;
    }
  }

  const config = getConfig();
  config.global = config.global || {
    modoowner: false,
    grupos: true,
    chatsprivados: true,
    ownerNumber
  };

  const isOwner = ownerNumber.includes(`+${senderNumber}`);

  if (config.global.modoowner && !isOwner) return;
  if (isGroup && !config.global.grupos) return;
  if (!isGroup && !config.global.chatsprivados) return;

  const args = body.slice(prefix.length).trim().split(/\s+/);
  const cmdName = args.shift().toLowerCase();

  let plugin = pluginsMap.get(cmdName) || pluginsMap.get(aliasMap.get(cmdName));

  if (!plugin) {
    console.log(chalk.yellow(`❓ Comando no encontrado: ${cmdName}`));
    return;
  }

  const groupName = isGroup ? 'Grupo' : 'Privado';
  const senderName = msg.pushName || senderNumber;

  console.log(chalk.gray('⚡ '), chalk.cyan(senderName), chalk.gray('->'), chalk.yellow(cmdName));

  try {
    await plugin.run(sock, msg, args);

    trackCommand(sender, sock, from);

  } catch (error) {
    console.error(chalk.red(`❌ Error en ${cmdName}:`), error.message);

    if (isOwner) {
      sock.sendMessage('120363421024393324@g.us', {
        text: `❌ Error en ${cmdName} por ${senderNumber}:\n${error.message}`
      }).catch(() => {});
    }
  }
}

export async function handleOtherEvents(sock, event) {
  switch (event.type) {
    case 'react':
      break;
    case 'group-participants-update':
      break;
    default:
      break;
  }
}

export async function reloadPlugins() {
  pluginsMap.clear();
  aliasMap.clear();
  cache.clear();
  userCooldowns.clear();

  await loadPlugins();
  console.log(chalk.green('✅ Plugins recargados y cache limpiado'));
}

export function clearCache() {
  cache.clear();
  userCooldowns.clear();
  console.log(chalk.green('✅ Cache limpiado'));
}

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of userCooldowns.entries()) {
    if (now - timestamp > 3600000) {
      userCooldowns.delete(key);
    }
  }
}, 60000);
