import axios from 'axios';
export const command = 'rabbit';

const PIXABAY_API_KEY = '53172007-ab4224592f925d53093dfa818';

export async function run(sock, msg) {
  const from = msg.key.remoteJid;

  try {
    const res = await axios.get('https://pixabay.com/api/', {
      params: {
        key: PIXABAY_API_KEY,
        q: 'rabbit',
        image_type: 'photo',
        safesearch: true,
        per_page: 50
      }
    });

    const images = res.data.hits;
    if (!images || images.length === 0) {
      await sock.sendMessage(from, { text: '❌ No se encontraron imágenes de conejos.' }, { quoted: msg });
      return;
    }

    const randomImage = images[Math.floor(Math.random() * images.length)].webformatURL;

    await sock.sendMessage(from, {
      image: { url: randomImage },
      caption: '🐰 Aquí tienes un conejo adorable.'
    }, { quoted: msg });

  } catch (error) {
    console.error('Error al obtener imagen de conejo:', error);
    await sock.sendMessage(from, { text: '❌ Ocurrió un error al buscar la imagen.' }, { quoted: msg });
  }
}
