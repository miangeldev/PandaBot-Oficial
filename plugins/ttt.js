// commands/tictactoe.js
import { cargarDatabase, guardarDatabase, inicializarUsuario } from '../data/database.js';

const partidasActivas = new Map(); // Almacena partidas activas

export const command = 'ttt';

export async function run(sock, msg, args) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  
  const subcomando = args[0]?.toLowerCase() || 'ayuda';

  switch (subcomando) {
    case 'jugar':
    case 'desafiar':
      await desafiarJugador(sock, msg, from, sender, args.slice(1));
      break;
    
    case 'aceptar':
    case 'accept':
      await aceptarDesafio(sock, msg, from, sender);
      break;
    
    case 'rechazar':
    case 'decline':
      await rechazarDesafio(sock, msg, from, sender);
      break;
    
    case 'mover':
    case 'move':
      await hacerMovimiento(sock, msg, from, sender, args.slice(1));
      break;
    
    case 'rendirse':
    case 'surrender':
      await rendirse(sock, msg, from, sender);
      break;
    
    case 'tablero':
    case 'board':
      await mostrarTablero(sock, msg, from, sender);
      break;
    
    case 'ayuda':
    case 'help':
    default:
      await mostrarAyuda(sock, from, sender, msg);
  }
}

async function mostrarAyuda(sock, from, sender, msg) {
  const ayuda = `❌ *TIC TAC TOE - TRES EN RAYA* 🎮

🎯 *COMANDOS:*
• .ttt jugar @usuario <apuesta> - Desafiar a un jugador
• .ttt aceptar - Aceptar desafío pendiente
• .ttt rechazar - Rechazar desafío
• .ttt mover <posición> - Hacer movimiento (1-9)
• .ttt tablero - Ver tablero actual
• .ttt rendirse - Rendirte de la partida
• .ttt ayuda - Esta ayuda

📊 *POSICIONES DEL TABLERO:*
 1 │ 2 │ 3
───┼───┼───
 4 │ 5 │ 6
───┼───┼───
 7 │ 8 │ 9

💰 *MECÁNICAS:*
• Apuesta mínima: 100 pandacoins
• Ganas la apuesta del oponente si ganas
• Empate: Cada uno recupera su apuesta
• Tienes 3 minutos por movimiento

⚡ *¡Demuestra tu estrategia y gana grandes premios!*`;

  await sock.sendMessage(from, { text: ayuda }, { quoted: msg });
}

