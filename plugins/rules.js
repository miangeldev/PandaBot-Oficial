export const command = 'rules';

export async function run(sock, msg) {
  const from = msg.key.remoteJid;
  
  const message = `REGLAS BÁSICAS DE PANDABOT:

- No llamar al bot.
- Esperar entre 2 a 3 segundos entre comando y comando.
- No abusar de Glitchs o Bugs, siempre avisar a administración.
- Si eres programador asegúrate de leer la licencia de PandaBot que está en el canal o la puedes solicitar al creador.
- Usar los grupos designados para las compras y ventas de personajes y también para las inversiones.
- No promocionar a otros bots en PandaBot.
- No pedir Owner, Admin ni VIP.
- No mencionar a los propietarios del bot si no es para algo serio o de urgencia.
- Seguir las indicaciones de cada comando.
- Hacer sugerencias y reportes a menudo para mejorar la experiencia de todos en el bot.
- Si eres programador de bots te sugerimos usar Love API Tools, ofrece grandes servicios.`;
  
  await sock.sendMessage(from, { text: message });
}