# Configuración Completa de Supabase

Para que todo funcione correctamente, necesitas configurar lo siguiente en Supabase:

## ✅ Checklist de Configuración

### 1. Agregar la columna `app` a la tabla `codigos`

**Ve a:** SQL Editor → Ejecuta este SQL:

```sql
-- Agregar columna APP a la tabla codigos
ALTER TABLE codigos 
ADD COLUMN IF NOT EXISTS app TEXT;
```

### 2. Habilitar Realtime para la tabla `codigos`

**Opción A - Desde la interfaz:**
1. Ve a **Database → Replication** (en el menú lateral)
2. Busca la tabla `codigos`
3. Haz clic en el toggle/switch para habilitar Realtime
4. Debería quedar en verde/activado

**Opción B - Desde SQL Editor:**
```sql
-- Habilitar Realtime para la tabla codigos
ALTER PUBLICATION supabase_realtime ADD TABLE codigos;
```

### 3. Configurar Políticas RLS (Row Level Security)

**Ve a:** SQL Editor → Ejecuta este SQL (o copia desde `supabase-rls-policies.sql`):

```sql
-- 1. Habilitar RLS en la tabla
ALTER TABLE codigos ENABLE ROW LEVEL SECURITY;

-- 2. Política para permitir INSERT
CREATE POLICY "Permitir insertar códigos"
ON codigos
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 3. Política para permitir SELECT
CREATE POLICY "Permitir leer códigos"
ON codigos
FOR SELECT
TO anon, authenticated
USING (true);

-- 4. Política para permitir UPDATE (opcional)
CREATE POLICY "Permitir actualizar códigos"
ON codigos
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 5. Política para permitir DELETE (opcional)
CREATE POLICY "Permitir eliminar códigos"
ON codigos
FOR DELETE
TO anon, authenticated
USING (true);
```

**Nota:** Si las políticas ya existen, puedes eliminarlas primero:
```sql
DROP POLICY IF EXISTS "Permitir insertar códigos" ON codigos;
DROP POLICY IF EXISTS "Permitir leer códigos" ON codigos;
DROP POLICY IF EXISTS "Permitir actualizar códigos" ON codigos;
DROP POLICY IF EXISTS "Permitir eliminar códigos" ON codigos;
```

## 🔍 Verificar la Configuración

### Verificar que la columna `app` existe:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'codigos' AND column_name = 'app';
```

### Verificar que Realtime está habilitado:
```sql
SELECT * FROM pg_publication_tables WHERE tablename = 'codigos';
```

### Verificar las políticas RLS:
```sql
SELECT * FROM pg_policies WHERE tablename = 'codigos';
```

## 🧪 Probar que Funciona

1. **Abre la consola del navegador (F12)**
2. **Crea una sesión** desde la página principal
3. **Abre otra pestaña/navegador** y únete a la misma sesión
4. **Deberías ver en la consola:**
   - `✅ Suscrito a cambios en tiempo real` O
   - `🔄 Iniciando polling de usuarios cada 3 segundos...`
5. **La lista de usuarios debería actualizarse automáticamente**

## ⚠️ Problemas Comunes

### Si ves "CHANNEL_ERROR":
- Verifica que Realtime esté habilitado en Database → Replication
- Verifica que las políticas RLS permitan SELECT

### Si el campo `app` queda en NULL:
- Verifica que la columna existe: `SELECT * FROM information_schema.columns WHERE table_name = 'codigos'`
- Revisa la consola para ver qué datos se están enviando

### Si no se actualiza automáticamente:
- El sistema ahora usa polling como respaldo (cada 3 segundos)
- Debería funcionar incluso sin Realtime habilitado
- Revisa la consola para ver qué método está usando

## 📝 Orden Recomendado de Ejecución

1. **Primero:** Agregar columna `app` (paso 1)
2. **Segundo:** Configurar políticas RLS (paso 3)
3. **Tercero:** Habilitar Realtime (paso 2)
4. **Cuarto:** Probar la aplicación

