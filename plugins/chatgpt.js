import fetch from 'node-fetch';
import { cargarDatabase, guardarDatabase } from '../data/database.js';

export const command = 'chatgpt';
export const aliases = ['🐼'];

// 🔑 API key
const API_KEY = '96bde0ae57397e48';

// 📏 Límite de interacciones en memoria de trabajo antes de resumir
const MEMORY_LIMIT = 20;

// 📏 Para debug (no afecta comportamiento)
const MAX_RESPONSE_CHARS = 60;

// 📦 Cada cuántas interacciones resumimos memoria
const RESUME_TRIGGER = 10;

// 🌐 Cada cuántos resúmenes hacemos meta-resumen
const META_RESUME_TRIGGER = 3;

// 🧠 Cuántas interacciones recientes dejamos sin resumir
const KEEP_RECENT = 3;

// 🔧 Llamada a tu API interna
async function callChatAPI({ prompt, system }) {
  const params = new URLSearchParams();
  params.append('prompt', prompt);
  if (system) params.append('system', system);
  params.append('api_key', API_KEY);

  const url = `https://loveapi-tools.miangel.dev/api/v1/chat?${params.toString()}`;

  const resp = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
  const raw = await resp.text();

  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${raw}`);
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`JSON inválido: ${raw}`);
  }

  if (!data || typeof data.response !== 'string') throw new Error('La API no devolvió "response".');

  return data.response;
}

export async function run(sock, msg, args) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const pushName = msg.pushName || 'Usuario';

  const userText = args.join(' ').trim();
  if (!userText) {
    return sock.sendMessage(from, {
      text: '❌ Ingresa algo para que PandaBot responda. Ej: `.chatgpt ¿Cómo estás?`'
    }, { quoted: msg });
  }

  // DB
  const db = cargarDatabase();
  db.users = db.users || {};
  const chatId = from.endsWith('@g.us') ? from : sender;
  db.users[chatId] = db.users[chatId] || {};
  db.users[chatId].memoria = db.users[chatId].memoria || [];
  db.users[chatId].resumenes = db.users[chatId].resumenes || [];

  // Subcomando: memorias
  if (userText.toLowerCase() === 'memorias') {
    const mem = db.users[chatId].memoria;
    const resums = db.users[chatId].resumenes;
    let texto = '🧠 *Memoria de PandaBot para este chat*\n\n';

    if (mem.length) {
      texto += mem.slice(-5).map((m, i) => {
        const fr = (m.memory_fragments?.length)
          ? m.memory_fragments.map(f => `   - ${f}`).join('\n')
          : '   (sin fragmentos)';
        return `*${i+1}.* 👤 ${m.name} dijo: ${m.prompt}\n🤖 PandaBot: ${m.response_short}\n📌 Memoria:\n${fr}`;
      }).join('\n\n');
    } else {
      texto += '🗨️ No hay interacciones guardadas.';
    }

    if (resums.length) texto += `\n\n📜 *Resúmenes:* \n\n${resums.join('\n\n')}`;

    await sock.sendMessage(from, { text: texto }, { quoted: msg });
    return;
  }

  // Subcomando: olvidar
  if (userText.toLowerCase() === 'olvidar') {
    db.users[chatId].memoria = [];
    db.users[chatId].resumenes = [];
    guardarDatabase(db);
    return sock.sendMessage(from, { text: '🧠 Memoria del chat limpiada.' }, { quoted: msg });
  }

  // Historial para memoria
  const historial = db.users[chatId].memoria
    .map(m => `👤 ${m.name}: ${m.prompt}\n🤖 ${m.response_full}`)
    .join('\n\n');

  const resumenesPrevios = db.users[chatId].resumenes.join('\n');

  // ✅ Detectar mensaje citado y agregarlo al prompt
  let contextoRespondido = '';
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const quotedSender = msg.message?.extendedTextMessage?.contextInfo?.participant;

  if (quoted) {
    let quotedText = quoted.conversation
      || quoted.extendedTextMessage?.text
      || quoted.imageMessage?.caption
      || quoted.videoMessage?.caption
      || null;

    if (quotedText) {
      contextoRespondido = `
El usuario está respondiendo a un mensaje previo.
Mensaje original de "${quotedSender || 'desconocido'}":
"${quotedText}"
      `.trim();
    }
  }

  // ✅ System Prompt suave
  const systemPrompt = `
Eres PandaBot. Hablas amable, cercano y relajado. Humor suave. Solo usas groserías si el usuario lo hace primero.

Memoria estable:
${resumenesPrevios || '(sin resúmenes previos)'}

Memoria reciente:
${historial || '(sin historial previo)'}

Tu respuesta debe ser JSON:
{
 "reply": "mensaje natural para el chat",
 "memory_fragments": ["Hechos recordables con nombres"]
}
`.trim();

  // ✅ Prompt principal con contexto si existe
  const fullPrompt = `
${contextoRespondido}

El usuario "${pushName}" dijo:
"${userText}"

Responde siguiendo el systemPrompt.
`.trim();

  await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

  try {
    const generated = await callChatAPI({ prompt: fullPrompt, system: systemPrompt });

    let botPayload;
    try { botPayload = JSON.parse(generated); }
    catch { botPayload = { reply: generated, memory_fragments: [] }; }

    botPayload.reply = String(botPayload.reply ?? '');
    botPayload.memory_fragments = Array.isArray(botPayload.memory_fragments) ? botPayload.memory_fragments : [];

    const attributedFragments = botPayload.memory_fragments
      .map(f => f?.trim())
      .filter(Boolean)
      .map(f => f.toLowerCase().startsWith(pushName.toLowerCase()) ? f : `${pushName}: ${f}`);

    const fullReply = botPayload.reply;
    const shortReply = fullReply.length > MAX_RESPONSE_CHARS ? fullReply.slice(0, MAX_RESPONSE_CHARS) + '…' : fullReply;

    db.users[chatId].memoria.push({
      name: pushName,
      prompt: userText,
      response_full: fullReply,
      response_short: shortReply,
      memory_fragments: attributedFragments,
      timestamp: Date.now()
    });

    if (db.users[chatId].memoria.length > MEMORY_LIMIT) {
      db.users[chatId].memoria = db.users[chatId].memoria.slice(-MEMORY_LIMIT);
    }

    guardarDatabase(db);

    // Resumen si corresponde (no tocado)
    const mem = db.users[chatId].memoria;
    if (mem.length >= RESUME_TRIGGER) {
      const head = mem.slice(0, mem.length - KEEP_RECENT);
      const tail = mem.slice(-KEEP_RECENT);
      const frags = head.flatMap(m => m.memory_fragments).filter(Boolean);
      const rawSummaryInput = frags.length ? frags.map(f => `- ${f}`).join('\n') : '(sin datos útiles)';

      try {
        const resumenTexto = await callChatAPI({
          prompt: rawSummaryInput,
          system: `Sintetiza hechos claros y útiles con nombres.`
        });

        db.users[chatId].resumenes.push(resumenTexto);
        db.users[chatId].memoria = tail;
        guardarDatabase(db);
      } catch { /* fallback silencioso */ }
    }

    // ✅ Responde citando el mensaje original
    await sock.sendMessage(from, { text: botPayload.reply }, { quoted: msg });

  } catch (err) {
    console.error(err);
    return sock.sendMessage(from, { text: '🚨 Error interno.' }, { quoted: msg });
  }
}