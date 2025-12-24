import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { uploadToCatbox } from '../lib/uploadToCatbox.js';
import fetch from 'node-fetch';

export const command = 'hd';
export const category = 'tools';

export async function run(sock, msg) {
  const from = msg.key.remoteJid;

  try {
    console.log('[HD] Comando ejecutado');

    
    const loadingMsg = await sock.sendMessage(from, { text: '⌛ Procesando HD...'}, { quoted: msg }).catch(() => null);
    try { if (loadingMsg) await sock.sendMessage(from, { react: { text: '⏳', key: loadingMsg.key } }).catch(() => {}); } catch {};

    const quoted =
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    const mime =
      msg.message?.imageMessage?.mimetype ||
      msg.message?.videoMessage?.mimetype ||
      quoted?.imageMessage?.mimetype ||
      quoted?.videoMessage?.mimetype;

    if (!mime || (!mime.startsWith('image/') && !mime.startsWith('video/'))) {
      return sock.sendMessage(
        from,
        { text: '⚙️ *Uso:* .hd\n📸 Responde a una imagen o video.' },
        { quoted: msg }
      );
    }

    const isVideo = mime.startsWith('video/');
    const type = isVideo ? 'video' : 'image';

    const mediaMsg = quoted
      ? quoted[type + 'Message']
      : msg.message[type + 'Message'];

    console.log('[HD] Descargando media…');

    const stream = await downloadContentFromMessage(mediaMsg, type);
    let buffer = Buffer.from([]);

    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }

    console.log('[HD] Media descargada:', buffer.length);

    const mediaUrl = await uploadToCatbox(
      buffer,
      isVideo ? 'video.mp4' : 'image.jpg'
    );

    console.log('[HD] Subido a Catbox:', mediaUrl);

    const apiUrl = isVideo
      ? `https://dark-v2-api.vercel.app/api/v1/tools/hdv?videoUrl=${encodeURIComponent(mediaUrl)}`
      : `https://dark-v2-api.vercel.app/api/v1/tools/hd?imageUrl=${encodeURIComponent(mediaUrl)}`;

    const res = await fetch(apiUrl);
    const json = await res.json();

    if (!json.status) throw 'La API HD falló';

    if (isVideo) {
      await sock.sendMessage(
        from,
        {
          video: { url: json.data.outputUrl },
          caption: '✅ *Video HD*',
          mimetype: 'video/mp4',
        },
        { quoted: msg }
      );
    } else {
      await sock.sendMessage(
        from,
        {
          image: { url: json.data.output },
          caption: '✅ *Imagen HD*',
        },
        { quoted: msg }
      );
    }


    try { if (loadingMsg) await sock.sendMessage(from, { delete: loadingMsg.key }).catch(() => {}); } catch {}

    console.log('[HD] Enviado correctamente');

  } catch (err) {
    console.error('[HD ERROR]', err);

    try { if (typeof loadingMsg !== 'undefined' && loadingMsg) await sock.sendMessage(from, { delete: loadingMsg.key }).catch(() => {}); } catch {}

    await sock.sendMessage(
      from,
      { text: `❌ Error HD:\n${err.message || err}` },
      { quoted: msg }
    );
  }
}