import { cargarDatabase, guardarDatabase, inicializarUsuario } from '../data/database.js';

const rifasActivas = new Map();
const historialRifas = [];

export const command = 'rifa';

export async function run(sock, msg, args) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  
  const subcomando = args[0]?.toLowerCase() || 'ayuda';

  switch (subcomando) {
    case 'crear':
      await crearRifa(sock, msg, from, sender, args.slice(1));
      break;
    
    case 'comprar':
      await comprarNumeros(sock, msg, from, sender, args.slice(1));
      break;
    
    case 'ver':
    case 'info':
      await verRifa(sock, msg, from, sender, args.slice(1));
      break;
    
    case 'listar':
    case 'lista':
      await listarRifas(sock, from, msg);
      break;
    
    case 'misrifas':
      await misRifas(sock, from, sender, msg);
      break;
    
    case 'mynumeros':
      await misNumeros(sock, from, sender, msg);
      break;
    
    case 'sortear':
      await sortearRifa(sock, msg, from, sender, args.slice(1));
      break;
    
    case 'cancelar':
      await cancelarRifa(sock, msg, from, sender, args.slice(1));
      break;
    
    case 'top':
    case 'ranking':
      await rankingRifas(sock, from, msg);
      break;
    
    case 'ayuda':
    default:
      await mostrarAyudaRifa(sock, from, sender, msg);
  }
}

async function mostrarAyudaRifa(sock, from, sender, msg) {
  const ayuda = `🎫 *SISTEMA DE RIFAS* 🏆

🎮 *COMANDOS PRINCIPALES:*
• .rifa crear <premio> <precio> <numeros> - Crear nueva rifa
• .rifa comprar <id> <numeros> - Comprar números
• .rifa ver <id> - Ver información de rifa
• .rifa listar - Ver todas las rifas activas
• .rifa misrifas - Ver rifas que has creado
• .rifa mynumeros - Ver tus números comprados
• .rifa sortear <id> - Sortear rifa (solo creador)
• .rifa cancelar <id> - Cancelar rifa (solo creador)
• .rifa top - Top organizadores de rifas
• .rifa ayuda - Esta ayuda

🎯 *CÓMO FUNCIONA:*
1. Crea una rifa con un premio y precio por número
2. Otros usuarios compran números disponibles
3. Cuando todos los números se venden o decides sortear
4. Se elige un ganador aleatorio entre los números vendidos
5. El organizador recibe el dinero de las ventas
6. El ganador recibe el premio anunciado

💰 *EJEMPLO:*
.rifa crear "iPhone 15" 100 50
→ Crea rifa con 50 números a 100 coins cada uno
→ Premio: iPhone 15
→ Recaudación potencial: 5,000 coins

💎 *REGLA ORO:* El premio debe ser algo real que puedas entregar!

⏰ *Las rifas expiran después de 7 días automáticamente*`;

  await sock.sendMessage(from, { text: ayuda }, { quoted: msg });
}

