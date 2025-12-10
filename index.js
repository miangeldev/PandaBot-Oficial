import { reiniciarStock } from './plugins/addstock.js';
import { migrarStockPlano } from './plugins/addstock.js';
import { limpiarPersonajes } from "./limpiarPersonajes.js";
import qrcode from "qrcode-terminal";
import { handleMessage } from './handler.js';
import chalk from 'chalk';
import NodeCache from 'node-cache';
import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeCacheableSignalKeyStore
} from "@whiskeysockets/baileys";
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

process.env.PINO_LOG_LEVEL = 'silent';
process.env.PINO_LEVEL = 'silent';
process.env.BAILEYS_LOG_LEVEL = 'silent';

const streamOriginal = process.stdout.write;
const streamErrorOriginal = process.stderr.write;

const filtrosLogs = [
  'Closing session: SessionEntry',
  'Closing stale open session',
  'SessionEntry {',
  '_chains:',
  'registrationId:',
  'ephemeralKeyPair:',
  'currentRatchet:',
  'indexInfo:',
  'pendingPreKey:',
  'lastRemoteEphemeralKey',
  'previousCounter:',
  'rootKey:',
  'baseKey:',
  'closed:',
  'used:',
  'created:',
  'remoteIdentityKey:',
  'signedKeyId:',
  'preKeyId:',
  'chainKey:',
  'chainType:',
  'messageKeys:',
  'pubKey: <Buffer',
  'privKey: <Buffer'
];

process.stdout.write = function(chunk, encoding, callback) {
  const texto = chunk.toString();
  
  if (filtrosLogs.some(filtro => texto.includes(filtro))) {
    if (callback) callback();
    return true;
  }
  
  if (texto.includes('0|bot  |')) {
    const contenido = texto.replace('0|bot  |', '').trim();
    
    if (filtrosLogs.some(filtro => contenido.includes(filtro))) {
      if (callback) callback();
      return true;
    }
    
    if (contenido.includes('💾') || contenido.includes('🧹') || contenido.includes('🔄')) {
      const hora = new Date().toLocaleTimeString();
      const mensajeLimpio = contenido.replace(/-\s*\d+:\d+:\d+\s*(AM|PM)/, `- ${hora}`);
      const resultado = `0|bot  | ${mensajeLimpio}\n`;
      return streamOriginal.call(process.stdout, resultado, encoding, callback);
    }
  }
  
  return streamOriginal.call(process.stdout, chunk, encoding, callback);
};

process.stderr.write = function(chunk, encoding, callback) {
  const texto = chunk.toString();
  
  if (filtrosLogs.some(filtro => texto.includes(filtro))) {
    if (callback) callback();
    return true;
  }
  
  if (texto.includes('0|bot  |')) {
    const contenido = texto.replace('0|bot  |', '').trim();
    
    if (filtrosLogs.some(filtro => contenido.includes(filtro))) {
      if (callback) callback();
      return true;
    }
  }
  
  return streamErrorOriginal.call(process.stderr, chunk, encoding, callback);
};

const loggerMock = {
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  child: () => loggerMock,
  level: 'silent',
  isLevelEnabled: () => false,
  getLevel: () => 100,
  silent: () => {}
};

const loggerBaileys = {
  ...loggerMock,
  error: (msg, ...args) => {
    if (typeof msg === 'string') {
      if (msg.includes('Failed to connect') || 
          msg.includes('Connection closed') ||
          msg.includes('Authentication failed')) {
        console.log(chalk.red('❌ Error crítico:'), msg);
      }
    }
  }
};

console.clear();
console.log(chalk.magenta(`
╔══════════════════════════════════╗
║        🐼 PANDABOT 🐼            ║
║     📱 Reconexión Segura         ║
╚══════════════════════════════════╝
`));

global.psSpawn = {
  activo: false,
  personaje: null,
  grupo: '120363402403091432@g.us',
  reclamadoPor: null
};

global.cache = new NodeCache({
  stdTTL: 300,
  checkperiod: 120,
  maxKeys: 100
});

