// lib/stickerUtils.js
import webp from 'node-webpmux';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';

// Extraer metadata de un sticker
export async function extractStickerMetadata(stickerBuffer) {
  try {
    const img = new webp.Image();
    await img.load(stickerBuffer);
    
    if (!img.exif) {
      return null; // No tiene metadata
    }
    
    // El metadata está en formato JSON dentro del EXIF
    const exifBuffer = Buffer.from(img.exif);
    
    // Buscar el JSON en el buffer (está después de los primeros 22 bytes)
    const jsonStart = 22;
    const jsonLength = exifBuffer.readUInt32LE(14);
    
    if (jsonStart + jsonLength > exifBuffer.length) {
      return null;
    }
    
    const jsonBuffer = exifBuffer.slice(jsonStart, jsonStart + jsonLength);
    const metadata = JSON.parse(jsonBuffer.toString('utf8'));
    
    return {
      packname: metadata['sticker-pack-name'] || '',
      author: metadata['sticker-pack-publisher'] || '',
      categories: metadata.emojis || ['']
    };
  } catch (error) {
    console.error('❌ Error extrayendo metadata:', error);
    return null;
  }
}

// Crear sticker con nueva metadata
export async function createStickerWithNewMetadata(stickerBuffer, newMetadata) {
  try {
    const img = new webp.Image();
    await img.load(stickerBuffer);
    
    const json = {
      "sticker-pack-id": "pandabot-id",
      "sticker-pack-name": newMetadata.packname || 'PandaBot',
      "sticker-pack-publisher": newMetadata.author || 'by lukas',
      "emojis": newMetadata.categories || ['']
    };
    
    const exif = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]); 
    const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8"); 
    const newExif = Buffer.concat([exif, jsonBuff]); 
    newExif.writeUIntLE(jsonBuff.length, 14, 4); 

    img.exif = newExif; 
    const finalBuffer = await img.save(null);
    
    return finalBuffer;
  } catch (error) {
    console.error('❌ Error creando sticker con nueva metadata:', error);
    throw error;
  }
}

// Guardar buffer temporalmente
export function saveTempFile(buffer, extension = 'webp') {
  const tempPath = path.join(tmpdir(), `sticker_temp_${Date.now()}.${extension}`);
  fs.writeFileSync(tempPath, buffer);
  return tempPath;
}