async function crearRifa(sock, msg, from, sender, args) {
  if (args.length < 3) {
    return await sock.sendMessage(from, {
      text: '❌ Formato incorrecto.\n💡 Ejemplo: .rifa crear "iPhone 15" 100 50'
    }, { quoted: msg });
  }

  let premio = '';
  let i = 0;
  
  if (args[0].startsWith('"')) {
    while (i < args.length && !args[i].endsWith('"')) {
      premio += args[i] + ' ';
      i++;
    }
    if (i < args.length) {
      premio += args[i];
      i++;
    }
    premio = premio.replace(/"/g, '').trim();
  } else {
    premio = args[0];
    i = 1;
  }

  const precio = parseInt(args[i]);
  const totalNumeros = parseInt(args[i + 1]);
  
  if (isNaN(precio) || precio < 10) {
    return await sock.sendMessage(from, {
      text: '❌ Precio inválido. Mínimo: 10 pandacoins por número.'
    }, { quoted: msg });
  }
  
  if (isNaN(totalNumeros) || totalNumeros < 5 || totalNumeros > 500) {
    return await sock.sendMessage(from, {
      text: '❌ Número de tickets inválido. Mínimo: 5, Máximo: 500.'
    }, { quoted: msg });
  }

  let rifasDelCreador = 0;
  for (const [_, rifa] of rifasActivas) {
    if (rifa.creador === sender && rifa.estado === 'activa') {
      rifasDelCreador++;
    }
  }
  
  if (rifasDelCreador >= 5) {
    return await sock.sendMessage(from, {
      text: '❌ Límite alcanzado. Máximo 5 rifas activas por usuario.'
    }, { quoted: msg });
  }

  const rifaId = `rifa_${sender.split('@')[0]}_${Date.now()}`.substring(0, 20);
  
  const rifa = {
    id: rifaId,
    grupo: from,
    creador: sender,
    creadorNombre: `@${sender.split('@')[0]}`,
    premio: premio,
    precio: precio,
    totalNumeros: totalNumeros,
    numerosVendidos: new Map(),
    numerosDisponibles: Array.from({length: totalNumeros}, (_, i) => i + 1),
    recaudado: 0,
    estado: 'activa',
    creado: Date.now(),
    expira: Date.now() + (7 * 24 * 60 * 60 * 1000),
    ganador: null,
    numeroGanador: null
  };
  
  rifasActivas.set(rifaId, rifa);
  
  const recaudacionPotencial = (precio * totalNumeros).toLocaleString();
  
  const respuesta = `🎫 *¡RIFA CREADA EXITOSAMENTE!* ✅

📋 *INFORMACIÓN DE LA RIFA:*
🆔 *ID:* ${rifaId}
🎁 *Premio:* ${premio}
💰 *Precio por número:* ${precio.toLocaleString()} coins
🔢 *Números disponibles:* 1-${totalNumeros}
👤 *Organizador:* @${sender.split('@')[0]}

📊 *ESTADÍSTICAS:*
💸 Recaudación potencial: ${recaudacionPotencial} coins
📈 Tu ganancia potencial: ${recaudacionPotencial} coins
⏰ Expira en: 7 días

🎯 *PARA PARTICIPAR:*
\`.rifa comprar ${rifaId} <números>\`
Ejemplo: \`.rifa comprar ${rifaId} 5,12,25\`

🔍 *VER RIFA:* \`.rifa ver ${rifaId}\`

⚠️ *IMPORTANTE:* Asegúrate de poder entregar el premio si ganas reputación!`;

  await sock.sendMessage(from, {
    text: respuesta,
    mentions: [sender]
  }, { quoted: msg });
}

async function comprarNumeros(sock, msg, from, sender, args) {
  if (args.length < 2) {
    return await sock.sendMessage(from, {
      text: '❌ Formato incorrecto.\n💡 Ejemplo: .rifa comppar RIFA123 5,12,25'
    }, { quoted: msg });
  }

  const rifaId = args[0];
  const numerosTexto = args[1];
  
  const rifa = rifasActivas.get(rifaId);
  
  if (!rifa) {
    return await sock.sendMessage(from, {
      text: '❌ Rifa no encontrada. Verifica el ID.\n💡 Usa .rifa listar para ver rifas activas'
    }, { quoted: msg });
  }
  
  if (rifa.estado !== 'activa') {
    return await sock.sendMessage(from, {
      text: `❌ Esta rifa ya está ${rifa.estado === 'terminada' ? 'terminada' : 'cancelada'}.`
    }, { quoted: msg });
  }
  
  if (rifa.creador === sender) {
    return await sock.sendMessage(from, {
      text: '❌ No puedes comprar números en tu propia rifa.'
    }, { quoted: msg });
  }
  
  const numerosSolicitados = new Set();
  const partes = numerosTexto.split(/[, ]+/);
  
  for (const parte of partes) {
    const num = parseInt(parte);
    if (!isNaN(num) && num >= 1 && num <= rifa.totalNumeros) {
      numerosSolicitados.add(num);
    }
  }
  
  if (numerosSolicitados.size === 0) {
    return await sock.sendMessage(from, {
      text: `❌ Números inválidos. Deben ser entre 1 y ${rifa.totalNumeros}.`
    }, { quoted: msg });
  }
  
  const numerosNoDisponibles = [];
  const numerosDisponibles = [];
  
  for (const num of numerosSolicitados) {
    if (rifa.numerosVendidos.has(num)) {
      numerosNoDisponibles.push(num);
    } else {
      numerosDisponibles.push(num);
    }
  }
  
  if (numerosDisponibles.length === 0) {
    return await sock.sendMessage(from, {
      text: `❌ Todos los números solicitados ya están vendidos.\n🚫 No disponibles: ${numerosNoDisponibles.join(', ')}`
    }, { quoted: msg });
  }
  
  const costoTotal = numerosDisponibles.length * rifa.precio;
  
  const db = cargarDatabase();
  inicializarUsuario(sender, db);
  
  const comprador = db.users[sender];
  
  if (comprador.pandacoins < costoTotal) {
    return await sock.sendMessage(from, {
      text: `❌ No tienes suficientes pandacoins.\n💰 Necesitas: ${costoTotal.toLocaleString()}\n💳 Tienes: ${comprador.pandacoins.toLocaleString()}`
    }, { quoted: msg });
  }
  
  comprador.pandacoins -= costoTotal;
  
  const comision = Math.floor(costoTotal * 0.05);
  const pagoCreador = costoTotal - comision;
  
  inicializarUsuario(rifa.creador, db);
  const creador = db.users[rifa.creador];
  creador.pandacoins += pagoCreador;
  
  comprador.stats = comprador.stats || {};
  comprador.stats.rifas_participadas = (comprador.stats.rifas_participadas || 0) + 1;
  comprador.stats.rifas_gastado = (comprador.stats.rifas_gastado || 0) + costoTotal;
  
  creador.stats = creador.stats || {};
  creador.stats.rifas_creadas = (creador.stats.rifas_creadas || 0) + 1;
  creador.stats.rifas_ganancias = (creador.stats.rifas_ganancias || 0) + pagoCreador;
  
  for (const num of numerosDisponibles) {
    rifa.numerosVendidos.set(num, {
      comprador: sender,
      compradorNombre: `@${sender.split('@')[0]}`,
      fechaCompra: Date.now()
    });
    
    const index = rifa.numerosDisponibles.indexOf(num);
    if (index !== -1) {
      rifa.numerosDisponibles.splice(index, 1);
    }
  }
  
  rifa.recaudado += costoTotal;
  
  if (rifa.numerosVendidos.size === rifa.totalNumeros) {
    rifa.estado = 'completa';
    
    setTimeout(() => {
      sock.sendMessage(from, {
        text: `🎉 *¡RIFA COMPLETADA!* 🎉\n\n` +
              `🆔 Rifa: ${rifaId}\n` +
              `🎁 Premio: ${rifa.premio}\n` +
              `💰 Recaudado: ${rifa.recaudado.toLocaleString()} coins\n` +
              `👤 Creador: ${rifa.creadorNombre}\n\n` +
              `⚡ @${rifa.creador.split('@')[0]}, usa \`.rifa sortear ${rifaId}\` para elegir ganador!`,
        mentions: [rifa.creador]
      });
    }, 1000);
  }
  
  rifasActivas.set(rifaId, rifa);
  guardarDatabase(db);
  
  let respuesta = `✅ *COMPRA EXITOSA* 🎫\n\n`;
  respuesta += `🆔 *Rifa:* ${rifaId}\n`;
  respuesta += `🎁 *Premio:* ${rifa.premio}\n`;
  respuesta += `👤 *Organizador:* ${rifa.creadorNombre}\n\n`;
  
  respuesta += `📋 *NÚMEROS COMPRADOS:*\n`;
  respuesta += `✅ Disponibles: ${numerosDisponibles.join(', ')}\n`;
  if (numerosNoDisponibles.length > 0) {
    respuesta += `❌ No disponibles: ${numerosNoDisponibles.join(', ')}\n`;
  }
  
  respuesta += `\n💰 *DETALLES DE PAGO:*\n`;
  respuesta += `📦 Números: ${numerosDisponibles.length}\n`;
  respuesta += `💸 Precio unitario: ${rifa.precio.toLocaleString()} coins\n`;
  respuesta += `💳 Total pagado: ${costoTotal.toLocaleString()} coins\n`;
  respuesta += `🏦 Nuevo saldo: ${comprador.pandacoins.toLocaleString()} coins\n\n`;
  
  respuesta += `🎯 *ESTADÍSTICAS DE LA RIFA:*\n`;
  respuesta += `📊 Vendidos: ${rifa.numerosVendidos.size}/${rifa.totalNumeros}\n`;
  respuesta += `💰 Recaudado: ${rifa.recaudado.toLocaleString()} coins\n`;
  respuesta += `📈 Tu probabilidad: ${((numerosDisponibles.length / rifa.totalNumeros) * 100).toFixed(1)}%\n\n`;
  
  respuesta += `💡 *Tu ticket:* Guarda este mensaje como comprobante!`;
  
  await sock.sendMessage(from, {
    text: respuesta,
    mentions: [sender, rifa.creador]
  }, { quoted: msg });
}

async function verRifa(sock, msg, from, sender, args) {
  if (args.length < 1) {
    return await sock.sendMessage(from, {
      text: '❌ Especifica el ID de la rifa.\n💡 Ejemplo: .rifa ver RIFA123'
    }, { quoted: msg });
  }

  const rifaId = args[0];
  const rifa = rifasActivas.get(rifaId);
  
  if (!rifa) {
    return await sock.sendMessage(from, {
      text: '❌ Rifa no encontrada.'
    }, { quoted: msg });
  }
  
  const tiempoRestante = Math.max(0, rifa.expira - Date.now());
  const dias = Math.floor(tiempoRestante / (24 * 60 * 60 * 1000));
  const horas = Math.floor((tiempoRestante % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  
  const numerosDisponibles = rifa.numerosDisponibles.slice(0, 20); // Mostrar solo primeros 20
  
  let respuesta = `🎫 *INFORMACIÓN DE RIFA* 📋\n\n`;
  
  respuesta += `🆔 *ID:* ${rifa.id}\n`;
  respuesta += `🎁 *Premio:* ${rifa.premio}\n`;
  respuesta += `👤 *Creador:* ${rifa.creadorNombre}\n`;
  respuesta += `📅 *Creada:* Hace ${Math.floor((Date.now() - rifa.creado) / (60 * 60 * 1000))} horas\n`;
  respuesta += `⏰ *Expira en:* ${dias}d ${horas}h\n`;
  respuesta += `📊 *Estado:* ${rifa.estado.toUpperCase()}\n\n`;
  
  respuesta += `💰 *INFORMACIÓN ECONÓMICA:*\n`;
  respuesta += `💸 Precio por número: ${rifa.precio.toLocaleString()} coins\n`;
  respuesta += `📦 Números totales: ${rifa.totalNumeros}\n`;
  respuesta += `✅ Vendidos: ${rifa.numerosVendidos.size}\n`;
  respuesta += `🔄 Disponibles: ${rifa.numerosDisponibles.length}\n`;
  respuesta += `🏦 Recaudado: ${rifa.recaudado.toLocaleString()} coins\n\n`;
  
  if (rifa.ganador) {
    respuesta += `🏆 *GANADOR:*\n`;
    respuesta += `👑 ${rifa.ganador}\n`;
    respuesta += `🎯 Número ganador: ${rifa.numeroGanador}\n\n`;
  }
  
  respuesta += `🔢 *NÚMEROS DISPONIBLES (primeros 20):*\n`;
  if (numerosDisponibles.length > 0) {
    respuesta += `${numerosDisponibles.join(', ')}`;
    if (rifa.numerosDisponibles.length > 20) {
      respuesta += `... y ${rifa.numerosDisponibles.length - 20} más`;
    }
  } else {
    respuesta += `❌ No hay números disponibles`;
  }
  
  respuesta += `\n\n🎯 *PARA COMPRAR:*\n`;
  respuesta += `\`.rifa comprar ${rifa.id} <números>\`\n`;
  respuesta += `Ejemplo: \`.rifa comprar ${rifa.id} 1,5,10\``;
  
  if (rifa.estado === 'activa') {
    const probabilidad = rifa.numerosDisponibles.length > 0 ? 
      (1 / rifa.totalNumeros * 100).toFixed(2) : '0';
    
    respuesta += `\n\n📈 *Tu probabilidad si compras 1 número:* ${probabilidad}%`;
  }
  
  await sock.sendMessage(from, { 
    text: respuesta,
    mentions: [rifa.creador].concat(rifa.ganador ? [rifa.ganador] : [])
  }, { quoted: msg });
}

async function listarRifas(sock, from, msg) {
  const rifasArray = Array.from(rifasActivas.values())
    .filter(rifa => rifa.estado === 'activa' && rifa.grupo === from)
    .sort((a, b) => b.creado - a.creado);
  
  if (rifasArray.length === 0) {
    return await sock.sendMessage(from, {
      text: '📭 *No hay rifas activas en este grupo.*\n💡 ¡Sé el primero en crear una con `.rifa crear`!'
    }, { quoted: msg });
  }
  
  let listaTexto = `🎫 *RIFAS ACTIVAS EN ESTE GRUPO* 📋\n\n`;
  
  rifasArray.slice(0, 10).forEach((rifa, index) => {
    const porcentajeVendido = Math.round((rifa.numerosVendidos.size / rifa.totalNumeros) * 100);
    const tiempoRestante = Math.max(0, rifa.expira - Date.now());
    const dias = Math.floor(tiempoRestante / (24 * 60 * 60 * 1000));
    
    listaTexto += `${index + 1}. 🆔 *${rifa.id}*\n`;
    listaTexto += `   🎁 ${rifa.premio.substring(0, 30)}${rifa.premio.length > 30 ? '...' : ''}\n`;
    listaTexto += `   👤 ${rifa.creadorNombre}\n`;
    listaTexto += `   💰 ${rifa.precio.toLocaleString()} coins c/u\n`;
    listaTexto += `   📊 ${rifa.numerosVendidos.size}/${rifa.totalNumeros} (${porcentajeVendido}%)\n`;
    listaTexto += `   ⏰ ${dias}d restantes\n`;
    listaTexto += `   🔗 \`.rifa ver ${rifa.id}\`\n\n`;
  });
  
  if (rifasArray.length > 10) {
    listaTexto += `📌 ... y ${rifasArray.length - 10} rifas más\n`;
  }
  
  listaTexto += `💡 *Para participar:*\n`;
  listaTexto += `\`.rifa comprar <ID> <números>\`\n`;
  listaTexto += `\`.rifa crear <premio> <precio> <numeros>\``;
  
  await sock.sendMessage(from, { text: listaTexto }, { quoted: msg });
}

async function misRifas(sock, from, sender, msg) {
  const misRifasArray = Array.from(rifasActivas.values())
    .filter(rifa => rifa.creador === sender)
    .sort((a, b) => b.creado - a.creado);
  
  const db = cargarDatabase();
  inicializarUsuario(sender, db);
  const user = db.users[sender];
  const stats = user.stats || {};
  
  if (misRifasArray.length === 0) {
    return await sock.sendMessage(from, {
      text: `📭 *No has creado ninguna rifa.*\n\n` +
            `🎯 *Tus estadísticas:*\n` +
            `📊 Rifas creadas: ${stats.rifas_creadas || 0}\n` +
            `💰 Ganancias: ${stats.rifas_ganancias?.toLocaleString() || 0} coins\n\n` +
            `💡 ¡Crea tu primera rifa con \`.rifa crear\`!`
    }, { quoted: msg });
  }
  
  let respuesta = `📋 *TUS RIFAS* 👑\n\n`;
  
  respuesta += `📊 *ESTADÍSTICAS:*\n`;
  respuesta += `🎫 Total creadas: ${stats.rifas_creadas || 0}\n`;
  respuesta += `💰 Ganancias totales: ${stats.rifas_ganancias?.toLocaleString() || 0} coins\n`;
  respuesta += `🏆 Rifas sorteadas: ${stats.rifas_sorteadas || 0}\n\n`;
  
  respuesta += `🎫 *RIFAS ACTIVAS:*\n`;
  
  const rifasActivasList = misRifasArray.filter(r => r.estado === 'activa');
  const rifasTerminadas = misRifasArray.filter(r => r.estado !== 'activa');
  
  if (rifasActivasList.length === 0) {
    respuesta += `📭 No tienes rifas activas\n`;
  } else {
    rifasActivasList.slice(0, 5).forEach((rifa, index) => {
      const porcentaje = Math.round((rifa.numerosVendidos.size / rifa.totalNumeros) * 100);
      respuesta += `${index + 1}. 🆔 ${rifa.id}\n`;
      respuesta += `   🎁 ${rifa.premio.substring(0, 20)}...\n`;
      respuesta += `   📊 ${porcentaje}% vendido\n`;
      respuesta += `   💰 ${rifa.recaudado.toLocaleString()} coins\n`;
      respuesta += `   🔗 \`.rifa ver ${rifa.id}\`\n\n`;
    });
  }
  
  if (rifasTerminadas.length > 0) {
    respuesta += `📜 *RIFAS TERMINADAS:* ${rifasTerminadas.length}\n`;
    respuesta += `💡 Usa \`.rifa ver <ID>\` para ver detalles`;
  }
  
  respuesta += `\n\n🎯 *CREAR NUEVA RIFA:*\n`;
  respuesta += `\`.rifa crear "premio" <precio> <numeros>\``;
  
  await sock.sendMessage(from, {
    text: respuesta,
    mentions: [sender]
  }, { quoted: msg });
}

async function misNumeros(sock, from, sender, msg) {
  const db = cargarDatabase();
  inicializarUsuario(sender, db);
  const user = db.users[sender];
  const stats = user.stats || {};
  
  const misCompras = [];
  
  for (const [rifaId, rifa] of rifasActivas) {
    for (const [numero, datos] of rifa.numerosVendidos) {
      if (datos.comprador === sender) {
        misCompras.push({
          rifaId,
          rifa,
          numero,
          datos
        });
      }
    }
  }
  
  if (misCompras.length === 0) {
    return await sock.sendMessage(from, {
      text: `📭 *No has comprado números en ninguna rifa.*\n\n` +
            `🎯 *Tus estadísticas:*\n` +
            `📊 Rifas participadas: ${stats.rifas_participadas || 0}\n` +
            `💰 Dinero gastado: ${stats.rifas_gastado?.toLocaleString() || 0} coins\n` +
            `🏆 Rifas ganadas: ${stats.rifas_ganadas || 0}\n\n` +
            `💡 ¡Participa en una rifa con \`.rifa listar\` y luego \`.rifa comprar\`!`
    }, { quoted: msg });
  }
  
  const rifasMap = new Map();
  misCompras.forEach(compra => {
    if (!rifasMap.has(compra.rifaId)) {
      rifasMap.set(compra.rifaId, {
        rifa: compra.rifa,
        numeros: [],
        totalGastado: 0
      });
    }
    const entrada = rifasMap.get(compra.rifaId);
    entrada.numeros.push(compra.numero);
    entrada.totalGastado += compra.rifa.precio;
  });
  
  let respuesta = `🎫 *TUS NÚMEROS COMPRADOS* 📋\n\n`;
  
  respuesta += `📊 *ESTADÍSTICAS:*\n`;
  respuesta += `🎫 Rifas participadas: ${stats.rifas_participadas || 0}\n`;
  respuesta += `🔢 Números comprados: ${misCompras.length}\n`;
  respuesta += `💰 Total gastado: ${stats.rifas_gastado?.toLocaleString() || 0} coins\n`;
  respuesta += `🏆 Rifas ganadas: ${stats.rifas_ganadas || 0}\n\n`;
  
  respuesta += `📋 *TUS PARTICIPACIONES:*\n`;
  
  let index = 1;
  for (const [rifaId, datos] of rifasMap) {
    if (index > 5) break;
    
    const rifa = datos.rifa;
    const porcentaje = (datos.numeros.length / rifa.totalNumeros * 100).toFixed(1);
    const estado = rifa.estado === 'activa' ? '⏳ Activa' : 
                   rifa.estado === 'terminada' ? '🏆 Terminada' : '❌ Cancelada';
    
    respuesta += `${index}. 🆔 *${rifaId}*\n`;
    respuesta += `   🎁 ${rifa.premio.substring(0, 25)}${rifa.premio.length > 25 ? '...' : ''}\n`;
    respuesta += `   🔢 Tus números: ${datos.numeros.sort((a,b) => a-b).join(', ')}\n`;
    respuesta += `   📈 Tu probabilidad: ${porcentaje}%\n`;
    respuesta += `   💰 Gastado: ${datos.totalGastado.toLocaleString()} coins\n`;
    respuesta += `   📊 Estado: ${estado}\n`;
    respuesta += `   🔗 \`.rifa ver ${rifaId}\`\n\n`;
    
    index++;
  }
  
  if (rifasMap.size > 5) {
    respuesta += `📌 ... y ${rifasMap.size - 5} rifas más\n`;
  }
  
  respuesta += `💡 *Para comprar más números:*\n`;
  respuesta += `1. Usa \`.rifa listar\` para ver rifas\n`;
  respuesta += `2. \`.rifa comprar <ID> <números>\``;
  
  await sock.sendMessage(from, {
    text: respuesta,
    mentions: [sender]
  }, { quoted: msg });
}

async function sortearRifa(sock, msg, from, sender, args) {
  if (args.length < 1) {
    return await sock.sendMessage(from, {
      text: '❌ Especifica el ID de la rifa.\n💡 Ejemplo: .rifa sortear RIFA123'
    }, { quoted: msg });
  }

  const rifaId = args[0];
  const rifa = rifasActivas.get(rifaId);
  
  if (!rifa) {
    return await sock.sendMessage(from, {
      text: '❌ Rifa no encontrada.'
    }, { quoted: msg });
  }
  
  if (rifa.creador !== sender) {
    return await sock.sendMessage(from, {
      text: '❌ Solo el creador de la rifa puede sortearla.'
    }, { quoted: msg });
  }
  
  if (rifa.estado !== 'activa' && rifa.estado !== 'completa') {
    return await sock.sendMessage(from, {
      text: `❌ Esta rifa ya está ${rifa.estado === 'terminada' ? 'terminada' : 'cancelada'}.`
    }, { quoted: msg });
  }
  
  if (rifa.numerosVendidos.size === 0) {
    return await sock.sendMessage(from, {
      text: '❌ No se ha vendido ningún número todavía.'
    }, { quoted: msg });
  }
  
  await sock.sendMessage(from, {
    text: `🎰 *INICIANDO SORTEO DE RIFA* 🎰\n\n` +
          `🆔 Rifa: ${rifaId}\n` +
          `🎁 Premio: ${rifa.premio}\n` +
          `👥 Participantes: ${rifa.numerosVendidos.size}\n\n` +
          `⚡ ¡Preparando el sorteo...!`
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await sock.sendMessage(from, {
    text: `🔢 *REVOLVIENDO LOS NÚMEROS...* 🔢\n\n` +
          `🎯 Números participantes: ${Array.from(rifa.numerosVendidos.keys()).join(', ')}`
  });
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const numerosVendidosArray = Array.from(rifa.numerosVendidos.entries());
  const [numeroGanador, datosGanador] = numerosVendidosArray[
    Math.floor(Math.random() * numerosVendidosArray.length)
  ];
  
  rifa.estado = 'terminada';
  rifa.ganador = datosGanador.comprador;
  rifa.ganadorNombre = datosGanador.compradorNombre;
  rifa.numeroGanador = numeroGanador;
  rifasActivas.set(rifaId, rifa);
  
  const db = cargarDatabase();
  
  inicializarUsuario(datosGanador.comprador, db);
  const ganadorUser = db.users[datosGanador.comprador];
  ganadorUser.stats = ganadorUser.stats || {};
  ganadorUser.stats.rifas_ganadas = (ganadorUser.stats.rifas_ganadas || 0) + 1;
  
  const creadorUser = db.users[rifa.creador];
  creadorUser.stats = creadorUser.stats || {};
  creadorUser.stats.rifas_sorteadas = (creadorUser.stats.rifas_sorteadas || 0) + 1;
  
  guardarDatabase(db);
  
  historialRifas.push({
    rifaId,
    premio: rifa.premio,
    creador: rifa.creador,
    ganador: datosGanador.comprador,
    numeroGanador,
    recaudado: rifa.recaudado,
    timestamp: Date.now(),
    grupo: from
  });
  
  if (historialRifas.length > 50) {
    historialRifas.shift();
  }
  
  const respuesta = `🎉 *¡TENEMOS UN GANADOR!* 🏆\n\n`;
  respuesta += `🆔 *Rifa:* ${rifaId}\n`;
  respuesta += `🎁 *Premio:* ${rifa.premio}\n`;
  respuesta += `💰 *Recaudado:* ${rifa.recaudado.toLocaleString()} coins\n\n`;
  respuesta += `🎯 *NÚMERO GANADOR:* ${numeroGanador} 🎯\n\n`;
  respuesta += `👑 *¡FELICIDADES!* 👑\n`;
  respuesta += `🏆 *GANADOR:* ${datosGanador.compradorNombre}\n`;
  respuesta += `🎫 *Número comprado:* ${numeroGanador}\n`;
  respuesta += `📅 *Fecha de compra:* ${new Date(datosGanador.fechaCompra).toLocaleDateString()}\n\n`;
  respuesta += `👤 *Organizador:* ${rifa.creadorNombre}\n`;
  respuesta += `📞 *Contacta al organizador para reclamar tu premio!*\n\n`;
  respuesta += `🎊 *¡Felicidades al ganador!* 🎊`;
  
  await sock.sendMessage(from, {
    text: respuesta,
    mentions: [datosGanador.comprador, rifa.creador]
  });
}

async function cancelarRifa(sock, msg, from, sender, args) {
  if (args.length < 1) {
    return await sock.sendMessage(from, {
      text: '❌ Especifica el ID de la rifa.\n💡 Ejemplo: .rifa cancelar RIFA123'
    }, { quoted: msg });
  }

  const rifaId = args[0];
  const rifa = rifasActivas.get(rifaId);
  
  if (!rifa) {
    return await sock.sendMessage(from, {
      text: '❌ Rifa no encontrada.'
    }, { quoted: msg });
  }
  
  if (rifa.creador !== sender) {
    return await sock.sendMessage(from, {
      text: '❌ Solo el creador de la rifa puede cancelarla.'
    }, { quoted: msg });
  }
  
  if (rifa.estado !== 'activa') {
    return await sock.sendMessage(from, {
      text: `❌ Esta rifa ya está ${rifa.estado}.`
    }, { quoted: msg });
  }
  
  if (rifa.numerosVendidos.size > 0) {
    const db = cargarDatabase();
    
    for (const [_, datos] of rifa.numerosVendidos) {
      const comprador = db.users[datos.comprador];
      if (comprador) {
        comprador.pandacoins += rifa.precio;
      }
    }
    
    guardarDatabase(db);
  }
  
  rifa.estado = 'cancelada';
  rifasActivas.set(rifaId, rifa);
  
  let respuesta = `❌ *RIFA CANCELADA* 🚫\n\n`;
  respuesta += `🆔 *ID:* ${rifaId}\n`;
  respuesta += `🎁 *Premio:* ${rifa.premio}\n`;
  respuesta += `👤 *Cancelada por:* @${sender.split('@')[0]}\n\n`;
  
  if (rifa.numerosVendidos.size > 0) {
    respuesta += `💰 *Se han devuelto ${rifa.numerosVendidos.size * rifa.precio} coins a los compradores.*\n`;
    respuesta += `👥 *Compradores afectados:* ${rifa.numerosVendidos.size}\n`;
  }
  
  respuesta += `\n📝 *Razón:* Cancelada por el organizador`;
  
  await sock.sendMessage(from, {
    text: respuesta,
    mentions: [sender]
  }, { quoted: msg });
}

async function rankingRifas(sock, from, msg) {
  const db = cargarDatabase();
  
  const usuariosConStats = Object.entries(db.users)
    .filter(([_, user]) => user.stats?.rifas_creadas || user.stats?.rifas_ganadas)
    .map(([id, user]) => ({
      id,
      nombre: `@${id.split('@')[0]}`,
      creadas: user.stats.rifas_creadas || 0,
      ganancias: user.stats.rifas_ganancias || 0,
      ganadas: user.stats.rifas_ganadas || 0,
      sorteadas: user.stats.rifas_sorteadas || 0
    }));
  
  const topCreadores = [...usuariosConStats]
    .sort((a, b) => b.creadas - a.creadas)
    .slice(0, 10);
  
  const topGanadores = [...usuariosConStats]
    .sort((a, b) => b.ganadas - a.ganadas)
    .slice(0, 10);
  
  const topRecaudadores = [...usuariosConStats]
    .sort((a, b) => b.ganancias - a.ganancias)
    .slice(0, 10);
  
  let respuesta = `🏆 *RANKING DE RIFAS* 📊\n\n`;
  
  respuesta += `👑 *TOP 5 CREADORES:*\n`;
  topCreadores.slice(0, 5).forEach((user, index) => {
    const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
    respuesta += `${emoji} ${user.nombre}\n`;
    respuesta += `   🎫 ${user.creadas} rifas | 💰 ${user.ganancias.toLocaleString()} coins\n`;
  });
  
  respuesta += `\n🏅 *TOP 5 GANADORES:*\n`;
  topGanadores.slice(0, 5).forEach((user, index) => {
    const emoji = index === 0 ? '👑' : index === 1 ? '⭐' : index === 2 ? '🌟' : '✨';
    respuesta += `${emoji} ${user.nombre}\n`;
    respuesta += `   🏆 ${user.ganadas} premios ganados\n`;
  });
  
  respuesta += `\n💰 *TOP 5 RECAUDADORES:*\n`;
  topRecaudadores.slice(0, 5).forEach((user, index) => {
    const emoji = index === 0 ? '💰' : index === 1 ? '💎' : index === 2 ? '💵' : '💸';
    respuesta += `${emoji} ${user.nombre}\n`;
    respuesta += `   🏦 ${user.ganancias.toLocaleString()} coins recaudados\n`;
  });
  
  const totalRifas = topCreadores.reduce((sum, user) => sum + user.creadas, 0);
  const totalGanado = topRecaudadores.reduce((sum, user) => sum + user.ganancias, 0);
  const totalPremios = topGanadores.reduce((sum, user) => sum + user.ganadas, 0);
  
  respuesta += `\n📈 *ESTADÍSTICAS GLOBALES:*\n`;
  respuesta += `🎫 Rifas creadas: ${totalRifas}\n`;
  respuesta += `💰 Dinero movido: ${totalGanado.toLocaleString()} coins\n`;
  respuesta += `🏆 Premios entregados: ${totalPremios}\n`;
  respuesta += `👥 Usuarios activos: ${usuariosConStats.length}\n\n`;
  
  respuesta += `💡 *¡Crea tu propia rifa para aparecer en el ranking!*\n`;
  respuesta += `🎯 Comando: \`.rifa crear "premio" <precio> <numeros>\``;
  
  await sock.sendMessage(from, { text: respuesta }, { quoted: msg });
}

setInterval(() => {
  const ahora = Date.now();
  
  for (const [rifaId, rifa] of rifasActivas) {
    if (rifa.estado === 'activa' && ahora > rifa.expira) {
      rifa.estado = 'expirada';
      rifasActivas.set(rifaId, rifa);
      
      if (rifa.numerosVendidos.size > 0) {
        const db = cargarDatabase();
        
        for (const [_, datos] of rifa.numerosVendidos) {
          const comprador = db.users[datos.comprador];
          if (comprador) {
            comprador.pandacoins += rifa.precio;
          }
        }
        
        guardarDatabase(db);
        
        setTimeout(() => {
          sock.sendMessage(rifa.grupo, {
            text: `⏰ *RIFA EXPIRADA* ⏰\n\n` +
                  `🆔 ${rifaId}\n` +
                  `🎁 ${rifa.premio}\n` +
                  `👤 Creador: ${rifa.creadorNombre}\n\n` +
                  `❌ Esta rifa ha expirado después de 7 días.\n` +
                  `💰 Se han devuelto ${rifa.numerosVendidos.size * rifa.precio} coins a los compradores.`
          });
        }, 1000);
      }
    }
    
    if ((rifa.estado === 'terminada' || rifa.estado === 'cancelada' || rifa.estado === 'expirada') && 
        (ahora - rifa.creado) > 30 * 24 * 60 * 60 * 1000) {
      rifasActivas.delete(rifaId);
    }
  }
}, 60 * 60 * 1000);
