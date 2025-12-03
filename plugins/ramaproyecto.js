// ramaproyecto.js
export const command = 'ramaproyecto';

import fs from 'fs';
import path from 'path';

const SKIP_CONTENT_DIRS = [
  'plugins',
  'auth_info',
  'auth_info_baileys',
  'auth_info_multi',
  'PandaLove',
  'uploads',
  'venv'
];

const IGNORE_DIRS = [
  'node_modules',
  '.git',
  '.cache',
  '.vscode',
  '.idea',
  'dist',
  'build',
  'downloads',
  'temp',
  'tmp'
];

// Genera el árbol del proyecto con indentación de 2 espacios por nivel
function generateProjectTree(rootDir = process.cwd()) {
  const lines = [];
  lines.push('Proyecto:');
  buildTree(rootDir, 0, lines);
  return lines.join('\n');
}

function buildTree(dir, depth, lines) {
  let entries;

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  // Orden: primero directorios, luego archivos, todo alfabético
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of entries) {
    const name = entry.name;

    // Ignorar directorios basura por completo
    if (IGNORE_DIRS.includes(name)) continue;

    const indent = '  '.repeat(depth); // 2 espacios por nivel
    const fullPath = path.join(dir, name);

    if (entry.isDirectory()) {
      if (SKIP_CONTENT_DIRS.includes(name)) {
        // Solo mostrar que existe el directorio, sin mostrar su contenido
        lines.push(`${indent}${name}/  (contenido omitido)`);
        continue;
      }

      lines.push(`${indent}${name}/`);
      buildTree(fullPath, depth + 1, lines);
    } else {
      lines.push(`${indent}${name}`);
    }
  }
}

export async function run(sock, msg) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;

  let tree;
  try {
    tree = generateProjectTree();
  } catch (err) {
    tree = `No pude generar el mapa del proyecto:\n${err.message}`;
  }

  const message = [
    '🌳 *Mapa del proyecto*',
    '',
    '```',
    tree,
    '```',
    '',
    '📁 *Nota:* Se omitió el contenido de `plugins/`, `auth_info/`, `PandaLove/`, `uploads/` y `venv/`. ' +
    'Además se ignoraron completamente `node_modules/`, `.git/`, `downloads/`, `temp/`, `tmp/`, etc.'
  ].join('\n');

  await sock.sendMessage(from, {
    text: message,
    mentions: [sender]
  });
}