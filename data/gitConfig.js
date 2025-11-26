import fs from 'fs';
import path from 'path';

const GIT_CONFIG_PATH = './src/data/git_credentials.json';

export function guardarGitCredentials(username, token) {
  const credentials = {
    username,
    token,
    fecha: new Date().toLocaleString()
  };
  
  const dir = path.dirname(GIT_CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(GIT_CONFIG_PATH, JSON.stringify(credentials, null, 2));
  return true;
}

export function cargarGitCredentials() {
  try {
    if (fs.existsSync(GIT_CONFIG_PATH)) {
      const data = fs.readFileSync(GIT_CONFIG_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('❌ Error cargando credenciales Git:', error);
  }
  return null;
}

export function eliminarGitCredentials() {
  try {
    if (fs.existsSync(GIT_CONFIG_PATH)) {
      fs.unlinkSync(GIT_CONFIG_PATH);
      return true;
    }
  } catch (error) {
    console.error('❌ Error eliminando credenciales Git:', error);
  }
  return false;
}