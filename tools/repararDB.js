// tools/repararDB.js
import { cargarDatabase, guardarDatabase } from '../data/database.js';

export function repararBaseDeDatos() {
  console.log('🛠️  Iniciando reparación de base de datos...');
  
  const db = cargarDatabase();
  
  if (!db.users) {
    console.log('✅ No hay usuarios en la base de datos');
    return;
  }
  
  let usuariosReparados = 0;
  let errores = 0;
  
  Object.keys(db.users).forEach(userId => {
    try {
      const user = db.users[userId];
      
      // Reparar estructura básica
      if (!user.inventario) user.inventario = {};
      if (!user.inventario.recursos) user.inventario.recursos = {};
      if (!user.inventario.herramientas) user.inventario.herramientas = {};
      if (!user.inventario.especiales) user.inventario.especiales = {};
      if (!user.inventario.mascotas) user.inventario.mascotas = {};
      if (!user.stats) user.stats = {};
      if (!user.cooldowns) user.cooldowns = {};
      
      // Asegurar valores por defecto
      if (user.nivel === undefined) user.nivel = 1;
      if (user.exp === undefined) user.exp = 0;
      if (user.pandacoins === undefined) user.pandacoins = 0;
      
      // Inicializar recursos comunes si no existen
      const recursosComunes = [
        'pescado', 'carne', 'madera', 'oro', 'diamantes',
        'piedras', 'comida', 'hierro', 'carbon', 'cuero', 'tela'
      ];
      
      recursosComunes.forEach(recurso => {
        if (user.inventario.recursos[recurso] === undefined) {
          user.inventario.recursos[recurso] = 0;
        }
      });
      
      usuariosReparados++;
      console.log(`✅ Usuario reparado: ${userId}`);
      
    } catch (error) {
      errores++;
      console.error(`❌ Error reparando usuario ${userId}:`, error.message);
    }
  });
  
  if (usuariosReparados > 0) {
    guardarDatabase(db);
    console.log(`\n🎉 Reparación completada:`);
    console.log(`✅ Usuarios reparados: ${usuariosReparados}`);
    console.log(`❌ Errores: ${errores}`);
  } else {
    console.log('✅ La base de datos ya está correcta');
  }
}

// Ejecutar reparación
repararBaseDeDatos();
