import { cargarDatabase, guardarDatabase } from '../data/database.js';

export const command = 'boss';
export const aliases = ['jefeboss', 'bossglobal'];

export async function run(sock, msg, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant?.split('@')[0] || msg.key.remoteJid.split('@')[0];
    const usuarioId = msg.key.participant || msg.key.remoteJid;

    const db = cargarDatabase();
    
    // Inicializar sistema boss si no existe
    if (!db.bossGlobal) {
        inicializarBoss(db);
    }

    // Inicializar users si no existe (solo el objeto, no usuarios individuales)
    if (!db.users) {
        db.users = {};
    }

    const subcomando = args[0]?.toLowerCase() || 'estado';

    try {
        switch (subcomando) {
            case 'atacar':
            case 'attack':
                await atacarBoss(sock, msg, from, usuarioId, sender, db);
                break;
            case 'estado':
            case 'status':
                await estadoBoss(sock, from, db);
                break;
            case 'ranking':
            case 'top':
                await rankingAtaques(sock, from, db);
                break;
            case 'iniciar':
                await iniciarBoss(sock, from, usuarioId, args.slice(1), db);
                break;
            default:
                await mostrarInfoBoss(sock, from);
        }
    } catch (error) {
        console.error('❌ Error en comando boss:', error);
        await sock.sendMessage(from, {
            text: '❌ Ocurrió un error al procesar el comando. Intenta nuevamente.'
        });
    }
}

function inicializarBoss(db) {
    db.bossGlobal = {
        activo: false,
        nombre: "",
        vidaActual: 0,
        vidaMaxima: 0,
        recompensaBase: 0,
        fechaInicio: null,
        ataquesRecibidos: 0,
        ataquesNecesarios: 0,
        derrotado: false,
        historicoAtaques: {},
        infoAtacantes: {}
    };
    guardarDatabase(db);
}

async function mostrarInfoBoss(sock, from) {
    const mensaje = `🐉 *SISTEMA BOSS GLOBAL* 🐉\n\n` +
        `⚔️ *Comandos disponibles:*\n` +
        `• .boss atacar - Atacar al boss actual\n` +
        `• .boss estado - Ver estado del boss\n` +
        `• .boss ranking - Top atacantes del día\n\n` +
        `🎯 *Mecánicas:*\n` +
        `• Ataca al boss y gana recompensas\n` +
        `• Mientras más ataques, mayor recompensa\n` +
        `• Riesgo: Puedes perder Pandacoins\n` +
        `• Boss se renueva cada 24h\n\n` +
        `💡 El boss aparece automáticamente cada día!`;

    await sock.sendMessage(from, { text: mensaje });
}