async function desafiarJugador(sock, msg, from, sender, args) {
  // Obtener usuario mencionado
  const mencionado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
  
  if (!mencionado) {
    return await sock.sendMessage(from, {
      text: '❌ Debes mencionar a un jugador.\n💡 Ejemplo: .ttt jugar @usuario 500'
    }, { quoted: msg });
  }

  if (mencionado === sender) {
    return await sock.sendMessage(from, {
      text: '❌ No puedes jugar contra ti mismo.'
    }, { quoted: msg });
  }

  // Obtener apuesta
  const apuesta = parseInt(args.find(arg => !isNaN(arg))) || 100;
  
  if (apuesta < 100) {
    return await sock.sendMessage(from, {
      text: '❌ Apuesta mínima: 100 pandacoins.'
    }, { quoted: msg });
  }

  const db = cargarDatabase();
  inicializarUsuario(sender, db);
  inicializarUsuario(mencionado, db);

  const jugador1 = db.users[sender];
  const jugador2 = db.users[mencionado];

  // Verificar fondos
  if (jugador1.pandacoins < apuesta) {
    return await sock.sendMessage(from, {
      text: `❌ No tienes suficientes pandacoins.\n💰 Necesitas: ${apuesta}\n💳 Tienes: ${jugador1.pandacoins}`
    }, { quoted: msg });
  }

  if (jugador2.pandacoins < apuesta) {
    return await sock.sendMessage(from, {
      text: `❌ @${mencionado.split('@')[0]} no tiene suficientes pandacoins para apostar.`,
      mentions: [mencionado]
    }, { quoted: msg });
  }

  // Verificar si ya hay partida pendiente
  for (const [partidaId, partida] of partidasActivas) {
    if (partida.jugador1 === sender && partida.jugador2 === mencionado && partida.estado === 'pendiente') {
      return await sock.sendMessage(from, {
        text: `⚠️ Ya tienes un desafío pendiente con @${mencionado.split('@')[0]}.`
      }, { quoted: msg });
    }
  }

  // Crear nueva partida
  const partidaId = `${sender}_${mencionado}_${Date.now()}`;
  
  partidasActivas.set(partidaId, {
    id: partidaId,
    jugador1: sender,
    jugador2: mencionado,
    apuesta: apuesta,
    tablero: Array(9).fill(' '),
    turno: sender, // Jugador 1 empieza
    estado: 'pendiente',
    creado: Date.now(),
    ultimoMovimiento: Date.now(),
    ganador: null,
    movimientos: []
  });

  // Congelar apuesta del jugador 1
  jugador1.pandacoins -= apuesta;
  guardarDatabase(db);

  // Mensaje de desafío
  const mensajeDesafio = `🎮 *DESAFÍO DE TIC TAC TOE* ⚔️

👤 *Desafiante:* @${sender.split('@')[0]}
👤 *Retado:* @${mencionado.split('@')[0]}
💰 *Apuesta:* ${apuesta.toLocaleString()} pandacoins

⚡ @${mencionado.split('@')[0]}, ¿aceptas el desafío?

✅ *Para aceptar:*
.ttt aceptar

❌ *Para rechazar:*
.ttt rechazar

⏰ *Tienes 2 minutos para responder.*`;

  await sock.sendMessage(from, {
    text: mensajeDesafio,
    mentions: [sender, mencionado]
  }, { quoted: msg });

  // Timer para expirar desafío
  setTimeout(() => {
    const partida = partidasActivas.get(partidaId);
    if (partida && partida.estado === 'pendiente') {
      partidasActivas.delete(partidaId);
      
      // Devolver apuesta
      jugador1.pandacoins += apuesta;
      guardarDatabase(db);

      sock.sendMessage(from, {
        text: `⏰ *Desafío expirado*\n\nEl desafío de @${sender.split('@')[0]} a @${mencionado.split('@')[0]} ha expirado.\n💰 ${apuesta.toLocaleString()} pandacoins devueltos a @${sender.split('@')[0]}.`,
        mentions: [sender, mencionado]
      });
    }
  }, 2 * 60 * 1000); // 2 minutos
}

async function aceptarDesafio(sock, msg, from, sender) {
  // Buscar partida pendiente donde el usuario sea el jugador2
  let partidaAceptar = null;
  let partidaId = null;

  for (const [id, partida] of partidasActivas) {
    if (partida.jugador2 === sender && partida.estado === 'pendiente') {
      partidaAceptar = partida;
      partidaId = id;
      break;
    }
  }

  if (!partidaAceptar) {
    return await sock.sendMessage(from, {
      text: '❌ No tienes desafíos pendientes para aceptar.'
    }, { quoted: msg });
  }

  const db = cargarDatabase();
  inicializarUsuario(sender, db);

  const jugador2 = db.users[sender];

  // Congelar apuesta del jugador 2
  if (jugador2.pandacoins < partidaAceptar.apuesta) {
    return await sock.sendMessage(from, {
      text: `❌ Ya no tienes suficientes pandacoins para la apuesta.\n💰 Necesitas: ${partidaAceptar.apuesta}\n💳 Tienes: ${jugador2.pandacoins}`
    }, { quoted: msg });
  }

  jugador2.pandacoins -= partidaAceptar.apuesta;
  guardarDatabase(db);

  // Actualizar estado de la partida
  partidaAceptar.estado = 'activa';
  partidaAceptar.ultimoMovimiento = Date.now();
  partidasActivas.set(partidaId, partidaAceptar);

  // Mensaje de inicio
  const mensajeInicio = `🎮 *¡PARTIDA INICIADA!* 🚀

👤 *Jugador X:* @${partidaAceptar.jugador1.split('@')[0]}
👤 *Jugador O:* @${partidaAceptar.jugador2.split('@')[0]}
💰 *Apuesta:* ${partidaAceptar.apuesta.toLocaleString()} pandacoins

🎯 *Turno actual:* @${partidaAceptar.turno.split('@')[0]} (X)

📊 *Tablero actual:*
${generarTableroVisual(partidaAceptar.tablero)}

⚡ *Instrucciones:*
Usa \`.ttt mover <posición>\` para jugar
Posiciones del 1 al 9 (como teléfono)

⏰ *Tiempo por turno:* 3 minutos`;

  await sock.sendMessage(from, {
    text: mensajeInicio,
    mentions: [partidaAceptar.jugador1, partidaAceptar.jugador2]
  });

  // Timer para turno
  iniciarTimerTurno(sock, from, partidaId);
}

