import { cargarDatabase, guardarDatabase } from '../data/database.js';
import { ownerNumber } from '../config.js';

export const command = 'skipexpedicion';
export const aliases = ['skipmission', 'finalizarexpedicion'];

export async function run(sock, msg, args) {
    const from = msg.key.remoteJid;
    const sender = (msg.key.participant || msg.key.remoteJid).split('@')[0];

    if (!ownerNumber.includes(`+${sender}`)) {
        await sock.sendMessage(from, { text: '❌ Solo los owners pueden usar este comando.' });
        return;
    }

    const db = cargarDatabase();
    db.users = db.users || {};

    if (args.length === 0) {
        await mostrarAyuda(sock, from, db);
        return;
    }

    const accion = args[0].toLowerCase();

    if (accion === 'user') {
        await skipExpedicionUsuario(sock, msg, from, args.slice(1), db);
    } else if (accion === 'all') {
        await skipTodasExpediciones(sock, msg, from, args.slice(1), db);
    } else if (accion === 'list') {
        await listarExpedicionesActivas(sock, from, db);
    } else {
        // Si no es una acción específica, asumimos que es un usuario
        await skipExpedicionUsuario(sock, msg, from, args, db);
    }
}

async function mostrarAyuda(sock, from, db) {
    // Contar expediciones activas totales
    let totalExpediciones = 0;
    Object.values(db.users).forEach(user => {
        if (user.expediciones && user.expediciones.activas) {
            totalExpediciones += user.expediciones.activas.length;
        }
    });

    let mensaje = `⚡ *SKIP EXPEDICIONES - OWNERS* ⚡\n\n`;
    mensaje += `📊 *Estadísticas globales:*\n`;
    mensaje += `• Expediciones activas: ${totalExpediciones}\n`;
    mensaje += `• Usuarios con expediciones: ${Object.values(db.users).filter(u => u.expediciones?.activas?.length > 0).length}\n\n`;

    mensaje += `🎯 *Comandos disponibles:*\n`;
    mensaje += `• .skipexpedicion <@usuario> - Skip expediciones de usuario\n`;
    mensaje += `• .skipexpedicion user <@usuario> - Mismo que arriba\n`;
    mensaje += `• .skipexpedicion all - Skip TODAS las expediciones\n`;
    mensaje += `• .skipexpedicion list - Listar expediciones activas\n\n`;

    mensaje += `💡 *Ejemplos:*\n`;
    mensaje += `• .skipexpedicion @usuario\n`;
    mensaje += `• .skipexpedicion user 123456789\n`;
    mensaje += `• .skipexpedicion all\n`;
    mensaje += `• .skipexpedicion list`;

    await sock.sendMessage(from, { text: mensaje });
}