async function atacarBoss(sock, msg, from, usuarioId, sender, db) {
    // Verificar si hay boss activo
    if (!db.bossGlobal.activo || db.bossGlobal.derrotado) {
        await sock.sendMessage(from, { 
            text: '❌ No hay ningún boss activo en este momento.\n\n💡 Vuelve más tarde o usa .boss iniciar (solo admins)' 
        });
        return;
    }

    // ✅ FORMA SEGURA de inicializar usuario - SIN SOBREESCRIBIR
    if (!db.users[usuarioId]) {
        db.users[usuarioId] = {}; // Solo crea objeto vacío si no existe
    }
    
    const user = db.users[usuarioId];
    
    // ✅ Inicializar propiedades individuales SIN borrar otras
    if (typeof user.pandacoins !== 'number') {
        user.pandacoins = 0;
    }
    if (typeof user.ultimoAtaqueBoss !== 'number') {
        user.ultimoAtaqueBoss = 0;
    }

    if (user.pandacoins <= 0) {
        await sock.sendMessage(from, { 
            text: '❌ Necesitas tener Pandacoins para atacar al boss.' 
        });
        return;
    }

    // Verificar cooldown (máximo 1 ataque por minuto por usuario)
    const ahora = Date.now();
    const ultimoAtaque = user.ultimoAtaqueBoss;
    if (ahora - ultimoAtaque < 60000) {
        const tiempoRestante = Math.ceil((60000 - (ahora - ultimoAtaque)) / 1000);
        await sock.sendMessage(from, { 
            text: `⏳ Espera ${tiempoRestante} segundos antes de atacar nuevamente.` 
        });
        return;
    }

    // Obtener información del usuario (nombre y mención)
    const userInfo = await obtenerInfoUsuario(sock, msg, usuarioId);
    
    // Calcular daño y riesgo
    const dañoBase = Math.floor(Math.random() * 50) + 25;
    const critico = Math.random() < 0.15; // 15% de crítico
    const dañoFinal = critico ? dañoBase * 2 : dañoBase;

    // Riesgo: 20% de probabilidad de perder pandacoins
    let resultadoAtaque = "";
    let pandacoinsPerdidos = 0;

    if (Math.random() < 0.2) {
        pandacoinsPerdidos = Math.floor(user.pandacoins * 0.05); // 5% de perdida
        user.pandacoins = Math.max(0, user.pandacoins - pandacoinsPerdidos);
        resultadoAtaque = `💥 *¡EL BOSS TE CONTRAATACÓ!*\nPerdiste ${pandacoinsPerdidos.toLocaleString()} 🐼`;
    } else {
        resultadoAtaque = critico ? `💫 *¡ATAQUE CRÍTICO!*` : `⚔️ Ataque exitoso`;
    }

    // Aplicar daño al boss
    db.bossGlobal.vidaActual = Math.max(0, db.bossGlobal.vidaActual - dañoFinal);
    db.bossGlobal.ataquesRecibidos++;

    // ✅ Inicializar propiedades del boss de forma segura
    if (!db.bossGlobal.historicoAtaques) {
        db.bossGlobal.historicoAtaques = {};
    }
    if (!db.bossGlobal.infoAtacantes) {
        db.bossGlobal.infoAtacantes = {};
    }

    // Registrar ataque del usuario con información completa
    db.bossGlobal.historicoAtaques[usuarioId] = (db.bossGlobal.historicoAtaques[usuarioId] || 0) + 1;
    
    // Guardar información del atacante
    if (!db.bossGlobal.infoAtacantes[usuarioId]) {
        db.bossGlobal.infoAtacantes[usuarioId] = {
            nombre: userInfo.nombre,
            mencion: userInfo.mencion,
            totalAtaques: 0,
            primerAtaque: ahora,
            ultimoAtaque: ahora
        };
    }
    
    db.bossGlobal.infoAtacantes[usuarioId].totalAtaques = db.bossGlobal.historicoAtaques[usuarioId];
    db.bossGlobal.infoAtacantes[usuarioId].ultimoAtaque = ahora;
    
    user.ultimoAtaqueBoss = ahora;

    // Verificar si el boss fue derrotado
    let mensajeDerrota = "";
    if (db.bossGlobal.vidaActual <= 0 && !db.bossGlobal.derrotado) {
        db.bossGlobal.derrotado = true;
        db.bossGlobal.activo = false;
        mensajeDerrota = await procesarDerrotaBoss(sock, db);
    }

    guardarDatabase(db);

    // Mensaje de resultado del ataque
    const mensaje = `🐉 *ATAQUE AL BOSS* 🐉\n\n` +
        `👤 *Atacante:* ${userInfo.nombre}\n` +
        `⚔️ *Daño infligido:* ${dañoFinal} ${critico ? "💫" : ""}\n` +
        `❤️ *Vida del boss:* ${db.bossGlobal.vidaActual}/${db.bossGlobal.vidaMaxima}\n` +
        `🎯 *Progreso:* ${db.bossGlobal.ataquesRecibidos}/${db.bossGlobal.ataquesNecesarios}\n\n` +
        `${resultadoAtaque}\n\n` +
        `${mensajeDerrota ? `🎉 *BOSS DERROTADO* 🎉\n${mensajeDerrota}` : '💪 ¡Sigue atacando!'}`;

    await sock.sendMessage(from, { text: mensaje });
}

