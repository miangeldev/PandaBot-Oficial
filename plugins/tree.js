import fs from 'fs';
import path from 'path';

export const command = 'tree';
export const aliases = ['arbol', 'proyecto', 'estructura'];
export const description = 'Mostrar estructura del proyecto';
export const category = 'utilidad';

// Carpetas que se mostrarán completas
const SHOW_FULL = ['src', 'data', 'tools', 'lib', 'middleware'];
// Carpetas que solo se mostrarán (sin contenido)
const SHOW_ONLY = ['plugins'];
// Carpetas/archivos a ignorar
const IGNORE = ['node_modules', '.git', 'auth_info', 'package-lock.json', '.env'];

function generateTree(dir, prefix = '', isLast = true) {
    let tree = '';
    
    try {
        const items = fs.readdirSync(dir)
            .filter(item => !IGNORE.includes(item))
            .sort((a, b) => {
                // Ordenar: carpetas primero, luego archivos
                const aIsDir = fs.statSync(path.join(dir, a)).isDirectory();
                const bIsDir = fs.statSync(path.join(dir, b)).isDirectory();
                if (aIsDir && !bIsDir) return -1;
                if (!aIsDir && bIsDir) return 1;
                return a.localeCompare(b);
            });

        items.forEach((item, index) => {
            const itemPath = path.join(dir, item);
            const isDirectory = fs.statSync(itemPath).isDirectory();
            const isLastItem = index === items.length - 1;
            
            const currentPrefix = prefix + (isLast ? '    ' : '│   ');
            const connector = isLastItem ? '└── ' : '├── ';
            
            tree += prefix + connector + item + '\n';
            
            if (isDirectory) {
                if (SHOW_FULL.includes(item)) {
                    // Mostrar carpeta completa
                    tree += generateTree(itemPath, currentPrefix, isLastItem);
                } else if (SHOW_ONLY.includes(item)) {
                    // Solo mostrar nombre de carpeta
                    tree += currentPrefix + '    📁 (contenido oculto)\n';
                } else {
                    // Mostrar normalmente
                    tree += generateTree(itemPath, currentPrefix, isLastItem);
                }
            }
        });
    } catch (error) {
        tree += prefix + '    ❌ Error leyendo directorio\n';
    }
    
    return tree;
}

export async function run(sock, msg) {
    const from = msg.key.remoteJid;
    
    try {
        const projectRoot = process.cwd();
        const projectName = path.basename(projectRoot);
        
        let treeStructure = `🌳 *ESTRUCTURA DEL PROYECTO*\n\n`;
        treeStructure += `📂 ${projectName}\n`;
        
        // Generar árbol
        const tree = generateTree(projectRoot, '', true);
        treeStructure += tree;
        
        // Agregar leyenda
        treeStructure += `\n📊 *LEYENDA:*\n`;
        treeStructure += `📂 Carpeta\n`;
        treeStructure += `📄 Archivo\n`;
        treeStructure += `📁 Carpeta (contenido oculto)\n\n`;
        treeStructure += `🔧 *CARPETAS COMPLETAS:* ${SHOW_FULL.join(', ')}\n`;
        treeStructure += `👁️ *SOLO NOMBRE:* ${SHOW_ONLY.join(', ')}\n`;
        treeStructure += `🚫 *OCULTAS:* ${IGNORE.filter(i => !i.startsWith('.')).join(', ')}`;
        
        // Dividir en partes si es muy largo
        const maxLength = 4000;
        if (treeStructure.length > maxLength) {
            const parts = [];
            let currentPart = '';
            const lines = treeStructure.split('\n');
            
            for (const line of lines) {
                if ((currentPart + line + '\n').length > maxLength) {
                    parts.push(currentPart);
                    currentPart = line + '\n';
                } else {
                    currentPart += line + '\n';
                }
            }
            if (currentPart) parts.push(currentPart);
            
            for (let i = 0; i < parts.length; i++) {
                await sock.sendMessage(from, { 
                    text: `🌳 *PARTE ${i + 1}/${parts.length}*\n\n${parts[i]}` 
                });
                // Pequeña pausa entre mensajes
                if (i < parts.length - 1) await new Promise(resolve => setTimeout(resolve, 500));
            }
        } else {
            await sock.sendMessage(from, { text: treeStructure });
        }
        
    } catch (error) {
        console.error('Error en comando tree:', error);
        await sock.sendMessage(from, { 
            text: '❌ Error generando la estructura del proyecto.' 
        });
    }
}