async function rechazarDesafio(sock, msg, from, sender) {
  // Buscar partida pendiente
  let partidaRechazar = null;
  let partidaId = null;

  for (const [id, partida] of partidasActivas) {
    if (partida.jugador2 === sender && partida.estado === 'pendiente') {
      partidaRechazar = partida;
      partidaId = id;
      break;
    }
  }

  if (!partidaRechazar) {
    return await sock.sendMessage(from, {
      text: '❌ No tienes desafíos pendientes para rechazar.'
    }, { quoted: msg });
  }

  // Devolver apuesta al jugador 1
  const db = cargarDatabase();
  const jugador1 = db.users[partidaRechazar.jugador1];
  
  if (jugador1) {
    jugador1.pandacoins += partidaRechazar.apuesta;
    guardarDatabase(db);
  }

  // Eliminar partida
  partidasActivas.delete(partidaId);

  await sock.sendMessage(from, {
    text: `❌ *DESAFÍO RECHAZADO*\n\n@${sender.split('@')[0]} ha rechazado el desafío de @${partidaRechazar.jugador1.split('@')[0]}.\n💰 ${partidaRechazar.apuesta.toLocaleString()} pandacoins devueltos a @${partidaRechazar.jugador1.split('@')[0]}.`,
    mentions: [sender, partidaRechazar.jugador1]
  });
}

