import { reiniciarStock } from './plugins/addstock.js';
import { migrarStockPlano } from './plugins/addstock.js';
migrarStockPlano();

global.psSpawn = {
  activo: false,
  personaje: null,
  grupo: '120363402403091432@g.us',
  reclamadoPor: null
};

import { limpiarPersonajes } from "./limpiarPersonajes.js";
import baileys from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import { handleMessage } from './handler.js';
import readline from 'readline';
import chalk from 'chalk';
import NodeCache from 'node-cache';
import pino from 'pino';
import { cargarDatabase, guardarDatabase } from './data/database.js';
import { createDatabaseBackup } from './tools/createBackup.js';
import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  jidNormalizedUser,
  makeCacheableSignalKeyStore
} from "@whiskeysockets/baileys";

// ============================================
// SISTEMA DE PROTECCIÓN CONTRA MUCHAS SOLICITUDES
// ============================================

// Rate Limiting global
global.rateLimit = new Map();
global.MAX_REQUESTS_PER_MINUTE = 100; // Límite por usuario por minuto
global.MAX_MESSAGES_PER_SECOND = 50; // Límite global por segundo

// Sistema de cola para mensajes
global.messageQueue = [];
global.processingQueue = false;

// Contador de mensajes por segundo
let messagesThisSecond = 0;
setInterval(() => {
  messagesThisSecond = 0;
}, 1000);

// Función para verificar rate limiting
function checkRateLimit(userId) {
  const now = Date.now();
  const userRequests = global.rateLimit.get(userId) || [];
  
  // Limpiar requests antiguos (más de 1 minuto)
  const recentRequests = userRequests.filter(time => now - time < 60000);
  
  if (recentRequests.length >= global.MAX_REQUESTS_PER_MINUTE) {
    return false;
  }
  
  recentRequests.push(now);
  global.rateLimit.set(userId, recentRequests);
  return true;
}

// Función para procesar cola de mensajes de forma segura
async function processMessageQueue(sock) {
  if (global.processingQueue || global.messageQueue.length === 0) return;
  
  global.processingQueue = true;
  
  try {
    // Procesar máximo 10 mensajes por lote
    const batch = global.messageQueue.splice(0, Math.min(10, global.messageQueue.length));
    
    for (const { msg, type } of batch) {
      if (messagesThisSecond >= global.MAX_MESSAGES_PER_SECOND) {
        // Si excedemos el límite, reintentar más tarde
        global.messageQueue.unshift({ msg, type });
        await new Promise(resolve => setTimeout(resolve, 100));
        break;
      }
      
      try {
        if (type === 'group-participants.update') {
          await handleGroupUpdate(sock, msg);
        } else if (type === 'messages.upsert') {
          await handleMessagesUpsert(sock, msg);
        }
        messagesThisSecond++;
      } catch (error) {
        console.error('❌ Error procesando mensaje de la cola:', error);
      }
    }
  } catch (error) {
    console.error('❌ Error en processMessageQueue:', error);
  } finally {
    global.processingQueue = false;
    
    // Si aún hay mensajes en cola, procesar siguiente lote
    if (global.messageQueue.length > 0) {
      setTimeout(() => processMessageQueue(sock), 50);
    }
  }
}

// Función segura para manejar actualizaciones de grupo
async function handleGroupUpdate(sock, update) {
  try {
    const { id, participants, action } = update;
    let texto = '';

    if (action === 'add') {
      texto = `
👋 Bienvenido @${participants[0].split('@')[0]} al grupo!

Recuerda leer la descripción del grupo, si quieres usar al bot envía *.menu* o *.help* para ver los comandos totales.
`;
    } else if (action === 'remove') {
      texto = `@${participants[0].split('@')[0]} Salió del grupo. 👎`;
    } else if (action === 'promote') {
      texto = `🎉 @${participants[0].split('@')[0]} ahora es admin del grupo.`;
    } else if (action === 'demote') {
      texto = `⚠️ @${participants[0].split('@')[0]} ha sido removido como admin.`;
    }

    if (texto) {
      await sock.sendMessage(id, { 
        text: texto, 
        mentions: participants 
      });
    }
  } catch (error) {
    console.error('❌ Error en handleGroupUpdate:', error);
  }
}

// Función segura para manejar mensajes
async function handleMessagesUpsert(sock, { messages, type }) {
  if (type !== 'notify') return;

  for (const msg of messages) {
    if (!msg.message) continue;

    try {
      // Rate limiting por usuario
      const userId = msg.key.participant || msg.key.remoteJid;
      if (!checkRateLimit(userId)) {
        console.log(`⏰ Rate limit excedido para usuario: ${userId}`);
        continue;
      }

      await handleMessage(sock, msg);
    } catch (e) {
      console.error('❌ Error en handleMessage:', e);
    }
  }
}

