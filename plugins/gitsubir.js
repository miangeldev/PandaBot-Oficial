import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { cargarGitCredentials, guardarGitCredentials, eliminarGitCredentials, verificarCredenciales } from '../data/gitConfig.js';
import { ownerNumber } from '../config.js';

const execAsync = promisify(exec);

function esOwner(sender) {
  const senderNumber = sender.split('@')[0];
  return ownerNumber.includes(`+${senderNumber}`);
}

export const command = 'gitsubir';
export const aliases = ['git', 'github', 'subir'];

export async function run(sock, msg, args) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;

  if (!esOwner(sender)) {
    await sock.sendMessage(from, { 
      text: '❌ Solo los Owners pueden usar este comando.' 
    });
    return;
  }

  const subcomando = args[0]?.toLowerCase();

  switch (subcomando) {
    case 'config':
    case 'configurar':
      await configurarGit(sock, from, args.slice(1));
      break;
    case 'info':
    case 'configuracion':
      await mostrarConfiguracion(sock, from);
      break;
    case 'logout':
    case 'eliminar':
      await eliminarConfiguracion(sock, from);
      break;
    case 'debug':
    case 'test':
      await debugRemote(sock, from);
      break;
    case 'verificar':
    case 'check':
      await verificarToken(sock, from);
      break;
    case 'diagnostico':
      await diagnosticoCompleto(sock, from);
      break;
    default:
      await subirCambios(sock, from, args);
  }
}

async function configurarGit(sock, from, args) {
  if (args.length < 2) {
    await sock.sendMessage(from, {
      text: '🔐 *CONFIGURAR CREDENCIALES GIT*\n\n' +
            '💡 Usa: .gitsubir config <usuario> <token>\n\n' +
            '📝 Ejemplo:\n' +
            '.gitsubir config brawly1654 github_pat_tuToken\n\n' +
            '🔗 Para crear un token:\n' +
            '1. Ve a GitHub → Settings → Developer settings\n' +
            '2. Personal access tokens → Tokens (classic)\n' +
            '3. Genera nuevo token con permisos repo\n' +
            '4. Cópialo y úsalo aquí'
    });
    return;
  }

  const username = args[0];
  const token = args[1];

  if (!username || !token) {
    await sock.sendMessage(from, {
      text: '❌ Usuario y token son requeridos.'
    });
    return;
  }

  if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
    await sock.sendMessage(from, {
      text: '❌ El token parece inválido. Debe empezar con "ghp_" o "github_pat_"'
    });
    return;
  }

  try {
    const success = guardarGitCredentials(username, token);
    if (success) {
      await sock.sendMessage(from, {
        text: `✅ *CREDENCIALES GUARDADAS* 🔐\n\n` +
              `👤 Usuario: ${username}\n` +
              `🔐 Token: ${token.substring(0, 12)}...\n` +
              `📝 Tipo: ${token.startsWith('github_pat_') ? 'Nuevo (Fine-grained)' : 'Clásico'}\n\n` +
              `💡 Ahora puedes usar: .gitsubir "mensaje del commit"`
      });
    } else {
      throw new Error('Error al guardar credenciales');
    }
  } catch (error) {
    await sock.sendMessage(from, {
      text: `❌ Error guardando credenciales: ${error.message}`
    });
  }
}

async function mostrarConfiguracion(sock, from) {
  const config = cargarGitCredentials();

  if (!config) {
    await sock.sendMessage(from, {
      text: '🔐 *CONFIGURACIÓN GIT*\n\n' +
            '📭 No hay credenciales guardadas.\n\n' +
            '💡 Configura con:\n' +
            '.gitsubir config <usuario> <token>'
    });
    return;
  }

  await sock.sendMessage(from, {
    text: `🔐 *CONFIGURACIÓN GIT GUARDADA*\n\n` +
          `👤 Usuario: ${config.username}\n` +
          `🔐 Token: ${config.token.substring(0, 12)}...\n` +
          `📝 Tipo: ${config.token.startsWith('github_pat_') ? 'Nuevo (Fine-grained)' : 'Clásico'}\n` +
          `📅 Guardado: ${new Date(config.fecha).toLocaleString()}\n\n` +
          `💡 Para subir cambios:\n` +
          `.gitsubir "mensaje del commit"`
  });
}

