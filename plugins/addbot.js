import fs from 'fs';
import path from 'path';

const CREADOR_JID = '120363420237055271@g.us';
const owners = ['56953508566', '573023181375', '166164298780822'];
const requestsFile = path.resolve('./data/joinrequests.json');

function loadRequests() {
  if (!fs.existsSync(requestsFile)) {
    fs.writeFileSync(requestsFile, JSON.stringify([], null, 2));
  }
  return JSON.parse(fs.readFileSync(requestsFile));
}

function saveRequests(requests) {
  fs.writeFileSync(requestsFile, JSON.stringify(requests, null, 2));
}

export const command = 'addbot';
export const aliases = ['unete', 'join']; // 🔧 CORRECCIÓN: Cambié 'command' por 'aliases'
export async function run(sock, msg, args) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const senderNumber = sender.split('@')[0];
 
  const subCommand = args[0]?.toLowerCase();
  const requestId = parseInt(args[1]);

  // 🔧 CORRECCIÓN: Manejo de comandos de administración
  if (subCommand === 'aceptar' || subCommand === 'rechazar') {
    if (!owners.includes(senderNumber)) {
      await sock.sendMessage(from, { 
        text: '❌ Solo los dueños del bot pueden usar este comando.' 
      });
      return;
    }

    const requests = loadRequests();
    const request = requests.find(r => r.id === requestId && r.status === 'pending');

    if (!request) {
      await sock.sendMessage(from, { 
        text: `❌ No se encontró la solicitud #${requestId} pendiente.` 
      });
      return;
    }

    if (subCommand === 'aceptar') {
      try {
        // 🔧 CORRECCIÓN: Extraer el código de invitación correctamente
        const groupLink = request.groupLink;
        const inviteCode = groupLink.split('/').pop(); // Obtener la última parte del enlace
        
        console.log(`🔗 Intentando unirse al grupo con código: ${inviteCode}`);
        
        // 🔧 CORRECCIÓN: Usar groupAcceptInvite en lugar de groupJoin
        await sock.groupAcceptInvite(inviteCode);
        
        request.status = 'accepted';
        request.acceptedAt = Date.now();
        saveRequests(requests);
        
        await sock.sendMessage(from, { 
          text: `✅ Solicitud #${requestId} aceptada. El bot se unió al grupo exitosamente.` 
        });
        
        // Notificar al usuario que hizo la solicitud
        try {
          await sock.sendMessage(request.senderJid, { 
            text: `🎉 ¡Tu solicitud ha sido aprobada! PandaBot se unió a tu grupo.\n\n💡 Recuerda hacer al bot admin para que funcione correctamente.` 
          });
        } catch (notifyError) {
          console.log('No se pudo notificar al usuario:', notifyError.message);
        }
        
      } catch (error) {
        console.error('Error al unirse al grupo:', error);
        await sock.sendMessage(from, { 
          text: `❌ Error al unirse al grupo: ${error.message}\n\n🔍 Posibles causas:\n• El enlace es inválido o expiró\n• El bot fue removido previamente\n• El grupo está lleno\n• Restricciones de privacidad` 
        });
      }
    } else {
      // Rechazar solicitud
      request.status = 'rejected';
      request.rejectedAt = Date.now();
      saveRequests(requests);
      
      await sock.sendMessage(from, { 
        text: `❌ Solicitud #${requestId} rechazada.` 
      });
      
      // Notificar al usuario
      try {
        await sock.sendMessage(request.senderJid, { 
          text: `💔 Tu solicitud para que PandaBot se una a tu grupo ha sido rechazada.\n\n📋 Posibles razones:\n• El grupo no cumple los requisitos\n• Límite de grupos alcanzado\n• Solicitud duplicada` 
        });
      } catch (notifyError) {
        console.log('No se pudo notificar al usuario:', notifyError.message);
      }
    }
    return;
  }

  // 🔧 CORRECCIÓN: Manejo de nueva solicitud
  const groupLink = args[0];
  const linkRegex = /https:\/\/chat\.whatsapp\.com\/[a-zA-Z0-9]{22}/;

  if (!groupLink || !linkRegex.test(groupLink)) {
    await sock.sendMessage(from, { 
      text: `❌ Debes proporcionar un enlace de invitación válido.\n\n📝 Formato: https://chat.whatsapp.com/CODIGO\n\n💡 Ejemplo: .addbot https://chat.whatsapp.com/ABC123def456GHI789jklMNO` 
    });
    return;
  }

  // Verificar si ya existe una solicitud pendiente para este grupo
  const requests = loadRequests();
  const existingRequest = requests.find(r => 
    r.groupLink === groupLink && r.status === 'pending'
  );

  if (existingRequest) {
    await sock.sendMessage(from, { 
      text: `⏳ Ya existe una solicitud pendiente para este grupo (ID: #${existingRequest.id}). Por favor espera la respuesta.` 
    });
    return;
  }

  // Crear nueva solicitud
  const newRequestId = requests.length > 0 ? Math.max(...requests.map(r => r.id)) + 1 : 1;

  const newRequest = {
    id: newRequestId,
    senderJid: sender,
    senderNumber: senderNumber,
    groupLink: groupLink,
    status: 'pending',
    timestamp: Date.now(),
    senderName: msg.pushName || 'Usuario'
  };
  
  requests.push(newRequest);
  saveRequests(requests);

  // Notificar a los owners
  const notificationText = `
🔔 *NUEVA SOLICITUD DE GRUPO*

📋 *ID:* #${newRequestId}
👤 *Usuario:* ${msg.pushName || 'Sin nombre'}
📞 *Número:* ${senderNumber}
🔗 *Enlace:* ${groupLink}
⏰ *Fecha:* ${new Date().toLocaleString()}

✅ *Aceptar:* 
.addbot aceptar ${newRequestId}

❌ *Rechazar:* 
.addbot rechazar ${newRequestId}
`;

  // Enviar notificación a todos los owners
  for (const owner of owners) {
    try {
      await sock.sendMessage(`${owner}@s.whatsapp.net`, { 
        text: notificationText 
      });
    } catch (error) {
      console.log(`No se pudo notificar al owner ${owner}:`, error.message);
    }
  }

  // Confirmar al usuario
  await sock.sendMessage(from, { 
    text: `✅ Tu solicitud ha sido enviada con el ID *#${newRequestId}*.\n\n📞 Los administradores revisarán tu solicitud y te notificarán la decisión.\n\n⏳ Por favor ten paciencia.` 
  });
}

