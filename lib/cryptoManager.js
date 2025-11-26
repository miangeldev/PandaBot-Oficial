import fs from 'fs';

const MARKET_FILE = './data/cryptomarket.json';

export function actualizarMercado() {
    try {
        const marketData = JSON.parse(fs.readFileSync(MARKET_FILE, 'utf8'));
        const ahora = new Date();
        const ultimaActualizacion = new Date(marketData.ultimaActualizacion);

        const minutosDesdeUltimaActualizacion = (ahora - ultimaActualizacion) / (1000 * 60);
        const intervaloActualizacion = 60 / marketData.actualizacionesPorHora;

        if (minutosDesdeUltimaActualizacion >= intervaloActualizacion) {
            // Actualizar precios de todas las monedas
            Object.values(marketData.monedas).forEach(moneda => {
                moneda.precioAnterior = moneda.precioActual;

                // Generar cambio aleatorio basado en volatilidad
                const cambio = (Math.random() - 0.5) * 2 * moneda.volatilidad;
                moneda.precioActual *= (1 + cambio);

                // Mantener precio mínimo
                if (moneda.precioActual < 0.1) moneda.precioActual = 0.1;

                // Guardar en historial (últimas 24 horas)
                moneda.historial.push({
                    precio: moneda.precioActual,
                    timestamp: ahora.toISOString()
                });

                // Mantener solo últimas 24 entradas
                if (moneda.historial.length > 24) {
                    moneda.historial = moneda.historial.slice(-24);
                }
            });

            marketData.ultimaActualizacion = ahora.toISOString();
            fs.writeFileSync(MARKET_FILE, JSON.stringify(marketData, null, 2));
        }

        return true;
    } catch (error) {
        console.error('Error actualizando mercado:', error);
        return false;
    }
}

export function obtenerEstadoMercado() {
    try {
        return JSON.parse(fs.readFileSync(MARKET_FILE, 'utf8'));
    } catch (error) {
        console.error('Error obteniendo estado del mercado:', error);
        return null;
    }
}

export function obtenerPrecioMoneda(monedaId) {
    try {
        const marketData = JSON.parse(fs.readFileSync(MARKET_FILE, 'utf8'));
        return marketData.monedas[monedaId] || null;
    } catch (error) {
        console.error('Error obteniendo precio:', error);
        return null;
    }
}

export function obtenerTiempoProximaActualizacion() {
    try {
        const marketData = JSON.parse(fs.readFileSync(MARKET_FILE, 'utf8'));
        const ahora = new Date();
        const ultimaActualizacion = new Date(marketData.ultimaActualizacion);
        const intervaloMs = (60 / marketData.actualizacionesPorHora) * 60 * 1000;
        const proximaActualizacion = new Date(ultimaActualizacion.getTime() + intervaloMs);
        const tiempoRestanteMs = proximaActualizacion - ahora;
        
        return Math.max(0, Math.floor(tiempoRestanteMs / 1000)); // segundos restantes
    } catch (error) {
        console.error('Error obteniendo tiempo de actualización:', error);
        return 0;
    }
}

export function obtenerAnalisisMoneda(moneda) {
    if (!moneda.historial || moneda.historial.length < 2) {
        return "📊 Datos insuficientes para análisis";
    }

    const precios = moneda.historial.map(h => h.precio);
    const precioActual = precios[precios.length - 1];
    const precioInicial = precios[0];
    
    const cambioTotal = ((precioActual - precioInicial) / precioInicial) * 100;
    
    // Calcular volatilidad reciente (últimas 5 actualizaciones)
    const ultimosPrecios = precios.slice(-6);
    let volatilidadReciente = 0;
    for (let i = 1; i < ultimosPrecios.length; i++) {
        const cambio = Math.abs((ultimosPrecios[i] - ultimosPrecios[i-1]) / ultimosPrecios[i-1]);
        volatilidadReciente += cambio;
    }
    volatilidadReciente = (volatilidadReciente / (ultimosPrecios.length - 1)) * 100;

    let tendencia = "➡️ ESTABLE";
    if (cambioTotal > 5) tendencia = "📈 ALCISTA";
    else if (cambioTotal < -5) tendencia = "📉 BAJISTA";
    
    let riesgo = "🟢 BAJO";
    if (volatilidadReciente > 15) riesgo = "🔴 ALTO";
    else if (volatilidadReciente > 8) riesgo = "🟡 MEDIO";

    return `${tendencia} | ${riesgo} Riesgo | 📊 ${cambioTotal >= 0 ? '+' : ''}${cambioTotal.toFixed(1)}% en 24h`;
}

// Inicializar mercado si no existe
export function inicializarMercado() {
    try {
        JSON.parse(fs.readFileSync(MARKET_FILE, 'utf8'));
    } catch (error) {
        // Crear archivo si no existe
        const mercadoInicial = {
            "monedas": {
                "LILANCOIN": {
                    "nombre": "LilanCoin",
                    "precioActual": 1.0,
                    "precioAnterior": 1.0,
                    "volatilidad": 0.02,
                    "historial": [],
                    "color": "🟡",
                    "descripcion": "Moneda estable, perfecta para principiantes"
                },
                "DRAGONTOKEN": {
                    "nombre": "DragonToken", 
                    "precioActual": 50.0,
                    "precioAnterior": 50.0,
                    "volatilidad": 0.08,
                    "historial": [],
                    "color": "🔴",
                    "descripcion": "Volátil pero con potencial de crecimiento"
                },
                "UNISTAR": {
                    "nombre": "UniStar",
                    "precioActual": 100.0,
                    "precioAnterior": 100.0,
                    "volatilidad": 0.12,
                    "historial": [],
                    "color": "🔵",
                    "descripcion": "Alto riesgo, altas recompensas"
                },
                "MOONSHOT": {
                    "nombre": "MoonShot",
                    "precioActual": 5.0,
                    "precioAnterior": 5.0,
                    "volatilidad": 0.25,
                    "historial": [],
                    "color": "🚀",
                    "descripcion": "Extrema volatilidad - Solo para expertos"
                },
                "SAFEGEM": {
                    "nombre": "SafeGem",
                    "precioActual": 25.0,
                    "precioAnterior": 25.0,
                    "volatilidad": 0.05,
                    "historial": [],
                    "color": "💎",
                    "descripcion": "Balance perfecto entre riesgo y estabilidad"
                },
                "NEUTRON": {
                    "nombre": "Neutron",
                    "precioActual": 75.0,
                    "precioAnterior": 75.0,
                    "volatilidad": 0.15,
                    "historial": [],
                    "color": "⚛️",
                    "descripcion": "Tecnología avanzada, crecimiento moderado"
                }
            },
            "ultimaActualizacion": new Date().toISOString(),
            "actualizacionesPorHora": 12
        };

        fs.writeFileSync(MARKET_FILE, JSON.stringify(mercadoInicial, null, 2));
    }
}

// Inicializar al cargar el módulo
inicializarMercado();
