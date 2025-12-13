# Web de Prueba

Una página web de demostración creada con HTML, CSS y JavaScript vanilla.

## 🚀 Características

- **Responsive Design**: Se adapta a diferentes tamaños de pantalla
- **Navegación Suave**: Scroll suave entre secciones
- **Formulario Interactivo**: Con validación en tiempo real
- **Animaciones**: Efectos de scroll y transiciones
- **Tema Oscuro/Claro**: Alternancia de tema (función en consola)
- **Contador de Visitas**: Almacenado en localStorage

## 📁 Estructura del Proyecto

```
webPrueba_01/
├── index.html          # Página principal
├── styles.css          # Estilos CSS
├── script.js           # Funcionalidad JavaScript
├── package.json        # Configuración del proyecto
└── README.md          # Este archivo
```

## 🛠️ Instalación y Uso

### Opción 1: Servidor Simple
```bash
# Instalar dependencias
npm install

# Iniciar servidor local
npm start
```

### Opción 2: Live Server (recomendado para desarrollo)
```bash
# Instalar dependencias
npm install

# Iniciar con live reload
npm run dev
```

### Opción 3: Servidor Estático
```bash
# Instalar dependencias
npm install

# Servir archivos estáticos
npm run serve
```

### Opción 4: Sin Node.js
Simplemente abre el archivo `index.html` en tu navegador web.

## 🎯 Funcionalidades

### 1. Navegación
- Enlaces de navegación suave entre secciones
- Menú responsive para dispositivos móviles

### 2. Interactividad
- Botón de saludo que solicita el nombre del usuario
- Formulario de contacto con validación
- Efectos hover en botones y elementos

### 3. Efectos Visuales
- Animaciones de entrada para las secciones
- Gradientes y sombras modernas
- Transiciones suaves en elementos interactivos

### 4. Funciones Adicionales
- **Tema oscuro**: Ejecuta `alternarTema()` en la consola del navegador
- **Contador de visitas**: Se guarda automáticamente en localStorage
- **Validación de formulario**: En tiempo real y al enviar

## 🎨 Personalización

### Colores
Los colores principales están definidos en CSS usando variables:
- Color primario: `#667eea` (azul)
- Color secundario: `#764ba2` (morado)
- Gradientes personalizables en los botones y header

### Tipografía
- Fuente principal: Arial
- Tamaños responsivos definidos en rem

## 📱 Responsive Design

La página está optimizada para:
- **Desktop**: Layout completo con múltiples columnas
- **Tablet**: Adaptación de grid y navegación
- **Mobile**: Navegación vertical y contenido en una columna

## 🔧 Herramientas de Desarrollo

- **HTML5**: Estructura semántica
- **CSS3**: Flexbox, Grid, animaciones y transiciones
- **JavaScript ES6+**: Funciones modernas y localStorage
- **Live Server**: Recarga automática durante desarrollo

## 📝 Notas

- El contador de visitas se almacena localmente en el navegador
- El tema se guarda en localStorage y persiste entre sesiones
- Todas las animaciones están optimizadas para rendimiento
- Compatible con navegadores modernos (Chrome, Firefox, Safari, Edge)

## 🚀 Próximas Mejoras

- [ ] Agregar más secciones de contenido
- [ ] Implementar un sistema de comentarios
- [ ] Agregar más temas de color
- [ ] Optimizar para SEO
- [ ] Agregar tests unitarios

---

¡Disfruta explorando tu nueva página web de prueba! 🎉

## 📚 Documentación

La documentación específica del sitio está en la carpeta `docs/`:

- Documentación completa del sitio: [docs/mi-sitio-web.md](docs/mi-sitio-web.md)
- Índice de documentación: [docs/README.md](docs/README.md)