async function skipExpedicionUsuario(sock, msg, from, args, db) {
    if (args.length === 0) {
        await sock.sendMessage(from, {
            text: '❌ Debes especificar un usuario.\n\n💡 Ejemplos:\n• .skipexpedicion @usuario\n• .skipexpedicion user 123456789'
        });
        return;
    }

    let usuarioId = args[0];

    // Si es una mención (@usuario)
    if (usuarioId.startsWith('@')) {
        usuarioId = usuarioId.substring(1);
    }

    // Buscar usuario en la base de datos
    const usuario = db.users[usuarioId + '@lid'] || Object.values(db.users).find(u => {
        const userId = u.id || Object.keys(db.users).find(key => key.includes(usuarioId));
        return userId && userId.includes(usuarioId);
    });

    if (!usuario) {
        await sock.sendMessage(from, {
            text: `❌ Usuario no encontrado en la base de datos.\n\n💡 Asegúrate de que el usuario esté registrado.`
        });
        return;
    }

    // Obtener el ID real del usuario
    const usuarioRealId = Object.keys(db.users).find(key =>
        key.includes(usuarioId) || db.users[key] === usuario
    );

    if (!usuarioRealId) {
        await sock.sendMessage(from, { text: '❌ Error al identificar al usuario.' });
        return;
    }

    const userData = db.users[usuarioRealId];

    if (!userData.expediciones || userData.expediciones.activas.length === 0) {
        await sock.sendMessage(from, {
            text: `❌ El usuario no tiene expediciones activas.`
        });
        return;
    }

    const expedicionesActivas = userData.expediciones.activas.length;
    let totalRecompensa = 0;
    const personajesCompletados = [];

    // Calcular recompensas y completar expediciones
    userData.expediciones.activas.forEach(expedicion => {
        totalRecompensa += expedicion.recompensa.monedas;
        personajesCompletados.push(expedicion.personaje);

        // Actualizar estadísticas
        userData.expediciones.completadas = (userData.expediciones.completadas || 0) + 1;
        userData.expediciones.tiempoTotal = (userData.expediciones.tiempoTotal || 0) + expedicion.duracion;
    });

    // Dar recompensas
    userData.pandacoins = (userData.pandacoins || 0) + totalRecompensa;

    // Limpiar expediciones activas
    userData.expediciones.activas = [];

    guardarDatabase(db);

    // Obtener el ID corto del usuario para mencionar
    const usuarioCorto = usuarioRealId.split('@')[0];
    
    // Crear mensaje con mención en el grupo
    const mensaje = `⚡ *EXPEDICIONES SKIPPEADAS* ⚡\n\n` +
        `👤 *Usuario:* @${usuarioCorto}\n` +
        `📊 *Expediciones completadas:* ${expedicionesActivas}\n` +
        `💰 *Recompensa total:* ${totalRecompensa.toLocaleString()} 🐼\n\n` +
        `👥 *Personajes:*\n${personajesCompletados.map(p => `• ${p}`).join('\n')}\n\n` +
        `✅ Todas las expediciones han sido finalizadas.`;

    // Enviar mensaje mencionando al usuario en el grupo
    await sock.sendMessage(from, { 
        text: mensaje,
        mentions: [usuarioRealId]
    });

    // Eliminar el intento de notificación por privado ya que ahora se hace en el grupo
    console.log(`✅ Expediciones skippeadas para @${usuarioCorto} - Notificado en el grupo`);
}

async function skipTodasExpediciones(sock, msg, from, args, db) {
    // Confirmación de seguridad
    if (args && args.length > 0 && args[0] !== 'confirmar') {
        let totalExpediciones = 0;
        let totalUsuarios = 0;
        let totalRecompensa = 0;

        Object.values(db.users).forEach(user => {
            if (user.expediciones && user.expediciones.activas) {
                totalExpediciones += user.expediciones.activas.length;
                totalUsuarios++;
                user.expediciones.activas.forEach(exp => {
                    totalRecompensa += exp.recompensa.monedas;
                });
            }
        });

        await sock.sendMessage(from, {
            text: `⚠️ *CONFIRMACIÓN REQUERIDA* ⚠️\n\n¿Estás seguro de que quieres finalizar TODAS las expediciones?\n\n📊 *Impacto:*\n• Usuarios afectados: ${totalUsuarios}\n• Expediciones: ${totalExpediciones}\n• Recompensa total: ${totalRecompensa.toLocaleString()} 🐼\n\n✅ Para confirmar usa:\n.skipexpedicion all confirmar\n\n❌ Esta acción no se puede deshacer.`
        });
        return;
    }

    let totalExpediciones = 0;
    let totalUsuarios = 0;
    let totalRecompensa = 0;
    const usuariosAfectados = [];
    const usuariosParaMencionar = [];

    // Procesar todos los usuarios
    Object.keys(db.users).forEach(usuarioId => {
        const user = db.users[usuarioId];

        if (user.expediciones && user.expediciones.activas.length > 0) {
            const expedicionesUsuario = user.expediciones.activas.length;
            let recompensaUsuario = 0;

            user.expediciones.activas.forEach(expedicion => {
                recompensaUsuario += expedicion.recompensa.monedas;

                // Actualizar estadísticas
                user.expediciones.completadas = (user.expediciones.completadas || 0) + 1;
                user.expediciones.tiempoTotal = (user.expediciones.tiempoTotal || 0) + expedicion.duracion;
            });

            // Dar recompensas
            user.pandacoins = (user.pandacoins || 0) + recompensaUsuario;

            // Limpiar expediciones activas
            user.expediciones.activas = [];

            totalExpediciones += expedicionesUsuario;
            totalRecompensa += recompensaUsuario;
            totalUsuarios++;
            
            const usuarioInfo = `${usuarioId.split('@')[0]} (${expedicionesUsuario} exp)`;
            usuariosAfectados.push(usuarioInfo);
            usuariosParaMencionar.push(usuarioId);
        }
    });

    guardarDatabase(db);

    let mensaje = `⚡ *TODAS LAS EXPEDICIONES SKIPPEADAS* ⚡\n\n`;
    mensaje += `📊 *Resumen global:*\n`;
    mensaje += `• Usuarios afectados: ${totalUsuarios}\n`;
    mensaje += `• Expediciones finalizadas: ${totalExpediciones}\n`;
    mensaje += `• Recompensa total distribuida: ${totalRecompensa.toLocaleString()} 🐼\n\n`;

    if (usuariosAfectados.length > 0) {
        mensaje += `👥 *Usuarios afectados (primeros 10):*\n`;
        
        // Crear lista con menciones
        const primerosUsuarios = usuariosAfectados.slice(0, 10);
        primerosUsuarios.forEach((usuarioInfo, index) => {
            const usuarioId = usuariosParaMencionar[index];
            mensaje += `• @${usuarioInfo.split(' ')[0]}\n`;
        });

        if (usuariosAfectados.length > 10) {
            mensaje += `\n... y ${usuariosAfectados.length - 10} usuarios más`;
        }
    }

    // Enviar mensaje con menciones en el grupo
    await sock.sendMessage(from, { 
        text: mensaje,
        mentions: usuariosParaMencionar.slice(0, 10) // Mencionar solo los primeros 10 para no saturar
    });

    // Notificar en el grupo en lugar de por privado
    if (usuariosAfectados.length > 0) {
        const mensajeNotificacion = `🎉 *¡EXPEDICIONES ACELERADAS GLOBALMENTE!* 🎉\n\n` +
            `⚡ Un administrador ha finalizado todas las expediciones del servidor.\n` +
            `💰 Se distribuyeron ${totalRecompensa.toLocaleString()} 🐼 entre ${totalUsuarios} usuarios.\n\n` +
            `💼 Revisa tu saldo con .misps`;

        await sock.sendMessage(from, { 
            text: mensajeNotificacion,
            mentions: usuariosParaMencionar // Mencionar a todos los afectados
        });
    }
}

