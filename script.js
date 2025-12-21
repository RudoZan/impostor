// Handler global para errores no capturados y promise rejections
window.addEventListener('error', function(event) {
    console.error('❌ Error no capturado:', event.error);
    if (typeof NotificationUtils !== 'undefined' && event.error && !event.error.message?.includes('Script error')) {
        NotificationUtils.error('Ha ocurrido un error inesperado. Por favor, recarga la página.');
    }
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('❌ Promise rejection no manejada:', event.reason);
    if (typeof NotificationUtils !== 'undefined') {
        const errorMessage = event.reason?.message || 'Error desconocido';
        if (!errorMessage.includes('Timeout') && !errorMessage.includes('abort')) {
            NotificationUtils.error('Error en la operación. Por favor, intenta nuevamente.');
        }
    }
    // Prevenir que el error aparezca en la consola del navegador
    event.preventDefault();
});

// Función para limpiar recursos al salir de la página
function limpiarRecursos() {
    // Limpiar intervalos de polling
    if (window.pollingInterval) {
        clearInterval(window.pollingInterval);
        window.pollingInterval = null;
    }
    if (window.pollingJuegoInterval) {
        clearInterval(window.pollingJuegoInterval);
        window.pollingJuegoInterval = null;
    }
    
    // Desconectar suscripciones de Realtime
    if (window.realtimeSubscription) {
        try {
            window.realtimeSubscription.unsubscribe();
        } catch (e) {
            debugLog('Error al desconectar suscripción Realtime:', e);
        }
        window.realtimeSubscription = null;
    }
    
    // Desconectar suscripciones de juego
    if (window.juegoSubscription) {
        try {
            if (window.supabaseClient) {
                window.supabaseClient.removeChannel(window.juegoSubscription);
            }
        } catch (e) {
            debugLog('Error al desconectar suscripción de juego:', e);
        }
        window.juegoSubscription = null;
    }
    
    if (window.usuariosSubscription) {
        try {
            if (window.supabaseClient) {
                window.supabaseClient.removeChannel(window.usuariosSubscription);
            }
        } catch (e) {
            debugLog('Error al desconectar suscripción de usuarios:', e);
        }
        window.usuariosSubscription = null;
    }
    
    // Limpiar todas las notificaciones activas
    if (typeof NotificationUtils !== 'undefined') {
        NotificationUtils.clearAll();
    }
    
    // Cache de DOM ya no se usa, no hay nada que limpiar
}

// Limpiar recursos cuando se sale de la página
window.addEventListener('beforeunload', limpiarRecursos);
window.addEventListener('pagehide', limpiarRecursos);

// Limpiar recursos cuando la página se oculta (para móviles)
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Pausar polling cuando la página está oculta (optimización de performance)
        if (window.pollingInterval) {
            clearInterval(window.pollingInterval);
            window.pollingInterval = null;
            debugLog('⏸️ Polling de usuarios pausado (página oculta)');
        }
        if (window.pollingJuegoInterval) {
            clearInterval(window.pollingJuegoInterval);
            window.pollingJuegoInterval = null;
            debugLog('⏸️ Polling de juego pausado (página oculta)');
        }
    } else {
        // Reanudar polling cuando la página vuelve a ser visible
        const sessionNumber = SessionCache.getSessionNumber();
        if (sessionNumber && window.location.pathname.includes('sesion.html')) {
            debugLog('▶️ Reanudando polling (página visible)');
            // Los polling se reiniciarán automáticamente en las funciones correspondientes
            // No necesitamos llamarlos aquí explícitamente ya que se reinician al detectar cambios
        }
    }
});

// Esperar a que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', function() {
    
    // Verificar si estamos en la página de inicio o de sesión
    const isHomePage = document.getElementById('btn-crear-sesion');
    const isSesionPage = document.getElementById('numero-sesion-header');
    
    if (isHomePage) {
        initHomePage();
    } else if (isSesionPage) {
        initSesionPage();
    }
});

// Funciones globales para manejo de números de sesión
// Helper para obtener año y mes actual (optimización: evitar múltiples new Date())
function obtenerAnioMesActual() {
    const ahora = new Date();
    return {
        año: ahora.getFullYear(),
        mes: String(ahora.getMonth() + 1).padStart(2, '0')
    };
}

// Función helper para navegación centralizada (mejora: evitar duplicación)
function navegarA(url, delay = 0) {
    // Validar que url sea un string válido
    if (!url || typeof url !== 'string') {
        debugWarn('⚠️ URL inválida en navegarA:', url);
        return;
    }
    
    // Validar que sea una URL relativa o absoluta válida
    if (!/^[a-zA-Z0-9._/-]+\.html$|^\/|^https?:\/\//.test(url)) {
        debugWarn('⚠️ URL con formato inválido:', url);
        return;
    }
    
    const navigate = () => {
        window.location.href = url;
    };
    
    if (delay > 0) {
        setTimeout(navigate, delay);
    } else {
        navigate();
    }
}

// Función helper para verificar si localStorage está disponible
function isLocalStorageAvailable() {
    try {
        const test = '__localStorage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
}

// Función helper para obtener valor de localStorage de forma segura
function getLocalStorageItem(key, defaultValue = null) {
    if (!isLocalStorageAvailable()) {
        return defaultValue;
    }
    try {
        const value = localStorage.getItem(key);
        return value !== null ? value : defaultValue;
    } catch (e) {
        debugLog('Error leyendo localStorage:', e);
        return defaultValue;
    }
}

// Función helper para guardar en localStorage de forma segura
function setLocalStorageItem(key, value) {
    if (!isLocalStorageAvailable()) {
        debugWarn('localStorage no disponible');
        return false;
    }
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        debugLog('Error guardando en localStorage:', e);
        return false;
    }
}

// Función para generar número de sesión completo: YYYYMM + 4 dígitos aleatorios
// Ejemplo: 2025123456 (año 2025, mes 12, código 3456)
// Optimización: usar crypto.getRandomValues si está disponible para mejor aleatoriedad
function generarNumeroSesion() {
    const { año, mes } = obtenerAnioMesActual();
    
    // Usar crypto.getRandomValues si está disponible (más seguro y aleatorio)
    let codigoAleatorio;
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const array = new Uint32Array(1);
        crypto.getRandomValues(array);
        // Convertir a rango 1000-9999
        codigoAleatorio = 1000 + (array[0] % 9000);
    } else {
        // Fallback a Math.random
        codigoAleatorio = Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000;
    }
    
    // Combinar: YYYYMM + código (ej: 2025123456)
    // Optimización: usar Number en lugar de parseInt para mejor performance
    return Number(`${año}${mes}${codigoAleatorio}`);
}

// Función para obtener el código corto (últimos 4 dígitos) de un número de sesión
// Optimización: usar toString() en lugar de String() para mejor performance
function obtenerCodigoCorto(numeroSesion) {
    // Validar que el número de sesión sea válido
    if (!numeroSesion || (typeof numeroSesion !== 'number' && typeof numeroSesion !== 'string')) {
        debugWarn('⚠️ Número de sesión inválido en obtenerCodigoCorto:', numeroSesion);
        return '0000';
    }
    // Retornar los últimos 4 dígitos (toString es más rápido que String())
    return numeroSesion.toString().slice(-4);
}

// Función para validar código de sesión (4 dígitos)
function validarCodigoSesion(codigo) {
    // Convertir a string y limpiar
    const codigoStr = String(codigo || '').trim();
    
    // Validar que no esté vacío
    if (!codigoStr) {
        return {
            valido: false,
            error: 'Por favor, ingresa un código de sesión.',
            codigo: null
        };
    }
    
    // Validar que sean solo dígitos
    if (!/^\d+$/.test(codigoStr)) {
        return {
            valido: false,
            error: 'El código de sesión solo puede contener números.',
            codigo: null
        };
    }
    
    // Validar longitud (debe ser 4 dígitos)
    if (codigoStr.length !== 4) {
        return {
            valido: false,
            error: 'El código de sesión debe tener exactamente 4 dígitos.',
            codigo: null
        };
    }
    
    // Validar rango (1000-9999)
    const codigoNum = Number(codigoStr);
    if (codigoNum < 1000 || codigoNum > 9999) {
        return {
            valido: false,
            error: 'El código de sesión debe estar entre 1000 y 9999.',
            codigo: null
        };
    }
    
    return {
        valido: true,
        error: null,
        codigo: codigoNum
    };
}

// Función para construir el número de sesión completo desde un código corto
// Agrega automáticamente el año y mes actual
function construirNumeroSesionCompleto(codigoCorto) {
    // Validar entrada
    if (!codigoCorto && codigoCorto !== 0) {
        throw new Error('El código corto es requerido');
    }
    
    const { año, mes } = obtenerAnioMesActual();
    
    // Validar que el código corto tenga 4 dígitos (optimización: usar toString)
    const codigo = codigoCorto.toString().padStart(4, '0');
    if (codigo.length !== 4 || !/^\d{4}$/.test(codigo)) {
        throw new Error('El código debe tener exactamente 4 dígitos numéricos');
    }
    
    // Validar rango (1000-9999)
    const codigoNum = Number(codigo);
    if (codigoNum < 1000 || codigoNum > 9999) {
        throw new Error('El código debe estar entre 1000 y 9999');
    }
    
    // Combinar: YYYYMM + código (optimización: usar Number en lugar de parseInt para números)
    return Number(`${año}${mes}${codigo}`);
}