async function eliminarConfiguracion(sock, from) {
  const eliminado = eliminarGitCredentials();

  if (eliminado) {
    await sock.sendMessage(from, {
      text: '✅ Credenciales eliminadas correctamente.'
    });
  } else {
    await sock.sendMessage(from, {
      text: '❌ No hay credenciales guardadas o error al eliminar.'
    });
  }
}

async function debugRemote(sock, from) {
  try {
    let mensaje = `🔧 *DEBUG REMOTE* 🔍\n\n`;

    const remoteUrl = await execAsync('git config --get remote.origin.url');
    mensaje += `🔗 Remote URL: ${remoteUrl.stdout}\n\n`;

    const config = cargarGitCredentials();
    mensaje += `👤 Credenciales: ${config ? config.username : 'NO'}\n`;

    try {
      await execAsync('git ls-remote origin');
      mensaje += `🔐 Auth: ✅ CONEXIÓN EXITOSA\n`;
    } catch (authError) {
      mensaje += `🔐 Auth: ❌ FALLÓ - ${authError.message}\n`;
    }

    await sock.sendMessage(from, { text: mensaje });

  } catch (error) {
    await sock.sendMessage(from, { 
      text: `❌ Debug error: ${error.message}` 
    });
  }
}

async function verificarToken(sock, from) {
  const config = cargarGitCredentials();
  
  if (!config) {
    await sock.sendMessage(from, {
      text: '❌ No hay credenciales configuradas.'
    });
    return;
  }

  await sock.sendMessage(from, {
    text: `🔍 *VERIFICANDO TOKEN* 🔍\n\n` +
          `👤 Usuario: ${config.username}\n` +
          `🔐 Token: ${config.token.substring(0, 12)}...\n` +
          `📅 Configurado: ${config.fecha}\n\n` +
          `🔄 Probando autenticación...`
  });

  try {
    const testAuth = await execAsync(`curl -s -H "Authorization: token ${config.token}" https://api.github.com/user`);
    
    await sock.sendMessage(from, {
      text: `✅ *TOKEN VÁLIDO* 🎉\n\n` +
            `👤 Usuario: ${config.username}\n` +
            `🔐 Token activo\n` +
            `🌐 Conexión a GitHub: OK\n\n` +
            `💡 El token funciona correctamente.`
    });
    
  } catch (error) {
    await sock.sendMessage(from, {
      text: `❌ *TOKEN INVÁLIDO O EXPIRADO* 🔴\n\n` +
            `👤 Usuario: ${config.username}\n` +
            `🔐 Token: ${config.token.substring(0, 12)}...\n\n` +
            `🔄 *Solución:*\n` +
            `1. Ve a https://github.com/settings/tokens\n` +
            `2. Genera un nuevo token\n` +
            `3. Usa: .gitsubir config <usuario> <nuevo-token>`
    });
  }
}

async function diagnosticoCompleto(sock, from) {
  try {
    let mensaje = `🔧 *DIAGNÓSTICO COMPLETO* 🔍\n\n`;

    const status = await execAsync('git status --short');
    mensaje += `📊 Archivos modificados:\n\`\`\`${status.stdout || 'Ninguno'}\`\`\`\n`;

    const branch = await execAsync('git branch --show-current');
    mensaje += `🌿 Rama actual: ${branch.stdout || 'master'}\n`;

    const remotes = await execAsync('git remote -v');
    mensaje += `🔗 Remotes:\n\`\`\`${remotes.stdout}\`\`\`\n`;

    const config = cargarGitCredentials();
    mensaje += `👤 Credenciales: ${config ? '✅ ' + config.username : '❌ NO'}\n`;

    await sock.sendMessage(from, { text: mensaje });

  } catch (error) {
    await sock.sendMessage(from, { 
      text: `❌ Diagnóstico error: ${error.message}` 
    });
  }
}