async function hacerMovimiento(sock, msg, from, sender, args) {
  if (args.length < 1) {
    return await sock.sendMessage(from, {
      text: '❌ Especifica la posición (1-9).\n💡 Ejemplo: .ttt mover 5'
    }, { quoted: msg });
  }

  const posicion = parseInt(args[0]);

  if (isNaN(posicion) || posicion < 1 || posicion > 9) {
    return await sock.sendMessage(from, {
      text: '❌ Posición inválida. Usa un número del 1 al 9.'
    }, { quoted: msg });
  }

  // Buscar partida activa del jugador
  let partidaJugador = null;
  let partidaId = null;

  for (const [id, partida] of partidasActivas) {
    if ((partida.jugador1 === sender || partida.jugador2 === sender) && 
        partida.estado === 'activa') {
      partidaJugador = partida;
      partidaId = id;
      break;
    }
  }

  if (!partidaJugador) {
    return await sock.sendMessage(from, {
      text: '❌ No estás en una partida activa.'
    }, { quoted: msg });
  }

  if (partidaJugador.turno !== sender) {
    return await sock.sendMessage(from, {
      text: '❌ No es tu turno.'
    }, { quoted: msg });
  }

  // Verificar posición válida (índice 0-8)
  const index = posicion - 1;
  
  if (partidaJugador.tablero[index] !== ' ') {
    return await sock.sendMessage(from, {
      text: '❌ Esa casilla ya está ocupada.'
    }, { quoted: msg });
  }

  // Determinar símbolo del jugador
  const simbolo = partidaJugador.jugador1 === sender ? '❌' : '⭕';
  
  // Hacer movimiento
  partidaJugador.tablero[index] = simbolo;
  partidaJugador.movimientos.push({
    jugador: sender,
    posicion: posicion,
    simbolo: simbolo,
    tiempo: Date.now()
  });
  
  // Verificar si hay ganador
  const ganador = verificarGanador(partidaJugador.tablero);
  
  if (ganador) {
    // Partida terminada
    partidaJugador.estado = 'terminada';
    partidaJugador.ganador = ganador === '❌' ? partidaJugador.jugador1 : partidaJugador.jugador2;
    partidaJugador.ultimoMovimiento = Date.now();
    
    // Distribuir premios
    await distribuirPremios(partidaJugador);
    
    // Mostrar tablero final
    const mensajeFinal = generarMensajeFinal(partidaJugador);
    
    await sock.sendMessage(from, {
      text: mensajeFinal,
      mentions: [partidaJugador.jugador1, partidaJugador.jugador2]
    });
    
    // Eliminar partida
    partidasActivas.delete(partidaId);
    
    return;
  }
  
  // Verificar empate
  if (partidaJugador.tablero.every(casilla => casilla !== ' ')) {
    // Empate
    partidaJugador.estado = 'terminada';
    partidaJugador.ganador = 'empate';
    
    // Devolver apuestas
    await distribuirPremios(partidaJugador);
    
    const mensajeEmpate = `🤝 *¡EMPATE!* 🤝

👤 *Jugador X:* @${partidaJugador.jugador1.split('@')[0]}
👤 *Jugador O:* @${partidaJugador.jugador2.split('@')[0]}
💰 *Apuesta:* ${partidaJugador.apuesta.toLocaleString()} pandacoins

📊 *Tablero final:*
${generarTableroVisual(partidaJugador.tablero)}

🎮 *Resultado:* Empate
💸 *Recompensa:* Cada jugador recupera su apuesta

⚡ *¡Bien jugado a ambos!*`;
    
    await sock.sendMessage(from, {
      text: mensajeEmpate,
      mentions: [partidaJugador.jugador1, partidaJugador.jugador2]
    });
    
    partidasActivas.delete(partidaId);
    return;
  }
  
  // Cambiar turno
  partidaJugador.turno = partidaJugador.turno === partidaJugador.jugador1 
    ? partidaJugador.jugador2 
    : partidaJugador.jugador1;
  
  partidaJugador.ultimoMovimiento = Date.now();
  partidasActivas.set(partidaId, partidaJugador);
  
  // Mostrar tablero actualizado
  const simboloSiguiente = partidaJugador.turno === partidaJugador.jugador1 ? '❌' : '⭕';
  
  const mensajeTurno = `🎮 *MOVIMIENTO REALIZADO* ✅

@${sender.split('@')[0]} colocó ${simbolo} en posición ${posicion}

📊 *Tablero actual:*
${generarTableroVisual(partidaJugador.tablero)}

🎯 *Siguiente turno:* @${partidaJugador.turno.split('@')[0]} (${simboloSiguiente})

⚡ *Instrucción:*
\`.ttt mover <posición>\`

⏰ *Tiempo restante:* 3 minutos`;

  await sock.sendMessage(from, {
    text: mensajeTurno,
    mentions: [partidaJugador.jugador1, partidaJugador.jugador2]
  });
  
  // Reiniciar timer
  clearTimeout(partidaJugador.timer);
  iniciarTimerTurno(sock, from, partidaId);
}

async function mostrarTablero(sock, msg, from, sender) {
  // Buscar partida del jugador
  let partida = null;

  for (const [_, p] of partidasActivas) {
    if ((p.jugador1 === sender || p.jugador2 === sender) && 
        (p.estado === 'activa' || p.estado === 'pendiente')) {
      partida = p;
      break;
    }
  }

  if (!partida) {
    return await sock.sendMessage(from, {
      text: '❌ No estás en ninguna partida activa.'
    }, { quoted: msg });
  }

  const estadoTexto = partida.estado === 'pendiente' 
    ? '⏳ *Estado:* Esperando aceptación' 
    : '🎮 *Estado:* En juego';

  const turnoTexto = partida.estado === 'activa' 
    ? `🎯 *Turno:* @${partida.turno.split('@')[0]}` 
    : '';

  const mensaje = `📊 *TABLERO DE TIC TAC TOE*

${estadoTexto}
👤 *Jugador X:* @${partida.jugador1.split('@')[0]}
👤 *Jugador O:* @${partida.jugador2.split('@')[0]}
💰 *Apuesta:* ${partida.apuesta.toLocaleString()} pandacoins
${turnoTexto}

📊 *Tablero actual:*
${generarTableroVisual(partida.tablero)}

${partida.estado === 'activa' 
  ? `⚡ *Instrucción:* \`.ttt mover <posición>\`\n⏰ *Tiempo restante:* ${Math.ceil((3 * 60 * 1000 - (Date.now() - partida.ultimoMovimiento)) / 1000)} segundos`
  : `✅ *Para aceptar:* \`.ttt aceptar\`\n❌ *Para rechazar:* \`.ttt rechazar\``}`;

  await sock.sendMessage(from, {
    text: mensaje,
    mentions: [partida.jugador1, partida.jugador2]
  }, { quoted: msg });
}

async function rendirse(sock, msg, from, sender) {
  // Buscar partida activa
  let partidaRendirse = null;
  let partidaId = null;

  for (const [id, partida] of partidasActivas) {
    if ((partida.jugador1 === sender || partida.jugador2 === sender) && 
        partida.estado === 'activa') {
      partidaRendirse = partida;
      partidaId = id;
      break;
    }
  }

  if (!partidaRendirse) {
    return await sock.sendMessage(from, {
      text: '❌ No estás en una partida activa para rendirte.'
    }, { quoted: msg });
  }

  // Determinar ganador (el otro jugador)
  const ganador = partidaRendirse.jugador1 === sender 
    ? partidaRendirse.jugador2 
    : partidaRendirse.jugador1;

  // Terminar partida
  partidaRendirse.estado = 'terminada';
  partidaRendirse.ganador = ganador;

  // Distribuir premios (ganador se lleva todo)
  await distribuirPremios(partidaRendirse);

  const mensajeRendicion = `🏳️ *¡RENDICIÓN!* 🏳️

