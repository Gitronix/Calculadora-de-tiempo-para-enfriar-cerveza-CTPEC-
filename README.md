# CTPEC – Calculadora de Tiempo para Enfriar Cerveza

Aplicación web en HTML, CSS y JavaScript puro que estima cuánto tarda en enfriarse una cerveza usando la Ley de Enfriamiento de Newton.

## Modelo

Ecuación: `T(t) = T_env + (T0 − T_env) * e^(−k * t)`

Despeje del tiempo: `t = (1 / k) * ln((T0 − T_env) / (T_obj − T_env))`

El valor de `k` se obtiene combinando:
- `k_base` del medio de enfriado (freezer, heladera, balde, etc.).
- Factor por material del envase (aluminio, vidrio, PET).
- Factor por volumen (envases grandes enfrían más lento).
- Factor por servilleta mojada (acelera el proceso).

Los valores de `k` y factores son aproximados y están definidos en un bloque de configuración en `script.js` para ajustarlos en producción.

## Qué puedes configurar

- Tipo de envase (lata, botella de vidrio, botella PET) y volumen.
- Medio de enfriado (freezer, heladera, balde con agua/hielo, balde con agua/hielo/sal).
- Uso de servilleta mojada (sí/no).
- Temperaturas: inicial (T0), objetivo (T_obj) y del medio (T_env). El medio ofrece sugerencias editables.

## Cómo usar

1. Clona el repositorio  
   `git clone https://github.com/Gitronix/Calculadora-de-tiempo-para-enfriar-cerveza-CTPEC-`
2. Abre `index.html` en tu navegador (no requiere servidor).
3. Selecciona envase y medio, indica si usas servilleta, ingresa T0, T_obj y elige o ajusta T_env.
4. Presiona “Calcular tiempo” para ver la estimación en minutos y en formato minutos/segundos, junto con el resumen del escenario.

> Los resultados son aproximados; no reemplazan mediciones reales ni instrumentación de laboratorio.

## Futuras mejoras

- Graficar la curva de enfriamiento y mostrar progreso estimado.
- Guardar perfiles personalizados y calibrar `k` con datos empíricos.
- Alternar unidades (°C/°F) y traducir la interfaz (ES/EN).
- Mejorar accesibilidad (alto contraste, lectura automática del resultado).
