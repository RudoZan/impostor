# Configurar Supabase Realtime

Para que la lista de usuarios se actualice en tiempo real, necesitas habilitar Realtime en Supabase.

## Pasos para habilitar Realtime:

1. **Ve a tu proyecto en Supabase**: https://supabase.com

2. **Ve a Database → Replication** (en el menú lateral izquierdo)

3. **Habilita Realtime para la tabla `codigos`**:
   - Busca la tabla `codigos` en la lista
   - Haz clic en el toggle/switch para habilitar Realtime
   - Debería quedar en verde/activado

4. **Verifica que esté habilitado**:
   - La tabla `codigos` debería mostrar un indicador de que Realtime está activo

## Alternativa: Habilitar desde SQL Editor

Si prefieres usar SQL, ejecuta este comando en el SQL Editor:

```sql
-- Habilitar Realtime para la tabla codigos
ALTER PUBLICATION supabase_realtime ADD TABLE codigos;
```

## Verificar que funciona:

1. **Abre la consola del navegador (F12)** antes de continuar
2. Abre la página de sesión en dos navegadores diferentes (o pestañas)
3. Únete a la misma sesión con diferentes nombres
4. Deberías ver en la consola:
   - `📡 Estado de suscripción Realtime: SUBSCRIBED` (si está funcionando)
   - `🔔 Cambio detectado en usuarios:` cuando alguien se une
5. La lista de usuarios se debería actualizar automáticamente en ambos navegadores

## Solución de problemas:

### Si no se actualiza automáticamente:

1. **Verifica en la consola (F12)**:
   - ¿Aparece `✅ Suscrito a cambios en tiempo real`?
   - ¿Aparece `❌ Error en la suscripción Realtime`?
   - ¿Aparece `🔔 Cambio detectado` cuando alguien se une?

2. **Si ves "CHANNEL_ERROR"**:
   - Verifica que Realtime esté habilitado en Database → Replication
   - Verifica que las políticas RLS estén configuradas

3. **Si no ves ningún mensaje de suscripción**:
   - Realtime probablemente no está habilitado
   - Ve a Database → Replication y habilita la tabla `codigos`

4. **Si ves "SUBSCRIBED" pero no se actualiza**:
   - Verifica que el campo `app` tenga el valor 'Impostor1' en los registros
   - Revisa los logs en la consola para ver si los cambios se están detectando

## Notas importantes:

- Realtime funciona solo con INSERT, UPDATE y DELETE
- Asegúrate de que las políticas RLS permitan SELECT (ya configurado en `supabase-rls-policies.sql`)
- La suscripción se reconecta automáticamente si se pierde la conexión