async function subirCambios(sock, from, args) {
  const config = cargarGitCredentials();
  
  if (!config) {
    await sock.sendMessage(from, {
      text: '❌ No hay credenciales configuradas.\n\n' +
            '💡 Configura primero con:\n' +
            '.gitsubir config <usuario> <token>'
    });
    return;
  }

  let commitMessage = args.join(' ').trim();
  
  if (!commitMessage) {
    const fecha = new Date().toLocaleString();
    commitMessage = `🤖 Actualización automática - ${fecha}`;
  }

  await sock.sendMessage(from, { 
    text: '🔄 *INICIANDO SUBIDA A GITHUB...*\n\n' +
          `📝 Commit: ${commitMessage}\n` +
          `👤 Usuario: ${config.username}\n` +
          `⏰ ${new Date().toLocaleString()}\n\n` +
          `⌛ Procesando...`
  });

  try {
    await configurarGitRemote(config.username, config.token);
    const resultados = await ejecutarComandosGit(commitMessage);

    await sock.sendMessage(from, {
      text: `✅ *¡SUBIDA EXITOSA!* 🚀\n\n` +
            `📝 Commit: ${commitMessage}\n` +
            `👤 Por: ${config.username}\n` +
            `🌿 Rama: ${resultados.rama}\n` +
            `🕒 ${new Date().toLocaleString()}\n\n` +
            `📊 Resultados:\n` +
            `┌─ 📁 Archivos: ${resultados.add}\n` +
            `├─ 📄 Cambios: ${resultados.archivos} archivos\n` +
            `├─ 💾 Commit: ${resultados.commit}\n` +
            `└─ 🚀 Push: ${resultados.push}\n\n` +
            `🔗 Repo actualizado correctamente.`
    });

  } catch (error) {
    console.error('❌ Error en subida Git:', error);
    
    let mensajeError = `❌ *ERROR EN SUBIDA GIT*\n\n` +
                       `📝 Commit: ${commitMessage}\n` +
                       `🔍 Error: ${error.message}\n\n`;

    if (error.message.includes('Authentication failed')) {
      mensajeError += `🔐 Error de autenticación.\n` +
                      `💡 Verifica tu token con: .gitsubir verificar`;
    } else if (error.message.includes('nothing to commit')) {
      mensajeError += `📭 No hay cambios para subir.`;
    } else if (error.message.includes('src refspec')) {
      mensajeError += `🌿 Error de rama. Usa: git push origin master`;
    }

    await sock.sendMessage(from, { text: mensajeError });
  }
}

async function configurarGitRemote(username, token) {
  try {
    const currentUrl = await execAsync('git config --get remote.origin.url');
    let cleanUrl = currentUrl.stdout.trim();
    
    if (cleanUrl.includes('@')) {
      cleanUrl = cleanUrl.replace(/https:\/\/[^@]+@/, 'https://');
    }
    
    const newUrl = cleanUrl.replace('https://', `https://${username}:${token}@`);
    await execAsync(`git remote set-url origin "${newUrl}"`);
    
    console.log('✅ Remote configurado correctamente');
    
  } catch (error) {
    console.error('❌ Error configurando remote:', error);
    throw new Error(`Error configurando Git: ${error.message}`);
  }
}

async function ejecutarComandosGit(commitMessage) {
  const resultados = {};

  try {
    console.log('🚀 Ejecutando comandos Git...');

    await execAsync('git add .');
    resultados.add = 'Todos los archivos';

    const status = await execAsync('git status --short');
    resultados.archivos = status.stdout ? status.stdout.split('\n').filter(l => l).length : 0;

    await execAsync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`);
    resultados.commit = 'OK';

    try {
      await execAsync('git push origin master');
      resultados.push = 'OK';
      resultados.rama = 'master';
    } catch (masterError) {
      await execAsync('git push origin main');
      resultados.push = 'OK';
      resultados.rama = 'main';
    }

    return resultados;

  } catch (error) {
    if (error.message.includes('nothing to commit') || error.message.includes('no changes added to commit')) {
      throw new Error('No hay cambios para subir.');
    }
    throw error;
  }
}