try {
  const coinmasterPath = join(__dirname, 'coinmaster.json');
  if (fs.existsSync(coinmasterPath)) {
    global.cmDB = JSON.parse(fs.readFileSync(coinmasterPath, 'utf8'));
    console.log(chalk.green('✅ Coinmaster cargado'));
  } else {
    global.cmDB = {};
    console.log(chalk.yellow('⚠️  Coinmaster no encontrado, creando nuevo'));
  }
} catch (error) {
  global.cmDB = {};
  console.log(chalk.red('❌ Error cargando coinmaster:'), error.message);
}

global.guardarCM = () => {
  try {
    const coinmasterPath = join(__dirname, 'coinmaster.json');
    fs.writeFileSync(coinmasterPath, JSON.stringify(global.cmDB, null, 2));
  } catch (error) {
    console.log(chalk.red('❌ Error guardando coinmaster:'), error.message);
  }
};

global.recolectarCooldown = {};

let lastQR = '';

function displayQR(qr) {
  if (qr !== lastQR) {
    lastQR = qr;
    console.clear();
    console.log(chalk.magenta(`
╔══════════════════════════════════╗
║        🐼 PANDABOT 🐼            ║
║     📱 ESCANEA EL QR CODE       ║
╚══════════════════════════════════╝
`));
    console.log(chalk.yellow('📱 ESCANEA ESTE CÓDIGO QR CON WHATSAPP:'));
    console.log(chalk.yellow('⏰ Tienes 60 segundos para escanearlo\n'));
    qrcode.generate(qr, { small: true });
    console.log(chalk.cyan('\n📱 PASOS PARA ESCANEAR:'));
    console.log(chalk.cyan('1. Abre WhatsApp en tu teléfono'));
    console.log(chalk.cyan('2. Toca los 3 puntos (⋮) > Dispositivos vinculados'));
    console.log(chalk.cyan('3. Toca "Vincular un dispositivo"'));
    console.log(chalk.cyan('4. Escanea el código QR mostrado arriba'));
    console.log(chalk.cyan('\n🔗 También puedes usar WhatsApp Web:'));
    console.log(chalk.cyan('   web.whatsapp.com → ⋮ → Vincular dispositivo'));
  }
}

function logMessage(type, message, data = null) {
  const timestamp = new Date().toLocaleTimeString();
  const colors = {
    success: chalk.green,
    error: chalk.red,
    info: chalk.cyan,
    warning: chalk.yellow,
    event: chalk.magenta,
    message: chalk.blue
  };
  if (type === 'message') {
    const from = data?.from || 'Desconocido';
    const text = message.length > 50 ? message.substring(0, 47) + '...' : message;
    console.log(`${chalk.gray(timestamp)} ${chalk.blue('📱')} ${chalk.yellow(from.split('@')[0])}: ${text}`);
  } else if (colors[type]) {
    console.log(`${chalk.gray(timestamp)} ${colors[type](message)}`);
  }
}

