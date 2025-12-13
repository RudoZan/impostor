// Supabase initialization
// Reemplaza las variables con tus credenciales de Supabase

/* 
 * Para obtener tus credenciales:
 * 1. Ve a tu proyecto en https://supabase.com
 * 2. Ve a Settings > API
 * 3. Copia la URL del proyecto (Project URL)
 * 4. Copia la clave pública (anon/public key)
 */

// ⚠️ REEMPLAZA ESTOS VALORES CON TUS CREDENCIALES DE SUPABASE
const SUPABASE_URL = 'https://junonydusnrcumbjjzqt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vmnxlj3GbQPYqoXSjoK4IA_WN37wTR8';

(function() {
  try {
    // Verificar si Supabase está cargado
    if (typeof supabase === 'undefined') {
      console.warn('Supabase SDK no está cargado. La integración con Supabase está deshabilitada.');
      return;
    }

    // Verificar si las credenciales están configuradas
    if (SUPABASE_URL.includes('TU_PROYECTO') || SUPABASE_ANON_KEY.includes('TU_ANON_KEY')) {
      console.warn('⚠️ Por favor, configura tus credenciales de Supabase en supabase-init.js');
      console.warn('Necesitas reemplazar SUPABASE_URL y SUPABASE_ANON_KEY con tus valores reales.');
      return;
    }

    // Inicializar Supabase y exponer el cliente como window.supabaseClient
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase inicializado correctamente. Cliente disponible como window.supabaseClient');
  } catch (e) {
    console.error('❌ Error inicializando Supabase:', e);
  }
})();