// Funcionalidad para la página de inicio
function initHomePage() {
    // Obtener el campo de nombre del usuario
    const nombreUsuarioInput = document.getElementById('nombre-usuario-inicio');
    if (!nombreUsuarioInput) {
        debugWarn('❌ No se encontró el campo nombre-usuario-inicio');
        return;
    }
    
    // Cargar nombre guardado si existe (usando helper seguro)
    const nombreGuardado = getLocalStorageItem('userName');
    if (nombreGuardado) {
        nombreUsuarioInput.value = nombreGuardado;
    }
    
    // Cargar y mostrar ícono guardado
    const iconoGuardado = obtenerIconoUsuario();
    const iconoActual = document.getElementById('icono-actual');
    if (iconoActual) {
        iconoActual.textContent = iconoGuardado;
    }
    
    // Configurar botón para abrir modal de ícono
    const btnCambiarIcono = document.getElementById('btn-cambiar-icono');
    const modalIcono = document.getElementById('modal-icono');
    const btnCerrarIcono = document.getElementById('btn-cerrar-icono');
    
    // Cachear iconosOptions para evitar múltiples queries (optimización)
    const iconosOptions = document.querySelectorAll('.icono-option');
    
    if (btnCambiarIcono && modalIcono) {
        btnCambiarIcono.addEventListener('click', function() {
            // Cargar ícono actual y marcar como seleccionado
            const iconoActual = obtenerIconoUsuario();
            iconosOptions.forEach(btn => {
                btn.classList.remove('selected');
                if (btn.dataset.icono === iconoActual) {
                    btn.classList.add('selected');
                }
            });
            ModalUtils.show('modal-icono');
        });
    }
    
    // Configurar selección de íconos en el modal (usando iconosOptions ya cacheado)
    iconosOptions.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remover selección anterior
            iconosOptions.forEach(b => b.classList.remove('selected'));
            // Agregar selección actual
            this.classList.add('selected');
            // Guardar ícono seleccionado
            const iconoSeleccionado = this.dataset.icono;
            guardarIconoUsuario(iconoSeleccionado);
            // Actualizar ícono en el botón
            const iconoActualElement = document.getElementById('icono-actual');
            if (iconoActualElement) {
                iconoActualElement.textContent = iconoSeleccionado;
            }
        });
    });
    
    // Configurar modal de ícono usando ModalUtils
    ModalUtils.setup('modal-icono', {
        closeButtonId: 'btn-cerrar-icono',
        closeOnOutsideClick: true
    });
    
    // Función para validar y obtener el nombre del usuario
    function obtenerYValidarNombre() {
        const nombre = nombreUsuarioInput.value.trim();
        const MAX_LENGTH = CONFIG.USER_NAME_MAX_LENGTH;
        const MIN_LENGTH = CONFIG.USER_NAME_MIN_LENGTH;
        
        // Validaciones básicas
        if (!nombre) {
            NotificationUtils.error('Por favor, ingresa tu nombre antes de continuar.');
            nombreUsuarioInput.focus();
            return null;
        }
        
        if (nombre.length < MIN_LENGTH) {
            NotificationUtils.warning(`El nombre debe tener al menos ${MIN_LENGTH} caracteres.`);
            nombreUsuarioInput.focus();
            return null;
        }
        
        if (nombre.length > MAX_LENGTH) {
            NotificationUtils.warning(`El nombre no puede exceder ${MAX_LENGTH} caracteres.`);
            nombreUsuarioInput.focus();
            return null;
        }
        
        // Validar caracteres permitidos (solo letras, números, espacios y algunos caracteres especiales)
        const nombreRegex = /^[a-zA-Z0-9\sáéíóúÁÉÍÓÚñÑüÜ\-_.,!?]+$/;
        if (!nombreRegex.test(nombre)) {
            NotificationUtils.warning('El nombre contiene caracteres no permitidos. Solo se permiten letras, números y espacios.');
            nombreUsuarioInput.focus();
            return null;
        }
        
        // Prevenir nombres que sean solo espacios o caracteres especiales
        if (!/[a-zA-Z0-9]/.test(nombre)) {
            NotificationUtils.warning('El nombre debe contener al menos una letra o número.');
            nombreUsuarioInput.focus();
            return null;
        }
        
        // Sanitizar: remover caracteres de control y espacios múltiples
        const nombreSanitizado = nombre.replace(/\s+/g, ' ').trim();
        
        // Guardar el nombre en localStorage (usando helper seguro)
        if (setLocalStorageItem('userName', nombreSanitizado)) {
            // Invalidar cache
            SessionCache.invalidateUserName();
            return nombreSanitizado;
        } else {
            // Si no se pudo guardar, aún retornar el nombre pero mostrar advertencia
            debugWarn('No se pudo guardar el nombre en localStorage');
            return nombreSanitizado;
        }
    }
    
    // Función para crear nueva sesión
    async function crearNuevaSesion() {
        const nombre = obtenerYValidarNombre();
        if (!nombre) {
            return; // La validación ya mostró el error
        }
        
        // Verificar que Supabase esté disponible
        if (!isSupabaseAvailable()) {
            NotificationUtils.error('Error: No se puede conectar con la base de datos. Por favor, recarga la página.');
            return;
        }
        
        // Generar un número de sesión único
        let numeroSesion;
        let intentos = 0;
        const maxIntentos = CONFIG.MAX_INTENTOS_SESION; // Usar constante de CONFIG
        
        do {
            numeroSesion = generarNumeroSesion();
            const existe = await verificarCodigoSesion(numeroSesion);
            
            if (!existe) {
                // Número único encontrado
                debugLog(`✅ Número de sesión único encontrado: ${numeroSesion} (intento ${intentos + 1})`);
                break;
            }
            
            intentos++;
            debugLog(`⚠️ Número ${numeroSesion} ya existe, generando otro... (intento ${intentos})`);
            
            if (intentos >= maxIntentos) {
                NotificationUtils.error('Error: No se pudo generar un número de sesión único después de varios intentos. Por favor, intenta nuevamente.');
                return;
            }
        } while (true);
        
        // Guardar en localStorage para que esté disponible en la página de sesión (usando helpers seguros)
        setLocalStorageItem('sessionNumber', numeroSesion);
        setLocalStorageItem('sessionType', 'admin');
        // Invalidar cache
        SessionCache.invalidateSessionNumber();
        SessionCache.invalidateSessionType();
        
        // Persistir la sesión en Supabase con el código y el nombre del usuario
        try {
            await saveSessionToSupabase(numeroSesion, { 
                role: 'admin',
                usuario: nombre 
            });
            debugLog(`✅ Sesión ${numeroSesion} creada exitosamente`);
        } catch (err) {
            debugLog('No se pudo guardar la sesión en Supabase:', err);
            NotificationUtils.error('Error al crear la sesión. Por favor, intenta nuevamente.');
            // Limpiar localStorage en caso de error
            limpiarDatosSesion();
            return;
        }

        // Redirigir a la página de sesión
        navegarA('sesion.html');
    }
    
    // Función para abrir sesión existente
    async function abrirSesionExistente() {
        const nombre = obtenerYValidarNombre();
        if (!nombre) {
            return; // La validación ya mostró el error
        }
        
        const codigoIngresado = document.getElementById('numero-sesion')?.value || '';
        
        // Validar código de sesión
        const validacion = validarCodigoSesion(codigoIngresado);
        if (!validacion.valido) {
            NotificationUtils.warning(validacion.error);
            return;
        }
        
        const codigoNum = validacion.codigo;
        
        // Buscar sesión por código corto (últimos 4 dígitos)
        // Primero intenta con el mes actual, luego busca en cualquier mes
        if (!isSupabaseAvailable()) {
            NotificationUtils.error('Error: No se puede conectar con la base de datos. Por favor, recarga la página.');
            return;
        }
        
        let numeroSesion = null;
        
        // Primero intentar con el año y mes actual
        try {
            const numeroActual = construirNumeroSesionCompleto(codigoIngresado);
            const existeActual = await verificarCodigoSesion(numeroActual);
            if (existeActual) {
                numeroSesion = numeroActual;
                debugLog(`✅ Sesión encontrada con mes actual: ${numeroSesion}`);
            }
        } catch (err) {
            debugLog('Error al construir número con mes actual:', err);
            // Continuar con la búsqueda en otros meses
        }
        
        // Si no se encontró, buscar en cualquier sesión que termine con esos 4 dígitos
        if (!numeroSesion) {
            try {
                numeroSesion = await buscarSesionPorCodigoCorto(codigoIngresado);
                if (numeroSesion) {
                    debugLog(`✅ Sesión encontrada en otro mes: ${numeroSesion}`);
                }
            } catch (err) {
                debugLog('Error buscando sesión por código corto:', err);
                const errorMessage = err?.message || 'Error desconocido';
                if (errorMessage.includes('Timeout') || errorMessage.includes('network')) {
                    NotificationUtils.error('Error de conexión. Por favor, verifica tu internet e intenta nuevamente.');
                } else {
                    NotificationUtils.error('Error al buscar la sesión. Por favor, intenta nuevamente.');
                }
            return;
            }
        }
        
        if (!numeroSesion) {
            NotificationUtils.error('Este código de sesión no existe en la base de datos. Por favor, verifica el número e intenta nuevamente.');
            return;
        }
        
        // Verificar que no exista otro usuario con el mismo nombre en esta sesión
        try {
        const usuarioExiste = await verificarUsuarioEnSesion(numeroSesion, nombre);
        if (usuarioExiste) {
                NotificationUtils.warning(`Ya existe un usuario con el nombre "${nombre}" en esta sesión. Por favor, elige otro nombre.`);
                return;
            }
        } catch (err) {
            debugLog('Error verificando usuario en sesión:', err);
            NotificationUtils.error('Error al verificar el usuario. Por favor, intenta nuevamente.');
            return;
        }
        
        // Guardar en localStorage (usando helpers seguros)
        setLocalStorageItem('sessionNumber', numeroSesion);
        setLocalStorageItem('sessionType', 'guest');
        // Invalidar cache
        SessionCache.invalidateSessionNumber();
        SessionCache.invalidateSessionType();
        
        // Verificar que el ícono esté guardado en localStorage antes de unirse
        const iconoGuardado = obtenerIconoUsuario();
        if (iconoGuardado === '👤' && !localStorage.getItem('userIcono')) {
            // Si no hay ícono guardado, usar el por defecto y guardarlo
            guardarIconoUsuario('👤');
            debugLog('⚠️ No se encontró ícono en localStorage, usando por defecto 👤');
        } else {
            debugLog('✅ Ícono encontrado en localStorage antes de unirse:', iconoGuardado);
        }
        
        // Guardar el participante en Supabase
        try {
            await saveParticipantToSupabase(numeroSesion, { name: nombre, role: 'guest' });
        } catch (err) {
            debugLog('❌ Error al guardar participante en Supabase:', err);
            if (CONFIG.DEBUG_MODE) {
                debugLog('📋 Detalles completos del error:', JSON.stringify(err, null, 2));
            }
            
            // Mostrar mensaje más detallado si es un error de permisos
            if (err.code === 'PGRST301' || (err.message && err.message.includes('permission')) || (err.message && err.message.includes('RLS'))) {
                NotificationUtils.error('Error de permisos: No se pudo guardar el ícono. Verifica la configuración de RLS en Supabase.');
            } else if (err.message && err.message.includes('column')) {
                NotificationUtils.error('Error: La columna "icono" no existe en la tabla. Ejecuta: ALTER TABLE codigos ADD COLUMN icono TEXT DEFAULT \'👤\';');
            } else {
                NotificationUtils.error('Error al unirse a la sesión: ' + (err.message || 'Error desconocido'));
            }
            return;
        }
        
        // Redirigir a la página de sesión
        navegarA('sesion.html');
    }
    
    // Event listeners para la página de inicio (con debounce para prevenir clicks múltiples)
    const btnCrearSesion = document.getElementById('btn-crear-sesion');
    if (btnCrearSesion) {
        let isCreating = false;
        btnCrearSesion.addEventListener('click', debounce(function() {
            if (isCreating) return;
            isCreating = true;
            // Agregar estado de loading
            const originalText = btnCrearSesion.textContent;
            btnCrearSesion.disabled = true;
            btnCrearSesion.textContent = 'Creando...';
            
            crearNuevaSesion().catch(err => handleSessionError(err, 'crear sesión')).finally(() => {
                isCreating = false;
                btnCrearSesion.disabled = false;
                btnCrearSesion.textContent = originalText;
            });
        }, 1000));
    }
    
    const btnAbrirSesion = document.getElementById('btn-abrir-sesion');
    if (btnAbrirSesion) {
        let isJoining = false;
        btnAbrirSesion.addEventListener('click', debounce(function() {
            if (isJoining) return;
            isJoining = true;
            // Agregar estado de loading
            const originalText = btnAbrirSesion.textContent;
            btnAbrirSesion.disabled = true;
            btnAbrirSesion.textContent = 'Uniéndose...';
            
            abrirSesionExistente().catch(err => handleSessionError(err, 'unirse a la sesión')).finally(() => {
                isJoining = false;
                btnAbrirSesion.disabled = false;
                btnAbrirSesion.textContent = originalText;
            });
        }, 1000));
    }
    
    // Permitir crear sesión con Enter en el campo de número
    // Agregar validación en tiempo real del código de sesión
    const numeroSesionInput = document.getElementById('numero-sesion');
    if (numeroSesionInput) {
        // Validación en tiempo real mientras el usuario escribe
        numeroSesionInput.addEventListener('input', function(e) {
            const valor = e.target.value;
            // Limitar a 4 dígitos
            if (valor.length > 4) {
                e.target.value = valor.slice(0, 4);
            }
            // Validar que solo sean números
            if (valor && !/^\d+$/.test(valor)) {
                e.target.value = valor.replace(/\D/g, '');
            }
        });
        
        // Permitir Enter para enviar
        numeroSesionInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            abrirSesionExistente().catch(err => handleSessionError(err, 'unirse a la sesión'));
        }
    });
    }
    
    // Permitir crear sesión con Enter en el campo de nombre
    nombreUsuarioInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            // Si el campo de número de sesión tiene valor, abrir sesión, sino crear nueva
            const numeroSesionInput = document.getElementById('numero-sesion');
            const numeroSesion = numeroSesionInput ? numeroSesionInput.value : '';
            if (numeroSesion) {
                abrirSesionExistente().catch(err => handleSessionError(err, 'unirse a la sesión'));
            } else {
                crearNuevaSesion().catch(err => handleSessionError(err, 'crear sesión'));
            }
        }
    });
    
    // Configurar botón de instrucciones
    const btnInstrucciones = document.getElementById('btn-instrucciones');
    const modalInstrucciones = document.getElementById('modal-instrucciones');
    const btnCerrarInstrucciones = document.getElementById('btn-cerrar-instrucciones');
    
    // Configurar modal de instrucciones usando ModalUtils
    ModalUtils.setup('modal-instrucciones', {
        openButtonId: 'btn-instrucciones',
        closeButtonId: 'btn-cerrar-instrucciones',
        closeOnOutsideClick: true
    });
}

// Funcionalidad para la página de sesión
async function initSesionPage() {
    // Obtener datos de la sesión desde localStorage
    const sessionNumber = SessionCache.getSessionNumber();
    
    // Si no hay datos de sesión, redirigir al inicio
    if (!sessionNumber) {
        NotificationUtils.error('No se encontró información de sesión. Redirigiendo al inicio...');
        setTimeout(() => {
            navegarA('index.html', 2000);
        }, 2000);
        return;
    }
    
    // Verificar que el código de sesión existe en Supabase (OBLIGATORIO)
    if (isSupabaseAvailable()) {
        const existe = await verificarCodigoSesion(sessionNumber);
        if (!existe) {
            NotificationUtils.error('Esta sesión ya no existe en la base de datos. Redirigiendo al inicio...');
            // Limpiar localStorage
            limpiarDatosSesion();
            SessionCache.clear();
            setTimeout(() => {
                navegarA('index.html', 2000);
            }, 2000);
            return;
        }
    } else {
        // Si Supabase no está disponible, no permitir continuar
        NotificationUtils.error('Error: No se puede conectar con la base de datos. Por favor, recarga la página.');
        setTimeout(() => {
            navegarA('index.html', 2000);
        }, 2000);
        return;
    }
    
    // Actualizar número de sesión (mostrar solo los últimos 4 dígitos)
    const numeroSesionHeader = document.getElementById('numero-sesion-header');
    if (numeroSesionHeader) {
        const codigoCorto = obtenerCodigoCorto(sessionNumber);
        numeroSesionHeader.textContent = codigoCorto;
    }
    
    // Función para actualizar la información del usuario
    function actualizarBarraSuperior(nombre) {
        const userNameHeader = document.getElementById('user-name-header');
        const nombreUsuarioHeader = document.getElementById('nombre-usuario-header');
        
        if (userNameHeader && nombreUsuarioHeader) {
            nombreUsuarioHeader.textContent = nombre;
            userNameHeader.style.display = 'block';
        }
    }
    
    // Configurar botón de volver al inicio INMEDIATAMENTE (antes de cualquier operación asíncrona)
    // para que esté disponible desde el principio sin delays
    configurarBotonVolverInicio();
    
    // Verificar si ya hay un nombre guardado
    const userName = SessionCache.getUserName();
    if (userName) {
        actualizarBarraSuperior(userName);
    }
    
    // Cargar y suscribirse a usuarios en tiempo real
    await cargarYSuscribirUsuarios(sessionNumber);
    
    // Inicializar juego
    await inicializarJuego(sessionNumber);
    
    // Re-configurar botón como respaldo (por si acaso algo cambió durante la inicialización)
    configurarBotonVolverInicio();
    
    // Inicializar efectos visuales
    efectosScroll();
}

// Configuración centralizada
const CONFIG = {
    VERSION_JUEGO: '1.2',
    APP_NAME: 'Impostor1',
    MAX_INTENTOS_SESION: 50,
    POLLING_INTERVAL: 3000,
    POLLING_JUEGO_INTERVAL: 2000,
    REALTIME_TIMEOUT: 5000,
    REALTIME_CHECK_TIMEOUT: 5000,
    SUPABASE_TIMEOUT: 10000, // 10 segundos
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    MAX_USUARIOS_QUERY: 100,
    DELAY_REINTENTO_JUEGO: 2000,
    TIEMPO_MOSTRAR_CONTENIDO: 2000,
    DEBUG_MODE: false, // Cambiar a true para ver logs detallados
    USER_NAME_MIN_LENGTH: 2,
    USER_NAME_MAX_LENGTH: 50
};

// Funciones helper para logging (optimización: evitar múltiples ifs)
function debugLog(...args) {
    if (CONFIG.DEBUG_MODE) {
        console.log(...args);
    }
}

function debugWarn(...args) {
    if (CONFIG.DEBUG_MODE) {
        console.warn(...args);
    }
}

// Utilidad para debounce (prevenir múltiples clicks rápidos)
function debounce(func, wait = 500) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Helper para delay (optimización: evitar repetir Promise con setTimeout)
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper para convertir sessionNumber a string de forma consistente
function sessionNumberToString(sessionNumber) {
    if (sessionNumber == null) return '';
    return typeof sessionNumber === 'string' ? sessionNumber : sessionNumber.toString();
}

// Helper para verificar si Supabase está disponible (optimización: evitar repetición)
function isSupabaseAvailable() {
    return typeof window.supabaseClient !== 'undefined';
}

// Helper para verificar si un array tiene elementos (optimización: evitar repetición)
function isNonEmptyArray(arr) {
    return Array.isArray(arr) && arr.length > 0;
}

