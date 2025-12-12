import { reiniciarStock } from './plugins/addstock.js';
import { migrarStockPlano } from './plugins/addstock.js';
import { limpiarPersonajes } from "./limpiarPersonajes.js";
import { handleMessage } from './handler.js';
import chalk from 'chalk';
import NodeCache from 'node-cache';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  Browsers
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";

// ============================================
// CONFIGURACIÓN SIMPLIFICADA
// ============================================

// Logger mínimo
const logger = pino({
  level: 'fatal', // Solo errores críticos
  transport: {
    target: 'pino-pretty',
    options: { colorize: false }
  }
});

// ============================================
// VARIABLES GLOBALES BÁSICAS
// ============================================

global.sock = null;
global.cmDB = {};
global.msgQueue = [];

// Función para guardar coinmaster
global.guardarCM = () => {
  try {
    if (global.cmDB) {
      fs.writeFileSync('./coinmaster.json', JSON.stringify(global.cmDB, null, 2));
    }
  } catch (error) {
    console.error(chalk.red('❌ Error guardando coinmaster'));
  }
};

// Cargar coinmaster si existe
try {
  if (fs.existsSync('./coinmaster.json')) {
    global.cmDB = JSON.parse(fs.readFileSync('./coinmaster.json', 'utf8'));
  }
} catch (error) {
  global.cmDB = {};
}

// ============================================
// FUNCIÓN PRINCIPAL DE CONEXIÓN
// ============================================

async function connectWhatsApp() {
  console.log(chalk.blue('🚀 Iniciando conexión con WhatsApp...'));
  
  try {
    // 1. Obtener versión de Baileys
    const { version } = await fetchLatestBaileysVersion();
    console.log(chalk.cyan(`📦 Usando Baileys v${version.join('.')}`));
    
    // 2. Cargar o crear estado de autenticación
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    console.log(chalk.cyan('🔐 Estado de autenticación cargado'));
    
    // 3. CONFIGURACIÓN CRÍTICA: Socket que SÍ muestra QR
    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
      },
      // ESTA ES LA PARTE MÁS IMPORTANTE:
      printQRInTerminal: true, // FORZAR a mostrar QR
      browser: Browsers.macOS('Safari'), // Browser genérico
      logger: pino({ level: 'silent' }), // Silenciar logs de Baileys
      markOnlineOnConnect: true,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      emitOwnEvents: true,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 10000
    });
    
    // Guardar socket globalmente
    global.sock = sock;
    
    console.log(chalk.green('✅ Socket creado correctamente'));
    
    // 4. Manejar actualización de credenciales
    sock.ev.on('creds.update', saveCreds);
    
    // 5. MANEJO DE CONEXIÓN (PARTE MÁS IMPORTANTE)
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      console.log(chalk.yellow(`[CONEXIÓN] Estado: ${connection}`));
      
      // MOSTRAR QR SI ESTÁ DISPONIBLE
      if (qr) {
        console.log(chalk.yellow('\n═══════════════════════════════════════════════'));
        console.log(chalk.yellow('📱 CÓDIGO QR GENERADO - ESCANEA CON WHATSAPP'));
        console.log(chalk.yellow('═══════════════════════════════════════════════\n'));
        console.log(chalk.white('1. Abre WhatsApp en tu teléfono'));
        console.log(chalk.white('2. Toca los 3 puntos (⋮) → Dispositivos vinculados'));
        console.log(chalk.white('3. Toca "Vincular un dispositivo"'));
        console.log(chalk.white('4. Escanea este código QR:\n'));
        
        // Mostrar QR en terminal
        qrcode.generate(qr, { small: true });
        
        console.log(chalk.yellow('\n═══════════════════════════════════════════════'));
      }
      
      // CONEXIÓN EXITOSA
      if (connection === 'open') {
        console.log(chalk.green('\n🎉 ¡CONEXIÓN EXITOSA!'));
        console.log(chalk.cyan(`👤 Usuario: ${sock.user?.name || 'N/A'}`));
        console.log(chalk.cyan(`📱 Número: ${sock.user?.id?.split(':')[0]?.split('@')[0] || 'N/A'}`));
        console.log(chalk.green('\n🤖 Bot listo para recibir mensajes...\n'));
        
        // Enviar mensaje de prueba
        try {
          sock.sendMessage(sock.user.id, { 
            text: '✅ Bot conectado correctamente!' 
          });
        } catch (error) {
          // Ignorar error si no se puede enviar
        }
        
        // Iniciar tareas en segundo plano
        startBackgroundTasks();
      }
      
      // CONEXIÓN CERRADA
      if (connection === 'close') {
        console.log(chalk.red('\n❌ Conexión cerrada'));
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        
        if (statusCode === DisconnectReason.loggedOut) {
          console.log(chalk.yellow('⚠️  Sesión cerrada. Elimina la carpeta "auth_info" y vuelve a escanear el QR'));
          process.exit(1);
        } else {
          console.log(chalk.yellow('🔄 Reconectando en 5 segundos...'));
          setTimeout(connectWhatsApp, 5000);
        }
      }
    });
    
    // 6. MANEJO DE MENSAJES (SIMPLIFICADO)
    sock.ev.on('messages.upsert', async (data) => {
      if (data.type !== 'notify') return;
      
      for (const msg of data.messages) {
        // Ignorar mensajes propios
        if (msg.key?.fromMe) continue;
        
        // Log básico
        const sender = msg.key?.remoteJid;
        const isGroup = sender?.endsWith('@g.us');
        console.log(chalk.gray(`[${isGroup ? 'GRUPO' : 'PRIV'}] ${sender?.split('@')[0] || 'DESC'}: ${msg.message ? 'con mensaje' : 'sin mensaje'}`));
        
        // Procesar mensaje
        try {
          await handleMessage(sock, msg);
        } catch (error) {
          console.error(chalk.red('❌ Error procesando mensaje:'), error.message);
        }
      }
    });
    
    // 7. Manejar errores de conexión
    sock.ev.on('connection.update', (update) => {
      if (update.qr) {
        console.log(chalk.blue('[QR] Código QR actualizado'));
      }
      
      if (update.connection === 'connecting') {
        console.log(chalk.blue('[CONEXIÓN] Conectando...'));
      }
    });
    
    return sock;
    
  } catch (error) {
    console.error(chalk.red('❌ Error en connectWhatsApp:'), error.message);
    
    // Reintentar en 10 segundos
    console.log(chalk.yellow('🔄 Reintentando en 10 segundos...'));
    setTimeout(connectWhatsApp, 10000);
  }
}

