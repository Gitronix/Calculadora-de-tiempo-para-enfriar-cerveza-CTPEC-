# CTPEC – Calculadora de Tiempo para Enfriar Cerveza

Aplicación web sencilla (HTML, CSS y JavaScript puro) que estima cuánto tiempo tarda en enfriarse una cerveza usando la Ley de Enfriamiento de Newton.

## ¿Cómo funciona?

Modelo: `T(t) = T_env + (T0 - T_env) * e^(-k * t)`

Despejando el tiempo: `t = (1 / k) * ln((T0 - T_env) / (T_obj - T_env))`

El valor de `k` depende del método de enfriado elegido (freezer, heladera, balde con hielo, etc.).

## Instrucciones rápidas

1. Clona el repositorio  
   `git clone https://github.com/Gitronix/Calculadora-de-tiempo-para-enfriar-cerveza-CTPEC-`
2. Abre `index.html` en tu navegador (no requiere servidor).
3. Ingresa:
   - Temperatura inicial de la cerveza (T0, °C)
   - Temperatura objetivo (T_obj, °C)
   - Temperatura del entorno (T_env, °C)
   - Método de enfriado (para seleccionar la constante `k`)
4. Presiona “Calcular tiempo” para ver la estimación.

> Los resultados son aproximados y no reemplazan mediciones reales ni instrumentación de laboratorio.

## Futuras mejoras

- Graficar la curva de enfriamiento y el progreso en tiempo real.
- Guardar perfiles de botellas/latas con tamaños y materiales configurables.
- Ajustar automáticamente `k` a partir de mediciones empíricas del usuario.
- Añadir accesibilidad avanzada (lectura de resultados, alto contraste).
- Internacionalización (ES/EN) y selector de unidades (°C/°F).
