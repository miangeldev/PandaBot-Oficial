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

    const subcomando = args[0]?.toLowerCase() || 'estado';

    switch (subcomando) {
        case 'atacar':
        case 'attack':
            await atacarBoss(sock, from, usuarioId, sender, db);
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
        historicoAtaques: {}
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

async function atacarBoss(sock, from, usuarioId, sender, db) {
    // Verificar si hay boss activo
    if (!db.bossGlobal.activo || db.bossGlobal.derrotado) {
        await sock.sendMessage(from, { 
            text: '❌ No hay ningún boss activo en este momento.\n\n💡 Vuelve más tarde o usa .boss iniciar (solo admins)' 
        });
        return;
    }

    const user = db.users[usuarioId];
    if (!user || !user.pandacoins) {
        await sock.sendMessage(from, { 
            text: '❌ Necesitas tener Pandacoins para atacar al boss.' 
        });
        return;
    }

    // Verificar cooldown (máximo 1 ataque por minuto por usuario)
    const ahora = Date.now();
    const ultimoAtaque = user.ultimoAtaqueBoss || 0;
    if (ahora - ultimoAtaque < 60000) {
        const tiempoRestante = Math.ceil((60000 - (ahora - ultimoAtaque)) / 1000);
        await sock.sendMessage(from, { 
            text: `⏳ Espera ${tiempoRestante} segundos antes de atacar nuevamente.` 
        });
        return;
    }

    // Calcular daño y riesgo
    const dañoBase = Math.floor(Math.random() * 50) + 25;
    const critico = Math.random() < 0.15; // 15% de crítico
    const dañoFinal = critico ? dañoBase * 2 : dañoBase;

    // Riesgo: 20% de probabilidad de perder pandacoins
    let resultadoAtaque = "";
    let pandacoinsPerdidos = 0;

    if (Math.random() < 0.2) {
        pandacoinsPerdidos = Math.floor(user.pandacoins * 0.05); // 5% de perdida
        user.pandacoins -= pandacoinsPerdidos;
        resultadoAtaque = `💥 *¡EL BOSS TE CONTRAATACÓ!*\nPerdiste ${pandacoinsPerdidos.toLocaleString()} 🐼`;
    } else {
        resultadoAtaque = critico ? `💫 *¡ATAQUE CRÍTICO!*` : `⚔️ Ataque exitoso`;
    }

    // Aplicar daño al boss
    db.bossGlobal.vidaActual = Math.max(0, db.bossGlobal.vidaActual - dañoFinal);
    db.bossGlobal.ataquesRecibidos++;

    // Registrar ataque del usuario
    db.bossGlobal.historicoAtaques[usuarioId] = (db.bossGlobal.historicoAtaques[usuarioId] || 0) + 1;
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
        `👤 *Atacante:* ${sender}\n` +
        `⚔️ *Daño infligido:* ${dañoFinal} ${critico ? "💫" : ""}\n` +
        `❤️ *Vida del boss:* ${db.bossGlobal.vidaActual}/${db.bossGlobal.vidaMaxima}\n` +
        `🎯 *Progreso:* ${db.bossGlobal.ataquesRecibidos}/${db.bossGlobal.ataquesNecesarios}\n\n` +
        `${resultadoAtaque}\n\n` +
        `${mensajeDerrota ? `🎉 *BOSS DERROTADO* 🎉\n${mensajeDerrota}` : '💪 ¡Sigue atacando!'}`;

    await sock.sendMessage(from, { text: mensaje });
}

async function procesarDerrotaBoss(sock, db) {
    const recompensaTotal = db.bossGlobal.recompensaBase + 
                           (db.bossGlobal.ataquesRecibidos * 10);

    // Distribuir recompensas
    let totalDistribuido = 0;
    const participantes = Object.keys(db.bossGlobal.historicoAtaques);

    participantes.forEach(usuarioId => {
        const ataquesUsuario = db.bossGlobal.historicoAtaques[usuarioId];
        const porcentajeParticipacion = ataquesUsuario / db.bossGlobal.ataquesRecibidos;
        const recompensaUsuario = Math.floor(recompensaTotal * porcentajeParticipacion);

        if (db.users[usuarioId]) {
            db.users[usuarioId].pandacoins = (db.users[usuarioId].pandacoins || 0) + recompensaUsuario;
            totalDistribuido += recompensaUsuario;
        }
    });

    guardarDatabase(db);

    // Notificar a todos los participantes
    participantes.forEach(async (usuarioId, index) => {
        setTimeout(async () => {
            try {
                const recompensaUsuario = Math.floor(
                    (db.bossGlobal.historicoAtaques[usuarioId] / db.bossGlobal.ataquesRecibidos) * recompensaTotal
                );
                
                await sock.sendMessage(usuarioId, {
                    text: `🎉 *¡BOSS DERROTADO!* 🎉\n\n` +
                          `🐉 ${db.bossGlobal.nombre} ha sido vencido!\n` +
                          `⚔️ Tus ataques: ${db.bossGlobal.historicoAtaques[usuarioId]}\n` +
                          `💰 Recompensa: ${recompensaUsuario.toLocaleString()} 🐼\n\n` +
                          `💼 Nuevo saldo: ${db.users[usuarioId]?.pandacoins?.toLocaleString()} 🐼`
                });
            } catch (error) {
                console.log(`No se pudo notificar a ${usuarioId}`);
            }
        }, index * 500);
    });

    return `¡El boss ${db.bossGlobal.nombre} ha sido derrotado!\n` +
           `💰 Recompensa total: ${recompensaTotal.toLocaleString()} 🐼 distribuidos entre ${participantes.length} participantes`;
}

async function estadoBoss(sock, from, db) {
    if (!db.bossGlobal.activo || db.bossGlobal.derrotado) {
        await sock.sendMessage(from, { 
            text: '🐉 *NO HAY BOSS ACTIVO*\n\n💡 Vuelve más tarde para el próximo boss global.' 
        });
        return;
    }

    const progreso = (db.bossGlobal.ataquesRecibidos / db.bossGlobal.ataquesNecesarios) * 100;
    const barraProgreso = generarBarraProgreso(progreso);

    const mensaje = `🐉 *BOSS GLOBAL ACTIVO* 🐉\n\n` +
        `👹 *Nombre:* ${db.bossGlobal.nombre}\n` +
        `❤️ *Vida:* ${db.bossGlobal.vidaActual}/${db.bossGlobal.vidaMaxima}\n` +
        `⚔️ *Ataques recibidos:* ${db.bossGlobal.ataquesRecibidos}/${db.bossGlobal.ataquesNecesarios}\n\n` +
        `📊 ${barraProgreso} ${Math.round(progreso)}%\n\n` +
        `💰 *Recompensa base:* ${db.bossGlobal.recompensaBase.toLocaleString()} 🐼\n` +
        `🎯 *Bonus por ataque:* +10 🐼 por ataque\n\n` +
        `💡 Usa .boss atacar para unirte a la batalla!`;

    await sock.sendMessage(from, { text: mensaje });
}

async function rankingAtaques(sock, from, db) {
    if (!db.bossGlobal.historicoAtaques || Object.keys(db.bossGlobal.historicoAtaques).length === 0) {
        await sock.sendMessage(from, { 
            text: '📊 *RANKING DE ATAQUES*\n\nAún no hay ataques registrados en este boss.' 
        });
        return;
    }

    const ranking = Object.entries(db.bossGlobal.historicoAtaques)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);

    let mensaje = `🏆 *TOP ATACANTES - BOSS ACTUAL* 🏆\n\n`;

    ranking.forEach(([usuarioId, ataques], index) => {
        const usuario = usuarioId.split('@')[0];
        const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🔹';
        mensaje += `${emoji} ${index + 1}. ${usuario} - ${ataques} ataques\n`;
    });

    mensaje += `\n🐉 Boss: ${db.bossGlobal.nombre}\n`;
    mensaje += `⚔️ Total ataques: ${db.bossGlobal.ataquesRecibidos}`;

    await sock.sendMessage(from, { text: mensaje });
}