async function connectWhatsApp() {
  const sessions = join(__dirname, 'auth_info');
  if (!fs.existsSync(sessions)) {
    fs.mkdirSync(sessions, { recursive: true });
  }
  try {
    console.log(chalk.blue('🔄 Iniciando conexión a WhatsApp...'));
    const { version } = await fetchLatestBaileysVersion();
    console.log(chalk.gray(`📦 Usando Baileys v${version.join('.')}`));
    const { state, saveCreds } = await useMultiFileAuthState(sessions);
    console.log(chalk.green('✅ Estado de autenticación cargado'));
    const credsFile = join(sessions, 'creds.json');
    const hasCreds = fs.existsSync(credsFile);
    if (hasCreds) {
      console.log(chalk.cyan('🔑 Credenciales encontradas, intentando restaurar sesión...'));
    } else {
      console.log(chalk.yellow('🔐 No hay sesión guardada, se mostrará QR code'));
    }
    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, loggerMock),
      },
      browser: ['Ubuntu', 'Chrome', '122.0.0.0'],
      logger: loggerMock,
      printQRInTerminal: false,
      markOnlineOnConnect: true,
      syncFullHistory: false,
      generateHighQualityLinkPreview: true,
      defaultQueryTimeoutMs: 60000,
      connectTimeoutMs: 30000,
      keepAliveIntervalMs: 15000,
      emitOwnEvents: true,
      msgRetryCounterCache: new NodeCache(),
      getMessage: async () => ({}),
      shouldIgnoreJid: () => false,
      fireInitQueries: true,
      transactionOpts: { maxCommitRetries: 0 }
    });
    global.sock = sock;
    console.log(chalk.cyan('✅ Socket creado correctamente'));
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (!msg.message || msg.key?.fromMe) continue;
        const sender = msg.key.remoteJid;
        const text = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || 
                     '[Media/Archivo/Sticker]';
        logMessage('message', text, { from: sender });
        try {
          await handleMessage(sock, msg);
        } catch (error) {
          logMessage('error', `Error procesando mensaje: ${error.message}`);
        }
      }
    });
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr, isNewLogin } = update;
      if (qr) {
        displayQR(qr);
      }
      if (connection === 'open') {
        console.clear();
        console.log(chalk.green.bold(`
╔══════════════════════════════════╗
║        🎉 CONEXIÓN EXITOSA       ║
║        🤖 BOT LISTO              ║
╚══════════════════════════════════╝
`));
        const userNumber = sock.user?.id?.replace('@s.whatsapp.net', '') || 'Desconocido';
        console.log(chalk.cyan(`👤 Usuario: ${userNumber}`));
        console.log(chalk.cyan(`📅 Hora: ${new Date().toLocaleTimeString()}`));
        console.log(chalk.green('\n✨ ¡Bot listo para recibir comandos!\n'));
        startBackgroundTasks();
      }
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const error = lastDisconnect?.error;
        console.log(chalk.yellow('\n🔌 Conexión cerrada'));
        if (statusCode) {
          console.log(chalk.yellow(`📊 Código: ${statusCode}`));
        }
        if (error?.message) {
          console.log(chalk.yellow(`⚠️  Error: ${error.message}`));
        }
        if (statusCode === DisconnectReason.loggedOut) {
          console.log(chalk.red('\n❌ SESIÓN EXPIRADA'));
          console.log(chalk.red('💡 Elimina la carpeta "auth_info" y vuelve a iniciar'));
          console.log(chalk.yellow('\n¿Eliminar sesión expirada automáticamente? (s/n)'));
          setTimeout(() => {
            console.log(chalk.cyan('\n🔄 Ejecuta nuevamente el bot después de eliminar auth_info'));
            process.exit(0);
          }, 3000);
          return;
        }
        if (statusCode === DisconnectReason.connectionClosed) {
          console.log(chalk.yellow('🔄 Conexión cerrada, reconectando en 5s...'));
          setTimeout(connectWhatsApp, 5000);
          return;
        }
        if (statusCode === DisconnectReason.connectionLost) {
          console.log(chalk.yellow('📶 Pérdida de conexión, reconectando en 3s...'));
          setTimeout(connectWhatsApp, 3000);
          return;
        }
        if (statusCode === DisconnectReason.restartRequired) {
          console.log(chalk.yellow('🔄 Reinicio requerido, reconectando en 2s...'));
          setTimeout(connectWhatsApp, 2000);
          return;
        }
        if (statusCode === DisconnectReason.timedOut) {
          console.log(chalk.yellow('⏰ Timeout, reconectando en 10s...'));
          setTimeout(connectWhatsApp, 10000);
          return;
        }
        console.log(chalk.yellow('🔄 Reconectando en 15s...'));
        setTimeout(connectWhatsApp, 15000);
      }
      if (connection === 'connecting') {
        console.log(chalk.blue('🔄 Conectando al servidor de WhatsApp...'));
      }
    });
    sock.ev.on('messages.reaction', (reactions) => {});
    sock.ev.on('groups.update', (updates) => {});
    return sock;
  } catch (error) {
    console.log(chalk.red('\n🔥 ERROR CRÍTICO DE CONEXIÓN:'));
    console.log(chalk.red('Mensaje:', error.message));
    if (error.stack) {
      const stackLines = error.stack.split('\n').slice(0, 3);
      console.log(chalk.red('Stack:', stackLines.join('\n')));
    }
    console.log(chalk.yellow('\n🔄 Intentando reconexión en 10 segundos...'));
    setTimeout(connectWhatsApp, 10000);
  }
}