// 🔧 CORRECCIÓN: Comando adicional para ver solicitudes
export const command2 = 'requests';
export const aliases2 = ['solicitudes', 'verrequests'];
export async function run2(sock, msg, args) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const senderNumber = sender.split('@')[0];

  if (!owners.includes(senderNumber)) {
    await sock.sendMessage(from, { 
      text: '❌ Solo los dueños del bot pueden usar este comando.' 
    });
    return;
  }

  const requests = loadRequests();
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const acceptedRequests = requests.filter(r => r.status === 'accepted');
  const rejectedRequests = requests.filter(r => r.status === 'rejected');

  let response = `📋 *SOLICITUDES DE GRUPO*\n\n`;
  response += `⏳ Pendientes: ${pendingRequests.length}\n`;
  response += `✅ Aceptadas: ${acceptedRequests.length}\n`;
  response += `❌ Rechazadas: ${rejectedRequests.length}\n\n`;

  if (pendingRequests.length > 0) {
    response += `🆕 *SOLICITUDES PENDIENTES:*\n`;
    pendingRequests.forEach(req => {
      const timeAgo = Math.floor((Date.now() - req.timestamp) / (1000 * 60));
      response += `#${req.id} - ${req.senderName} - ${timeAgo}min\n`;
    });
  }

  await sock.sendMessage(from, { text: response });
}