async function iniciarBoss(sock, from, usuarioId, args, db) {
    // Verificar permisos de admin (aquí puedes ajustar según tu sistema)
    const sender = usuarioId.split('@')[0];
    if (!['166164298780822'].includes(sender)) { // Reemplaza con tus admin IDs
        await sock.sendMessage(from, { 
            text: '❌ Solo los administradores pueden iniciar bosses manualmente.' 
        });
        return;
    }

    const nombresBoss = [
        "Dragón Infernal", "Titan de Hielo", "Golem Ancestral", 
        "Serpiente Marina", "Fénix Renacido", "Ciclope Gigante",
        "Kraken Abisal", "Minotauro Legendario", "Hidra Venenosa"
    ];

    const bossElegido = nombresBoss[Math.floor(Math.random() * nombresBoss.length)];
    const vidaBase = 1000;
    const ataquesNecesarios = 300;
    const recompensaBase = 100000;

    db.bossGlobal = {
        activo: true,
        nombre: bossElegido,
        vidaActual: vidaBase,
        vidaMaxima: vidaBase,
        recompensaBase: recompensaBase,
        fechaInicio: Date.now(),
        ataquesRecibidos: 0,
        ataquesNecesarios: ataquesNecesarios,
        derrotado: false,
        historicoAtaques: {}
    };

    guardarDatabase(db);

    await sock.sendMessage(from, { 
        text: `🐉 *¡NUEVO BOSS INICIADO!* 🐉\n\n` +
              `👹 *Nombre:* ${bossElegido}\n` +
              `❤️ *Vida:* ${vidaBase}\n` +
              `🎯 *Ataques necesarios:* ${ataquesNecesarios}\n` +
              `💰 *Recompensa base:* ${recompensaBase.toLocaleString()} 🐼\n\n` +
              `⚔️ ¡Usa .boss atacar para unirte a la batalla!`
    });
}