// ============================================
// TAREAS EN SEGUNDO PLANO
// ============================================

function startBackgroundTasks() {
  // Stock cada minuto
  setInterval(() => {
    try {
      reiniciarStock();
      console.log(chalk.gray('[SISTEMA] Stock reiniciado'));
    } catch (error) {
      // Ignorar errores de stock
    }
  }, 60000);
  
  // Guardar datos cada 2 minutos
  setInterval(() => {
    try {
      global.guardarCM();
    } catch (error) {
      // Ignorar errores de guardado
    }
  }, 120000);
  
  console.log(chalk.gray('🔧 Tareas en segundo plano iniciadas'));
}

// ============================================
// INICIALIZACIÓN COMPLETA
// ============================================

async function initializeBot() {
  console.log(chalk.magenta(`
╔══════════════════════════════╗
║      🤖 WHATSAPP BOT 🤖      ║
║    🚀 VERSIÓN CORREGIDA     ║
║    📱 QR GARANTIZADO        ║
╚══════════════════════════════╝
  `));
  
  // Verificar si existe carpeta auth_info
  if (!fs.existsSync('auth_info')) {
    console.log(chalk.yellow('📁 Creando carpeta de autenticación...'));
    fs.mkdirSync('auth_info', { recursive: true });
  }
  
  // Crear backup inicial si no existe
  if (!fs.existsSync('backups')) {
    fs.mkdirSync('backups', { recursive: true });
  }
  
  // Limpiar personajes si existe el archivo
  try {
    if (fs.existsSync('./data/personajes.json')) {
      const result = limpiarPersonajes("./data/personajes.json");
      console.log(chalk.green(`🧹 ${result?.length || 0} personajes limpiados`));
    }
  } catch (error) {
    // Ignorar error
  }
  
  // Ejecutar migración si existe
  try {
    migrarStockPlano();
  } catch (error) {
    // Ignorar error
  }
  
  // Conectar a WhatsApp
  await connectWhatsApp();
}

// ============================================
// MANEJO DE SEÑALES Y ERRORES
// ============================================

process.on('SIGINT', () => {
  console.log(chalk.yellow('\n👋 Apagando bot...'));
  
  // Intentar guardar datos
  try {
    global.guardarCM();
  } catch (error) {
    // Ignorar
  }
  
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error(chalk.red('\n🔥 Error no capturado:'), error.message);
  
  // No salir, intentar reconectar
  setTimeout(connectWhatsApp, 5000);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.yellow('\n⚠️ Promesa rechazada:'), reason);
});

// ============================================
// INICIAR EL BOT
// ============================================

// Limpiar consola al inicio
console.clear();

// Iniciar bot con pequeño retraso
setTimeout(() => {
  initializeBot().catch(error => {
    console.error(chalk.red('❌ Error fatal al iniciar:'), error);
    process.exit(1);
  });
}, 1000);
