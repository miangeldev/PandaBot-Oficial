import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { cargarGitCredentials, guardarGitCredentials, eliminarGitCredentials } from '../data/gitConfig.js';
import { ownerNumber } from '../config.js';

const execAsync = promisify(exec);

function esOwner(sender) {
  const senderNumber = sender.split('@')[0];
  return ownerNumber.includes(`+${senderNumber}`);
}

export const command = 'gitsubir';
export const aliases = ['git', 'subir'];

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

  // Subcomando para configurar credenciales
  if (subcomando === 'config' || subcomando === 'configurar') {
    await configurarGit(sock, from, args.slice(1));
    return;
  }

  // Subcomando para ver configuración
  if (subcomando === 'info' || subcomando === 'configuracion') {
    await mostrarConfiguracion(sock, from);
    return;
  }

  // Subcomando para eliminar configuración
  if (subcomando === 'logout' || subcomando === 'eliminar') {
    await eliminarConfiguracion(sock, from);
    return;
  }

  // Subcomando principal: subir cambios
  await subirCambios(sock, from, args);
}

async function configurarGit(sock, from, args) {
  if (args.length < 2) {
    await sock.sendMessage(from, {
      text: '🔐 *CONFIGURAR CREDENCIALES GIT*\n\n' +
            '💡 Usa: .gitsubir config <usuario> <token>\n\n' +
            '📝 Ejemplo:\n' +
            '.gitsubir config tuusuario github_pat_tuTokenDeGitHub\n\n' +
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

  // Validaciones básicas
  if (!username || !token) {
    await sock.sendMessage(from, {
      text: '❌ Usuario y token son requeridos.'
    });
    return;
  }

  // Validación corregida para tokens nuevos de GitHub
  if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
    await sock.sendMessage(from, {
      text: '❌ El token parece inválido. Debe empezar con "ghp_" o "github_pat_"'
    });
    return;
  }

  try {
    guardarGitCredentials(username, token);
    await sock.sendMessage(from, {
      text: `✅ *CREDENCIALES GUARDADAS*\n\n` +
            `👤 Usuario: ${username}\n` +
            `🔐 Token: ${token.substring(0, 12)}...\n` +
            `📝 Tipo: ${token.startsWith('github_pat_') ? 'Nuevo (Fine-grained)' : 'Clásico'}\n\n` +
            `💡 Ahora puedes usar: .gitsubir "mensaje del commit"`
    });
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

async function subirCambios(sock, from, args) {
  // Verificar si hay credenciales guardadas
  const config = cargarGitCredentials();
  if (!config) {
    await sock.sendMessage(from, {
      text: '❌ No hay credenciales configuradas.\n\n' +
            '💡 Configura primero con:\n' +
            '.gitsubir config <usuario> <token>'
    });
    return;
  }

  // Obtener mensaje del commit
  let commitMessage = args.join(' ').trim();
  
  if (!commitMessage) {
    // Si no hay mensaje, usar uno por defecto con fecha
    const fecha = new Date().toLocaleString();
    commitMessage = `🤖 Actualización automática - ${fecha}`;
  }

  await sock.sendMessage(from, { 
    text: '🔄 *INICIANDO SUBIDA A GITHUB...*\n\n' +
          `📝 Commit: ${commitMessage}\n` +
          `👤 Usuario: ${config.username}\n` +
          `⏰ ${new Date().toLocaleString()}\n\n` +
          `⌛ Esto puede tomar unos segundos...`
  });

  try {
    // Configurar Git con las credenciales
    await configurarGitRemote(config.username, config.token);

    // Ejecutar los comandos Git
    const resultados = await ejecutarComandosGit(commitMessage);

    await sock.sendMessage(from, {
      text: `✅ *¡SUBIDA EXITOSA!* 🚀\n\n` +
            `📝 Commit: ${commitMessage}\n` +
            `👤 Por: ${config.username}\n` +
            `🕒 ${new Date().toLocaleString()}\n\n` +
            `📊 Resultados:\n` +
            `┌─ 📁 Archivos añadidos: ${resultados.add}\n` +
            `├─ 📄 Cambios: ${resultados.archivos} archivos\n` +
            `├─ 💾 Commit realizado\n` +
            `└─ 🚀 Push exitoso\n\n` +
            `🔗 Repo actualizado correctamente.`
    });

  } catch (error) {
    console.error('❌ Error en subida Git:', error);
    
    let mensajeError = `❌ *ERROR EN SUBIDA GIT*\n\n` +
                       `📝 Commit: ${commitMessage}\n` +
                       `🔍 Error: ${error.message}\n\n`;

    // Mensajes específicos para errores comunes
    if (error.message.includes('fatal: not a git repository')) {
      mensajeError += `💡 Solución: Inicializa el repo primero con:\n` +
                      `\`git init\`\n` +
                      `\`git remote add origin <tu-repo-url>\``;
    } else if (error.message.includes('Authentication failed')) {
      mensajeError += `🔐 Error de autenticación.\n` +
                      `💡 Verifica tu token con: .gitsubir config`;
    } else if (error.message.includes('no upstream branch')) {
      mensajeError += `🌊 Configura upstream con:\n` +
                      `\`git push -u origin master\``;
    } else if (error.message.includes('nothing to commit')) {
      mensajeError += `📭 No hay cambios para subir. Todo está actualizado.`;
    }

    await sock.sendMessage(from, { text: mensajeError });
  }
}

async function configurarGitRemote(username, token) {
  try {
    // Verificar si existe el remote origin
    const remotes = await execAsync('git remote -v');
    
    if (remotes.stdout.includes('origin')) {
      console.log('✅ Remote origin detectado:', remotes.stdout);
      
      // Obtener la URL actual del origin
      const currentUrl = await execAsync('git config --get remote.origin.url');
      const repoUrl = currentUrl.stdout.trim();
      console.log('🔗 URL actual:', repoUrl);
      
      // Si la URL ya contiene el token, no hacer nada
      if (repoUrl.includes(token)) {
        console.log('✅ Token ya está en la URL');
        return;
      }
      
      // Construir la nueva URL con autenticación
      let newUrl;
      if (repoUrl.startsWith('https://github.com/')) {
        // Extraer la parte después de github.com/
        const repoPath = repoUrl.replace('https://github.com/', '');
        newUrl = `https://${username}:${token}@github.com/${repoPath}`;
      } else if (repoUrl.startsWith('https://') && repoUrl.includes('@github.com')) {
        // Ya tiene autenticación, reemplazar la parte de autenticación
        const repoPath = repoUrl.split('@github.com/')[1];
        newUrl = `https://${username}:${token}@github.com/${repoPath}`;
      } else {
        // Usar la URL por defecto
        newUrl = `https://${username}:${token}@github.com/brawly1654/PandaBot-Oficial.git`;
      }
      
      console.log('🔄 Actualizando URL a:', newUrl.replace(token, '***'));
      await execAsync(`git remote set-url origin "${newUrl}"`);
      
    } else {
      // Si no existe origin, crearlo
      const newUrl = `https://${username}:${token}@github.com/brawly1654/PandaBot-Oficial.git`;
      console.log('📝 Creando remote origin:', newUrl.replace(token, '***'));
      await execAsync(`git remote add origin "${newUrl}"`);
    }
    
    // Verificar que se configuró correctamente
    const verifiedUrl = await execAsync('git config --get remote.origin.url');
    console.log('✅ URL verificada:', verifiedUrl.stdout.replace(token, '***'));
    
  } catch (error) {
    console.error('❌ Error configurando remote:', error);
    throw new Error(
      `Error configurando el remote: ${error.message}\n\n` +
      `💡 Tu remote actual es: https://github.com/brawly1654/PandaBot-Oficial.git\n` +
      `🔍 Usa .gitsubir debug para más información`
    );
  }
}

async function ejecutarComandosGit(commitMessage) {
  const resultados = {};

  try {
    // 1. git add .
    await execAsync('git add .');
    resultados.add = 'Todos los archivos';

    // 2. git status para ver qué se va a subir
    const status = await execAsync('git status --short');
    resultados.archivos = status.stdout ? status.stdout.split('\n').filter(l => l).length : 0;

    // 3. git commit -m "mensaje"
    await execAsync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`);
    resultados.commit = 'OK';

    // 4. git push - PRIMERO intentar con master, LUEGO con main
    try {
      // Intentar con master primero
      await execAsync('git push origin master');
      resultados.push = 'OK (master)';
      resultados.rama = 'master';
    } catch (masterError) {
      // Si master falla, intentar con main
      try {
        await execAsync('git push origin main');
        resultados.push = 'OK (main)';
        resultados.rama = 'main';
      } catch (mainError) {
        // Si ambas fallan, mostrar error específico
        if (masterError.message.includes('src refspec master does not match any') && 
            mainError.message.includes('src refspec main does not match any')) {
          throw new Error('No hay ramas "master" ni "main". Crea una rama primero.');
        }
        throw masterError; // Mostrar el error original de master
      }
    }

    return resultados;

  } catch (error) {
    // Si el commit falla porque no hay cambios, manejarlo
    if (error.message.includes('nothing to commit') || error.message.includes('no changes added to commit')) {
      throw new Error('No hay cambios para subir. Todo está actualizado.');
    }
    
    // Error específico de rama
    if (error.message.includes('src refspec')) {
      throw new Error(`Rama no encontrada. Tu repositorio usa "master".\n\n💡 Solución: git push origin master`);
    }
    
    throw error;
  }
}