👤 *Rendido:* @${sender.split('@')[0]}
👑 *Ganador:* @${ganador.split('@')[0]}
💰 *Apuesta:* ${partidaRendirse.apuesta.toLocaleString()} pandacoins

📊 *Tablero final:*
${generarTableroVisual(partidaRendirse.tablero)}

🎮 *Resultado:* Rendición
💸 *Recompensa:* @${ganador.split('@')[0]} gana ${(partidaRendirse.apuesta * 2).toLocaleString()} pandacoins

💔 *Mejor suerte la próxima vez!*`;

  await sock.sendMessage(from, {
    text: mensajeRendicion,
    mentions: [sender, ganador]
  });

  // Eliminar partida
  partidasActivas.delete(partidaId);
}

// Funciones auxiliares
function generarTableroVisual(tablero) {
  // Reemplazar espacios vacíos con números para mejor visualización
  const tableroVisual = tablero.map((casilla, index) => 
    casilla === ' ' ? (index + 1).toString() : casilla
  );

  return `
 ${tableroVisual[0]} │ ${tableroVisual[1]} │ ${tableroVisual[2]}
───┼───┼───
 ${tableroVisual[3]} │ ${tableroVisual[4]} │ ${tableroVisual[5]}
───┼───┼───
 ${tableroVisual[6]} │ ${tableroVisual[7]} │ ${tableroVisual[8]}
`;
}

function verificarGanador(tablero) {
  const lineasGanadoras = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Horizontales
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Verticales
    [0, 4, 8], [2, 4, 6]             // Diagonales
  ];

  for (const linea of lineasGanadoras) {
    const [a, b, c] = linea;
    if (tablero[a] !== ' ' && tablero[a] === tablero[b] && tablero[a] === tablero[c]) {
      return tablero[a];
    }
  }

  return null;
}

async function distribuirPremios(partida) {
  const db = cargarDatabase();
  
  if (partida.ganador === 'empate') {
    // Empate: devolver apuestas
    const jugador1 = db.users[partida.jugador1];
    const jugador2 = db.users[partida.jugador2];
    
    if (jugador1) jugador1.pandacoins += partida.apuesta;
    if (jugador2) jugador2.pandacoins += partida.apuesta;
  } else {
    // Hay ganador: se lleva todo
    const ganador = db.users[partida.ganador];
    const perdedor = partida.ganador === partida.jugador1 
      ? db.users[partida.jugador2] 
      : db.users[partida.jugador1];
    
    if (ganador) ganador.pandacoins += partida.apuesta * 2;
    
    // Estadísticas
    if (ganador) {
      ganador.stats = ganador.stats || {};
      ganador.stats.ttt_ganadas = (ganador.stats.ttt_ganadas || 0) + 1;
      ganador.stats.ttt_ganancias = (ganador.stats.ttt_ganancias || 0) + (partida.apuesta * 2);
    }
    
    if (perdedor) {
      perdedor.stats = perdedor.stats || {};
      perdedor.stats.ttt_perdidas = (perdedor.stats.ttt_perdidas || 0) + 1;
    }
  }
  
  guardarDatabase(db);
}

function generarMensajeFinal(partida) {
  const ganadorNombre = `@${partida.ganador.split('@')[0]}`;
  const perdedorNombre = partida.ganador === partida.jugador1 
    ? `@${partida.jugador2.split('@')[0]}`
    : `@${partida.jugador1.split('@')[0]}`;
  
  const simboloGanador = partida.ganador === partida.jugador1 ? '❌' : '⭕';
  
  return `🎉 *¡VICTORIA!* 🏆

