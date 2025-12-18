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
// Función para generar número de sesión completo: YYYYMM + 4 dígitos aleatorios
// Ejemplo: 2025123456 (año 2025, mes 12, código 3456)
function generarNumeroSesion() {
    const ahora = new Date();
    const año = ahora.getFullYear(); // 2025
    const mes = String(ahora.getMonth() + 1).padStart(2, '0'); // 01-12
    const codigoAleatorio = Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000; // 1000-9999
    
    // Combinar: YYYYMM + código (ej: 2025123456)
    return parseInt(`${año}${mes}${codigoAleatorio}`);
}

// Función para obtener el código corto (últimos 4 dígitos) de un número de sesión
function obtenerCodigoCorto(numeroSesion) {
    const numeroStr = String(numeroSesion);
    // Retornar los últimos 4 dígitos
    return numeroStr.slice(-4);
}

// Función para construir el número de sesión completo desde un código corto
// Agrega automáticamente el año y mes actual
function construirNumeroSesionCompleto(codigoCorto) {
    const ahora = new Date();
    const año = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    
    // Validar que el código corto tenga 4 dígitos
    const codigo = String(codigoCorto).padStart(4, '0');
    if (codigo.length !== 4) {
        throw new Error('El código debe tener 4 dígitos');
    }
    
    // Combinar: YYYYMM + código
    return parseInt(`${año}${mes}${codigo}`);
}

