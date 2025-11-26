import fs from 'fs';
import { enviarAlerta } from '../utils/alertaGrupo.js';
import { createDatabaseBackup } from '../tools/createBackup.js';

const dbFile = './database.json';
const logFile = './logs/db.log';
const MAX_SAVES_WITHOUT_BACKUP = 25;

function logEvento(texto) {
  const timestamp = new Date().toISOString();
  fs.mkdirSync('./logs', { recursive: true });
  fs.appendFileSync(logFile, `[${timestamp}] ${texto}\n`);
}

function ensureMeta(data) {
  if (!data || typeof data !== 'object') return;
  data._meta = data._meta || {};
  if (typeof data._meta.savesWithoutBackup !== 'number') {
    data._meta.savesWithoutBackup = 0;
  }
}

// 🔥 SISTEMA BOSS GLOBAL - Función para inicializar boss automático
export function iniciarSistemaBossAutomatico(data) {
  if (!data) return;
  
  // Inicializar estructura del boss si no existe
  if (!data.bossGlobal) {
    data.bossGlobal = {
      activo: false,
      nombre: "",
      vidaActual: 0,
      vidaMaxima: 0,
      recompensaBase: 0,
      fechaInicio: null,
      ataquesRecibidos: 0,
      ataquesNecesarios: 0,
      derrotado: false,
      historicoAtaques: {}
    };
    logEvento('🐉 Sistema boss global inicializado');
  }

  // Verificar y crear boss automático cada 24h
  const ahora = Date.now();
  const ultimoBoss = data.ultimoBossTimestamp || 0;
  
  // Si no hay boss activo y han pasado 24 horas desde el último
  if ((!data.bossGlobal.activo || data.bossGlobal.derrotado) && 
      (ahora - ultimoBoss >= 24 * 60 * 60 * 1000)) {
    
    const nombresBoss = [
      "Dragón Infernal", "Titan de Hielo", "Golem Ancestral", 
      "Serpiente Marina", "Fénix Renacido", "Ciclope Gigante",
      "Kraken Abisal", "Minotauro Legendario", "Hidra Venenosa",
      "Dragón Diario", "Guardián Nocturno", "Bestia Celestial"
    ];
    
    const bossElegido = nombresBoss[Math.floor(Math.random() * nombresBoss.length)];
    const vidaBase = 500;
    const ataquesNecesarios = 50;
    const recompensaBase = 2000;
    
    data.bossGlobal = {
      activo: true,
      nombre: bossElegido,
      vidaActual: vidaBase,
      vidaMaxima: vidaBase,
      recompensaBase: recompensaBase,
      fechaInicio: ahora,
      ataquesRecibidos: 0,
      ataquesNecesarios: ataquesNecesarios,
      derrotado: false,
      historicoAtaques: {}
    };
    
    data.ultimoBossTimestamp = ahora;
    logEvento(`🐉 Nuevo boss automático creado: ${bossElegido}`);
    
    return true; // Indica que se creó un nuevo boss
  }
  
  return false;
}

export function cargarDatabase() {
  if (!fs.existsSync(dbFile)) {
    logEvento('⚠️ database.json no existe. Se requiere restauración manual.');
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(dbFile));
    ensureMeta(data);
    
    // 🔥 Inicializar sistema boss al cargar la base de datos
    iniciarSistemaBossAutomatico(data);
    
    logEvento('✅ Base de datos cargada correctamente.');
    return data;
  } catch (err) {
    logEvento(`❌ Error al leer la base: ${err.message}`);
    return null;
  }
}

export function guardarDatabase(data, sock = null) {
  if (!data || typeof data !== 'object') {
    logEvento('❌ Intento de guardar base inválida (no es un objeto).');
    return;
  }

  ensureMeta(data);

  let savesWithoutBackup = data._meta.savesWithoutBackup ?? 0;
  savesWithoutBackup += 1;

  let backupInfo = null;

  if (savesWithoutBackup >= MAX_SAVES_WITHOUT_BACKUP) {
    try {
      backupInfo = createDatabaseBackup({
        filenameFormatter: (timestamp) => `backup(${timestamp}).json`,
        filenamePrefix: 'backup',
        maxBackups: 10
      });
      logEvento(`📦 Backup creado: ${backupInfo.backupPath}`);
      savesWithoutBackup = 0;
    } catch (err) {
      logEvento(`⚠️ No se pudo crear el backup automático: ${err.message}`);
    }
  }

  data._meta.savesWithoutBackup = savesWithoutBackup;

  try {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
    logEvento('💾 Base de datos guardada correctamente.');

    if (sock) {
      const backupDato = backupInfo?.fileName || 'sin información';
      const alertMessage = backupInfo
        ? `⚠️ *La base de datos fue modificada.*\nBackup creado: ${backupDato}`
        : '⚠️ *La base de datos fue modificada.*\nNo se pudo crear el backup automático.';
      enviarAlerta(sock, alertMessage);
    }
  } catch (err) {
    logEvento(`❌ Error al guardar la base: ${err.message}`);
  }
}

export function guardarPersonajes(personajes) {
  fs.writeFileSync('./data/personajes.json', JSON.stringify({ characters: personajes }, null, 2));
  logEvento('📁 Personajes guardados.');
}

// 🔥 Función auxiliar para crear boss manualmente (para admins)
export function crearBossManual(data, nombre, vida = 500, ataquesNecesarios = 50, recompensa = 2000) {
  if (!data) return false;
  
  data.bossGlobal = {
    activo: true,
    nombre: nombre,
    vidaActual: vida,
    vidaMaxima: vida,
    recompensaBase: recompensa,
    fechaInicio: Date.now(),
    ataquesRecibidos: 0,
    ataquesNecesarios: ataquesNecesarios,
    derrotado: false,
    historicoAtaques: {}
  };
  
  data.ultimoBossTimestamp = Date.now();
  logEvento(`🐉 Boss manual creado: ${nombre}`);
  
  return true;
}

// 🔥 Función para obtener estadísticas del boss
export function obtenerEstadisticasBoss(data) {
  if (!data || !data.bossGlobal) {
    return null;
  }
  
  return {
    activo: data.bossGlobal.activo,
    nombre: data.bossGlobal.nombre,
    vidaActual: data.bossGlobal.vidaActual,
    vidaMaxima: data.bossGlobal.vidaMaxima,
    progreso: (data.bossGlobal.ataquesRecibidos / data.bossGlobal.ataquesNecesarios) * 100,
    ataquesRecibidos: data.bossGlobal.ataquesRecibidos,
    ataquesNecesarios: data.bossGlobal.ataquesNecesarios,
    recompensaBase: data.bossGlobal.recompensaBase,
    participantes: Object.keys(data.bossGlobal.historicoAtaques || {}).length,
    derrotado: data.bossGlobal.derrotado
  };
}