async function listarExpedicionesActivas(sock, from, db) {
    const expedicionesActivas = [];

    Object.keys(db.users).forEach(usuarioId => {
        const user = db.users[usuarioId];

        if (user.expediciones && user.expediciones.activas.length > 0) {
            user.expediciones.activas.forEach(expedicion => {
                expedicionesActivas.push({
                    usuario: usuarioId.split('@')[0],
                    usuarioId: usuarioId, // Guardar el ID completo para menciones
                    personaje: expedicion.personaje,
                    calidad: expedicion.calidad,
                    tiempoRestante: expedicion.fin - Date.now(),
                    recompensa: expedicion.recompensa.monedas
                });
            });
        }
    });

    if (expedicionesActivas.length === 0) {
        await sock.sendMessage(from, {
            text: `📭 No hay expediciones activas en este momento.`
        });
        return;
    }

    let mensaje = `📋 *EXPEDICIONES ACTIVAS - LISTADO* 📋\n\n`;
    mensaje += `📊 Total: ${expedicionesActivas.length} expediciones\n\n`;

    const usuariosParaMencionar = [];

    expedicionesActivas.slice(0, 15).forEach((exp, index) => {
        const horas = Math.floor(exp.tiempoRestante / (60 * 60 * 1000));
        const minutos = Math.floor((exp.tiempoRestante % (60 * 60 * 1000)) / (60 * 1000));
        const estado = exp.tiempoRestante <= 0 ? '✅ LISTA' : `⏳ ${horas}h ${minutos}m`;

        mensaje += `${index + 1}. @${exp.usuario}\n`;
        mensaje += `   👤 ${exp.personaje} (${exp.calidad})\n`;
        mensaje += `   🕒 ${estado}\n`;
        mensaje += `   💰 ${exp.recompensa.toLocaleString()} 🐼\n\n`;
        
        usuariosParaMencionar.push(exp.usuarioId);
    });

    if (expedicionesActivas.length > 15) {
        mensaje += `... y ${expedicionesActivas.length - 15} expediciones más\n\n`;
    }

    mensaje += `💡 Usa .skipexpedicion <@usuario> para skip expediciones específicas.`;

    // Enviar lista con menciones
    await sock.sendMessage(from, { 
        text: mensaje,
        mentions: usuariosParaMencionar
    });
}
