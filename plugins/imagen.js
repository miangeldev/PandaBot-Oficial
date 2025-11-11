import axios from 'axios';
import { isVip } from '../utils/vip.js'
export const command = 'imagen';

const UNSPLASH_ACCESS_KEY = '3SlCoHJHOxW0OViSk3NaMYGCyObJdRua5Bo-ac7Ku4Q';

export async function run(sock, msg, args) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;

  if (!isVip(sender)) {
    await sock.sendMessage(from, { text: '❌ Este comando es solo para usuarios VIP.' });
    return;
  }

  if (!args.length) {
    await sock.sendMessage(from, {
      text: '❌ Usa `.imagen <término>` para buscar una imagen.'
    }, { quoted: msg });
    return;
  }

  const query = args.join(' ');

  try {
    const res = await axios.get('https://api.unsplash.com/search/photos', {
      params: {
        query,
        per_page: 30
      },
      headers: {
        Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`
      }
    });

    const results = res.data.results;
    if (!results || results.length === 0) {
      await sock.sendMessage(from, {
        text: `❌ No se encontraron imágenes para *${query}*.`
      }, { quoted: msg });
      return;
    }

    const randomImage = results[Math.floor(Math.random() * results.length)].urls.regular;

    await sock.sendMessage(from, {
      image: { url: randomImage },
      caption: `📷 Imagen para: *${query}*`
    }, { quoted: msg });

  } catch (error) {
    console.error('Error en .imagen:', error);
    await sock.sendMessage(from, {
      text: '❌ Ocurrió un error al buscar la imagen.'
    }, { quoted: msg });
  }
}
