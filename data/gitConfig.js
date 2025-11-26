import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const GIT_CONFIG_PATH = './src/data/git_config.enc';
const ENCRYPTION_KEY = 'pandabot_git_key_2024_secure_12345';

function encrypt(text) {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('❌ Error encriptando:', error);
    return null;
  }
}

function decrypt(encryptedText) {
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) throw new Error('Formato encriptado inválido');
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = Buffer.from(parts[2], 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('❌ Error desencriptando:', error.message);
    return null;
  }
}

export function guardarGitCredentials(username, token) {
  try {
    if (!username || !token) throw new Error('Username y token son requeridos');

    const credentials = {
      username: username.trim(),
      token: token.trim(),
      fecha: new Date().toISOString(),
      version: '2.0'
    };

    const encryptedData = encrypt(JSON.stringify(credentials));
    if (!encryptedData) throw new Error('Error en encriptación');

    const dir = path.dirname(GIT_CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    fs.writeFileSync(GIT_CONFIG_PATH, encryptedData, 'utf8');
    console.log('✅ Credenciales guardadas exitosamente');
    return true;
    
  } catch (error) {
    console.error('❌ Error guardando credenciales:', error.message);
    return false;
  }
}

export function cargarGitCredentials() {
  try {
    if (!fs.existsSync(GIT_CONFIG_PATH)) {
      if (migrarDesdeFormatoAntiguo()) return cargarGitCredentials();
      return null;
    }

    const encryptedData = fs.readFileSync(GIT_CONFIG_PATH, 'utf8').trim();
    if (!encryptedData) throw new Error('Archivo vacío');

    const decryptedData = decrypt(encryptedData);
    if (!decryptedData) throw new Error('Error en desencriptación');

    const credentials = JSON.parse(decryptedData);
    if (!credentials.username || !credentials.token) throw new Error('Estructura inválida');

    return credentials;
    
  } catch (error) {
    console.error('❌ Error cargando credenciales:', error.message);
    if (migrarDesdeFormatoAntiguo()) return cargarGitCredentials();
    return null;
  }
}

function migrarDesdeFormatoAntiguo() {
  const oldPath = './src/data/git_credentials.json';
  try {
    if (fs.existsSync(oldPath)) {
      console.log('🔄 Migrando desde formato antiguo...');
      const oldData = JSON.parse(fs.readFileSync(oldPath, 'utf8'));
      
      if (oldData.username && oldData.token) {
        const success = guardarGitCredentials(oldData.username, oldData.token);
        if (success) {
          const backupPath = oldPath + '.backup';
          fs.renameSync(oldPath, backupPath);
          console.log('✅ Migración completada');
          return true;
        }
      }
    }
  } catch (error) {
    console.error('❌ Error en migración:', error.message);
  }
  return false;
}

export function eliminarGitCredentials() {
  try {
    const filesToDelete = [
      GIT_CONFIG_PATH,
      './src/data/git_credentials.json',
      './src/data/git_credentials.json.backup'
    ];
    
    let deleted = false;
    filesToDelete.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log('🗑️ Eliminado:', file);
        deleted = true;
      }
    });
    
    return deleted;
  } catch (error) {
    console.error('❌ Error eliminando credenciales:', error);
    return false;
  }
}

export function verificarCredenciales() {
  try {
    const credenciales = cargarGitCredentials();
    if (!credenciales) return { valido: false, error: 'No hay credenciales' };
    
    const token = credenciales.token;
    if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
      return { valido: false, error: 'Formato de token inválido' };
    }
    
    if (!credenciales.username || credenciales.username.trim() === '') {
      return { valido: false, error: 'Username inválido' };
    }
    
    return { valido: true, credenciales };
  } catch (error) {
    return { valido: false, error: error.message };
  }
}