// Helper para obtener elementos DOM
function getElement(id) {
    return document.getElementById(id);
}

// Helper para manejo de errores de sesión (optimización: evitar código duplicado)
function handleSessionError(err, action = 'operación') {
    debugLog(`Error al ${action}:`, err);
    const errorMessage = err?.message || 'Error desconocido';
    if (errorMessage.includes('Timeout') || errorMessage.includes('network')) {
        NotificationUtils.error('Error de conexión. Por favor, verifica tu internet e intenta nuevamente.');
    } else if (action.includes('crear')) {
        NotificationUtils.error('Error al crear la sesión. Por favor, intenta nuevamente.');
    } else if (action.includes('abrir') || action.includes('unirse')) {
        NotificationUtils.error('Error al unirse a la sesión. Por favor, intenta nuevamente.');
    } else {
        NotificationUtils.error(`Error en la ${action}. Por favor, intenta nuevamente.`);
    }
}

// Helper para reintentos con delay (optimización: extraer lógica duplicada)
async function retryWithDelay(fn, maxAttempts = 3, delayMs = CONFIG.DELAY_REINTENTO_JUEGO) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const result = await fn();
        if (result) return result;
        if (attempt < maxAttempts) {
            debugLog(`⏳ Intento ${attempt} falló, reintentando en ${delayMs}ms...`);
            await delay(delayMs);
        }
    }
    return null;
}