// ============================================
// CONFIGURACIÓN INICIAL
// ============================================

global.cmDB = JSON.parse(fs.readFileSync('./coinmaster.json'));
global.guardarCM = () => {
  try {
    fs.writeFileSync('./coinmaster.json', JSON.stringify(global.cmDB, null, 2));
  } catch (error) {
    console.error('❌ Error guardando coinmaster:', error);
  }
};

global.recolectarCooldown = {};

// Logs pandabot con protección
global.terminalLogs = [];
const logLimit = 20;
const originalConsoleLog = console.log;
console.log = (...args) => {
  try {
    const message = args.join(' ');
    originalConsoleLog.apply(console, args);
    if (message.includes('.buy')) {
      global.terminalLogs.push(message);
      if (global.terminalLogs.length > logLimit) {
        global.terminalLogs.shift();
      }
    }
  } catch (error) {
    originalConsoleLog('❌ Error en console.log personalizado:', error);
  }
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (texto) => new Promise((resolver) => rl.question(texto, resolver));

// Limpieza con manejo de errores
import fs from 'fs';
try {
  const resultado = limpiarPersonajes("./data/personajes.json");
  console.log("Personajes únicos:", resultado.length);
} catch (error) {
  console.error('❌ Error en limpiarPersonajes:', error);
}

// Configuración
const msgRetryCounterCache = new NodeCache();
const sessions = 'auth_info';
const nameqr = 'PandaBot';
const methodCodeQR = process.argv.includes("qr");
const methodCode = process.argv.includes("code");
let startupBackupCreated = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

function ensureStartupBackup() {
  if (startupBackupCreated) return;
  try {
    const { backupPath } = createDatabaseBackup({
      filenameFormatter: (timestamp) => `backup_startup(${timestamp}).json`,
      filenamePrefix: 'backup',
      maxBackups: 10
    });
    console.log(`📦 Backup inicial creado: ${backupPath}`);
  } catch (error) {
    console.error('❌ No se pudo crear el backup inicial:', error.message);
  } finally {
    startupBackupCreated = true;
  }
}

// Función de reconexión con backoff exponencial
async function delayedReconnect(attempt) {
  const delay = Math.min(1000 * Math.pow(2, attempt), 30000); // Máximo 30 segundos
  console.log(chalk.bold.yellowBright(`🔄 Reconectando en ${delay/1000} segundos... (Intento ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS})`));
  
  await new Promise(resolve => setTimeout(resolve, delay));
  await startBot();
}

async function startBot() {
  try {
    ensureStartupBackup();
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(sessions);

    const auth = {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' })),
    };

    // ============================================
    // DETERMINAR MÉTODO DE CONEXIÓN
    // ============================================
    let connectionMethod = 'qr';

    if (methodCode) {
      connectionMethod = 'code';
    } else if (!fs.existsSync(`./${sessions}/creds.json`)) {
      console.log(chalk.bold.magentaBright(`\n⌨ Selecciona una opción:`));
      console.log(chalk.bold.greenBright(`1. Con código QR`));
      console.log(chalk.bold.cyanBright(`2. Con código de texto de 8 dígitos`));
      
      try {
        const choice = await question(chalk.bold.yellowBright(`--> `));
        connectionMethod = choice === '2' ? 'code' : 'qr';
      } catch (error) {
        console.error('❌ Error en selección de método:', error);
        connectionMethod = 'qr'; // Fallback a QR
      }
    }

    // ============================================
    // CREAR SOCKET CON MÁS CONFIGURACIONES SEGURAS
    // ============================================
    const sock = makeWASocket({
      version,
      auth,
      printQRInTerminal: connectionMethod === 'qr',
      browser: connectionMethod === 'qr'
        ? [nameqr, 'Chrome', '20.0.04']
        : ['Ubuntu', 'Edge', '110.0.1587.56'],
      msgRetryCounterCache,
      logger: pino({ level: 'silent' }), // Reducir logs para mejor performance
      markOnlineOnConnect: false, // Mejorar performance
      syncFullHistory: false, // No sincronizar historial completo
      transactionOpts: {
        maxCommitRetries: 3,
        delayBetweenTries: 1000
      },
      getMessage: async (clave) => {
        try {
          let jid = jidNormalizedUser(clave.remoteJid);
          let msg = await store.loadMessage(jid, clave.id);
          return msg?.message || "";
        } catch (error) {
          console.error('❌ Error en getMessage:', error);
          return "";
        }
      },
    });

    globalThis.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    // ============================================
    // EVENTOS CON PROTECCIÓN
    // ============================================

    // Eventos de grupo con cola
    sock.ev.on('group-participants.update', async (update) => {
      global.messageQueue.push({ msg: update, type: 'group-participants.update' });
      processMessageQueue(sock);
    });

    // Mensajes con cola y rate limiting
    sock.ev.on('messages.upsert', async (data) => {
      global.messageQueue.push({ msg: data, type: 'messages.upsert' });
      processMessageQueue(sock);
    });

    // ============================================
    // CONEXIÓN MEJORADA CON RECONEXIÓN INTELIGENTE
    // ============================================
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      try {
        // ✅ Mostrar QR si es necesario
        if (qr && connectionMethod === 'qr') {
          console.log(chalk.bold.yellowBright('\n📱 Escanea este QR para vincular el bot:\n'));
          qrcode.generate(qr, { small: true });
        }

        // ✅ PEDIR PAIRING CODE AQUÍ (antes de conectarse completamente)
        if (connection === 'connecting' && connectionMethod === 'code') {
          await new Promise(resolve => setTimeout(resolve, 1000));

          if (!sock.authState.creds.registered) {
            console.log(chalk.bold.cyanBright('\n🔐 Modo de emparejamiento con código'));
            
            try {
              const phoneNumber = await question(chalk.bold.magentaBright(`\n📱 Ingresa tu número (ej: 56912345678)\n--> `));

              if (phoneNumber && phoneNumber.replace(/\D/g, '').length >= 10) {
                const code = await sock.requestPairingCode(phoneNumber.replace(/\D/g, ''));
                console.log(chalk.bold.white(chalk.bgMagenta(`\n✞ CÓDIGO DE VINCULACIÓN ✞ `)), chalk.bold.white(code));
                console.log(chalk.bold.yellowBright(`\n📲 Ingresa este código en WhatsApp -> Dispositivos vinculados -> Vincular dispositivo`));
              } else {
                console.log(chalk.bold.redBright(`❌ Número de teléfono inválido.`));
              }
            } catch (error) {
              console.log(chalk.bold.redBright(`❌ Error al solicitar código: ${error.message}`));
            }
          }
        }

        // ✅ Conexión establecida
        if (connection === 'open') {
          console.log(chalk.bold.greenBright('\n✅ Bot conectado correctamente!'));
          console.log(chalk.bold.cyanBright(`📱 Dispositivo: ${sock.user.id}`));
          console.log(chalk.bold.yellowBright(`🤖 Bot listo para recibir comandos\n`));
          
          reconnectAttempts = 0; // Resetear contador de reconexiones

          // Iniciar sistemas con manejo de errores
          try {
            setInterval(() => {
              try {
                reiniciarStock();
              } catch (error) {
                console.error('❌ Error en reiniciarStock:', error);
              }
            }, 60 * 1000);

            const db = cargarDatabase();
            setInterval(() => {
              try {
                iniciarSistemaBossAutomatico(db);
              } catch (error) {
                console.error('❌ Error en iniciarSistemaBossAutomatico:', error);
              }
            }, 60 * 60 * 1000);
          } catch (error) {
            console.error('❌ Error iniciando sistemas automáticos:', error);
          }
        }

        // ⚠️ Conexión cerrada
        if (connection === 'close') {
          const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.log(chalk.bold.yellowBright('⚠️ Conexión cerrada'));
          console.log(chalk.bold.cyanBright(`Código: ${statusCode}`));
          console.log(chalk.bold.magentaBright(`Reconectar: ${shouldReconnect}`));

          if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            await delayedReconnect(reconnectAttempts);
          } else {
            console.log(chalk.bold.redBright('❌ Bot deslogueado. Borra la carpeta auth_info y vuelve a iniciar.'));
            process.exit(1);
          }
        }
      } catch (error) {
        console.error('❌ Error en connection.update:', error);
      }
    });

  } catch (error) {
    console.error('❌ Error crítico en startBot:', error);
    
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      await delayedReconnect(reconnectAttempts);
    } else {
      console.log(chalk.bold.redBright('❌ Máximo número de intentos de reconexión alcanzado.'));
      process.exit(1);
    }
  }
}

// ============================================
// MANEJO DE ERRORES GLOBALES
// ============================================

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// ============================================
// INICIAR BOT
// ============================================
console.log(chalk.bold.magentaBright(`
╔═══════════════════════════════════════╗
║                                       ║
║         🐼 PANDABOT INICIANDO 🐼      ║
║          🔒 CON PROTECCIÓN 🔒         ║
║                                       ║
╚═══════════════════════════════════════╝
`));

startBot();
