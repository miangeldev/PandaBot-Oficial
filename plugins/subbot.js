export const command = 'subbot';
export const aliases = ['connectbot', 'linkbot'];

export async function run(sock, msg, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;

    const subCommand = args[0]?.toLowerCase();

    if (subCommand === 'code') {
        // 🔥 GENERAR CÓDIGO DE VINCULACIÓN
        await sock.sendMessage(from, {
            text: '🔄 Generando código de vinculación...',
            mentions: [sender]
        });

        try {
            // Extraer solo números del JID
            const phoneNumber = sender.replace(/\D/g, '');
            
            // Solicitar código de pairing REAL de WhatsApp
            const pairingCode = await sock.requestPairingCode(phoneNumber);
            
            if (!pairingCode) {
                await sock.sendMessage(from, {
                    text: '❌ Error al generar el código. Intenta nuevamente.',
                    mentions: [sender]
                });
                return;
            }

            // Formatear código como WhatsApp (XXXX-XXXX)
            const formattedCode = pairingCode.match(/.{1,4}/g).join('-');
            
            await sock.sendMessage(from, {
                text: `🔗 *CÓDIGO DE VINCULACIÓN* 🔗\n\n` +
                      `👤 Solicitado por: @${sender.split('@')[0]}\n` +
                      `🎯 *${formattedCode}*\n\n` +
                      `💡 *Instrucciones:*\n` +
                      `1. Abre WhatsApp en tu teléfono\n` +
                      `2. Ve a *Ajustes → Dispositivos vinculados*\n` +
                      `3. Toca *Vincular un dispositivo*\n` +
                      `4. Escoge *Vincular con número de teléfono*\n` +
                      `5. Ingresa este código: *${formattedCode}*\n\n` +
                      `✅ ¡Listo! Te conectarás como un Sub-Bot de Pandabot\n\n` +
                      `⏰ *Este código expira en 2 minutos*`,
                mentions: [sender]
            });

        } catch (error) {
            console.error('Error generando pairing code:', error);
            await sock.sendMessage(from, {
                text: '❌ Error al generar el código. Asegúrate de que tu número esté registrado en WhatsApp.',
                mentions: [sender]
            });
        }

    } else if (subCommand === 'help' || !subCommand) {
        // AYUDA
        await sock.sendMessage(from, {
            text: `🤖 *SISTEMA SUB-BOT PANDABOT* 🤖\n\n` +
                  `Conecta tu cuenta como una instancia adicional del bot.\n\n` +
                  `🔗 *Comandos:*\n` +
                  `• .subbot code - Generar código de vinculación\n` +
                  `• .subbot help - Esta ayuda\n\n` +
                  `💡 *¿Cómo funciona?*\n` +
                  `1. Usa .subbot code para obtener un código\n` +
                  `2. Ingresa el código en WhatsApp → Dispositivos vinculados\n` +
                  `3. ¡Conectado! Tu cuenta será un Sub-Bot\n\n` +
                  `✅ Funciona en grupos y privado\n` +
                  `⏰ Los códigos expiran en 2 minutos`,
            mentions: [sender]
        });
    } else {
        await sock.sendMessage(from, {
            text: '❌ Comando no reconocido. Usa *.subbot code* para generar un código o *.subbot help* para ayuda.',
            mentions: [sender]
        });
    }
}