// Sistema de notificaciones para reemplazar alerts (mejora UX)
const NotificationUtils = {
    // Rastrear notificaciones activas para evitar memory leaks
    activeNotifications: new Set(),
    
    show(message, type = 'info', duration = 3000) {
        // Crear elemento de notificación
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        // Mapa de iconos por tipo (optimización: más legible que ternarios anidados)
        const iconMap = {
            error: '❌',
            success: '✅',
            warning: '⚠️',
            info: 'ℹ️'
        };
        const icon = iconMap[type] || iconMap.info;
        
        // Usar createElement en lugar de innerHTML para seguridad XSS
        const iconSpan = document.createElement('span');
        iconSpan.className = 'notification-icon';
        iconSpan.textContent = icon;
        
        const messageSpan = document.createElement('span');
        messageSpan.className = 'notification-message';
        messageSpan.textContent = message; // textContent escapa automáticamente
        
        notification.appendChild(iconSpan);
        notification.appendChild(messageSpan);
        
        // Agregar estilos si no existen
        let notificationStyles = document.getElementById('notification-styles');
        if (!notificationStyles) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: white;
                    padding: 1rem 1.5rem;
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    max-width: 400px;
                    animation: slideInRight 0.3s ease;
                    font-size: 0.9rem;
                }
                .notification-error { border-left: 4px solid var(--color-error, #e53e3e); }
                .notification-success { border-left: 4px solid var(--color-success, #38a169); }
                .notification-warning { border-left: 4px solid var(--color-warning, #d69e2e); }
                .notification-info { border-left: 4px solid var(--color-info, #3182ce); }
                .notification-icon { font-size: 1.2rem; }
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
            // Cachear el elemento
            // Cache de DOM ya no se usa
        }
        
        document.body.appendChild(notification);
        this.activeNotifications.add(notification);
        
        // Auto-remover después de duration
        const timeoutId = setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            const removeTimeoutId = setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                this.activeNotifications.delete(notification);
            }, 300);
            // Almacenar referencia al timeout para limpieza si es necesario
            notification._removeTimeoutId = removeTimeoutId;
        }, duration);
        // Almacenar referencia al timeout para limpieza si es necesario
        notification._timeoutId = timeoutId;
        
        return notification;
    },
    
    error(message, duration = 4000) {
        return this.show(message, 'error', duration);
    },
    
    success(message, duration = 3000) {
        return this.show(message, 'success', duration);
    },
    
    warning(message, duration = 3500) {
        return this.show(message, 'warning', duration);
    },
    
    info(message, duration = 3000) {
        return this.show(message, 'info', duration);
    },
    
    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    // Limpiar todas las notificaciones activas (útil al cambiar de página)
    clearAll() {
        this.activeNotifications.forEach(notification => {
            if (notification._timeoutId) {
                clearTimeout(notification._timeoutId);
            }
            if (notification._removeTimeoutId) {
                clearTimeout(notification._removeTimeoutId);
            }
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
        this.activeNotifications.clear();
    }
};

// Utilidad para manejo de modales (refactorización: evitar código duplicado)
const ModalUtils = {
    show(modalId) {
        // #region agent log
        console.log('[DEBUG] ModalUtils.show ENTRY', {modalId});
        fetch('http://127.0.0.1:7242/ingest/23d8a578-afff-4b9d-97f4-b7377d1722b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:1008',message:'ModalUtils.show ENTRY',data:{modalId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        const modal = getElement(modalId);
        // #region agent log
        console.log('[DEBUG] BEFORE modal display change', {modalFound:!!modal,modalId,currentDisplay:modal?.style.display});
        fetch('http://127.0.0.1:7242/ingest/23d8a578-afff-4b9d-97f4-b7377d1722b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:1010',message:'BEFORE modal display change',data:{modalFound:!!modal,modalId,currentDisplay:modal?.style.display},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        if (modal) {
            modal.style.display = 'flex';
            // #region agent log
            const computedDisplay = window.getComputedStyle(modal).display;
            console.log('[DEBUG] AFTER modal display change', {modalId,newDisplay:modal.style.display,computedDisplay});
            fetch('http://127.0.0.1:7242/ingest/23d8a578-afff-4b9d-97f4-b7377d1722b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:1011',message:'AFTER modal display change',data:{modalId,newDisplay:modal.style.display,computedDisplay},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            // Prevenir scroll del body cuando el modal está abierto
            document.body.style.overflow = 'hidden';
        } else {
            // #region agent log
            console.log('[DEBUG] ModalUtils.show - modal not found', {modalId});
            fetch('http://127.0.0.1:7242/ingest/23d8a578-afff-4b9d-97f4-b7377d1722b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:1015',message:'ModalUtils.show - modal not found',data:{modalId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
        }
        return modal;
    },
    
    hide(modalId) {
        const modal = getElement(modalId);
        if (modal) {
            modal.style.display = 'none';
            // Restaurar scroll del body
            document.body.style.overflow = '';
            
            // Limpiar escape handler si existe
            if (modal._escapeHandler) {
                document.removeEventListener('keydown', modal._escapeHandler);
                modal._escapeHandler = null;
            }
            
            // Mejorar accesibilidad: devolver foco al elemento que abrió el modal
            const lastFocused = document.activeElement;
            if (lastFocused && lastFocused !== document.body) {
                // Si el último elemento enfocado está dentro del modal, buscar el botón que lo abrió
                const openButton = document.querySelector(`[data-opened-modal="${modalId}"]`);
                if (openButton) {
                    setTimeout(() => openButton.focus(), 100);
                }
            }
        }
        return modal;
    },
    
    toggle(modalId) {
        const modal = getElement(modalId);
        if (modal) {
            const isVisible = modal.style.display === 'flex';
            if (isVisible) {
                this.hide(modalId);
            } else {
                this.show(modalId);
            }
        }
        return modal;
    },
    
    // Configurar cierre al hacer clic fuera del modal
    setupOutsideClick(modalId) {
        const modal = getElement(modalId);
        if (modal) {
            // Remover listener anterior si existe
            const existingHandler = modal._outsideClickHandler;
            if (existingHandler) {
                modal.removeEventListener('click', existingHandler);
            }
            
            const handler = function(e) {
                if (e.target === modal) {
                    ModalUtils.hide(modalId);
                }
            };
            modal._outsideClickHandler = handler;
            modal.addEventListener('click', handler);
        }
    },
    
    // Configurar modal completo con botones de confirmar/cancelar
    setup(modalId, options = {}) {
        const modal = getElement(modalId);
        if (!modal) return null;
        
        const {
            openButtonId,
            closeButtonId,
            confirmButtonId,
            cancelButtonId,
            onConfirm,
            onCancel,
            closeOnOutsideClick = true,
            closeOnEscape = true
        } = options;
        
        // Configurar cierre con tecla Escape (mejora de accesibilidad)
        if (closeOnEscape) {
            const escapeHandler = (e) => {
                if (e.key === 'Escape' && modal.style.display === 'flex') {
                    this.hide(modalId);
                    if (onCancel) onCancel();
                }
            };
            // Remover handler anterior si existe
            if (modal._escapeHandler) {
                document.removeEventListener('keydown', modal._escapeHandler);
            }
            modal._escapeHandler = escapeHandler;
            document.addEventListener('keydown', escapeHandler);
        }
        
        // Botón para abrir
        if (openButtonId) {
            const openBtn = getElement(openButtonId);
            if (openBtn) {
                // Remover listener anterior si existe
                const existingHandler = openBtn._openModalHandler;
                if (existingHandler) {
                    openBtn.removeEventListener('click', existingHandler);
                }
                
                const handler = () => {
                    // Marcar qué botón abrió el modal para devolver el foco después
                    openBtn.setAttribute('data-opened-modal', modalId);
                    this.show(modalId);
                };
                openBtn._openModalHandler = handler;
                openBtn.addEventListener('click', handler);
            }
        }
        
        // Botón para cerrar
        if (closeButtonId) {
            const closeBtn = getElement(closeButtonId);
            if (closeBtn) {
                const existingHandler = closeBtn._closeModalHandler;
                if (existingHandler) {
                    closeBtn.removeEventListener('click', existingHandler);
                }
                
                const handler = () => {
                    this.hide(modalId);
                    if (onCancel) onCancel();
                };
                closeBtn._closeModalHandler = handler;
                closeBtn.addEventListener('click', handler);
            }
        }
        
        // Botón de confirmar
        if (confirmButtonId) {
            const confirmBtn = getElement(confirmButtonId);
            if (confirmBtn) {
                const existingHandler = confirmBtn._confirmModalHandler;
                if (existingHandler) {
                    confirmBtn.removeEventListener('click', existingHandler);
                }
                
                const handler = () => {
                    this.hide(modalId);
                    if (onConfirm) onConfirm();
                };
                confirmBtn._confirmModalHandler = handler;
                confirmBtn.addEventListener('click', handler);
            }
        }
        
        // Botón de cancelar
        if (cancelButtonId) {
            const cancelBtn = getElement(cancelButtonId);
            if (cancelBtn) {
                const existingHandler = cancelBtn._cancelModalHandler;
                if (existingHandler) {
                    cancelBtn.removeEventListener('click', existingHandler);
                }
                
                const handler = () => {
                    this.hide(modalId);
                    if (onCancel) onCancel();
                };
                cancelBtn._cancelModalHandler = handler;
                cancelBtn.addEventListener('click', handler);
            }
        }
        
        // Cerrar al hacer clic fuera
        if (closeOnOutsideClick) {
            this.setupOutsideClick(modalId);
        }
        
        return modal;
    }
};

// Funciones helper para optimización de Supabase
// Timeout wrapper para llamadas a Supabase
async function supabaseWithTimeout(queryFn, timeoutMs = CONFIG.SUPABASE_TIMEOUT) {
    return Promise.race([
        queryFn(),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout: La operación tardó demasiado')), timeoutMs)
        )
    ]);
}

// Retry logic para operaciones críticas
async function retryOperation(fn, maxRetries = CONFIG.MAX_RETRIES, delayMs = CONFIG.RETRY_DELAY) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            debugLog(`⚠️ Intento ${i + 1} falló, reintentando en ${delayMs * (i + 1)}ms...`);
            await delay(delayMs * (i + 1));
        }
    }
}

// Función combinada: timeout + retry
async function supabaseQuery(queryFn, options = {}) {
    const { 
        timeout = CONFIG.SUPABASE_TIMEOUT, 
        retries = CONFIG.MAX_RETRIES,
        retryDelay = CONFIG.RETRY_DELAY
    } = options;
    
    return retryOperation(
        () => supabaseWithTimeout(queryFn, timeout),
        retries,
        retryDelay
    );
}

// Detectar pérdida de conexión
let connectionLost = false;

window.addEventListener('online', () => {
    if (connectionLost) {
        debugLog('✅ Conexión restaurada');
        connectionLost = false;
        // Mostrar notificación de reconexión
        if (typeof NotificationUtils !== 'undefined') {
            NotificationUtils.success('Conexión restaurada', 3000);
        }
        // Ocultar indicador de conexión si existe
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.style.display = 'none';
        }
        // Recargar datos si estamos en una página de sesión
        if (window.location.pathname.includes('sesion.html')) {
            const sessionNumber = SessionCache.getSessionNumber();
            if (sessionNumber) {
                debugLog('🔄 Recargando datos después de reconexión...');
                // Pequeño delay para asegurar que la conexión esté estable
                setTimeout(() => {
                    window.location.reload();
                }, 500);
            }
        }
    }
});

window.addEventListener('offline', () => {
    connectionLost = true;
    debugWarn('⚠️ Conexión perdida');
    // Mostrar notificación al usuario usando NotificationUtils
    if (typeof NotificationUtils !== 'undefined') {
        NotificationUtils.warning('Sin conexión a internet. Algunas funciones pueden no estar disponibles.', 5000);
    }
    // Mostrar notificación al usuario si hay un elemento para ello (fallback)
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        statusElement.textContent = '⚠️ Sin conexión';
        statusElement.style.display = 'block';
    }
});

// Variables globales del juego
let categoriasData = {
  "Animales": [
  "León", "Tigre", "Elefante", "Jirafa", "Cebra",
  "Oso", "Lobo", "Zorro", "Conejo", "Ratón",
  "Caballo", "Vaca", "Cerdo", "Oveja", "Cabra",
  "Gato", "Perro", "Pájaro", "Águila", "Búho",
  "Delfín", "Ballena", "Tiburón", "Pez", "Pulpo",
  "Serpiente", "Cocodrilo", "Tortuga", "Rana", "Araña",
  "Pantera", "Leopardo", "Hipopótamo", "Rinoceronte", "Canguro",
  "Koala", "Panda", "Camello", "Loro", "Hámster",
  "Cisne", "Chimpancé", "Gorila", "Orangután", "Condor",
  "Ardilla", "Erizo", "Mapache", "Zorrillo", "Castor"
],
"Lugares": [
  "Playa", "Montaña", "Escuela", "Hospital", "Museo", 
  "Cine", "Parque", "Casa", "Restaurante", "Aeropuerto",
  "Estacionamiento", "Supermercado", "Banco", "Farmacia", "Iglesia",
  "Estadio", "Teatro", "Biblioteca", "Universidad", "Hotel",
  "Plaza", "Centro Comercial", "Gimnasio", "Piscina", "Zoológico",
  "Cafetería", "Bar", "Discoteca", "Spa", "Salón de Belleza",
  "Oficina", "Taller", "Granja", "Bosque", "Desierto",
  "Río", "Lago", "Isla", "Volcán", "Cueva",
  "Estación de Tren", "Terminal de Buses", "Puerto", "Mercado", "Tienda",
  "Fábrica", "Cementerio", "Palacio", "Castillo", "Torre"
],
"Objetos": [
  "Hielo", "Cuerda", "Pantalla", "Llave", "Sombrero", 
  "Libro", "Teléfono", "Silla", "Reloj", "Pelota",
  "Mesa", "Cama", "Puerta", "Ventana", "Espejo",
  "Lámpara", "Cuchara", "Tenedor", "Cuchillo", "Plato",
  "Vaso", "Taza", "Botella", "Bolsa", "Maleta",
  "Zapatos", "Camisa", "Pantalón", "Gafas", "Gorra",
  "Coche", "Bicicleta", "Avión", "Barco", "Tren",
  "Lápiz", "Bolígrafo", "Cuaderno", "Carpeta", "Mochila",
  "Cámara", "Radio", "Computadora", "Tablet", "Auriculares",
  "Martillo", "Destornillador", "Clavo", "Tornillo", "Herramienta"
],
"Comida": [
    "Pizza", "Hamburguesa", "Hot dog", "Tacos", "Sushi",
    "Pasta", "Arroz", "Pollo", "Carne", "Pescado",
    "Ensalada", "Sopa", "Sandwich", "Burrito", "Quesadilla",
    "Lasagna", "Ravioli", "Spaghetti", "Macarrones", "Risotto",
    "Paella", "Ceviche", "Empanada", "Arepa", "Tamal",
    "Causa", "Lomo saltado", "Pollo a la brasa", "Chupe", "Ají de gallina",
    "Helado", "Pastel", "Torta", "Galletas", "Chocolate",
    "Pan", "Queso", "Huevo", "Leche", "Yogur",
    "Fruta", "Verdura", "Papas fritas", "Nachos", "Alitas",
    "Pescado frito", "Camarones", "Langosta", "Cangrejo", "Pulpo"
  ],
  "Tipos de Comida": [
    "Lleva carne", "Se come fría", "Comida salada", "Lleva pasta",
    "Se cocina al horno", "Sirve de postre", "Hecha con Harina", "Se puede comer con la mano",
    "Comida picante", "Comida dulce", "Comida vegana", "Comida vegetariana"
  ],
  "Electrodomésticos": [
    "Refrigerador", "Lavadora", "Secadora", "Microondas", "Horno", "Licuadora", "Batidora", "Cafetera", "Tostadora", "Aspiradora",
    "Plancha", "Ventilador", "Aire acondicionado", "Calefactor", "Televisor", "Radio", "Reproductor de DVD", "Lavavajillas", "Horno eléctrico",
    "Congelador", "Horno de gas", "Freidora", "Olla arrocera", "Exprimidor", "Procesador de alimentos",
    "Hervidor eléctrico", "Plancha de vapor", "Secador de pelo", "Rizador de pelo", "Depiladora", "Afeitadora eléctrica", "Cepillo de dientes eléctrico",
    "Lámpara", "Reproductor de música", "Reloj despertador",
    "Máquina de coser", "Cafetera express", "Campana extractora",
    "Vaporera", "Estufa"
  ],
  "Deportes": [
    "Fútbol", "Baloncesto", "Voleibol", "Tenis", "Fútbol Americano",
    "Béisbol", "Rugby", "Hockey", "Natación", "Atletismo",
    "Ciclismo", "Boxeo", "Karate", "Judo", "Taekwondo",
    "Esgrima", "Gimnasia", "Patinaje", "Esquí", "Snowboard",
    "Surf", "Buceo", "Remo", "Vela", "Pesca",
    "Golf", "Bádminton", "Squash", "Tenis de mesa", "Balonmano o Handball",
    "Waterpolo", "Polo", "Cricket", "Ultimate Frisbee",
    "Escalada", "Parapente", "Paracaidismo", "Triatlón", "Maratón",
    "Carrera", "Salto", "Lanzamiento", "Lucha", "Arquería",
    "Tiro con arco", "Equitación", "Automovilismo", "Motociclismo", "Carrera de caballos",
    "Ajedrez"
  ],
  "Tipos de Deportes": [
    "Deporte con pelota", "Deporte acuático", "Deporte de invierno", "Deporte individual", "Deporte en equipo",
    "Deporte olímpico", "Deporte que se juega al aire libre", "Deporte de contacto", "Deporte con raqueta", "Deporte de velocidad",
    "Deporte extremo", "Deporte de resistencia"
  ],
  "Profesiones": [
    "Médico", "Enfermero", "Profesor", "Ingeniero", "Abogado",
    "Arquitecto", "Contador", "Psicólogo", "Veterinario", "Farmacéutico",
    "Dentista", "Policía", "Bombero", "Piloto", "Capitán",
    "Chef", "Cocinero", "Mesero", "Camarero", "Barbero",
    "Peluquero", "Mecánico", "Electricista", "Plomero", "Carpintero",
    "Pintor", "Escritor", "Periodista", "Actor", "Músico",
    "Artista", "Diseñador", "Fotógrafo", "Videógrafo", "Programador",
    "Secretario", "Recepcionista", "Vendedor", "Comerciante", "Empresario",
    "Banquero", "Economista", "Administrador", "Gerente", "Director",
    "Soldado", "Marinero", "Guardia", "Seguridad", "Conductor"
  ],

  "Tipos de Profesión": [
    "Profesión en educación", "Profesión en tecnología", "Profesión en salud", "Profesión en construcción de edificios", "Profesión creativa", "Profesión lilegal",
    "Profesión que trabaja con números", "Profesión que trabaja con personas", "Profesión que requiere estudios universitarios", "Profesión de servicio", "Profesión artística",
    "Profesión en transporte"
  ],
  "Ramos PLEMC": [
    "Introducción a la Pedagogía en Matemática y Computación",
    "Álgebra I",
    "Matemática Básica",
    "Computación I",
    "Inglés I",
    "Sociología y Antropología de la Educación",
    "Álgebra II",
    "Cálculo I",
    "Computación II",
    "Inglés II",
    "Psicología del Aprendizaje Matemático",
    "Álgebra III",
    "Sistemas Operativos y Redes",
    "Probabilidad y Estadística",
    "Cálculo III",
    "Modelamiento de la Información y Sesarrollo de Software",
    "Taller de Inglés I",
    "Desarrollo Curricular Matemático",
    "Práctica I",
    "Fundamentos de la Educación Matemática",
    "Didáctica del Álgebra y el Cálculo",
    "Estadística",
    "Geometría I",
    "Medición y Evaluación de la Matemática",
    "Fundamentos de la Matemática I",
    "Fundamentos de la Matemática II",
    "Geometría II",
    "Computación Educativa",
    "Historia y Epistemología de la Matemática",
    "Taller de Herramientas Didácticas de la Matemática",
    "Didáctica de la Geometría y la Estadística",
    "Psicometría",
    "Taller II de Herramientas Didácticas de la Matemática",
    "Metodología de la Investigación en la Educación Matemática",
    "Aplicaciones Didácticas de la Computación"
  ]
};

let juegoActual = null;
let ultimoJuegoMostrado = null; // Para rastrear el último juego que se mostró

// Cargar categorías (ya están en memoria)
function cargarCategorias() {
    debugLog('✅ Categorías disponibles:', Object.keys(categoriasData).length, 'categorías');
    return categoriasData;
}

// Inicializar funcionalidad del juego
async function inicializarJuego(sessionNumber) {
    // Cargar categorías
    cargarCategorias();
    
    // Mostrar sección de juego
    const juegoSection = document.getElementById('juego-section');
    if (juegoSection) {
        juegoSection.style.display = 'block';
    }
    
    // Cargar estado del juego y usuarios en paralelo (optimización)
    let [hayJuegoActivo, usuarios] = await Promise.all([
        cargarEstadoJuego(sessionNumber),
        obtenerUsuariosSesion(sessionNumber)
    ]);
    
    // Si no se encontró el juego, intentar de nuevo después de un breve delay
    // (puede ser que se acabe de guardar y aún no esté disponible)
    if (!hayJuegoActivo) {
        debugLog('⏳ Juego no encontrado inicialmente, reintentando...');
        hayJuegoActivo = await retryWithDelay(
            () => cargarEstadoJuego(sessionNumber),
            3,
            CONFIG.DELAY_REINTENTO_JUEGO
        );
    }
    
    // Filtrar usuarios válidos
    const usuariosValidos = filtrarUsuariosValidos(usuarios);
    
    // Verificar si el usuario es admin (usando cache)
    const sessionType = SessionCache.getSessionType();
    const esAdmin = sessionType === 'admin';
    
    // Actualizar estado del botón y mensaje según el número de usuarios
    actualizarEstadoJuegoSegunUsuarios(usuariosValidos.length);
    
    // Configurar el botón solo si hay 3 o más usuarios y es admin
    const botonNuevoJuego = document.getElementById('btn-nuevo-juego');
    if (botonNuevoJuego && esAdmin && usuariosValidos.length >= 3) {
        // Solo configurar si el botón está visible (hay 3+ usuarios)
        configurarBotonNuevoJuego(hayJuegoActivo);
    } else if (botonNuevoJuego) {
        // Asegurar que el botón esté oculto si no cumple las condiciones
        botonNuevoJuego.style.display = 'none';
    }
    
    // Suscribirse a cambios del juego en tiempo real
    suscribirACambiosJuego(sessionNumber);
    
    // Iniciar polling de respaldo para asegurar que se detecten los cambios
    iniciarPollingJuego(sessionNumber);
}

// Configurar el botón de nuevo juego
function configurarBotonNuevoJuego(hayJuegoActivo) {
    const botonNuevoJuego = document.getElementById('btn-nuevo-juego');
    if (!botonNuevoJuego) return;
    
    // Evitar agregar múltiples event listeners
    if (botonNuevoJuego.dataset.configured === 'true') return;
    botonNuevoJuego.dataset.configured = 'true';
    
    // Si hay juego activo, mostrar modal de confirmación
    // Si no hay juego activo, redirigir directamente
    if (hayJuegoActivo) {
        // Configurar modal usando ModalUtils
        ModalUtils.setup('modal-confirmacion', {
            openButtonId: 'btn-nuevo-juego',
            confirmButtonId: 'btn-confirmar-nuevo-juego',
            cancelButtonId: 'btn-cancelar-nuevo-juego',
            onConfirm: () => {
                navegarA('seleccionar-categoria.html');
            },
            closeOnOutsideClick: true
        });
    } else {
        // Si no hay juego activo, redirigir directamente
    botonNuevoJuego.onclick = function() {
            navegarA('seleccionar-categoria.html');
        };
    }
}

// Configurar el botón de volver al inicio
function configurarBotonVolverInicio() {
    // #region agent log
    console.log('[DEBUG] configurarBotonVolverInicio ENTRY');
    fetch('http://127.0.0.1:7242/ingest/23d8a578-afff-4b9d-97f4-b7377d1722b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:1510',message:'configurarBotonVolverInicio ENTRY',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Intentar múltiples veces para asegurar que el DOM esté listo
    let botonVolverInicio = document.getElementById('btn-volver-inicio');
    if (!botonVolverInicio) {
        // Reintentar obtener el botón
        botonVolverInicio = document.getElementById('btn-volver-inicio');
    }
    
    // #region agent log
    console.log('[DEBUG] BEFORE boton check', {botonFound:!!botonVolverInicio,getElementByIdResult:!!document.getElementById('btn-volver-inicio'),documentReadyState:document.readyState});
    fetch('http://127.0.0.1:7242/ingest/23d8a578-afff-4b9d-97f4-b7377d1722b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:1513',message:'BEFORE boton check',data:{botonFound:!!botonVolverInicio,getElementByIdResult:!!document.getElementById('btn-volver-inicio')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    if (!botonVolverInicio) {
        debugWarn('❌ No se encontró el botón btn-volver-inicio, reintentando...');
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/23d8a578-afff-4b9d-97f4-b7377d1722b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:1514',message:'BOTON NOT FOUND - retrying',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        // Reintentar después de un breve delay
        setTimeout(() => {
            const retryBtn = document.getElementById('btn-volver-inicio');
            if (retryBtn) {
                configurarBotonVolverInicio();
            } else {
                debugWarn('❌ No se pudo encontrar el botón btn-volver-inicio después del reintento');
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/23d8a578-afff-4b9d-97f4-b7377d1722b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:1521',message:'RETRY FAILED - boton still not found',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                // #endregion
            }
        }, 100);
        return;
    }
    
    // Evitar agregar múltiples event listeners
    if (botonVolverInicio.dataset.configured === 'true') {
        debugLog('ℹ️ Botón volver al inicio ya configurado');
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/23d8a578-afff-4b9d-97f4-b7377d1722b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:1528',message:'ALREADY CONFIGURED - early return',data:{hasHandler:!!botonVolverInicio._directClickHandler},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        return;
    }
    botonVolverInicio.dataset.configured = 'true';
    
    debugLog('✅ Configurando botón volver al inicio');
    
    // Verificar que el modal existe antes de configurarlo
    const modal = document.getElementById('modal-salir-sesion');
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/23d8a578-afff-4b9d-97f4-b7377d1722b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:1537',message:'BEFORE modal check',data:{modalFound:!!modal,getElementByIdModal:!!document.getElementById('modal-salir-sesion')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    if (!modal) {
        debugWarn('❌ No se encontró el modal modal-salir-sesion');
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/23d8a578-afff-4b9d-97f4-b7377d1722b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:1539',message:'MODAL NOT FOUND - using fallback',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        // Agregar event listener directo como fallback
        botonVolverInicio.addEventListener('click', function() {
            debugLog('🔄 Navegando directamente al inicio (modal no disponible)');
            navegarA('index.html', 2000);
        });
        return;
    }
    
    // Agregar event listener directo (más confiable y simple)
    const clickHandler = function(e) {
        // #region agent log
        console.log('[DEBUG] CLICK HANDLER EXECUTED', {targetId:e.target?.id,currentTargetId:e.currentTarget?.id,modalExists:!!modal,eventType:e.type});
        fetch('http://127.0.0.1:7242/ingest/23d8a578-afff-4b9d-97f4-b7377d1722b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:1549',message:'CLICK HANDLER EXECUTED',data:{targetId:e.target?.id,currentTargetId:e.currentTarget?.id,modalExists:!!modal},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        // Prevenir comportamiento por defecto y propagación INMEDIATAMENTE
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        debugLog('🖱️ Click en btn-volver-inicio detectado');
        
        // Obtener el modal nuevamente para asegurar que existe
        const currentModal = document.getElementById('modal-salir-sesion');
        
        // Mostrar el modal inmediatamente usando requestAnimationFrame para asegurar que se muestre
        if (currentModal) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/23d8a578-afff-4b9d-97f4-b7377d1722b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:1556',message:'BEFORE modal display',data:{modalId:'modal-salir-sesion',modalStyleDisplay:currentModal.style.display},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            
            // Usar requestAnimationFrame para asegurar que el modal se muestre en el siguiente frame
            requestAnimationFrame(() => {
                currentModal.style.display = 'flex';
                currentModal.style.visibility = 'visible';
                currentModal.style.opacity = '1';
                document.body.style.overflow = 'hidden';
                
                // Forzar reflow para asegurar que el cambio se aplique
                void currentModal.offsetHeight;
                
                // #region agent log
                console.log('[DEBUG] Modal displayed', {display:currentModal.style.display,computedDisplay:window.getComputedStyle(currentModal).display});
                fetch('http://127.0.0.1:7242/ingest/23d8a578-afff-4b9d-97f4-b7377d1722b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:1557',message:'AFTER modal display',data:{modalStyleDisplayAfter:currentModal.style.display,computedDisplay:window.getComputedStyle(currentModal).display},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
                // #endregion
            });
        } else {
            // Si no hay modal, navegar directamente
            debugWarn('⚠️ Modal no disponible, navegando directamente');
            navegarA('index.html', 2000);
        }
    };
    
    // Remover todos los listeners anteriores para evitar duplicados
    if (botonVolverInicio._directClickHandler) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/23d8a578-afff-4b9d-97f4-b7377d1722b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:1565',message:'REMOVING previous handler',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        botonVolverInicio.removeEventListener('click', botonVolverInicio._directClickHandler, true);
        botonVolverInicio.removeEventListener('click', botonVolverInicio._directClickHandler, false);
    }
    
    // Limpiar onclick anterior si existe
    if (botonVolverInicio.onclick) {
        botonVolverInicio.onclick = null;
    }
    
    botonVolverInicio._directClickHandler = clickHandler;
    
    // Agregar un solo listener en bubble phase (más estándar y confiable)
    botonVolverInicio.addEventListener('click', clickHandler, false);
    
    // #region agent log
    console.log('[DEBUG] AFTER addEventListener', {hasHandler:!!botonVolverInicio._directClickHandler,configured:botonVolverInicio.dataset.configured,buttonId:botonVolverInicio.id,buttonVisible:botonVolverInicio.offsetParent !== null,hasOnclick:!!botonVolverInicio.onclick});
    fetch('http://127.0.0.1:7242/ingest/23d8a578-afff-4b9d-97f4-b7377d1722b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:1569',message:'AFTER addEventListener',data:{hasHandler:!!botonVolverInicio._directClickHandler,listenerCount:botonVolverInicio.onclick?1:0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // Configurar modal usando ModalUtils (para los botones de confirmar/cancelar)
    const setupResult = ModalUtils.setup('modal-salir-sesion', {
        confirmButtonId: 'btn-confirmar-salir',
        cancelButtonId: 'btn-cancelar-salir',
        onConfirm: () => {
            navegarA('index.html', 2000);
        },
        closeOnOutsideClick: true
    });
    
    // Configurar botones del modal manualmente como respaldo
    const btnConfirmar = document.getElementById('btn-confirmar-salir');
    const btnCancelar = document.getElementById('btn-cancelar-salir');
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/23d8a578-afff-4b9d-97f4-b7377d1722b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:1582',message:'BEFORE button config',data:{btnConfirmarFound:!!btnConfirmar,btnCancelarFound:!!btnCancelar,setupResult:!!setupResult},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    
    if (btnConfirmar && !btnConfirmar.dataset.configured) {
        btnConfirmar.dataset.configured = 'true';
        btnConfirmar.addEventListener('click', function() {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/23d8a578-afff-4b9d-97f4-b7377d1722b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:1587',message:'CONFIRM button clicked',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            ModalUtils.hide('modal-salir-sesion');
            navegarA('index.html', 2000);
        });
    }
    
    if (btnCancelar && !btnCancelar.dataset.configured) {
        btnCancelar.dataset.configured = 'true';
        btnCancelar.addEventListener('click', function() {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/23d8a578-afff-4b9d-97f4-b7377d1722b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:1595',message:'CANCEL button clicked',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            ModalUtils.hide('modal-salir-sesion');
        });
    }
    
    // Verificar CSS del botón
    // #region agent log
    const computedStyle = window.getComputedStyle(botonVolverInicio);
    fetch('http://127.0.0.1:7242/ingest/23d8a578-afff-4b9d-97f4-b7377d1722b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:1600',message:'BOTON CSS CHECK',data:{pointerEvents:computedStyle.pointerEvents,zIndex:computedStyle.zIndex,display:computedStyle.display,visibility:computedStyle.visibility,opacity:computedStyle.opacity},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    
    if (setupResult) {
        debugLog('✅ Modal configurado correctamente');
    } else {
        debugLog('⚠️ ModalUtils.setup retornó null, usando configuración manual');
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/23d8a578-afff-4b9d-97f4-b7377d1722b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:1608',message:'configurarBotonVolverInicio EXIT',data:{configured:botonVolverInicio.dataset.configured,hasHandler:!!botonVolverInicio._directClickHandler},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
}

// Guardar estado del juego en Supabase
async function guardarEstadoJuego(sessionNumber, estadoJuego) {
    // Validar parámetros
    if (!sessionNumber || (typeof sessionNumber !== 'number' && typeof sessionNumber !== 'string')) {
        debugWarn('⚠️ sessionNumber inválido en guardarEstadoJuego:', sessionNumber);
        return;
    }
    if (!estadoJuego || typeof estadoJuego !== 'object' || estadoJuego === null) {
        debugWarn('⚠️ estadoJuego inválido en guardarEstadoJuego:', estadoJuego);
        return;
    }
    
    if (!isSupabaseAvailable()) {
        debugWarn('Supabase no inicializado, guardando en localStorage');
        setLocalStorageItem(`juego_${sessionNumber}`, JSON.stringify(estadoJuego));
        return;
    }
    
    try {
        const versionJuego = CONFIG.VERSION_JUEGO;
        
        // Siempre insertar un nuevo registro para cada juego
        // Esto permite tener múltiples juegos en la misma sesión y detectar nuevos juegos
        debugLog('✨ Creando nuevo juego (siempre se inserta como nuevo registro)');
        
        const { error } = await supabaseQuery(() =>
            window.supabaseClient
            .from('codigos')
            .insert({
                    codigo: sessionNumberToString(sessionNumber),
                juegos: versionJuego,
                datos_juego: estadoJuego,
                rol: 'juego',
                    app: CONFIG.APP_NAME
                })
        );
        
        if (error) {
            debugLog('❌ Error guardando estado del juego:', error);
            if (CONFIG.DEBUG_MODE) {
                debugLog('📋 Detalles del error:', JSON.stringify(error, null, 2));
            }
            // Fallback a localStorage
            setLocalStorageItem(`juego_${sessionNumber}`, JSON.stringify(estadoJuego));
        } else {
            debugLog('✅ Estado del juego guardado exitosamente en Supabase');
            debugLog('📦 Datos guardados:', {
                codigo: sessionNumber,
                juegos: versionJuego,
                rol: 'juego',
                app: CONFIG.APP_NAME
            });
        }
    } catch (err) {
        debugLog('Error guardando estado del juego:', err);
        setLocalStorageItem(`juego_${sessionNumber}`, JSON.stringify(estadoJuego));
    }
}

// Cargar estado del juego desde Supabase
// Retorna true si hay un juego activo, false si no
async function cargarEstadoJuego(sessionNumber) {
    // Validar parámetro
    if (!sessionNumber || (typeof sessionNumber !== 'number' && typeof sessionNumber !== 'string')) {
        debugWarn('⚠️ sessionNumber inválido en cargarEstadoJuego:', sessionNumber);
        return false;
    }
    
    const userName = SessionCache.getUserName();
    
    if (!isSupabaseAvailable()) {
        // Cargar desde localStorage
        const juegoGuardado = getLocalStorageItem(`juego_${sessionNumber}`);
        if (juegoGuardado) {
            try {
                juegoActual = safeJSONParse(juegoGuardado);
                if (juegoActual && juegoActual.activo) {
                    mostrarResultadoJuego(juegoActual, userName);
                    return true;
                }
            } catch (err) {
                debugLog('Error parseando juego desde localStorage:', err);
                // Continuar sin mostrar error al usuario, simplemente no hay juego activo
            }
        }
        return false;
    }
    
    try {
        const versionJuego = CONFIG.VERSION_JUEGO;
        
        debugLog('🔍 Buscando juego activo para sesión:', sessionNumber);
        
        const { data, error } = await supabaseQuery(() =>
            window.supabaseClient
            .from('codigos')
            .select('datos_juego')
            .eq('codigo', sessionNumberToString(sessionNumber))
            .eq('juegos', versionJuego)
            .eq('rol', 'juego')
                .eq('app', CONFIG.APP_NAME)
            .not('datos_juego', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
                .maybeSingle()
        );
        
        if (error) {
            debugLog('⚠️ Error buscando juego:', error.message);
            return false;
        }
        
        debugLog('📦 Datos recibidos de Supabase:', data);
        
        if (data && data.datos_juego) {
            try {
                // datos_juego puede venir como objeto o como string JSON desde Supabase
                juegoActual = parsearDatosJuego(data.datos_juego);
                
                debugLog('🎮 Estado del juego cargado:', juegoActual);
                debugLog('🔍 Tipo de datos_juego original:', typeof data.datos_juego);
                debugLog('🔍 Verificando estado activo:', juegoActual.activo, 'tipo:', typeof juegoActual.activo);
                
                // Actualizar lista de usuarios con el estado del juego cargado
                const usuarios = await obtenerUsuariosSesion(sessionNumber);
                mostrarUsuarios(usuarios, juegoActual);
                
                // Verificar si el juego está activo
                const estaActivo = esJuegoActivo(juegoActual);
                
                debugLog('✅ Estado activo verificado:', estaActivo);
                
                if (juegoActual && estaActivo) {
                    // Verificar si es un juego nuevo o diferente
                    const juegoId = obtenerIdJuego(juegoActual);
                    const esJuegoNuevo = !ultimoJuegoMostrado || ultimoJuegoMostrado !== juegoId;
                    
                    if (esJuegoNuevo) {
                        debugLog('✅ Juego activo encontrado (NUEVO), mostrando resultado');
                        ultimoJuegoMostrado = juegoId;
                        // Pasar usuarios como parámetro para evitar consulta duplicada
                        mostrarResultadoJuego(juegoActual, userName, usuarios);
                        return true;
                    } else {
                        debugLog('ℹ️ Juego ya mostrado anteriormente, no se vuelve a mostrar');
                        return true; // Retornar true porque hay un juego activo, solo que ya se mostró
                    }
                } else {
                    debugLog('⚠️ Juego encontrado pero no está activo. Estado:', juegoActual?.activo);
                }
            } catch (parseError) {
                debugLog('❌ Error parseando estado del juego:', parseError);
                if (CONFIG.DEBUG_MODE && data?.datos_juego) {
                    debugLog('❌ Datos que causaron el error:', data.datos_juego);
                }
            }
        } else {
            debugLog('ℹ️ No se encontró juego activo');
        }
        
        return false;
    } catch (err) {
        debugLog('❌ Error cargando juego:', err);
        return false;
    }
}

// Mostrar resultado del juego a cada usuario
async function mostrarResultadoJuego(estadoJuego, userName, usuarios = null) {
    // Validar parámetros
    if (!estadoJuego || typeof estadoJuego !== 'object' || estadoJuego === null) {
        debugWarn('⚠️ estadoJuego inválido en mostrarResultadoJuego:', estadoJuego);
        return;
    }
    if (!userName || typeof userName !== 'string') {
        debugWarn('⚠️ userName inválido en mostrarResultadoJuego:', userName);
        return;
    }
    
    debugLog('🎮 Mostrando resultado del juego:', estadoJuego);
    
    const botonNuevoJuego = document.getElementById('btn-nuevo-juego');
    const resultado = document.getElementById('resultado-juego');
    
    if (!resultado) {
        debugWarn('❌ No se encontró el elemento resultado-juego');
        return;
    }
    
    // Obtener usuarios si no se pasaron como parámetro (optimización: evitar consulta duplicada)
    if (!usuarios) {
        const sessionNumber = SessionCache.getSessionNumber();
        usuarios = await obtenerUsuariosSesion(sessionNumber);
    }
    const usuariosValidos = filtrarUsuariosValidos(usuarios);
    
    // Actualizar estado del botón y mensaje según el número de usuarios
    actualizarEstadoJuegoSegunUsuarios(usuariosValidos.length);
    
    // Configurar el botón solo si hay 3 o más usuarios y es admin (usando cache)
    const sessionType = SessionCache.getSessionType();
    const esAdmin = sessionType === 'admin';
    if (botonNuevoJuego && esAdmin && usuariosValidos.length >= 3) {
        // Reconfigurar el botón ya que ahora hay juego activo
        botonNuevoJuego.dataset.configured = 'false';
        configurarBotonNuevoJuego(true);
    }
    
    // Mostrar resultado
    resultado.style.display = 'block';
    debugLog('✅ Resultado del juego mostrado');
    
    // Verificar si este usuario es el impostor
    const esImpostor = estadoJuego.impostor === userName;
    debugLog('👤 Usuario:', userName, '| Impostor:', estadoJuego.impostor, '| Es impostor:', esImpostor);
    
    // Mostrar botón para ver el concepto/palabra
    const elementoImpostor = document.getElementById('elemento-o-impostor');
    if (elementoImpostor) {
        // Limpiar contenido anterior
        // Limpiar contenido de forma segura (optimización: usar removeChild en lugar de innerHTML)
        while (elementoImpostor.firstChild) {
            elementoImpostor.removeChild(elementoImpostor.firstChild);
        }
        
        // Crear botón para ver el concepto/palabra usando createElement (más seguro que innerHTML)
        const btnVerConcepto = document.createElement('button');
        btnVerConcepto.id = 'btn-ver-concepto';
        btnVerConcepto.className = 'btn-ver-concepto';
        // Crear contenido del botón de forma más segura
        const categoriaSpan = document.createElement('span');
        categoriaSpan.textContent = `Categoría: ${estadoJuego.categoria}`;
        const br = document.createElement('br');
        const textoSpan = document.createElement('span');
        textoSpan.textContent = 'Ver concepto o palabra';
        btnVerConcepto.appendChild(categoriaSpan);
        btnVerConcepto.appendChild(br);
        btnVerConcepto.appendChild(textoSpan);
        
        const contenidoMostrado = document.createElement('div');
        contenidoMostrado.id = 'contenido-mostrado';
        contenidoMostrado.className = 'contenido-mostrado';
        contenidoMostrado.style.display = 'none';
        
        if (esImpostor) {
            const mensajeImpostor = document.createElement('div');
            mensajeImpostor.className = 'mensaje-impostor';
            mensajeImpostor.textContent = 'Eres impostor';
            contenidoMostrado.appendChild(mensajeImpostor);
        } else {
            const elementoMostrado = document.createElement('div');
            elementoMostrado.className = 'elemento-mostrado';
            elementoMostrado.textContent = estadoJuego.elemento;
            contenidoMostrado.appendChild(elementoMostrado);
        }
        
        const btnRevelarIdentidad = document.createElement('button');
        btnRevelarIdentidad.id = 'btn-revelar-identidad';
        btnRevelarIdentidad.className = 'btn-revelar-identidad';
        btnRevelarIdentidad.textContent = 'Revelar mi identidad';
        
        elementoImpostor.appendChild(btnVerConcepto);
        elementoImpostor.appendChild(contenidoMostrado);
        elementoImpostor.appendChild(btnRevelarIdentidad);
        
        // Configurar evento del botón ver concepto
        // Almacenar referencia al timeout para poder limpiarlo si es necesario
        let timeoutVerConcepto = null;
            btnVerConcepto.addEventListener('click', function() {
            // Limpiar timeout anterior si existe (prevenir memory leaks)
            if (timeoutVerConcepto) {
                clearTimeout(timeoutVerConcepto);
                timeoutVerConcepto = null;
            }
            
                // Ocultar botón y mostrar contenido
                btnVerConcepto.style.display = 'none';
                contenidoMostrado.style.display = 'block';
                
            // Después de 2 segundos, volver a mostrar el botón
            timeoutVerConcepto = setTimeout(function() {
                    contenidoMostrado.style.display = 'none';
                    btnVerConcepto.style.display = 'block';
                timeoutVerConcepto = null;
            }, CONFIG.TIEMPO_MOSTRAR_CONTENIDO);
            });
        
        // Configurar evento del botón revelar identidad
        if (btnRevelarIdentidad) {
            // Verificar si el usuario ya reveló su identidad
            const identidadesReveladas = estadoJuego.identidadesReveladas || {};
            if (identidadesReveladas[userName] === true) {
                btnRevelarIdentidad.disabled = true;
                btnRevelarIdentidad.textContent = 'Identidad revelada';
            }
            
            // Configurar modal de confirmación
            const modalRevelar = document.getElementById('modal-revelar-identidad');
            const btnConfirmarRevelar = document.getElementById('btn-confirmar-revelar');
            const btnCancelarRevelar = document.getElementById('btn-cancelar-revelar');
            
            btnRevelarIdentidad.addEventListener('click', function() {
                if (btnRevelarIdentidad.disabled) return;
                
                // Mostrar modal de confirmación
                ModalUtils.show('modal-revelar-identidad');
            });
            
            // Configurar modal de revelar identidad usando ModalUtils
            ModalUtils.setup('modal-revelar-identidad', {
                confirmButtonId: 'btn-confirmar-revelar',
                cancelButtonId: 'btn-cancelar-revelar',
                onConfirm: async () => {
                btnRevelarIdentidad.disabled = true;
                btnRevelarIdentidad.textContent = 'Revelando...';
                
                    const sessionNumber = SessionCache.getSessionNumber();
                await revelarIdentidad(sessionNumber, userName, estadoJuego);
                
                btnRevelarIdentidad.textContent = 'Identidad revelada';
                },
                closeOnOutsideClick: true
            });
        }
        
        if (esImpostor) {
            debugLog('🎭 Configurado botón para mensaje de impostor');
        } else {
            debugLog('📝 Configurado botón para elemento:', estadoJuego.elemento);
        }
    } else {
        debugWarn('❌ No se encontró el elemento elemento-o-impostor');
    }
}

// Función para revelar la identidad de un usuario
async function revelarIdentidad(sessionNumber, userName, estadoJuego) {
    if (!isSupabaseAvailable()) {
        debugWarn('❌ Supabase no inicializado');
        return;
    }
    
    try {
        // PRIMERO: Cargar el estado ACTUAL del juego desde Supabase para preservar todas las identidades ya reveladas
        const versionJuego = CONFIG.VERSION_JUEGO;
        const { data: juegoExistente, error: errorBuscar } = await supabaseQuery(() =>
            window.supabaseClient
            .from('codigos')
            .select('id, datos_juego')
                .eq('codigo', sessionNumberToString(sessionNumber))
            .eq('juegos', versionJuego)
            .eq('rol', 'juego')
                .eq('app', CONFIG.APP_NAME)
            .not('datos_juego', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
                .maybeSingle()
        );
        
        if (errorBuscar) {
            debugLog('❌ Error buscando juego para actualizar:', errorBuscar);
            return;
        }
        
        if (!juegoExistente) {
            debugWarn('❌ No se encontró el juego para actualizar');
            return;
        }
        
        // Parsear el estado actual del juego desde la base de datos
        let estadoJuegoActual = parsearDatosJuego(juegoExistente.datos_juego);
        
        // Preservar todas las identidades ya reveladas y agregar la nueva
        const identidadesReveladas = estadoJuegoActual.identidadesReveladas || {};
        identidadesReveladas[userName] = true;
        
        // Crear el estado actualizado preservando TODOS los campos del juego original
        const estadoJuegoActualizado = {
            ...estadoJuegoActual,
            identidadesReveladas: identidadesReveladas
        };
        
        debugLog('📋 Identidades reveladas:', Object.keys(identidadesReveladas).length);
        debugLog('📋 Usuarios que han revelado:', Object.keys(identidadesReveladas));
        
        // Actualizar el registro del juego
        const { error: errorActualizar } = await supabaseQuery(() =>
            window.supabaseClient
            .from('codigos')
            .update({ datos_juego: estadoJuegoActualizado })
                .eq('id', juegoExistente.id)
        );
        
        if (errorActualizar) {
            debugLog('❌ Error actualizando identidad revelada:', errorActualizar);
        } else {
            debugLog('✅ Identidad revelada para:', userName);
            // Actualizar el estado local
            juegoActual = estadoJuegoActualizado;
            // Invalidar cache de usuarios ya que se actualizó el juego
            usuariosCache.invalidate();
            // Actualizar la lista de usuarios
            const usuarios = await obtenerUsuariosSesion(sessionNumber);
            mostrarUsuarios(usuarios, estadoJuegoActualizado);
            // Actualizar el botón de revelar identidad
            const btnRevelarIdentidad = document.getElementById('btn-revelar-identidad');
            if (btnRevelarIdentidad) {
                btnRevelarIdentidad.disabled = true;
                btnRevelarIdentidad.textContent = 'Identidad revelada';
            }
        }
    } catch (err) {
        debugLog('Error revelando identidad:', err);
        NotificationUtils.error('Error al revelar identidad. Por favor, intenta nuevamente.');
    }
}

// Suscribirse a cambios del juego en tiempo real
function suscribirACambiosJuego(sessionNumber) {
    if (!isSupabaseAvailable()) {
        return;
    }
    
    const userName = SessionCache.getUserName();
    const versionJuego = CONFIG.VERSION_JUEGO;
    
    // Suscribirse a cambios en el estado del juego
    const subscription = window.supabaseClient
        .channel(`juego-${sessionNumber}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'codigos',
                filter: `codigo=eq.${sessionNumber}`
            },
            async (payload) => {
                debugLog('🔔 Cambio en estado del juego detectado:', payload.eventType);
                debugLog('📦 Payload completo:', payload);
                
                // Si es un INSERT o UPDATE, usar payload.new
                // Si es un DELETE, usar payload.old
                const registro = payload.new || payload.old;
                
                debugLog('📋 Registro extraído:', registro);
                
                // Verificar que el cambio es relevante (tiene datos_juego, juegos correcto y rol = 'juego')
                if (registro && registro.datos_juego && registro.juegos === versionJuego && registro.rol === 'juego' && registro.app === CONFIG.APP_NAME) {
                    try {
                        debugLog('✅ Cambio relevante detectado, actualizando juego');
                        
                        // Parsear datos_juego si viene como string
                        const nuevoJuego = parsearDatosJuego(registro.datos_juego);
                        
                        juegoActual = nuevoJuego;
                        
                        // Actualizar lista de usuarios con el nuevo estado del juego
                        const usuarios = await obtenerUsuariosSesion(sessionNumber);
                        mostrarUsuarios(usuarios, juegoActual);
                        
                        if (esJuegoActivo(juegoActual)) {
                            // Verificar si es un juego nuevo o diferente
                            const juegoId = obtenerIdJuego(juegoActual);
                            const esJuegoNuevo = !ultimoJuegoMostrado || ultimoJuegoMostrado !== juegoId;
                            
                            if (esJuegoNuevo) {
                                debugLog('🎮 Juego NUEVO detectado vía Realtime, mostrando resultado');
                                ultimoJuegoMostrado = juegoId;
                                // Pasar usuarios como parámetro para evitar consulta duplicada
                                mostrarResultadoJuego(juegoActual, userName, usuarios);
                            } else {
                                debugLog('ℹ️ Juego ya mostrado anteriormente (Realtime), no se vuelve a mostrar');
                            }
                        }
                    } catch (err) {
                        debugLog('❌ Error parseando estado del juego:', err);
                    }
                } else if (registro && registro.codigo === sessionNumberToString(sessionNumber)) {
                    // Si el cambio es en la sesión pero no tiene datos_juego, recargar
                    debugLog('🔄 Recargando estado del juego desde la base de datos');
                    await cargarEstadoJuego(sessionNumber);
                } else {
                    debugLog('ℹ️ Cambio no relevante o registro incompleto');
                }
            }
        )
        .subscribe((status) => {
            debugLog('📡 Estado de suscripción juego:', status);
            
            // Si la suscripción falla, usar polling como respaldo
            if (status === 'SUBSCRIBED') {
                debugLog('✅ Suscrito a cambios del juego en tiempo real');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                debugWarn('⚠️ Error en suscripción de juego, usando polling como respaldo');
                iniciarPollingJuego(sessionNumber);
            }
        });
    
    window.juegoSubscription = subscription;
}

// Polling de respaldo para el estado del juego
let ultimoJuegoCargado = null;

function iniciarPollingJuego(sessionNumber) {
    if (window.pollingJuegoInterval) {
        clearInterval(window.pollingJuegoInterval);
    }
    
    debugLog('🔄 Iniciando polling del juego cada', CONFIG.POLLING_JUEGO_INTERVAL / 1000, 'segundos como respaldo...');
    
    window.pollingJuegoInterval = setInterval(async () => {
        // Solo cargar si no hay un juego ya mostrado o si queremos verificar cambios
        // El polling solo debe detectar nuevos juegos, no re-mostrar el mismo
        const hayJuego = await cargarEstadoJuego(sessionNumber);
        
        // El polling continúa para detectar nuevos juegos
        if (hayJuego) {
            debugLog('✅ Juego activo detectado vía polling, continuando monitoreo para nuevos juegos...');
        }
    }, CONFIG.POLLING_JUEGO_INTERVAL);
}

// Limpiar polling y suscripciones cuando se salga de la página
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        // Limpiar intervalos de polling
        if (window.pollingInterval) {
            clearInterval(window.pollingInterval);
            window.pollingInterval = null;
        }
        if (window.pollingJuegoInterval) {
            clearInterval(window.pollingJuegoInterval);
            window.pollingJuegoInterval = null;
        }
        
        // Desconectar suscripciones de Realtime
        if (window.juegoSubscription) {
            window.supabaseClient?.removeChannel(window.juegoSubscription);
            window.juegoSubscription = null;
        }
        if (window.usuariosSubscription) {
            window.supabaseClient?.removeChannel(window.usuariosSubscription);
            window.usuariosSubscription = null;
        }
        
        // Limpiar caches
        SessionCache.clear();
        usuariosCache.invalidate();
        
        // Limpiar notificaciones activas
        if (typeof NotificationUtils !== 'undefined') {
            NotificationUtils.clearAll();
        }
    });
}

// Helper para filtrar usuarios válidos (optimizado: usando optional chaining)
function filtrarUsuariosValidos(usuarios) {
    if (!Array.isArray(usuarios)) return [];
    return usuarios.filter(usuario => 
        usuario?.usuario && 
        typeof usuario.usuario === 'string' &&
        usuario.usuario.trim() !== ''
    );
}

// Helper para verificar si un juego está activo (optimizado: más eficiente)
function esJuegoActivo(juego) {
    if (!juego?.activo) return false;
    const activo = juego.activo;
    // Verificar valores truthy comunes (true, 'true', 1, '1')
    return activo === true || activo === 'true' || activo === 1 || activo === '1';
}

// Helper para obtener ID único de un juego
function obtenerIdJuego(juego) {
    if (!juego) return null;
    return `${juego.iniciadoEn}_${juego.categoria}_${juego.elemento}_${juego.impostor}`;
}

// Función helper para parsear JSON de forma segura
function safeJSONParse(jsonString, defaultValue = null) {
    if (!jsonString) return defaultValue;
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        debugLog('Error parseando JSON:', e);
        return defaultValue;
    }
}

// Helper para parsear datos_juego desde Supabase (mejorado con manejo de errores)
function parsearDatosJuego(datosJuego) {
    if (!datosJuego) return null;
    if (typeof datosJuego === 'object' && datosJuego !== null) {
        return datosJuego;
    }
    if (typeof datosJuego === 'string') {
        return safeJSONParse(datosJuego, null);
    }
    return null;
}

// Cache de consultas de usuarios para reducir llamadas a Supabase
const usuariosCache = {
    data: null,
    sessionNumber: null,
    timestamp: 0,
    ttl: 2000, // 2 segundos
    
    get(sessionNumber) {
        const now = Date.now();
        if (this.data && 
            this.sessionNumber === sessionNumber && 
            (now - this.timestamp) < this.ttl) {
            debugLog('📦 Usuarios obtenidos del cache');
            return this.data;
        }
        return null;
    },
    
    set(sessionNumber, data) {
        this.data = data;
        this.sessionNumber = sessionNumber;
        this.timestamp = Date.now();
    },
    
    invalidate() {
        this.data = null;
        this.sessionNumber = null;
        this.timestamp = 0;
        debugLog('🗑️ Cache de usuarios invalidado');
    }
};

// Cache de localStorage para reducir accesos repetidos
const SessionCache = {
    sessionNumber: null,
    sessionType: null,
    userName: null,
    
    getSessionNumber() {
        if (this.sessionNumber === null) {
            this.sessionNumber = getLocalStorageItem('sessionNumber');
        }
        return this.sessionNumber;
    },
    
    getSessionType() {
        if (this.sessionType === null) {
            this.sessionType = getLocalStorageItem('sessionType');
        }
        return this.sessionType;
    },
    
    getUserName() {
        if (this.userName === null) {
            this.userName = getLocalStorageItem('userName');
        }
        return this.userName;
    },
    
    clear() {
        this.sessionNumber = null;
        this.sessionType = null;
        this.userName = null;
    },
    
    // Invalidar cuando se actualiza localStorage
    invalidateSessionNumber() {
        this.sessionNumber = null;
    },
    
    invalidateSessionType() {
        this.sessionType = null;
    },
    
    invalidateUserName() {
        this.userName = null;
    }
};


// Helper para limpiar datos de sesión de localStorage
function limpiarDatosSesion() {
    localStorage.removeItem('sessionNumber');
    localStorage.removeItem('sessionType');
    SessionCache.invalidateSessionNumber();
    SessionCache.invalidateSessionType();
}

// Helper para obtener ícono de usuario (con fallback)
function obtenerIconoUsuario() {
    return localStorage.getItem('userIcono') || '👤';
}

// Helper para guardar ícono de usuario
function guardarIconoUsuario(icono) {
    localStorage.setItem('userIcono', icono);
}

// Función para obtener usuarios de una sesión
async function obtenerUsuariosSesion(codigoSesion) {
    // Verificar cache primero
    const cached = usuariosCache.get(codigoSesion);
    if (cached) {
        return cached;
    }
    
    if (!isSupabaseAvailable()) {
        debugWarn('Supabase no inicializado');
        return [];
    }

    try {
        const { data, error } = await supabaseQuery(() =>
            window.supabaseClient
            .from('codigos')
                .select('usuario, rol, icono')
            .eq('codigo', sessionNumberToString(codigoSesion))
                .eq('app', CONFIG.APP_NAME)
            .not('usuario', 'is', null)
                .order('created_at', { ascending: true })
                .limit(CONFIG.MAX_USUARIOS_QUERY)
        );
        
        // Debug: verificar que se está obteniendo el rol (solo en modo debug)
        if (isNonEmptyArray(data)) {
            debugLog('👥 Usuarios obtenidos con roles:', data.map(u => ({ usuario: u.usuario, rol: u.rol })));
        }

        if (error) {
            console.error('Error obteniendo usuarios:', error);
            return [];
        }

        // Filtrar usuarios con nombre NULL o vacío (doble verificación)
        const usuariosValidos = filtrarUsuariosValidos(data || []);
        
        // Guardar en cache
        usuariosCache.set(codigoSesion, usuariosValidos);

        return usuariosValidos;
    } catch (err) {
        console.error('Error obteniendo usuarios:', err);
        return [];
    }
}

// Función para actualizar el estado del botón y mensaje según el número de usuarios
function actualizarEstadoJuegoSegunUsuarios(numeroUsuarios) {
    const sessionNumber = SessionCache.getSessionNumber();
    const sessionType = SessionCache.getSessionType();
    const esAdmin = sessionType === 'admin';
    const botonNuevoJuego = document.getElementById('btn-nuevo-juego');
    const mensajeEsperando = document.getElementById('mensaje-esperando');
    const numeroSesionEsperando = document.getElementById('numero-sesion-esperando');
    
    // Actualizar número de sesión en el mensaje (mostrar solo los últimos 4 dígitos)
    if (numeroSesionEsperando && sessionNumber) {
        const codigoCorto = obtenerCodigoCorto(sessionNumber);
        numeroSesionEsperando.textContent = codigoCorto;
    }
    
    // Si hay menos de 3 usuarios, mostrar mensaje de espera
    if (numeroUsuarios < 3) {
        if (mensajeEsperando) {
            mensajeEsperando.style.display = 'block';
        }
        if (botonNuevoJuego) {
            botonNuevoJuego.style.display = 'none';
        }
    } else {
        // Si hay 3 o más usuarios, ocultar mensaje y mostrar botón (solo al admin)
        if (mensajeEsperando) {
            mensajeEsperando.style.display = 'none';
        }
        if (botonNuevoJuego && esAdmin) {
            botonNuevoJuego.style.display = 'block';
            // Asegurar que el botón esté configurado
            if (botonNuevoJuego.dataset.configured !== 'true') {
                const hayJuegoActivo = juegoActual !== null && juegoActual !== undefined;
                configurarBotonNuevoJuego(hayJuegoActivo);
            }
        } else if (botonNuevoJuego) {
            botonNuevoJuego.style.display = 'none';
        }
    }
}

// Función para mostrar usuarios en la lista
function mostrarUsuarios(usuarios, estadoJuego = null) {
    const listaUsuarios = document.getElementById('lista-usuarios');
    if (!listaUsuarios) return;

    // Filtrar usuarios con nombre NULL o vacío (doble verificación)
    const usuariosValidos = filtrarUsuariosValidos(usuarios);

    if (usuariosValidos.length === 0) {
        // Limpiar lista de forma segura (optimización: usar removeChild en lugar de innerHTML)
        while (listaUsuarios.firstChild) {
            listaUsuarios.removeChild(listaUsuarios.firstChild);
        }
        const mensaje = document.createElement('p');
        mensaje.className = 'sin-usuarios';
        mensaje.textContent = 'No hay usuarios en la sesión';
        listaUsuarios.appendChild(mensaje);
        actualizarEstadoJuegoSegunUsuarios(0);
        return;
    }

    // Actualizar estado del botón y mensaje según el número de usuarios
    actualizarEstadoJuegoSegunUsuarios(usuariosValidos.length);

    // Obtener lista de usuarios que han revelado su identidad (optimización: simplificar verificación)
    const identidadesReveladas = estadoJuego?.identidadesReveladas || {};
    const impostor = estadoJuego?.impostor || null;

    // Usar DocumentFragment para mejor performance al insertar múltiples elementos
    const fragment = document.createDocumentFragment();
    
    usuariosValidos.forEach(usuario => {
        // Verificar si es admin (también verificar 'host' por compatibilidad con datos antiguos)
        const esAdmin = usuario.rol === 'admin' || usuario.rol === 'host';
        const haRevelado = identidadesReveladas[usuario.usuario] === true;
        const esImpostorUsuario = impostor === usuario.usuario;
        
        // Crear elementos usando createElement (más seguro)
        const item = document.createElement('div');
        item.className = 'usuario-item';
        
        const icono = document.createElement('span');
        icono.className = 'usuario-icono';
        icono.textContent = usuario.icono || '👤';
        
        const nombre = document.createElement('span');
        nombre.className = 'nombre-usuario';
        nombre.textContent = usuario.usuario; // textContent escapa automáticamente
        
        // Agregar badge de admin si es necesario
        if (esAdmin) {
            const badge = document.createElement('span');
            badge.className = 'badge-admin';
            badge.textContent = 'Admin';
            nombre.appendChild(badge);
        }
        
        const badgesContainer = document.createElement('div');
        badgesContainer.className = 'badges-container';
        
        // Agregar badge de identidad si ha revelado
        if (haRevelado) {
            const identidadBadge = document.createElement('span');
            if (esImpostorUsuario) {
                identidadBadge.className = 'badge-impostor';
                identidadBadge.textContent = 'EL IMPOSTOR';
            } else {
                identidadBadge.className = 'badge-no-impostor';
                identidadBadge.textContent = 'No Impostor';
            }
            badgesContainer.appendChild(identidadBadge);
        }
        
        item.appendChild(icono);
        item.appendChild(nombre);
        if (badgesContainer.children.length > 0) {
            item.appendChild(badgesContainer);
        }
        // Agregar al fragment en lugar de directamente al DOM (optimización)
        fragment.appendChild(item);
    });
    
    // Limpiar lista de forma segura (optimización: usar removeChild en lugar de innerHTML)
    while (listaUsuarios.firstChild) {
        listaUsuarios.removeChild(listaUsuarios.firstChild);
    }
    listaUsuarios.appendChild(fragment);
}

// Función para cargar usuarios y suscribirse a cambios en tiempo real
async function cargarYSuscribirUsuarios(codigoSesion) {
    let usuarios = [];
    
    try {
    // Cargar usuarios iniciales
        usuarios = await obtenerUsuariosSesion(codigoSesion);
        debugLog('👥 Usuarios obtenidos:', usuarios);
    // Cargar estado del juego para mostrar identidades reveladas
    const estadoJuego = juegoActual || null;
    mostrarUsuarios(usuarios, estadoJuego);
        debugLog('👥 Usuarios iniciales cargados:', usuarios.length);
    } catch (err) {
        console.error('❌ Error en cargarYSuscribirUsuarios:', err);
    }

    // Verificar que Supabase está disponible
    if (!isSupabaseAvailable()) {
        console.warn('Supabase no inicializado, usando polling como fallback');
        iniciarPollingUsuarios(codigoSesion);
        return;
    }

    // Variable para rastrear si Realtime está funcionando
    let realtimeFuncionando = false;
    let ultimoConteoUsuarios = usuarios.length;

    // Suscribirse a cambios en tiempo real (solo para APP = 'Impostor1')
    const subscription = window.supabaseClient
        .channel(`sesion-${codigoSesion}`, {
            config: {
                broadcast: { self: true }
            }
        })
        .on(
            'postgres_changes',
            {
                event: '*', // Escuchar INSERT, UPDATE, DELETE
                schema: 'public',
                table: 'codigos',
                filter: `codigo=eq.${codigoSesion}`
            },
            async (payload) => {
                debugLog('🔔 Cambio detectado en usuarios:', payload);
                debugLog('Evento:', payload.eventType);
                debugLog('Nuevo:', payload.new);
                debugLog('Viejo:', payload.old);
                
                realtimeFuncionando = true;
                
                // Siempre actualizar la lista cuando hay cambios
                // La función obtenerUsuariosSesion ya filtra por app = 'Impostor1'
                debugLog('✅ Actualizando lista de usuarios...');
                const usuariosActualizados = await obtenerUsuariosSesion(codigoSesion);
                // Cargar estado del juego actualizado para mostrar identidades reveladas
                const estadoJuegoActualizado = juegoActual || null;
                mostrarUsuarios(usuariosActualizados, estadoJuegoActualizado);
                ultimoConteoUsuarios = usuariosActualizados.length;
                debugLog('✅ Lista actualizada con', usuariosActualizados.length, 'usuarios');
                
                // Invalidar cache de usuarios cuando cambian los usuarios (ya se actualizó desde Realtime)
                // No invalidamos aquí porque los datos ya vienen actualizados del callback
                // Actualizar estado del botón y mensaje según el número de usuarios
                const usuariosValidos = filtrarUsuariosValidos(usuariosActualizados);
                actualizarEstadoJuegoSegunUsuarios(usuariosValidos.length);
            }
        )
        .subscribe((status, err) => {
            debugLog('📡 Estado de suscripción Realtime:', status);
            if (status === 'SUBSCRIBED') {
                debugLog('✅ Suscrito a cambios en tiempo real (APP: Impostor1)');
                // Verificar después de 5 segundos si Realtime está funcionando
                setTimeout(() => {
                    if (!realtimeFuncionando) {
                        console.warn('⚠️ Realtime suscrito pero no se detectan cambios. Activando polling como respaldo...');
                        iniciarPollingUsuarios(codigoSesion);
                    }
                }, CONFIG.REALTIME_CHECK_TIMEOUT);
            } else if (status === 'CHANNEL_ERROR') {
                console.error('❌ Error en la suscripción Realtime:', err);
                console.warn('⚠️ Activando polling como respaldo...');
                iniciarPollingUsuarios(codigoSesion);
            } else if (status === 'TIMED_OUT') {
                console.warn('⏱️ Suscripción Realtime expiró, usando polling...');
                iniciarPollingUsuarios(codigoSesion);
            } else if (status === 'CLOSED') {
                console.warn('🔒 Suscripción Realtime cerrada, usando polling...');
                iniciarPollingUsuarios(codigoSesion);
            }
        });

    // Guardar la suscripción para poder cancelarla si es necesario
    window.realtimeSubscription = subscription;
    
    // NO iniciar polling automáticamente - solo se iniciará si Realtime falla
    // El polling se activará automáticamente en los callbacks de subscribe si hay errores
}

// Función para actualizar usuarios periódicamente (polling como respaldo)
let pollingInterval = null;
function iniciarPollingUsuarios(codigoSesion) {
    // Cancelar polling anterior si existe
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }
    
    debugLog('🔄 Iniciando polling de usuarios cada 3 segundos...');
    
    pollingInterval = setInterval(async () => {
        try {
            const usuarios = await obtenerUsuariosSesion(codigoSesion);
            const listaUsuarios = document.getElementById('lista-usuarios');
            if (listaUsuarios) {
                const conteoActual = usuarios.length;
                // Solo actualizar si el número de usuarios cambió
                if (conteoActual !== (window.ultimoConteoUsuarios || 0)) {
                    debugLog('🔄 Polling: Cambio detectado en número de usuarios, actualizando...');
                    const estadoJuego = juegoActual || null;
                    mostrarUsuarios(usuarios, estadoJuego);
                    window.ultimoConteoUsuarios = conteoActual;
                    
                    // Actualizar estado del botón y mensaje según el número de usuarios
                    const usuariosValidos = filtrarUsuariosValidos(usuarios);
                    actualizarEstadoJuegoSegunUsuarios(usuariosValidos.length);
                }
            }
        } catch (err) {
            console.error('Error en polling de usuarios:', err);
        }
    }, 3000); // Actualizar cada 3 segundos
    
    // Guardar el intervalo para poder cancelarlo
    window.pollingInterval = pollingInterval;
}

// Funciones auxiliares globales
function efectosScroll() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observar todas las secciones
    const secciones = document.querySelectorAll('.content, .hero, .sesion-container');
    secciones.forEach(seccion => {
        seccion.style.opacity = '0';
        seccion.style.transform = 'translateY(20px)';
        seccion.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(seccion);
    });
}

// Función para agregar contador de visitas (simulado)
function actualizarContadorVisitas() {
    let visitas = localStorage.getItem('visitas') || 0;
    visitas = parseInt(visitas) + 1;
    localStorage.setItem('visitas', visitas);
    
    debugLog(`Número de visitas: ${visitas}`);
}

// Función para mostrar fecha y hora actual
function mostrarFechaHora() {
    const ahora = new Date();
    const opciones = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    
    const fechaHora = ahora.toLocaleDateString('es-ES', opciones);
    debugLog(`Página cargada el: ${fechaHora}`);
}

// Función global para alternar tema (accesible desde consola)
window.alternarTema = function() {
    document.body.classList.toggle('tema-oscuro');
    const esOscuro = document.body.classList.contains('tema-oscuro');
    localStorage.setItem('tema', esOscuro ? 'oscuro' : 'claro');
    debugLog(`Tema cambiado a: ${esOscuro ? 'oscuro' : 'claro'}`);
};

// Aplicar tema guardado al cargar cualquier página
function aplicarTemaGuardado() {
    const tema = localStorage.getItem('tema');
    if (tema === 'oscuro') {
        document.body.classList.add('tema-oscuro');
    }
}

// Función para actualizar la versión en el footer
function actualizarVersionFooter() {
    const versionElement = document.getElementById('version-number');
    if (versionElement) {
        versionElement.textContent = CONFIG.VERSION_JUEGO;
    }
}

// Inicializar funcionalidades comunes
aplicarTemaGuardado();
actualizarContadorVisitas();
mostrarFechaHora();
actualizarVersionFooter();

// Mensaje de bienvenida en consola (solo en modo debug)
debugLog('🚀 ¡Web de prueba cargada exitosamente!');
debugLog('Funcionalidades disponibles:');
debugLog('- Gestión de sesiones (crear y unirse)');
debugLog('- Números de sesión aleatorios (1000-9999)');
debugLog('- Identificación de usuarios');
debugLog('- Compartir números de sesión');
debugLog('- Contador de visitas (localStorage)');
debugLog('- Tema oscuro/claro (presiona F12 y ejecuta alternarTema() en consola)');

/* Supabase persistence helpers */
// saveSessionToSupabase(sessionId, meta)
async function saveSessionToSupabase(sessionId, meta = {}) {
    if (!isSupabaseAvailable()) {
        // Supabase not initialized; fallback to localStorage
        debugLog('Supabase no inicializado, guardando sesión en localStorage (temporal).');
        const sessions = safeJSONParse(getLocalStorageItem('sessions', '{}'), {});
        sessions[sessionId] = Object.assign({ createdAt: new Date().toISOString() }, meta);
        setLocalStorageItem('sessions', JSON.stringify(sessions));
        return;
    }

    try {
        // Obtener el nombre del usuario desde localStorage (usando SessionCache si está disponible)
        const nombreUsuario = meta.usuario || SessionCache.getUserName() || getLocalStorageItem('userName');
        
        // Validar que el nombre no sea NULL o vacío
        if (!nombreUsuario || nombreUsuario.trim() === '') {
            debugWarn('⚠️ No se puede crear sesión sin nombre de usuario');
            throw new Error('El nombre del usuario es requerido para crear una sesión');
        }
        
        // Obtener el ícono del usuario desde localStorage
        const iconoUsuario = obtenerIconoUsuario();
        debugLog('🎨 Ícono del admin obtenido de localStorage:', iconoUsuario);
        
        // Preparar los datos a insertar
        const datosInsert = {
            codigo: sessionNumberToString(sessionId),
            usuario: nombreUsuario.trim(),
            rol: meta.role || 'admin',
            app: 'Impostor1',
            icono: iconoUsuario
        };
        
        debugLog('📤 Insertando sesión con datos:', datosInsert);
        
        // Insertar el código de sesión en la tabla 'codigos'
        // Nota: La tabla necesita una columna 'codigo' (texto) para almacenar el número de sesión
        const { data, error } = await supabaseQuery(() =>
            window.supabaseClient
            .from('codigos')
            .insert(datosInsert)
                .select()
        );

        if (error) {
            console.error('Error guardando sesión en Supabase:', error);
            console.error('Detalles del error:', JSON.stringify(error, null, 2));
            // Si falla por falta de columnas, mostrar mensaje útil
            if (error.message && error.message.includes('column')) {
                console.warn('⚠️ La tabla "codigos" necesita las columnas: codigo (text), usuario (text), rol (text), app (text), icono (text)');
            }
            // Si falla por permisos RLS
            if (error.code === 'PGRST301' || (error.message && error.message.includes('permission')) || (error.message && error.message.includes('RLS'))) {
                console.error('⚠️ Error de permisos: Verifica que Row Level Security (RLS) esté configurado correctamente en Supabase');
            }
            throw error;
        }

        debugLog('✅ Sesión guardada en Supabase:', sessionId);
        debugLog('📥 Datos guardados:', data);
    } catch (err) {
        console.error('Error guardando sesión en Supabase:', err);
        throw err;
    }
}

// saveParticipantToSupabase(sessionId, participant)
async function saveParticipantToSupabase(sessionId, participant = {}) {
    // Invalidar cache de usuarios cuando se agrega un participante
    usuariosCache.invalidate();
    
    if (!isSupabaseAvailable()) {
        debugLog('Supabase no inicializado, guardando participante en localStorage (temporal).');
        const participantsKey = `participants_${sessionId}`;
        const parts = safeJSONParse(getLocalStorageItem(participantsKey, '[]'), []);
        parts.push(Object.assign({ addedAt: new Date().toISOString() }, participant));
        setLocalStorageItem(participantsKey, JSON.stringify(parts));
        return;
    }

    try {
        // Obtener el nombre del usuario desde localStorage o del parámetro (usando SessionCache si está disponible)
        const nombreUsuario = participant.name || SessionCache.getUserName() || getLocalStorageItem('userName');
        
        // Validar que el nombre no sea NULL o vacío
        if (!nombreUsuario || nombreUsuario.trim() === '') {
            debugWarn('⚠️ No se puede guardar participante sin nombre');
            throw new Error('El nombre del usuario es requerido');
        }
        
        // Obtener el ícono del usuario desde localStorage
        const iconoUsuario = obtenerIconoUsuario();
        debugLog('🎨 Ícono del usuario obtenido de localStorage:', iconoUsuario);
        debugLog('👤 Nombre del usuario:', nombreUsuario);
        debugLog('🎭 Rol del usuario:', participant.role || 'guest');
        
        // Preparar los datos a insertar
        const datosInsert = {
            codigo: sessionNumberToString(sessionId),
            usuario: nombreUsuario.trim(),
            rol: participant.role || 'guest',
            app: 'Impostor1',
            icono: iconoUsuario
        };
        
        debugLog('📤 Insertando participante con datos COMPLETOS:', JSON.stringify(datosInsert, null, 2));
        
        // Insertar participante en la tabla codigos
        // Nota: La tabla necesita columnas: codigo, usuario, rol, app, icono
        const { data, error } = await supabaseQuery(() =>
            window.supabaseClient
            .from('codigos')
            .insert(datosInsert)
                .select()
        );

        if (error) {
            console.error('❌ ERROR guardando participante en Supabase:', error);
            console.error('📋 Código del error:', error.code);
            console.error('📋 Mensaje del error:', error.message);
            console.error('📋 Detalles completos:', JSON.stringify(error, null, 2));
            console.error('📋 Datos que se intentaron insertar:', JSON.stringify(datosInsert, null, 2));
            
            // Si falla por falta de columnas, mostrar mensaje útil
            if (error.message && error.message.includes('column')) {
                console.error('⚠️ ERROR: La columna "icono" no existe en la tabla "codigos"');
                console.error('💡 Solución: Ejecuta en Supabase SQL Editor:');
                console.error('   ALTER TABLE codigos ADD COLUMN icono TEXT DEFAULT \'👤\';');
            }
            // Si falla por permisos RLS
            if (error.code === 'PGRST301' || (error.message && error.message.includes('permission')) || (error.message && error.message.includes('RLS'))) {
                console.error('⚠️ ERROR de permisos RLS: Los guests no pueden insertar el campo "icono"');
                console.error('💡 Solución: Verifica las políticas RLS en Supabase para permitir INSERT con el campo icono');
            }
            throw error;
        }

        debugLog('✅ Participante añadido exitosamente en Supabase para sesión:', sessionId);
        debugLog('📥 Datos guardados (respuesta completa):', JSON.stringify(data, null, 2));
        
        // Verificar que el ícono se guardó correctamente
        if (data && data[0]) {
            const iconoGuardado = data[0].icono;
            debugLog('🎨 Ícono guardado en la base de datos:', iconoGuardado);
            if (!iconoGuardado || iconoGuardado === null) {
                debugWarn('⚠️ ADVERTENCIA: El ícono no se guardó en la base de datos (es null o undefined)');
            }
        }
    } catch (err) {
        console.error('Error guardando participante en Supabase:', err);
        throw err;
    }
}

// Verificar si un código de sesión existe en Supabase
async function verificarCodigoSesion(codigo) {
    if (!isSupabaseAvailable()) {
        console.warn('Supabase no inicializado, no se puede verificar el código.');
        return false;
    }

    try {
        const { data, error } = await supabaseQuery(() =>
            window.supabaseClient
            .from('codigos')
            .select('codigo')
            .eq('codigo', sessionNumberToString(codigo))
                .eq('app', CONFIG.APP_NAME)
                .limit(1)
        );

        if (error) {
            console.error('Error verificando código en Supabase:', error);
            console.error('Detalles del error:', JSON.stringify(error, null, 2));
            return false;
        }

        // Si hay al menos un registro, el código existe
        return isNonEmptyArray(data);
    } catch (err) {
        console.error('Error verificando código:', err);
        console.error('Stack trace:', err.stack);
        return false;
    }
}

// Buscar sesión por código corto (últimos 4 dígitos) en cualquier mes/año
async function buscarSesionPorCodigoCorto(codigoCorto) {
    if (!isSupabaseAvailable()) {
        console.warn('Supabase no inicializado, no se puede buscar la sesión.');
        return null;
    }

    // Validar que el código corto sea válido antes de buscar
    const codigoStr = String(codigoCorto).padStart(4, '0');
    if (codigoStr.length !== 4 || !/^\d{4}$/.test(codigoStr)) {
        debugLog('⚠️ Código corto inválido:', codigoCorto);
        return null;
    }

    try {
        // Optimización: Buscar primero en los últimos 3 meses (más común)
        const { año, mes } = obtenerAnioMesActual();
        const mesesActuales = [];
        
        // Generar posibles códigos para los últimos 3 meses
        for (let i = 0; i < 3; i++) {
            const fecha = new Date(Number(año), Number(mes) - 1 - i, 1);
            const añoMes = `${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(2, '0')}`;
            const codigoCompleto = Number(`${añoMes}${codigoStr}`);
            mesesActuales.push(String(codigoCompleto));
        }
        
        // Buscar en los códigos posibles primero (más eficiente)
        const { data, error } = await supabaseQuery(() =>
            window.supabaseClient
                .from('codigos')
                .select('codigo')
                .eq('app', CONFIG.APP_NAME)
                .in('codigo', mesesActuales)
                .limit(10)
        );

        if (error) {
            debugLog('⚠️ Error en búsqueda optimizada, intentando búsqueda completa:', error);
            // Fallback a búsqueda completa si la optimizada falla
            return await buscarSesionPorCodigoCortoCompleto(codigoStr);
        }

        if (isNonEmptyArray(data)) {
            // Verificar que el código termine con los 4 dígitos
            for (const registro of data) {
                const codigoCompleto = String(registro.codigo);
                if (codigoCompleto.endsWith(codigoStr)) {
                    debugLog(`🔍 Sesión encontrada (optimizada): ${codigoCompleto} termina con ${codigoStr}`);
                    return Number(codigoCompleto);
                }
            }
        }

        // Si no se encontró en los últimos 3 meses, buscar en todos los códigos (fallback)
        return await buscarSesionPorCodigoCortoCompleto(codigoStr);
    } catch (err) {
        console.error('Error buscando sesión por código corto:', err);
        return null;
    }
}

// Función auxiliar para búsqueda completa (fallback)
async function buscarSesionPorCodigoCortoCompleto(codigoStr) {
    try {
        const { data, error } = await supabaseQuery(() =>
            window.supabaseClient
                .from('codigos')
                .select('codigo')
                .eq('app', CONFIG.APP_NAME)
                .limit(1000) // Limitar para no sobrecargar
        );

        if (error) {
            console.error('Error en búsqueda completa:', error);
            return null;
        }

        if (!isNonEmptyArray(data)) {
            return null;
        }

        // Buscar el código que termine con los 4 dígitos
        for (const registro of data) {
            const codigoCompleto = String(registro.codigo);
            if (codigoCompleto.endsWith(codigoStr)) {
                debugLog(`🔍 Sesión encontrada (completa): ${codigoCompleto} termina con ${codigoStr}`);
                return Number(codigoCompleto);
            }
        }

        return null;
    } catch (err) {
        console.error('Error en búsqueda completa:', err);
        return null;
    }
}

// Verificar si ya existe un usuario con el mismo nombre en la sesión
async function verificarUsuarioEnSesion(codigo, nombreUsuario) {
    if (!isSupabaseAvailable()) {
        debugWarn('Supabase no inicializado, no se puede verificar el usuario.');
        return false;
    }

    try {
        const { data, error } = await supabaseQuery(() =>
            window.supabaseClient
            .from('codigos')
            .select('codigo, usuario')
            .eq('codigo', sessionNumberToString(codigo))
            .eq('usuario', String(nombreUsuario))
                .eq('app', CONFIG.APP_NAME)
                .limit(1)
        );

        if (error) {
            console.error('Error verificando usuario en sesión:', error);
            console.error('Detalles del error:', JSON.stringify(error, null, 2));
            return false;
        }

        // Si hay al menos un registro, el usuario ya existe en esta sesión
        return isNonEmptyArray(data);
    } catch (err) {
        console.error('Error verificando usuario en sesión:', err);
        console.error('Stack trace:', err.stack);
        return false;
    }
}

// Mantener compatibilidad con funciones antiguas (Firestore)
const saveSessionToFirestore = saveSessionToSupabase;
const saveParticipantToFirestore = saveParticipantToSupabase;
