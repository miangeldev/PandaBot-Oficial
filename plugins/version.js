// version.js
export const command = "version";

export async function run(sock, msg, args) {
    const version = "2.75";

    await sock.sendMessage(msg.key.remoteJid, {
        text: `📦 *Versión del proyecto PandaBot🐼:* ${version}`
    });
}