function generarBarraProgreso(porcentaje) {
    const barrasTotal = 10;
    const barrasLlenas = Math.round((porcentaje / 100) * barrasTotal);
    const barrasVacias = barrasTotal - barrasLlenas;
    
    return '█'.repeat(barrasLlenas) + '░'.repeat(barrasVacias);
}

// ⚡ SISTEMA AUTOMÁTICO - Añade esto a tu main.js o donde manejes tareas automáticas
export function iniciarSistemaBossAutomatico(db) {
    // Verificar y crear boss automático cada 24h
    if (!db.bossGlobal || !db.bossGlobal.activo || db.bossGlobal.derrotado) {
        const ultimoBoss = db.ultimoBossTimestamp || 0;
        const ahora = Date.now();
        
        if (ahora - ultimoBoss >= 24 * 60 * 60 * 1000) { // 24 horas
            // Crear nuevo boss automático
            const nombresBoss = ["Dragón Diario", "Guardián Nocturno", "Bestia Celestial"];
            const bossElegido = nombresBoss[Math.floor(Math.random() * nombresBoss.length)];
            
            db.bossGlobal = {
                activo: true,
                nombre: bossElegido,
                vidaActual: 500,
                vidaMaxima: 500,
                recompensaBase: 100000,
                fechaInicio: ahora,
                ataquesRecibidos: 0,
                ataquesNecesarios: 200,
                derrotado: false,
                historicoAtaques: {}
            };
            
            db.ultimoBossTimestamp = ahora;
            guardarDatabase(db);
            
            console.log(`🐉 Nuevo boss automático creado: ${bossElegido}`);
        }
    }
}
