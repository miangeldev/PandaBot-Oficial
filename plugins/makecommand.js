import fs from 'fs';
import path from 'path';

const owners = ['56953508566', '573023181375', '166164298780822',
'12833748193431',
'267232999420158'];

export const command = 'makecommand';
export const aliases = ['crearcomando', 'addcmd'];

export async function run(sock, msg, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const senderNumber = sender.split('@')[0];

    if (!owners.includes(senderNumber)) {
        await sock.sendMessage(from, { 
            text: '❌ Solo los dueños pueden crear comandos.' 
        }, { quoted: msg });
        return;
    }

    // 🔥 CORRECCIÓN: Obtener el texto completo correctamente
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    
    // Remover ".makecommand" del inicio
    const input = body.replace(/^\.makecommand\s+/, '').trim();
    
    console.log('🔍 Input recibido:', input); // Debug
    
    if (!input.includes('|')) {
        return await sock.sendMessage(from, {
            text: `📝 *CREAR COMANDO*\n\n💡 *Uso:* .makecommand <comando> | <mensaje>\n\n📋 *Ejemplo:*\n.makecommand hola | ¡Hola! ¿Cómo estás?`
        }, { quoted: msg });
    }

    // 🔥 CORRECCIÓN: Separar correctamente
    const separatorIndex = input.indexOf('|');
    const cmdName = input.substring(0, separatorIndex).trim();
    const message = input.substring(separatorIndex + 1).trim();

    console.log('🔍 Comando detectado:', cmdName); // Debug
    console.log('🔍 Mensaje detectado:', message); // Debug

    if (!cmdName || !message) {
        return await sock.sendMessage(from, {
            text: '❌ Formato incorrecto. Usa: .makecommand <comando> | <mensaje>'
        }, { quoted: msg });
    }

    const commandName = cmdName.toLowerCase();
    const commandFile = path.join(process.cwd(), 'plugins', `${commandName}.js`);
    
    // Verificar si el comando ya existe
    if (fs.existsSync(commandFile)) {
        return await sock.sendMessage(from, {
            text: `❌ El comando ".${commandName}" ya existe.`
        }, { quoted: msg });
    }

    // 🔥 CORRECCIÓN: Escapar correctamente para mantener ENTERS
    const escapedMessage = message
        .replace(/`/g, '\\`')
        .replace(/\${/g, '\\${')
        .replace(/\\/g, '\\\\');

    const commandCode = `export const command = '${commandName}';

export async function run(sock, msg) {
  const from = msg.key.remoteJid;
  
  const message = \`${escapedMessage}\`;
  
  await sock.sendMessage(from, { text: message });
}`;

    // Guardar archivo
    fs.writeFileSync(commandFile, commandCode);

    await sock.sendMessage(from, {
        text: `✅ *COMANDO CREADO EXITOSAMENTE*\n\n📝 Comando: .${commandName}\n💬 Mensaje guardado correctamente.\n\n🔄 Reinicia el bot para aplicar los cambios.`
    }, { quoted: msg });
    
    console.log(`🆕 Nuevo comando creado: ${commandFile}`);
}