// Función para obtener información del usuario
async function obtenerInfoUsuario(sock, msg, usuarioId) {
    try {
        // Intentar obtener información del contacto
        const contactos = await sock.onWhatsApp(usuarioId);
        if (contactos && contactos[0] && contactos[0].exists) {
            try {
                const contacto = await sock.fetchContact(usuarioId);
                const nombre = contacto.notify || contacto.name || contacto.vname || usuarioId.split('@')[0];
                
                return {
                    id: usuarioId,
                    nombre: nombre,
                    mencion: `@${usuarioId.split('@')[0]}`,
                    numero: usuarioId.split('@')[0]
                };
            } catch (contactError) {
                console.log('Error obteniendo contacto, usando información básica:', contactError);
            }
        }
    } catch (error) {
        console.log('Error obteniendo info del usuario:', error);
    }
    
    // Fallback: usar información del mensaje
    const pushName = msg.pushName || usuarioId.split('@')[0];
    return {
        id: usuarioId,
        nombre: pushName,
        mencion: `@${usuarioId.split('@')[0]}`,
        numero: usuarioId.split('@')[0]
    };
}

async function procesarDerrotaBoss(sock, db) {
    const recompensaTotal = db.bossGlobal.recompensaBase + 
                           (db.bossGlobal.ataquesRecibidos * 10);

    // ✅ Distribuir recompensas de forma segura
    let totalDistribuido = 0;
    const participantes = Object.keys(db.bossGlobal.historicoAtaques || {});

    if (participantes.length === 0) {
        return "¡El boss ha sido derrotado! Pero no hubo participantes para recompensar.";
    }

    participantes.forEach(usuarioId => {
        const ataquesUsuario = db.bossGlobal.historicoAtaques[usuarioId];
        const porcentajeParticipacion = ataquesUsuario / db.bossGlobal.ataquesRecibidos;
        const recompensaUsuario = Math.floor(recompensaTotal * porcentajeParticipacion);

        // ✅ Asegurar que el usuario existe SIN borrar datos
        if (!db.users[usuarioId]) {
            db.users[usuarioId] = {};
        }
        if (typeof db.users[usuarioId].pandacoins !== 'number') {
            db.users[usuarioId].pandacoins = 0;
        }

        db.users[usuarioId].pandacoins += recompensaUsuario;
        totalDistribuido += recompensaUsuario;
    });

    guardarDatabase(db);

    // Notificar a todos los participantes
    participantes.forEach(async (usuarioId, index) => {
        setTimeout(async () => {
            try {
                const recompensaUsuario = Math.floor(
                    (db.bossGlobal.historicoAtaques[usuarioId] / db.bossGlobal.ataquesRecibidos) * recompensaTotal
                );
                
                const userInfo = db.bossGlobal.infoAtacantes?.[usuarioId] || { nombre: usuarioId.split('@')[0] };
                const saldoActual = db.users[usuarioId]?.pandacoins || 0;
                
                await sock.sendMessage(usuarioId, {
                    text: `🎉 *¡BOSS DERROTADO!* 🎉\n\n` +
                          `🐉 ${db.bossGlobal.nombre} ha sido vencido!\n` +
                          `⚔️ Tus ataques: ${db.bossGlobal.historicoAtaques[usuarioId]}\n` +
                          `💰 Recompensa: ${recompensaUsuario.toLocaleString()} 🐼\n\n` +
                          `💼 Nuevo saldo: ${saldoActual.toLocaleString()} 🐼`
                });
            } catch (error) {
                console.log(`No se pudo notificar a ${usuarioId}:`, error);
            }
        }, index * 500);
    });

    return `¡El boss ${db.bossGlobal.nombre} ha sido derrotado!\n` +
           `💰 Recompensa total: ${recompensaTotal.toLocaleString()} 🐼 distribuidos entre ${participantes.length} participantes`;
}

// ... (las funciones estadoBoss, rankingAtaques, iniciarBoss, generarBarraProgreso, 
// e iniciarSistemaBossAutomatico se mantienen igual que en la versión anterior)