// Funcionalidad para la página de inicio
function initHomePage() {
    // Obtener el campo de nombre del usuario
    const nombreUsuarioInput = document.getElementById('nombre-usuario-inicio');
    
    // Cargar nombre guardado si existe
    const nombreGuardado = localStorage.getItem('userName');
    if (nombreGuardado) {
        nombreUsuarioInput.value = nombreGuardado;
    }
    
    // Cargar y mostrar ícono guardado
    const iconoGuardado = localStorage.getItem('userIcono') || '👤';
    const iconoActual = document.getElementById('icono-actual');
    if (iconoActual) {
        iconoActual.textContent = iconoGuardado;
    }
    
    // Configurar botón para abrir modal de ícono
    const btnCambiarIcono = document.getElementById('btn-cambiar-icono');
    const modalIcono = document.getElementById('modal-icono');
    const btnCerrarIcono = document.getElementById('btn-cerrar-icono');
    
    if (btnCambiarIcono && modalIcono) {
        btnCambiarIcono.addEventListener('click', function() {
            // Cargar ícono actual y marcar como seleccionado
            const iconoActual = localStorage.getItem('userIcono') || '👤';
            const iconosOptions = document.querySelectorAll('.icono-option');
            iconosOptions.forEach(btn => {
                btn.classList.remove('selected');
                if (btn.dataset.icono === iconoActual) {
                    btn.classList.add('selected');
                }
            });
            modalIcono.style.display = 'flex';
        });
    }
    
    // Configurar selección de íconos en el modal
    const iconosOptions = document.querySelectorAll('.icono-option');
    iconosOptions.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remover selección anterior
            iconosOptions.forEach(b => b.classList.remove('selected'));
            // Agregar selección actual
            this.classList.add('selected');
            // Guardar ícono seleccionado
            const iconoSeleccionado = this.dataset.icono;
            localStorage.setItem('userIcono', iconoSeleccionado);
            // Actualizar ícono en el botón
            if (iconoActual) {
                iconoActual.textContent = iconoSeleccionado;
            }
        });
    });
    
    // Cerrar modal
    if (btnCerrarIcono && modalIcono) {
        btnCerrarIcono.addEventListener('click', function() {
            modalIcono.style.display = 'none';
        });
    }
    
    if (modalIcono) {
        modalIcono.addEventListener('click', function(e) {
            if (e.target === modalIcono) {
                modalIcono.style.display = 'none';
            }
        });
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
    
    // Función para crear nueva sesión
    async function crearNuevaSesion() {
        const nombre = obtenerYValidarNombre();
        if (!nombre) {
            return; // La validación ya mostró el error
        }
        
        // Verificar que Supabase esté disponible
        if (typeof window.supabaseClient === 'undefined') {
            alert('Error: No se puede conectar con la base de datos. Por favor, recarga la página.');
            return;
        }
        
        // Generar un número de sesión único
        let numeroSesion;
        let intentos = 0;
        const maxIntentos = 50; // Límite de intentos para evitar loops infinitos
        
        do {
            numeroSesion = generarNumeroSesion();
            const existe = await verificarCodigoSesion(numeroSesion);
            
            if (!existe) {
                // Número único encontrado
                console.log(`✅ Número de sesión único encontrado: ${numeroSesion} (intento ${intentos + 1})`);
                break;
            }
            
            intentos++;
            console.log(`⚠️ Número ${numeroSesion} ya existe, generando otro... (intento ${intentos})`);
            
            if (intentos >= maxIntentos) {
                alert('Error: No se pudo generar un número de sesión único después de varios intentos. Por favor, intenta nuevamente.');
                return;
            }
        } while (true);
        
        // Guardar en localStorage para que esté disponible en la página de sesión
        localStorage.setItem('sessionNumber', numeroSesion);
        localStorage.setItem('sessionType', 'admin');
        
        // Persistir la sesión en Supabase con el código y el nombre del usuario
        try {
            await saveSessionToSupabase(numeroSesion, { 
                role: 'admin',
                usuario: nombre 
            });
            console.log(`✅ Sesión ${numeroSesion} creada exitosamente`);
        } catch (err) {
            console.error('No se pudo guardar la sesión en Supabase:', err);
            alert('Error al crear la sesión. Por favor, intenta nuevamente.');
            // Limpiar localStorage en caso de error
            localStorage.removeItem('sessionNumber');
            localStorage.removeItem('sessionType');
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
        
        const codigoIngresado = document.getElementById('numero-sesion').value;
        
        if (!codigoIngresado) {
            alert('Por favor, ingresa el código de sesión (4 dígitos).');
            return;
        }
        
        // Validar que sea un número de 4 dígitos
        const codigoNum = parseInt(codigoIngresado);
        if (isNaN(codigoNum) || codigoIngresado.length !== 4 || codigoNum < 1000 || codigoNum > 9999) {
            alert('El código de sesión debe ser un número de 4 dígitos (1000-9999).');
            return;
        }
        
        // Buscar sesión por código corto (últimos 4 dígitos)
        // Primero intenta con el mes actual, luego busca en cualquier mes
        if (typeof window.supabaseClient === 'undefined') {
            alert('Error: No se puede conectar con la base de datos. Por favor, recarga la página.');
            return;
        }
        
        let numeroSesion = null;
        
        // Primero intentar con el año y mes actual
        try {
            const numeroActual = construirNumeroSesionCompleto(codigoIngresado);
            const existeActual = await verificarCodigoSesion(numeroActual);
            if (existeActual) {
                numeroSesion = numeroActual;
                console.log(`✅ Sesión encontrada con mes actual: ${numeroSesion}`);
            }
        } catch (err) {
            console.log('Error al construir número con mes actual:', err);
        }
        
        // Si no se encontró, buscar en cualquier sesión que termine con esos 4 dígitos
        if (!numeroSesion) {
            numeroSesion = await buscarSesionPorCodigoCorto(codigoIngresado);
            if (numeroSesion) {
                console.log(`✅ Sesión encontrada en otro mes: ${numeroSesion}`);
            }
        }
        
        if (!numeroSesion) {
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
        
        // Verificar que el ícono esté guardado en localStorage antes de unirse
        const iconoGuardado = localStorage.getItem('userIcono');
        if (!iconoGuardado) {
            // Si no hay ícono guardado, usar el por defecto y guardarlo
            localStorage.setItem('userIcono', '👤');
            console.log('⚠️ No se encontró ícono en localStorage, usando por defecto 👤');
        } else {
            console.log('✅ Ícono encontrado en localStorage antes de unirse:', iconoGuardado);
        }
        
        // Guardar el participante en Supabase
        try {
            await saveParticipantToSupabase(numeroSesion, { name: nombre, role: 'guest' });
        } catch (err) {
            console.error('❌ Error al guardar participante en Supabase:', err);
            console.error('📋 Detalles completos del error:', JSON.stringify(err, null, 2));
            
            // Mostrar mensaje más detallado si es un error de permisos
            if (err.code === 'PGRST301' || (err.message && err.message.includes('permission')) || (err.message && err.message.includes('RLS'))) {
                alert('Error de permisos: No se pudo guardar el ícono. Verifica la configuración de RLS en Supabase.');
            } else if (err.message && err.message.includes('column')) {
                alert('Error: La columna "icono" no existe en la tabla. Ejecuta: ALTER TABLE codigos ADD COLUMN icono TEXT DEFAULT \'👤\';');
            } else {
                alert('Error al unirse a la sesión: ' + (err.message || 'Error desconocido'));
            }
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
    
    // Configurar botón de instrucciones
    const btnInstrucciones = document.getElementById('btn-instrucciones');
    const modalInstrucciones = document.getElementById('modal-instrucciones');
    const btnCerrarInstrucciones = document.getElementById('btn-cerrar-instrucciones');
    
    if (btnInstrucciones && modalInstrucciones) {
        btnInstrucciones.addEventListener('click', function() {
            modalInstrucciones.style.display = 'flex';
        });
    }
    
    if (btnCerrarInstrucciones && modalInstrucciones) {
        btnCerrarInstrucciones.addEventListener('click', function() {
            modalInstrucciones.style.display = 'none';
        });
    }
    
    if (modalInstrucciones) {
        modalInstrucciones.addEventListener('click', function(e) {
            if (e.target === modalInstrucciones) {
                modalInstrucciones.style.display = 'none';
            }
        });
    }
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
  "Ramos PLEMC Malla Antigua": [
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
        console.log('⏳ Juego no encontrado inicialmente, reintentando en 2 segundos...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        hayJuegoActivo = await cargarEstadoJuego(sessionNumber);
        
        // Si aún no se encuentra, intentar una vez más
        if (!hayJuegoActivo) {
            console.log('⏳ Juego aún no encontrado, reintentando una vez más en 2 segundos...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            hayJuegoActivo = await cargarEstadoJuego(sessionNumber);
        }
    }
    
    // Obtener número de usuarios para determinar si mostrar el botón
    const usuarios = await obtenerUsuariosSesion(sessionNumber);
    const usuariosValidos = usuarios.filter(usuario => 
        usuario && usuario.usuario && usuario.usuario.trim() !== ''
    );
    
    // Verificar si el usuario es admin
    const sessionType = localStorage.getItem('sessionType');
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
    
    if (!botonVolverInicio) {
        console.error('❌ No se encontró el botón btn-volver-inicio');
        return;
    }
    
    if (!modal) {
        console.error('❌ No se encontró el modal modal-salir-sesion');
        return;
    }
    
    // Evitar agregar múltiples event listeners
    if (botonVolverInicio.dataset.configured === 'true') {
        console.log('ℹ️ Botón volver al inicio ya configurado');
        return;
    }
    botonVolverInicio.dataset.configured = 'true';
    
    console.log('✅ Configurando botón volver al inicio');
    
    // Remover cualquier event listener anterior
    botonVolverInicio.onclick = null;
    
    // Mostrar modal al hacer clic en "Volver al inicio"
    botonVolverInicio.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🖱️ Click en botón volver al inicio');
        if (modal) {
            modal.style.display = 'flex';
            console.log('✅ Modal mostrado');
        } else {
            console.error('❌ Modal no encontrado al hacer clic');
        }
    });
    
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
        const versionJuego = '1.1'; // Versión del juego
        
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
        const versionJuego = '1.1'; // Versión del juego
        
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
async function mostrarResultadoJuego(estadoJuego, userName) {
    console.log('🎮 Mostrando resultado del juego:', estadoJuego);
    
    const botonNuevoJuego = document.getElementById('btn-nuevo-juego');
    const resultado = document.getElementById('resultado-juego');
    
    if (!resultado) {
        console.error('❌ No se encontró el elemento resultado-juego');
        return;
    }
    
    // Obtener número de usuarios actual para verificar si mostrar el botón
    const sessionNumber = localStorage.getItem('sessionNumber');
    const usuarios = await obtenerUsuariosSesion(sessionNumber);
    const usuariosValidos = usuarios.filter(usuario => 
        usuario && usuario.usuario && usuario.usuario.trim() !== ''
    );
    
    // Actualizar estado del botón y mensaje según el número de usuarios
    actualizarEstadoJuegoSegunUsuarios(usuariosValidos.length);
    
    // Configurar el botón solo si hay 3 o más usuarios y es admin
    const sessionType = localStorage.getItem('sessionType');
    const esAdmin = sessionType === 'admin';
    if (botonNuevoJuego && esAdmin && usuariosValidos.length >= 3) {
        // Reconfigurar el botón ya que ahora hay juego activo
        botonNuevoJuego.dataset.configured = 'false';
        configurarBotonNuevoJuego(true);
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
            <button id="btn-ver-concepto" class="btn-ver-concepto">Categoría: ${estadoJuego.categoria}<br>Ver concepto o palabra</button>
            <div id="contenido-mostrado" class="contenido-mostrado" style="display: none;">
                ${esImpostor ? '<div class="mensaje-impostor">Eres impostor</div>' : `<div class="elemento-mostrado">${estadoJuego.elemento}</div>`}
            </div>
            <button id="btn-revelar-identidad" class="btn-revelar-identidad">Revelar mi identidad</button>
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
            .select('usuario, rol, icono')
            .eq('codigo', String(codigoSesion))
            .eq('app', 'Impostor1')
            .not('usuario', 'is', null)
            .order('created_at', { ascending: true });
        
        // Debug: verificar que se está obteniendo el rol
        if (data && data.length > 0) {
            console.log('👥 Usuarios obtenidos con roles:', data.map(u => ({ usuario: u.usuario, rol: u.rol })));
        }

        if (error) {
            console.error('Error obteniendo usuarios:', error);
            return [];
        }

        // Filtrar usuarios con nombre NULL o vacío (doble verificación)
        const usuariosValidos = (data || []).filter(usuario => 
            usuario && usuario.usuario && usuario.usuario.trim() !== ''
        );

        return usuariosValidos;
    } catch (err) {
        console.error('Error obteniendo usuarios:', err);
        return [];
    }
}

// Función para actualizar el estado del botón y mensaje según el número de usuarios
function actualizarEstadoJuegoSegunUsuarios(numeroUsuarios) {
    const sessionNumber = localStorage.getItem('sessionNumber');
    const sessionType = localStorage.getItem('sessionType');
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
    const usuariosValidos = usuarios.filter(usuario => 
        usuario && usuario.usuario && usuario.usuario.trim() !== ''
    );

    if (usuariosValidos.length === 0) {
        listaUsuarios.innerHTML = '<p class="sin-usuarios">No hay usuarios en la sesión</p>';
        actualizarEstadoJuegoSegunUsuarios(0);
        return;
    }
    
    // Actualizar estado del botón y mensaje según el número de usuarios
    actualizarEstadoJuegoSegunUsuarios(usuariosValidos.length);

    // Obtener lista de usuarios que han revelado su identidad
    const identidadesReveladas = estadoJuego && estadoJuego.identidadesReveladas ? estadoJuego.identidadesReveladas : {};
    const impostor = estadoJuego && estadoJuego.impostor ? estadoJuego.impostor : null;

    listaUsuarios.innerHTML = usuariosValidos.map(usuario => {
        // Verificar si es admin (también verificar 'host' por compatibilidad con datos antiguos)
        const esAdmin = usuario.rol === 'admin' || usuario.rol === 'host';
        const badge = esAdmin ? '<span class="badge-admin">Admin</span>' : '';
        const haRevelado = identidadesReveladas[usuario.usuario] === true;
        const esImpostorUsuario = impostor === usuario.usuario;
        
        let identidadBadge = '';
        if (haRevelado) {
            if (esImpostorUsuario) {
                identidadBadge = '<span class="badge-impostor">EL IMPOSTOR</span>';
            } else {
                identidadBadge = '<span class="badge-no-impostor">No Impostor</span>';
            }
        }
        
        // Obtener ícono del usuario desde la base de datos, o usar el por defecto
        const iconoUsuario = usuario.icono || '👤';
        
        // Debug: verificar que el rol y el ícono se están obteniendo
        console.log('👤 Usuario:', usuario.usuario, '| Rol:', usuario.rol, '| Es Admin:', esAdmin, '| Ícono:', iconoUsuario);
        
        return `
            <div class="usuario-item">
                <span class="usuario-icono">${iconoUsuario}</span>
                <span class="nombre-usuario">${usuario.usuario} ${badge}</span>
                <div class="badges-container">${identidadBadge}</div>
            </div>
        `;
    }).join('');
}

// Función para cargar usuarios y suscribirse a cambios en tiempo real
async function cargarYSuscribirUsuarios(codigoSesion) {
    let usuarios = [];
    
    try {
        // Cargar usuarios iniciales
        usuarios = await obtenerUsuariosSesion(codigoSesion);
        console.log('👥 Usuarios obtenidos:', usuarios);
        // Cargar estado del juego para mostrar identidades reveladas
        const estadoJuego = juegoActual || null;
        mostrarUsuarios(usuarios, estadoJuego);
        console.log('👥 Usuarios iniciales cargados:', usuarios.length);
    } catch (err) {
        console.error('❌ Error en cargarYSuscribirUsuarios:', err);
    }

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
                
                // Actualizar estado del botón y mensaje según el número de usuarios
                const usuariosValidos = usuariosActualizados.filter(usuario => 
                    usuario && usuario.usuario && usuario.usuario.trim() !== ''
                );
                actualizarEstadoJuegoSegunUsuarios(usuariosValidos.length);
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
                    
                    // Actualizar estado del botón y mensaje según el número de usuarios
                    const usuariosValidos = usuarios.filter(usuario => 
                        usuario && usuario.usuario && usuario.usuario.trim() !== ''
                    );
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
        
        // Obtener el ícono del usuario desde localStorage
        const iconoUsuario = localStorage.getItem('userIcono') || '👤';
        console.log('🎨 Ícono del admin obtenido de localStorage:', iconoUsuario);
        
        // Preparar los datos a insertar
        const datosInsert = {
            codigo: String(sessionId),
            usuario: nombreUsuario.trim(),
            rol: meta.role || 'admin',
            app: 'Impostor1',
            icono: iconoUsuario
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
                console.warn('⚠️ La tabla "codigos" necesita las columnas: codigo (text), usuario (text), rol (text), app (text), icono (text)');
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
        
        // Obtener el ícono del usuario desde localStorage
        const iconoUsuario = localStorage.getItem('userIcono') || '👤';
        console.log('🎨 Ícono del usuario obtenido de localStorage:', iconoUsuario);
        console.log('👤 Nombre del usuario:', nombreUsuario);
        console.log('🎭 Rol del usuario:', participant.role || 'guest');
        
        // Preparar los datos a insertar
        const datosInsert = {
            codigo: String(sessionId),
            usuario: nombreUsuario.trim(),
            rol: participant.role || 'guest',
            app: 'Impostor1',
            icono: iconoUsuario
        };
        
        console.log('📤 Insertando participante con datos COMPLETOS:', JSON.stringify(datosInsert, null, 2));
        
        // Insertar participante en la tabla codigos
        // Nota: La tabla necesita columnas: codigo, usuario, rol, app, icono
        const { data, error } = await window.supabaseClient
            .from('codigos')
            .insert(datosInsert)
            .select();

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

        console.log('✅ Participante añadido exitosamente en Supabase para sesión:', sessionId);
        console.log('📥 Datos guardados (respuesta completa):', JSON.stringify(data, null, 2));
        
        // Verificar que el ícono se guardó correctamente
        if (data && data[0]) {
            const iconoGuardado = data[0].icono;
            console.log('🎨 Ícono guardado en la base de datos:', iconoGuardado);
            if (!iconoGuardado || iconoGuardado === null) {
                console.warn('⚠️ ADVERTENCIA: El ícono no se guardó en la base de datos (es null o undefined)');
            }
        }
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

// Buscar sesión por código corto (últimos 4 dígitos) en cualquier mes/año
async function buscarSesionPorCodigoCorto(codigoCorto) {
    if (typeof window.supabaseClient === 'undefined') {
        console.warn('Supabase no inicializado, no se puede buscar la sesión.');
        return null;
    }

    try {
        // Obtener todos los códigos de sesión que terminen con los 4 dígitos
        const { data, error } = await window.supabaseClient
            .from('codigos')
            .select('codigo')
            .eq('app', 'Impostor1')
            .limit(1000); // Limitar para no sobrecargar

        if (error) {
            console.error('Error buscando sesión por código corto:', error);
            return null;
        }

        if (!data || data.length === 0) {
            return null;
        }

        // Buscar el código que termine con los 4 dígitos
        const codigoStr = String(codigoCorto).padStart(4, '0');
        for (const registro of data) {
            const codigoCompleto = String(registro.codigo);
            if (codigoCompleto.endsWith(codigoStr)) {
                console.log(`🔍 Sesión encontrada: ${codigoCompleto} termina con ${codigoStr}`);
                return parseInt(codigoCompleto);
            }
        }

        return null;
    } catch (err) {
        console.error('Error buscando sesión por código corto:', err);
        return null;
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