👑 *Ganador:* ${ganadorNombre} (${simboloGanador})
💔 *Perdedor:* ${perdedorNombre}
💰 *Apuesta:* ${partida.apuesta.toLocaleString()} pandacoins

📊 *Tablero final:*
${generarTableroVisual(partida.tablero)}

🎮 *Resultado:* Victoria de ${simboloGanador}
💸 *Recompensa:* ${ganadorNombre} gana ${(partida.apuesta * 2).toLocaleString()} pandacoins

⚡ *¡Felicidades al ganador!*`;
}

function iniciarTimerTurno(sock, from, partidaId) {
  const partida = partidasActivas.get(partidaId);
  
  if (!partida || partida.estado !== 'activa') return;
  
  // Limpiar timer anterior
  if (partida.timer) clearTimeout(partida.timer);
  
  // Configurar nuevo timer (3 minutos)
  partida.timer = setTimeout(async () => {
    const partidaActual = partidasActivas.get(partidaId);
    
    if (partidaActual && partidaActual.estado === 'activa') {
      // Tiempo agotado, el otro jugador gana
      const perdedor = partidaActual.turno;
      const ganador = partidaActual.turno === partidaActual.jugador1 
        ? partidaActual.jugador2 
        : partidaActual.jugador1;
      
      partidaActual.estado = 'terminada';
      partidaActual.ganador = ganador;
      
      // Distribuir premios
      await distribuirPremios(partidaActual);
      
      const mensajeTimeout = `⏰ *¡TIEMPO AGOTADO!* ⏰

@${perdedor.split('@')[0]} se quedó sin tiempo.
👑 *Ganador automático:* @${ganador.split('@')[0]}
💰 *Apuesta:* ${partidaActual.apuesta.toLocaleString()} pandacoins

📊 *Tablero final:*
${generarTableroVisual(partidaActual.tablero)}

🎮 *Resultado:* Victoria por tiempo
💸 *Recompensa:* @${ganador.split('@')[0]} gana ${(partidaActual.apuesta * 2).toLocaleString()} pandacoins

⚡ *¡Mantente atento en tu próximo turno!*`;
      
      await sock.sendMessage(from, {
        text: mensajeTimeout,
        mentions: [perdedor, ganador]
      });
      
      // Eliminar partida
      partidasActivas.delete(partidaId);
    }
  }, 3 * 60 * 1000); // 3 minutos
  
  // Guardar timer en la partida
  partida.timer = partida.timer;
  partidasActivas.set(partidaId, partida);
}

// Limpiar partidas antiguas periódicamente
setInterval(() => {
  const ahora = Date.now();
  
  for (const [partidaId, partida] of partidasActivas) {
    // Eliminar partidas pendientes con más de 5 minutos
    if (partida.estado === 'pendiente' && (ahora - partida.creado) > 5 * 60 * 1000) {
      partidasActivas.delete(partidaId);
      
      // Devolver apuesta
      const db = cargarDatabase();
      const jugador1 = db.users[partida.jugador1];
      
      if (jugador1) {
        jugador1.pandacoins += partida.apuesta;
        guardarDatabase(db);
      }
    }
    
    // Eliminar partidas terminadas con más de 10 minutos
    if (partida.estado === 'terminada' && (ahora - partida.ultimoMovimiento) > 10 * 60 * 1000) {
      partidasActivas.delete(partidaId);
    }
  }
}, 60 * 1000); // Revisar cada minuto