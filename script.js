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

// Funcionalidad para la página de inicio
function initHomePage() {
    // Obtener el campo de nombre del usuario
    const nombreUsuarioInput = document.getElementById('nombre-usuario-inicio');
    
    // Cargar nombre guardado si existe
    const nombreGuardado = localStorage.getItem('userName');
    if (nombreGuardado) {
        nombreUsuarioInput.value = nombreGuardado;
    }
    
    // Función para validar y obtener el nombre del usuario
    function obtenerYValidarNombre() {
        const nombre = nombreUsuarioInput.value.trim();
        
        if (!nombre) {
            alert('Por favor, ingresa tu nombre antes de continuar.');
            nombreUsuarioInput.focus();
            return null;
        }
        
        if (nombre.length < 2) {
            alert('El nombre debe tener al menos 2 caracteres.');
            nombreUsuarioInput.focus();
            return null;
        }
        
        // Guardar el nombre en localStorage
        localStorage.setItem('userName', nombre);
        return nombre;
    }
    
    // Función para generar número de sesión aleatorio
    function generarNumeroSesion() {
        return Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000;
    }
    
    // Función para crear nueva sesión
    async function crearNuevaSesion() {
        const nombre = obtenerYValidarNombre();
        if (!nombre) {
            return; // La validación ya mostró el error
        }
        
        const numeroSesion = generarNumeroSesion();
        // Guardar en localStorage para que esté disponible en la página de sesión
        localStorage.setItem('sessionNumber', numeroSesion);
        localStorage.setItem('sessionType', 'host');
        
        // Persistir la sesión en Supabase con el código y el nombre del usuario
        try {
            await saveSessionToSupabase(numeroSesion, { 
                role: 'host',
                usuario: nombre 
            });
        } catch (err) {
            console.error('No se pudo guardar la sesión en Supabase:', err);
            alert('Error al crear la sesión. Por favor, intenta nuevamente.');
            return;
        }

        // Redirigir a la página de sesión
        window.location.href = 'sesion.html';
    }
    
    // Función para abrir sesión existente
    async function abrirSesionExistente() {
        const nombre = obtenerYValidarNombre();
        if (!nombre) {
            return; // La validación ya mostró el error
        }
        
        const numeroSesion = document.getElementById('numero-sesion').value;
        
        if (!numeroSesion) {
            alert('Por favor, ingresa un número de sesión.');
            return;
        }
        
        const num = parseInt(numeroSesion);
        if (num < 1000 || num > 9999) {
            alert('El número de sesión debe estar entre 1000 y 9999.');
            return;
        }
        
        // Verificar si el código existe en Supabase (OBLIGATORIO)
        if (typeof window.supabaseClient === 'undefined') {
            alert('Error: No se puede conectar con la base de datos. Por favor, recarga la página.');
            return;
        }
        
        const existe = await verificarCodigoSesion(numeroSesion);
        if (!existe) {
            alert('Este código de sesión no existe en la base de datos. Por favor, verifica el número e intenta nuevamente.');
            return;
        }
        
        // Verificar que no exista otro usuario con el mismo nombre en esta sesión
        const usuarioExiste = await verificarUsuarioEnSesion(numeroSesion, nombre);
        if (usuarioExiste) {
            alert('Ya existe un usuario con el nombre "' + nombre + '" en esta sesión. Por favor, elige otro nombre.');
            return;
        }
        
        // Guardar en localStorage
        localStorage.setItem('sessionNumber', numeroSesion);
        localStorage.setItem('sessionType', 'guest');
        
        // Guardar el participante en Supabase
        try {
            await saveParticipantToSupabase(numeroSesion, { name: nombre, role: 'guest' });
        } catch (err) {
            console.error('No se pudo guardar el participante en Supabase:', err);
            alert('Error al unirse a la sesión. Por favor, intenta nuevamente.');
            return;
        }
        
        // Redirigir a la página de sesión
        window.location.href = 'sesion.html';
    }
    
    // Event listeners para la página de inicio
    document.getElementById('btn-crear-sesion').addEventListener('click', function() {
        crearNuevaSesion().catch(function(err) {
            console.error('Error al crear sesión:', err);
        });
    });
    
    document.getElementById('btn-abrir-sesion').addEventListener('click', function() {
        abrirSesionExistente().catch(function(err) {
            console.error('Error al abrir sesión:', err);
        });
    });
    
    // Permitir crear sesión con Enter en el campo de número
    document.getElementById('numero-sesion').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            abrirSesionExistente().catch(function(err) {
                console.error('Error al abrir sesión:', err);
            });
        }
    });
    
    // Permitir crear sesión con Enter en el campo de nombre
    nombreUsuarioInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            // Si el campo de número de sesión tiene valor, abrir sesión, sino crear nueva
            const numeroSesion = document.getElementById('numero-sesion').value;
            if (numeroSesion) {
                abrirSesionExistente().catch(function(err) {
                    console.error('Error al abrir sesión:', err);
                });
            } else {
                crearNuevaSesion().catch(function(err) {
                    console.error('Error al crear sesión:', err);
                });
            }
        }
    });
}