function startBackgroundTasks() {
  console.log(chalk.gray('\n🔧 Iniciando tareas en segundo plano...'));
  setInterval(() => {
    try {
      global.guardarCM();
    } catch (error) {
      console.log(chalk.red('❌ Error en backup automático:'), error.message);
    }
  }, 1800000);
  setInterval(() => {
    try {
      global.cache.flushAll();
    } catch (error) {
      console.log(chalk.red('❌ Error limpiando caché:'), error.message);
    }
  }, 900000);
  if (typeof reiniciarStock === 'function') {
    setInterval(() => {
      try {
        reiniciarStock();
      } catch (error) {
        console.log(chalk.red('❌ Error reiniciando stock:'), error.message);
      }
    }, 600000);
  }
  setInterval(() => {
    const now = new Date();
    console.log(chalk.cyan(`\n📊 Estado del Bot - ${now.toLocaleTimeString()}`));
    console.log(chalk.cyan(`📅 ${now.toLocaleDateString()}`));
    console.log(chalk.cyan('✅ Bot funcionando correctamente'));
  }, 3600000);
  console.log(chalk.green('✅ Tareas en segundo plano iniciadas'));
}

async function initializeBot() {
  console.log(chalk.blue('🚀 Iniciando Pandabot...'));
  const dirs = ['data', 'backups', 'logs'];
  for (const dir of dirs) {
    const dirPath = join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(chalk.gray(`📁 Carpeta ${dir} creada`));
    }
  }
  try {
    if (typeof limpiarPersonajes === 'function') {
      const personajesPath = join(__dirname, 'data', 'personajes.json');
      if (fs.existsSync(personajesPath)) {
        const result = limpiarPersonajes(personajesPath);
        console.log(chalk.green(`🧹 ${result?.length || 0} personajes limpiados`));
      }
    }
    if (typeof migrarStockPlano === 'function') {
      migrarStockPlano();
      console.log(chalk.green('📦 Migración de stock completada'));
    }
  } catch (error) {
    console.log(chalk.yellow('⚠️  Advertencia en inicialización:'), error.message);
  }
  await connectWhatsApp();
}

process.on('uncaughtException', (error) => {
  console.log(chalk.red('\n🔥 ERROR NO MANEJADO (uncaughtException):'));
  console.log(chalk.red('Mensaje:', error.message));
  if (error.stack) {
    const stackLines = error.stack.split('\n').slice(0, 3);
    console.log(chalk.red('Stack:', stackLines.join('\n')));
  }
  const criticalErrors = [
    'ERR_ASSERTION',
    'EACCES',
    'EADDRINUSE',
    'MODULE_NOT_FOUND'
  ];
  const isCritical = criticalErrors.some(err => error.message.includes(err));
  if (isCritical) {
    console.log(chalk.red('\n❌ Error crítico, saliendo...'));
    process.exit(1);
  } else {
    console.log(chalk.yellow('\n🔄 Continuando ejecución...'));
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.log(chalk.yellow('\n⚠️  PROMESA RECHAZADA NO MANEJADA:'));
  if (reason && typeof reason === 'object') {
    if (reason.message) {
      console.log(chalk.yellow('Razón:'), reason.message);
    } else {
      console.log(chalk.yellow('Razón:'), JSON.stringify(reason));
    }
  } else {
    console.log(chalk.yellow('Razón:'), String(reason));
  }
});

process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Recibida señal SIGINT. Cerrando bot...'));
  try {
    global.guardarCM();
    console.log(chalk.green('💾 Datos guardados correctamente'));
  } catch (error) {
    console.log(chalk.red('❌ Error guardando datos al salir:'), error.message);
  }
  console.log(chalk.cyan('✨ ¡Hasta pronto!'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(chalk.yellow('\n⚡ Recibida señal SIGTERM. Reiniciando...'));
  process.exit(0);
});

console.log(chalk.cyan(`
💡 INFORMACIÓN IMPORTANTE:
• El bot necesita acceso a WhatsApp Web
• Si no se muestra el QR, verifica tu conexión a internet
• Para forzar nuevo QR: Elimina la carpeta 'auth_info'
• Usa Ctrl+C para apagar correctamente
`));

setTimeout(() => {
  initializeBot().catch(error => {
    console.log(chalk.red('❌ ERROR FATAL AL INICIAR:'), error.message);
    if (error.stack) {
      console.log(chalk.red('Stack:', error.stack.split('\n')[0]));
    }
    console.log(chalk.yellow('\n🔄 Reiniciando en 5 segundos...'));
    setTimeout(() => {
      process.exit(1);
    }, 5000);
  });
}, 2000);