// Funcionalidad para la página de sesión
async function initSesionPage() {
    // Obtener datos de la sesión desde localStorage
    const sessionNumber = localStorage.getItem('sessionNumber');
    
    // Si no hay datos de sesión, redirigir al inicio
    if (!sessionNumber) {
        alert('No se encontró información de sesión. Redirigiendo al inicio...');
        window.location.href = 'index.html';
        return;
    }
    
    // Verificar que el código de sesión existe en Supabase (OBLIGATORIO)
    if (typeof window.supabaseClient !== 'undefined') {
        const existe = await verificarCodigoSesion(sessionNumber);
        if (!existe) {
            alert('Esta sesión ya no existe en la base de datos. Redirigiendo al inicio...');
            // Limpiar localStorage
            localStorage.removeItem('sessionNumber');
            localStorage.removeItem('sessionType');
            window.location.href = 'index.html';
            return;
        }
    } else {
        // Si Supabase no está disponible, no permitir continuar
        alert('Error: No se puede conectar con la base de datos. Por favor, recarga la página.');
        window.location.href = 'index.html';
        return;
    }
    
    // Actualizar número de sesión
    const numeroSesionHeader = document.getElementById('numero-sesion-header');
    if (numeroSesionHeader) {
        numeroSesionHeader.textContent = sessionNumber;
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
    
    // Verificar si ya hay un nombre guardado
    const userName = localStorage.getItem('userName');
    if (userName) {
        actualizarBarraSuperior(userName);
    }
    
    // Cargar y suscribirse a usuarios en tiempo real
    await cargarYSuscribirUsuarios(sessionNumber);
    
    // Inicializar juego
    await inicializarJuego(sessionNumber);
    
    // Configurar botón de volver al inicio
    configurarBotonVolverInicio();
    
    // Inicializar efectos visuales
    efectosScroll();
}

// Variables globales del juego
let categoriasData = {
  "Animales": [
    "Felinos", "Pájaros", "Animal que vuela", "Animal que vive en el agua", "Animal que es doméstico",
    "Animal que es salvaje", "Animal que es grande", "Animal que es pequeño", "Animal que corre rápido", "Animal que nada"
  ],
  "Países": [
    "País de Europa", "País de América", "País de Asia", "País de África", "País de Oceanía",
    "País que habla español", "País que habla inglés", "País con playa", "País con montañas", "País grande"
  ],
  "Deportes": [
    "Deporte con pelota", "Deporte acuático", "Deporte de invierno", "Deporte individual", "Deporte en equipo",
    "Deporte olímpico", "Deporte que se juega al aire libre", "Deporte de contacto", "Deporte con raqueta", "Deporte de velocidad"
  ],
  "Electrodomésticos": [
    "Refrigerador", "Lavadora", "Secadora", "Microondas", "Horno", "Licuadora", "Batidora", "Cafetera", "Tostadora", "Aspiradora",
    "Plancha", "Ventilador", "Aire acondicionado", "Calefactor", "Televisor", "Radio", "Reproductor de DVD", "Lavavajillas", "Horno eléctrico" 
  ],
  "Profesiones": [
    "Profesión en educación", "Profesión en tecnología", "Profesión en salud", "Profesión en construcción", "Profesión creativa",
    "Profesión que trabaja con números", "Profesión que trabaja con personas", "Profesión que requiere estudios universitarios", "Profesión de servicio", "Profesión artística"
  ],
  "Conceptos de Matemática": [
    "Número par", "Número impar", "Número primo", "Operación matemática", "Figura geométrica",
    "Unidad de medida", "Concepto de álgebra", "Concepto de geometría", "Fracción", "Porcentaje"
  ],
    "Películas": [
    "Película de acción", "Película de comedia", "Película de ciencia ficción", "Película animada", "Película de terror",
    "Película de superhéroes", "Película de Disney", "Película de aventuras", "Película dramática", "Película de fantasía"
  ],
  "Lugares": [
    "Lugar para estudiar", "Lugar para comer", "Lugar para comprar", "Lugar para trabajar", "Lugar para descansar",
    "Lugar público", "Lugar privado", "Lugar al aire libre", "Lugar techado", "Lugar de entretenimiento"
  ]
};

let juegoActual = null;
let ultimoJuegoMostrado = null; // Para rastrear el último juego que se mostró

// Cargar categorías (ya están en memoria)
function cargarCategorias() {
    console.log('✅ Categorías disponibles:', Object.keys(categoriasData).length, 'categorías');
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
    
    // Cargar estado actual del juego desde Supabase PRIMERO
    let hayJuegoActivo = await cargarEstadoJuego(sessionNumber);
    
    // Si no se encontró el juego, intentar de nuevo después de un breve delay
    // (puede ser que se acabe de guardar y aún no esté disponible)
    if (!hayJuegoActivo) {
        console.log('⏳ Juego no encontrado inicialmente, reintentando en 1 segundo...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        hayJuegoActivo = await cargarEstadoJuego(sessionNumber);
    }
    
    // Verificar si el usuario es host
    const sessionType = localStorage.getItem('sessionType');
    const esHost = sessionType === 'host';
    
    // Mostrar botón "Nuevo Juego" siempre al host (tanto si hay juego activo como si no)
    const botonNuevoJuego = document.getElementById('btn-nuevo-juego');
    if (botonNuevoJuego && esHost) {
        botonNuevoJuego.style.display = 'block';
        configurarBotonNuevoJuego(hayJuegoActivo);
    } else if (botonNuevoJuego) {
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
    const modal = document.getElementById('modal-confirmacion');
    const btnConfirmar = document.getElementById('btn-confirmar-nuevo-juego');
    const btnCancelar = document.getElementById('btn-cancelar-nuevo-juego');
    
    if (!botonNuevoJuego) return;
    
    // Evitar agregar múltiples event listeners
    if (botonNuevoJuego.dataset.configured === 'true') return;
    botonNuevoJuego.dataset.configured = 'true';
    
    // Si hay juego activo, mostrar modal de confirmación
    // Si no hay juego activo, redirigir directamente
    if (hayJuegoActivo && modal) {
        // Mostrar modal al hacer clic en "Nuevo Juego"
        botonNuevoJuego.onclick = function() {
            modal.style.display = 'flex';
        };
        
        // Confirmar: redirigir a seleccionar categoría
        if (btnConfirmar) {
            btnConfirmar.onclick = function() {
                modal.style.display = 'none';
                window.location.href = 'seleccionar-categoria.html';
            };
        }
        
        // Cancelar: cerrar modal
        if (btnCancelar) {
            btnCancelar.onclick = function() {
                modal.style.display = 'none';
            };
        }
        
        // Cerrar modal al hacer clic fuera de él
        modal.onclick = function(e) {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };
    } else {
        // Si no hay juego activo, redirigir directamente
        botonNuevoJuego.onclick = function() {
            window.location.href = 'seleccionar-categoria.html';
        };
    }
}

// Configurar el botón de volver al inicio
function configurarBotonVolverInicio() {
    const botonVolverInicio = document.getElementById('btn-volver-inicio');
    const modal = document.getElementById('modal-salir-sesion');
    const btnConfirmar = document.getElementById('btn-confirmar-salir');
    const btnCancelar = document.getElementById('btn-cancelar-salir');
    
    if (!botonVolverInicio || !modal) return;
    
    // Evitar agregar múltiples event listeners
    if (botonVolverInicio.dataset.configured === 'true') return;
    botonVolverInicio.dataset.configured = 'true';
    
    // Mostrar modal al hacer clic en "Volver al inicio"
    botonVolverInicio.onclick = function() {
        modal.style.display = 'flex';
    };
    
    // Confirmar: redirigir al inicio
    if (btnConfirmar) {
        btnConfirmar.onclick = function() {
            modal.style.display = 'none';
            window.location.href = 'index.html';
        };
    }
    
    // Cancelar: cerrar modal
    if (btnCancelar) {
        btnCancelar.onclick = function() {
            modal.style.display = 'none';
        };
    }
    
    // Cerrar modal al hacer clic fuera de él
    modal.onclick = function(e) {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

// Guardar estado del juego en Supabase
async function guardarEstadoJuego(sessionNumber, estadoJuego) {
    if (typeof window.supabaseClient === 'undefined') {
        console.warn('Supabase no inicializado, guardando en localStorage');
        localStorage.setItem(`juego_${sessionNumber}`, JSON.stringify(estadoJuego));
        return;
    }
    
    try {
        const versionJuego = '1.0'; // Versión del juego
        
        // Siempre insertar un nuevo registro para cada juego
        // Esto permite tener múltiples juegos en la misma sesión y detectar nuevos juegos
        console.log('✨ Creando nuevo juego (siempre se inserta como nuevo registro)');
        
        const { error } = await window.supabaseClient
            .from('codigos')
            .insert({
                codigo: String(sessionNumber),
                juegos: versionJuego,
                datos_juego: estadoJuego,
                rol: 'juego',
                app: 'Impostor1'
            });
        
        if (error) {
            console.error('❌ Error guardando estado del juego:', error);
            console.error('📋 Detalles del error:', JSON.stringify(error, null, 2));
            // Fallback a localStorage
            localStorage.setItem(`juego_${sessionNumber}`, JSON.stringify(estadoJuego));
        } else {
            console.log('✅ Estado del juego guardado exitosamente en Supabase');
            console.log('📦 Datos guardados:', {
                codigo: sessionNumber,
                juegos: versionJuego,
                rol: 'juego',
                app: 'Impostor1',
                datos_juego: estadoJuego
            });
        }
    } catch (err) {
        console.error('Error guardando estado del juego:', err);
        localStorage.setItem(`juego_${sessionNumber}`, JSON.stringify(estadoJuego));
    }
}

// Cargar estado del juego desde Supabase
// Retorna true si hay un juego activo, false si no
async function cargarEstadoJuego(sessionNumber) {
    const userName = localStorage.getItem('userName');
    
    if (typeof window.supabaseClient === 'undefined') {
        // Cargar desde localStorage
        const juegoGuardado = localStorage.getItem(`juego_${sessionNumber}`);
        if (juegoGuardado) {
            try {
                juegoActual = JSON.parse(juegoGuardado);
                if (juegoActual && juegoActual.activo) {
                    mostrarResultadoJuego(juegoActual, userName);
                    return true;
                }
            } catch (err) {
                console.error('Error parseando juego desde localStorage:', err);
            }
        }
        return false;
    }
    
    try {
        const versionJuego = '1.0'; // Versión del juego
        
        console.log('🔍 Buscando juego activo para sesión:', sessionNumber);
        
        const { data, error } = await window.supabaseClient
            .from('codigos')
            .select('datos_juego')
            .eq('codigo', String(sessionNumber))
            .eq('juegos', versionJuego)
            .eq('rol', 'juego')
            .eq('app', 'Impostor1')
            .not('datos_juego', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        
        if (error) {
            console.log('⚠️ Error buscando juego:', error.message);
            return false;
        }
        
        console.log('📦 Datos recibidos de Supabase:', data);
        
        if (data && data.datos_juego) {
            try {
                // datos_juego puede venir como objeto o como string JSON desde Supabase
                juegoActual = typeof data.datos_juego === 'string' 
                    ? JSON.parse(data.datos_juego) 
                    : data.datos_juego;
                
                console.log('🎮 Estado del juego cargado:', juegoActual);
                console.log('🔍 Tipo de datos_juego original:', typeof data.datos_juego);
                console.log('🔍 Verificando estado activo:', juegoActual.activo, 'tipo:', typeof juegoActual.activo);
                
                // Actualizar lista de usuarios con el estado del juego cargado
                const usuarios = await obtenerUsuariosSesion(sessionNumber);
                mostrarUsuarios(usuarios, juegoActual);
                
                // Verificar si el juego está activo (puede ser true, "true", o 1)
                const estaActivo = juegoActual.activo === true || 
                                   juegoActual.activo === 'true' || 
                                   juegoActual.activo === 1 ||
                                   juegoActual.activo === '1';
                
                console.log('✅ Estado activo verificado:', estaActivo);
                
                if (juegoActual && estaActivo) {
                    // Verificar si es un juego nuevo o diferente
                    const juegoId = `${juegoActual.iniciadoEn}_${juegoActual.categoria}_${juegoActual.elemento}_${juegoActual.impostor}`;
                    const esJuegoNuevo = !ultimoJuegoMostrado || ultimoJuegoMostrado !== juegoId;
                    
                    if (esJuegoNuevo) {
                        console.log('✅ Juego activo encontrado (NUEVO), mostrando resultado');
                        ultimoJuegoMostrado = juegoId;
                        mostrarResultadoJuego(juegoActual, userName);
                        return true;
                    } else {
                        console.log('ℹ️ Juego ya mostrado anteriormente, no se vuelve a mostrar');
                        return true; // Retornar true porque hay un juego activo, solo que ya se mostró
                    }
                } else {
                    console.log('⚠️ Juego encontrado pero no está activo. Estado:', juegoActual.activo, 'Tipo:', typeof juegoActual.activo);
                    console.log('⚠️ Contenido completo del juego:', JSON.stringify(juegoActual, null, 2));
                }
            } catch (parseError) {
                console.error('❌ Error parseando estado del juego:', parseError);
                console.error('❌ Datos que causaron el error:', data.datos_juego);
            }
        } else {
            console.log('ℹ️ No se encontró juego activo - data o datos_juego es null/undefined');
        }
        
        return false;
    } catch (err) {
        console.error('❌ Error cargando juego:', err);
        return false;
    }
}

// Mostrar resultado del juego a cada usuario
function mostrarResultadoJuego(estadoJuego, userName) {
    console.log('🎮 Mostrando resultado del juego:', estadoJuego);
    
    const botonNuevoJuego = document.getElementById('btn-nuevo-juego');
    const resultado = document.getElementById('resultado-juego');
    
    if (!resultado) {
        console.error('❌ No se encontró el elemento resultado-juego');
        return;
    }
    
    // Mostrar botón "Nuevo Juego" solo al host
    const sessionType = localStorage.getItem('sessionType');
    const esHost = sessionType === 'host';
    if (botonNuevoJuego && esHost) {
        botonNuevoJuego.style.display = 'block';
        // Reconfigurar el botón ya que ahora hay juego activo
        botonNuevoJuego.dataset.configured = 'false';
        configurarBotonNuevoJuego(true);
    } else if (botonNuevoJuego) {
        botonNuevoJuego.style.display = 'none';
    }
    
    // Mostrar resultado
    resultado.style.display = 'block';
    console.log('✅ Resultado del juego mostrado');
    
    // Verificar si este usuario es el impostor
    const esImpostor = estadoJuego.impostor === userName;
    console.log('👤 Usuario:', userName, '| Impostor:', estadoJuego.impostor, '| Es impostor:', esImpostor);
    
    // Mostrar botón para ver el concepto/palabra
    const elementoImpostor = document.getElementById('elemento-o-impostor');
    if (elementoImpostor) {
        // Crear botón para ver el concepto/palabra
        elementoImpostor.innerHTML = `
            <div class="categoria-texto">Categoría: ${estadoJuego.categoria}</div>
            <button id="btn-ver-concepto" class="btn-ver-concepto">Ver concepto o palabra</button>
            <div id="contenido-mostrado" class="contenido-mostrado" style="display: none;">
                ${esImpostor ? '<div class="mensaje-impostor">Eres impostor</div>' : `<div class="elemento-mostrado">${estadoJuego.elemento}</div>`}
            </div>
            <button id="btn-revelar-identidad" class="btn-revelar-identidad">Revelar identidad</button>
        `;
        
        // Configurar evento del botón ver concepto
        const btnVerConcepto = document.getElementById('btn-ver-concepto');
        const contenidoMostrado = document.getElementById('contenido-mostrado');
        
        if (btnVerConcepto && contenidoMostrado) {
            btnVerConcepto.addEventListener('click', function() {
                // Ocultar botón y mostrar contenido
                btnVerConcepto.style.display = 'none';
                contenidoMostrado.style.display = 'block';
                
                // Después de 2 segundos, volver a mostrar el botón
                setTimeout(function() {
                    contenidoMostrado.style.display = 'none';
                    btnVerConcepto.style.display = 'block';
                }, 2000);
            });
        }
        
        // Configurar evento del botón revelar identidad
        const btnRevelarIdentidad = document.getElementById('btn-revelar-identidad');
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
                if (modalRevelar) {
                    modalRevelar.style.display = 'flex';
                }
            });
            
            // Confirmar: revelar identidad
            if (btnConfirmarRevelar) {
                btnConfirmarRevelar.onclick = async function() {
                    if (modalRevelar) {
                        modalRevelar.style.display = 'none';
                    }
                    
                    btnRevelarIdentidad.disabled = true;
                    btnRevelarIdentidad.textContent = 'Revelando...';
                    
                    const sessionNumber = localStorage.getItem('sessionNumber');
                    await revelarIdentidad(sessionNumber, userName, estadoJuego);
                    
                    btnRevelarIdentidad.textContent = 'Identidad revelada';
                };
            }
            
            // Cancelar: cerrar modal
            if (btnCancelarRevelar) {
                btnCancelarRevelar.onclick = function() {
                    if (modalRevelar) {
                        modalRevelar.style.display = 'none';
                    }
                };
            }
            
            // Cerrar modal al hacer clic fuera de él
            if (modalRevelar) {
                modalRevelar.onclick = function(e) {
                    if (e.target === modalRevelar) {
                        modalRevelar.style.display = 'none';
                    }
                };
            }
        }
        
        if (esImpostor) {
            console.log('🎭 Configurado botón para mensaje de impostor');
        } else {
            console.log('📝 Configurado botón para elemento:', estadoJuego.elemento);
        }
    } else {
        console.error('❌ No se encontró el elemento elemento-o-impostor');
    }
}

// Función para revelar la identidad de un usuario
async function revelarIdentidad(sessionNumber, userName, estadoJuego) {
    if (typeof window.supabaseClient === 'undefined') {
        console.error('❌ Supabase no inicializado');
        return;
    }
    
    try {
        // PRIMERO: Cargar el estado ACTUAL del juego desde Supabase para preservar todas las identidades ya reveladas
        const versionJuego = '1.0';
        const { data: juegoExistente, error: errorBuscar } = await window.supabaseClient
            .from('codigos')
            .select('id, datos_juego')
            .eq('codigo', String(sessionNumber))
            .eq('juegos', versionJuego)
            .eq('rol', 'juego')
            .eq('app', 'Impostor1')
            .not('datos_juego', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        
        if (errorBuscar) {
            console.error('❌ Error buscando juego para actualizar:', errorBuscar);
            return;
        }
        
        if (!juegoExistente) {
            console.error('❌ No se encontró el juego para actualizar');
            return;
        }
        
        // Parsear el estado actual del juego desde la base de datos
        let estadoJuegoActual = typeof juegoExistente.datos_juego === 'string' 
            ? JSON.parse(juegoExistente.datos_juego) 
            : juegoExistente.datos_juego;
        
        // Preservar todas las identidades ya reveladas y agregar la nueva
        const identidadesReveladas = estadoJuegoActual.identidadesReveladas || {};
        identidadesReveladas[userName] = true;
        
        // Crear el estado actualizado preservando TODOS los campos del juego original
        const estadoJuegoActualizado = {
            ...estadoJuegoActual,
            identidadesReveladas: identidadesReveladas
        };
        
        console.log('📋 Identidades reveladas antes:', Object.keys(identidadesReveladas).length);
        console.log('📋 Identidades reveladas después:', Object.keys(identidadesReveladas).length);
        console.log('📋 Usuarios que han revelado:', Object.keys(identidadesReveladas));
        
        // Actualizar el registro del juego
        const { error: errorActualizar } = await window.supabaseClient
            .from('codigos')
            .update({ datos_juego: estadoJuegoActualizado })
            .eq('id', juegoExistente.id);
        
        if (errorActualizar) {
            console.error('❌ Error actualizando identidad revelada:', errorActualizar);
        } else {
            console.log('✅ Identidad revelada para:', userName);
            // Actualizar el estado local
            juegoActual = estadoJuegoActualizado;
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
        console.error('Error revelando identidad:', err);
    }
}

// Suscribirse a cambios del juego en tiempo real
function suscribirACambiosJuego(sessionNumber) {
    if (typeof window.supabaseClient === 'undefined') {
        return;
    }
    
    const userName = localStorage.getItem('userName');
    const versionJuego = '1.0';
    
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
                console.log('🔔 Cambio en estado del juego detectado:', payload.eventType);
                console.log('📦 Payload completo:', payload);
                
                // Si es un INSERT o UPDATE, usar payload.new
                // Si es un DELETE, usar payload.old
                const registro = payload.new || payload.old;
                
                console.log('📋 Registro extraído:', registro);
                
                // Verificar que el cambio es relevante (tiene datos_juego, juegos correcto y rol = 'juego')
                if (registro && registro.datos_juego && registro.juegos === versionJuego && registro.rol === 'juego' && registro.app === 'Impostor1') {
                    try {
                        console.log('✅ Cambio relevante detectado, actualizando juego');
                        
                        // Parsear datos_juego si viene como string
                        const nuevoJuego = typeof registro.datos_juego === 'string' 
                            ? JSON.parse(registro.datos_juego) 
                            : registro.datos_juego;
                        
                        juegoActual = nuevoJuego;
                        
                        // Actualizar lista de usuarios con el nuevo estado del juego
                        const usuarios = await obtenerUsuariosSesion(sessionNumber);
                        mostrarUsuarios(usuarios, juegoActual);
                        
                        if (juegoActual && juegoActual.activo) {
                            // Verificar si es un juego nuevo o diferente
                            const juegoId = `${juegoActual.iniciadoEn}_${juegoActual.categoria}_${juegoActual.elemento}_${juegoActual.impostor}`;
                            const esJuegoNuevo = !ultimoJuegoMostrado || ultimoJuegoMostrado !== juegoId;
                            
                            if (esJuegoNuevo) {
                                console.log('🎮 Juego NUEVO detectado vía Realtime, mostrando resultado');
                                ultimoJuegoMostrado = juegoId;
                                mostrarResultadoJuego(juegoActual, userName);
                            } else {
                                console.log('ℹ️ Juego ya mostrado anteriormente (Realtime), no se vuelve a mostrar');
                            }
                        }
                    } catch (err) {
                        console.error('❌ Error parseando estado del juego:', err);
                    }
                } else if (registro && registro.codigo === String(sessionNumber)) {
                    // Si el cambio es en la sesión pero no tiene datos_juego, recargar
                    console.log('🔄 Recargando estado del juego desde la base de datos');
                    await cargarEstadoJuego(sessionNumber);
                } else {
                    console.log('ℹ️ Cambio no relevante o registro incompleto');
                }
            }
        )
        .subscribe((status) => {
            console.log('📡 Estado de suscripción juego:', status);
            
            // Si la suscripción falla, usar polling como respaldo
            if (status === 'SUBSCRIBED') {
                console.log('✅ Suscrito a cambios del juego en tiempo real');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.warn('⚠️ Error en suscripción de juego, usando polling como respaldo');
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
    
    console.log('🔄 Iniciando polling del juego cada 2 segundos como respaldo...');
    
    window.pollingJuegoInterval = setInterval(async () => {
        // Solo cargar si no hay un juego ya mostrado o si queremos verificar cambios
        // El polling solo debe detectar nuevos juegos, no re-mostrar el mismo
        const hayJuego = await cargarEstadoJuego(sessionNumber);
        
        // El polling continúa para detectar nuevos juegos
        if (hayJuego) {
            console.log('✅ Juego activo detectado vía polling, continuando monitoreo para nuevos juegos...');
        }
    }, 2000);
}

// Limpiar polling cuando se salga de la página
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        if (window.pollingJuegoInterval) {
            clearInterval(window.pollingJuegoInterval);
        }
    });
}

// Función para obtener usuarios de una sesión
async function obtenerUsuariosSesion(codigoSesion) {
    if (typeof window.supabaseClient === 'undefined') {
        console.warn('Supabase no inicializado');
        return [];
    }

    try {
        const { data, error } = await window.supabaseClient
            .from('codigos')
            .select('usuario, rol')
            .eq('codigo', String(codigoSesion))
            .eq('app', 'Impostor1')
            .not('usuario', 'is', null)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error obteniendo usuarios:', error);
            return [];
        }

        // Filtrar usuarios con nombre NULL o vacío (doble verificación)
        const usuariosValidos = (data || []).filter(usuario => 
            usuario.usuario && usuario.usuario.trim() !== ''
        );

        return usuariosValidos;
    } catch (err) {
        console.error('Error obteniendo usuarios:', err);
        return [];
    }
}

// Función para mostrar usuarios en la lista
function mostrarUsuarios(usuarios, estadoJuego = null) {
    const listaUsuarios = document.getElementById('lista-usuarios');
    if (!listaUsuarios) return;

    // Filtrar usuarios con nombre NULL o vacío (doble verificación)
    const usuariosValidos = usuarios.filter(usuario => 
        usuario && usuario.usuario && usuario.usuario.trim() !== ''
    );

    if (usuariosValidos.length === 0) {
        listaUsuarios.innerHTML = '<p class="sin-usuarios">No hay usuarios en la sesión</p>';
        return;
    }

    // Obtener lista de usuarios que han revelado su identidad
    const identidadesReveladas = estadoJuego && estadoJuego.identidadesReveladas ? estadoJuego.identidadesReveladas : {};
    const impostor = estadoJuego && estadoJuego.impostor ? estadoJuego.impostor : null;

    listaUsuarios.innerHTML = usuariosValidos.map(usuario => {
        const esHost = usuario.rol === 'host';
        const badge = esHost ? '<span class="badge-host">Host</span>' : '';
        const haRevelado = identidadesReveladas[usuario.usuario] === true;
        const esImpostorUsuario = impostor === usuario.usuario;
        
        let identidadBadge = '';
        if (haRevelado) {
            if (esImpostorUsuario) {
                identidadBadge = '<span class="badge-impostor">Impostor</span>';
            } else {
                identidadBadge = '<span class="badge-no-impostor">No Impostor</span>';
            }
        }
        
        return `
            <div class="usuario-item">
                <span class="nombre-usuario">${usuario.usuario}</span>
                <div class="badges-container">${badge} ${identidadBadge}</div>
            </div>
        `;
    }).join('');
}

// Función para cargar usuarios y suscribirse a cambios en tiempo real
async function cargarYSuscribirUsuarios(codigoSesion) {
    // Cargar usuarios iniciales
    const usuarios = await obtenerUsuariosSesion(codigoSesion);
    // Cargar estado del juego para mostrar identidades reveladas
    const estadoJuego = juegoActual || null;
    mostrarUsuarios(usuarios, estadoJuego);
    console.log('👥 Usuarios iniciales cargados:', usuarios.length);

    // Verificar que Supabase está disponible
    if (typeof window.supabaseClient === 'undefined') {
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
                console.log('🔔 Cambio detectado en usuarios:', payload);
                console.log('Evento:', payload.eventType);
                console.log('Nuevo:', payload.new);
                console.log('Viejo:', payload.old);
                
                realtimeFuncionando = true;
                
                // Siempre actualizar la lista cuando hay cambios
                // La función obtenerUsuariosSesion ya filtra por app = 'Impostor1'
                console.log('✅ Actualizando lista de usuarios...');
                const usuariosActualizados = await obtenerUsuariosSesion(codigoSesion);
                // Cargar estado del juego actualizado para mostrar identidades reveladas
                const estadoJuegoActualizado = juegoActual || null;
                mostrarUsuarios(usuariosActualizados, estadoJuegoActualizado);
                ultimoConteoUsuarios = usuariosActualizados.length;
                console.log('✅ Lista actualizada con', usuariosActualizados.length, 'usuarios');
            }
        )
        .subscribe((status, err) => {
            console.log('📡 Estado de suscripción Realtime:', status);
            if (status === 'SUBSCRIBED') {
                console.log('✅ Suscrito a cambios en tiempo real (APP: Impostor1)');
                // Verificar después de 5 segundos si Realtime está funcionando
                setTimeout(() => {
                    if (!realtimeFuncionando) {
                        console.warn('⚠️ Realtime suscrito pero no se detectan cambios. Activando polling como respaldo...');
                        iniciarPollingUsuarios(codigoSesion);
                    }
                }, 5000);
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
    
    // También iniciar polling como respaldo (cada 3 segundos)
    iniciarPollingUsuarios(codigoSesion);
}

// Función para actualizar usuarios periódicamente (polling como respaldo)
let pollingInterval = null;
function iniciarPollingUsuarios(codigoSesion) {
    // Cancelar polling anterior si existe
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }
    
    console.log('🔄 Iniciando polling de usuarios cada 3 segundos...');
    
    pollingInterval = setInterval(async () => {
        try {
            const usuarios = await obtenerUsuariosSesion(codigoSesion);
            const listaUsuarios = document.getElementById('lista-usuarios');
            if (listaUsuarios) {
                const conteoActual = usuarios.length;
                // Solo actualizar si el número de usuarios cambió
                if (conteoActual !== (window.ultimoConteoUsuarios || 0)) {
                    console.log('🔄 Polling: Cambio detectado en número de usuarios, actualizando...');
                    const estadoJuego = juegoActual || null;
                    mostrarUsuarios(usuarios, estadoJuego);
                    window.ultimoConteoUsuarios = conteoActual;
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
    
    console.log(`Número de visitas: ${visitas}`);
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
    console.log(`Página cargada el: ${fechaHora}`);
}

// Función global para alternar tema (accesible desde consola)
window.alternarTema = function() {
    document.body.classList.toggle('tema-oscuro');
    const esOscuro = document.body.classList.contains('tema-oscuro');
    localStorage.setItem('tema', esOscuro ? 'oscuro' : 'claro');
    console.log(`Tema cambiado a: ${esOscuro ? 'oscuro' : 'claro'}`);
};

// Aplicar tema guardado al cargar cualquier página
function aplicarTemaGuardado() {
    const tema = localStorage.getItem('tema');
    if (tema === 'oscuro') {
        document.body.classList.add('tema-oscuro');
    }
}

// Inicializar funcionalidades comunes
aplicarTemaGuardado();
actualizarContadorVisitas();
mostrarFechaHora();

// Mensaje de bienvenida en consola
console.log('🚀 ¡Web de prueba cargada exitosamente!');
console.log('Funcionalidades disponibles:');
console.log('- Gestión de sesiones (crear y unirse)');
console.log('- Números de sesión aleatorios (1000-9999)');
console.log('- Identificación de usuarios');
console.log('- Compartir números de sesión');
console.log('- Contador de visitas (localStorage)');
console.log('- Tema oscuro/claro (presiona F12 y ejecuta alternarTema() en consola)');

/* Supabase persistence helpers */
// saveSessionToSupabase(sessionId, meta)
async function saveSessionToSupabase(sessionId, meta = {}) {
    if (typeof window.supabaseClient === 'undefined') {
        // Supabase not initialized; fallback to localStorage
        console.info('Supabase no inicializado, guardando sesión en localStorage (temporal).');
        const sessions = JSON.parse(localStorage.getItem('sessions') || '{}');
        sessions[sessionId] = Object.assign({ createdAt: new Date().toISOString() }, meta);
        localStorage.setItem('sessions', JSON.stringify(sessions));
        return;
    }

    try {
        // Obtener el nombre del usuario desde localStorage
        const nombreUsuario = meta.usuario || localStorage.getItem('userName');
        
        // Validar que el nombre no sea NULL o vacío
        if (!nombreUsuario || nombreUsuario.trim() === '') {
            console.warn('⚠️ No se puede crear sesión sin nombre de usuario');
            throw new Error('El nombre del usuario es requerido para crear una sesión');
        }
        
        // Preparar los datos a insertar
        const datosInsert = {
            codigo: String(sessionId),
            usuario: nombreUsuario.trim(),
            rol: meta.role || 'host',
            app: 'Impostor1'
        };
        
        console.log('📤 Insertando sesión con datos:', datosInsert);
        
        // Insertar el código de sesión en la tabla 'codigos'
        // Nota: La tabla necesita una columna 'codigo' (texto) para almacenar el número de sesión
        const { data, error } = await window.supabaseClient
            .from('codigos')
            .insert(datosInsert)
            .select();

        if (error) {
            console.error('Error guardando sesión en Supabase:', error);
            console.error('Detalles del error:', JSON.stringify(error, null, 2));
            // Si falla por falta de columnas, mostrar mensaje útil
            if (error.message && error.message.includes('column')) {
                console.warn('⚠️ La tabla "codigos" necesita las columnas: codigo (text), usuario (text), rol (text), app (text)');
            }
            // Si falla por permisos RLS
            if (error.code === 'PGRST301' || (error.message && error.message.includes('permission')) || (error.message && error.message.includes('RLS'))) {
                console.error('⚠️ Error de permisos: Verifica que Row Level Security (RLS) esté configurado correctamente en Supabase');
            }
            throw error;
        }

        console.log('✅ Sesión guardada en Supabase:', sessionId);
        console.log('📥 Datos guardados:', data);
    } catch (err) {
        console.error('Error guardando sesión en Supabase:', err);
        throw err;
    }
}

// saveParticipantToSupabase(sessionId, participant)
async function saveParticipantToSupabase(sessionId, participant = {}) {
    if (typeof window.supabaseClient === 'undefined') {
        console.info('Supabase no inicializado, guardando participante en localStorage (temporal).');
        const participantsKey = `participants_${sessionId}`;
        const parts = JSON.parse(localStorage.getItem(participantsKey) || '[]');
        parts.push(Object.assign({ addedAt: new Date().toISOString() }, participant));
        localStorage.setItem(participantsKey, JSON.stringify(parts));
        return;
    }

    try {
        // Obtener el nombre del usuario desde localStorage o del parámetro
        const nombreUsuario = participant.name || localStorage.getItem('userName');
        
        // Validar que el nombre no sea NULL o vacío
        if (!nombreUsuario || nombreUsuario.trim() === '') {
            console.warn('⚠️ No se puede guardar participante sin nombre');
            throw new Error('El nombre del usuario es requerido');
        }
        
        // Preparar los datos a insertar
        const datosInsert = {
            codigo: String(sessionId),
            usuario: nombreUsuario.trim(),
            rol: participant.role || 'guest',
            app: 'Impostor1'
        };
        
        console.log('📤 Insertando participante con datos:', datosInsert);
        
        // Insertar participante en la tabla codigos
        // Nota: La tabla necesita columnas: codigo, usuario, rol, app
        const { data, error } = await window.supabaseClient
            .from('codigos')
            .insert(datosInsert)
            .select();

        if (error) {
            console.error('Error guardando participante en Supabase:', error);
            console.error('Detalles del error:', JSON.stringify(error, null, 2));
            // Si falla por falta de columnas, mostrar mensaje útil
            if (error.message && error.message.includes('column')) {
                console.warn('⚠️ La tabla "codigos" necesita las columnas: codigo (text), usuario (text), rol (text), app (text)');
            }
            // Si falla por permisos RLS
            if (error.code === 'PGRST301' || (error.message && error.message.includes('permission')) || (error.message && error.message.includes('RLS'))) {
                console.error('⚠️ Error de permisos: Verifica que Row Level Security (RLS) esté configurado correctamente en Supabase');
            }
            throw error;
        }

        console.log('✅ Participante añadido en Supabase para sesión:', sessionId);
        console.log('📥 Datos guardados:', data);
    } catch (err) {
        console.error('Error guardando participante en Supabase:', err);
        throw err;
    }
}

// Verificar si un código de sesión existe en Supabase
async function verificarCodigoSesion(codigo) {
    if (typeof window.supabaseClient === 'undefined') {
        console.warn('Supabase no inicializado, no se puede verificar el código.');
        return false;
    }

    try {
        const { data, error } = await window.supabaseClient
            .from('codigos')
            .select('codigo')
            .eq('codigo', String(codigo))
            .eq('app', 'Impostor1')
            .limit(1);

        if (error) {
            console.error('Error verificando código en Supabase:', error);
            console.error('Detalles del error:', JSON.stringify(error, null, 2));
            return false;
        }

        // Si hay al menos un registro, el código existe
        return data && data.length > 0;
    } catch (err) {
        console.error('Error verificando código:', err);
        console.error('Stack trace:', err.stack);
        return false;
    }
}

// Verificar si ya existe un usuario con el mismo nombre en la sesión
async function verificarUsuarioEnSesion(codigo, nombreUsuario) {
    if (typeof window.supabaseClient === 'undefined') {
        console.warn('Supabase no inicializado, no se puede verificar el usuario.');
        return false;
    }

    try {
        const { data, error } = await window.supabaseClient
            .from('codigos')
            .select('codigo, usuario')
            .eq('codigo', String(codigo))
            .eq('usuario', String(nombreUsuario))
            .eq('app', 'Impostor1')
            .limit(1);

        if (error) {
            console.error('Error verificando usuario en sesión:', error);
            console.error('Detalles del error:', JSON.stringify(error, null, 2));
            return false;
        }

        // Si hay al menos un registro, el usuario ya existe en esta sesión
        return data && data.length > 0;
    } catch (err) {
        console.error('Error verificando usuario en sesión:', err);
        console.error('Stack trace:', err.stack);
        return false;
    }
}

// Mantener compatibilidad con funciones antiguas (Firestore)
const saveSessionToFirestore = saveSessionToSupabase;
const saveParticipantToFirestore = saveParticipantToSupabase;
