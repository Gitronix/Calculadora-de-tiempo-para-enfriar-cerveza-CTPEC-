// Bloque de configuración (valores aproximados ajustables en producción).
const ENVASES = {
  lata_330: { label: "Lata 330 ml (aluminio)", material: "aluminio", volumenMl: 330 },
  lata_473: { label: "Lata 473 ml (aluminio)", material: "aluminio", volumenMl: 473 },
  botella_vidrio_500: { label: "Botella 500 ml (vidrio)", material: "vidrio", volumenMl: 500 },
  botella_vidrio_750: { label: "Botella 750 ml (vidrio)", material: "vidrio", volumenMl: 750 },
  botella_pet_1500: { label: "Botella 1.5 L (PET)", material: "pet", volumenMl: 1500 }
};

const MEDIOS = {
  freezer: {
    label: "Freezer",
    kBase: 0.00055, // valor aproximado para aire muy frío
    tempsSugeridas: [-14, -16, -18],
    descripcion: "Freezer doméstico (aire)."
  },
  heladera: {
    label: "Heladera",
    kBase: 0.00018, // valor aproximado para aire frío moderado
    tempsSugeridas: [3, 4, 5],
    descripcion: "Heladera doméstica."
  },
  balde_hielo: {
    label: "Balde con agua y hielo",
    kBase: 0.0007, // contacto agua+hielo acelera transferencia
    tempsSugeridas: [0],
    descripcion: "Balde con agua y hielo en contacto."
  },
  balde_hielo_sal: {
    label: "Balde con agua, hielo y sal",
    kBase: 0.0009, // aún más rápido por depresión del punto de congelación
    tempsSugeridas: [-4, -6],
    descripcion: "Balde con hielo + sal (agua salmuera)."
  }
};

// Factores de corrección aproximados.
const FACTORES_MATERIAL = {
  aluminio: 1.12, // aluminio conduce mejor el calor
  vidrio: 0.95,   // vidrio es más lento que aluminio
  pet: 0.8        // PET/plástico es más aislante
};

const FACTOR_SERVILLETA = {
  con: 1.1, // con servilleta mojada (evaporación ayuda)
  sin: 1
};

function obtenerFactorVolumen(volumenMl) {
  if (volumenMl <= 350) return 1.08;      // muy pequeño, enfría más rápido
  if (volumenMl <= 600) return 1;         // referencia
  if (volumenMl <= 900) return 0.9;       // algo más lento
  return 0.8;                             // grande (1.5 L), se enfría más lento
}

function obtenerKFinal(envaseId, medioId, usaServilleta) {
  const envase = ENVASES[envaseId];
  const medio = MEDIOS[medioId];
  if (!envase || !medio) return null;

  const kBase = medio.kBase;
  const factorMaterial = FACTORES_MATERIAL[envase.material] ?? 1;
  const factorVolumen = obtenerFactorVolumen(envase.volumenMl);
  const factorServilleta = usaServilleta ? FACTOR_SERVILLETA.con : FACTOR_SERVILLETA.sin;

  return {
    k: kBase * factorMaterial * factorVolumen * factorServilleta,
    detalle: {
      kBase,
      factorMaterial,
      factorVolumen,
      factorServilleta
    }
  };
}

/**
 * Aplica la Ley de Enfriamiento de Newton para obtener el tiempo (t):
 * T(t) = T_env + (T0 - T_env) * e^(-k * t)
 * Despeje: t = (1 / k) * ln((T0 - T_env) / (T_obj - T_env))
 */
function calcularTiempo(T0, Ttarget, Tenv, k) {
  if (!k || k <= 0) return null;

  const deltaInicial = T0 - Tenv;
  const deltaObjetivo = Ttarget - Tenv;
  if (deltaInicial <= 0 || deltaObjetivo <= 0) return null;

  const ratio = deltaInicial / deltaObjetivo;
  if (ratio <= 0) return null;

  const tSeconds = (1 / k) * Math.log(ratio);
  if (!Number.isFinite(tSeconds) || tSeconds < 0) return null;

  const totalMinutes = tSeconds / 60;
  const minutesRounded = Math.round(totalMinutes * 10) / 10;
  const wholeMinutes = Math.floor(tSeconds / 60);
  const seconds = Math.round(tSeconds % 60);

  return {
    tSeconds,
    minutesRounded,
    pretty: `${wholeMinutes} minutos ${seconds} segundos`
  };
}

function renderResultado({ minutesRounded, pretty, escenario }) {
  const contenedor = document.getElementById("resultado");
  contenedor.classList.remove("error");
  contenedor.innerHTML = `
    <p><strong>Tiempo estimado:</strong> ${minutesRounded.toFixed(1)} minutos (${pretty}).</p>
    <p><strong>Escenario:</strong> ${escenario.envase}; medio: ${escenario.medio}; servilleta: ${escenario.servilleta ? "Sí" : "No"}.</p>
    <p>Temperaturas: T₀ = ${escenario.T0} °C, T_obj = ${escenario.Ttarget} °C, T_env = ${escenario.Tenv} °C.</p>
  `;
}

function renderError(message) {
  const contenedor = document.getElementById("resultado");
  contenedor.classList.add("error");
  contenedor.textContent = message;
}

function leerInputs() {
  const T0 = parseFloat(document.getElementById("temp-inicial").value);
  const Ttarget = parseFloat(document.getElementById("temp-objetivo").value);
  const Tenv = parseFloat(document.getElementById("temp-entorno").value);
  const envaseId = document.getElementById("envase").value;
  const medioId = document.getElementById("medio").value;
  const usaServilleta = document.getElementById("servilleta").value === "si";

  return { T0, Ttarget, Tenv, envaseId, medioId, usaServilleta };
}

function validarEntradas({ T0, Ttarget, Tenv, envaseId, medioId }) {
  if ([T0, Ttarget, Tenv].some(Number.isNaN) || !envaseId || !medioId) {
    return "Completa todos los valores numéricos y elige envase y medio.";
  }

  if (Ttarget <= Tenv) {
    return "La temperatura objetivo debe ser mayor que la del medio de enfriado.";
  }

  if (T0 <= Ttarget) {
    return "La cerveza ya está a la temperatura objetivo o más fría.";
  }

  return null;
}

function manejarSubmit(event) {
  event.preventDefault();
  const datos = leerInputs();
  const error = validarEntradas(datos);
  if (error) {
    renderError(error);
    return;
  }

  const kInfo = obtenerKFinal(datos.envaseId, datos.medioId, datos.usaServilleta);
  if (!kInfo || !kInfo.k) {
    renderError("No se pudo calcular la constante k para este escenario.");
    return;
  }

  const resultado = calcularTiempo(datos.T0, datos.Ttarget, datos.Tenv, kInfo.k);
  if (!resultado) {
    renderError("Los valores ingresados generan un cálculo inválido. Revisa que las temperaturas tengan sentido físico.");
    return;
  }

  renderResultado({
    ...resultado,
    escenario: {
      envase: ENVASES[datos.envaseId]?.label ?? datos.envaseId,
      medio: MEDIOS[datos.medioId]?.label ?? datos.medioId,
      servilleta: datos.usaServilleta,
      T0: datos.T0,
      Ttarget: datos.Ttarget,
      Tenv: datos.Tenv
    }
  });
}

function poblarSelectEnvases() {
  const select = document.getElementById("envase");
  select.innerHTML = `<option value="" disabled selected>Selecciona un envase</option>`;
  Object.entries(ENVASES).forEach(([key, { label }]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = label;
    select.appendChild(option);
  });
}

function poblarSelectMedios() {
  const select = document.getElementById("medio");
  select.innerHTML = `<option value="" disabled selected>Selecciona un medio</option>`;
  Object.entries(MEDIOS).forEach(([key, { label }]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = label;
    select.appendChild(option);
  });
}

function actualizarSugerenciasTemp(medioId) {
  const select = document.getElementById("temp-sugerida");
  const input = document.getElementById("temp-entorno");
  select.innerHTML = "";

  const medio = MEDIOS[medioId];
  if (!medio) {
    input.value = "";
    return;
  }

  medio.tempsSugeridas.forEach((temp, idx) => {
    const option = document.createElement("option");
    option.value = temp;
    option.textContent = `${temp} °C`;
    if (idx === 0) option.selected = true;
    select.appendChild(option);
  });

  // Pre-carga el input con la primera sugerencia.
  input.value = medio.tempsSugeridas[0];
}

function manejarCambioMedio() {
  const medioId = document.getElementById("medio").value;
  actualizarSugerenciasTemp(medioId);
}

function manejarCambioTempSugerida() {
  const selected = document.getElementById("temp-sugerida").value;
  const input = document.getElementById("temp-entorno");
  if (selected !== "") input.value = selected;
}

document.addEventListener("DOMContentLoaded", () => {
  poblarSelectEnvases();
  poblarSelectMedios();
  document.getElementById("medio").addEventListener("change", manejarCambioMedio);
  document.getElementById("temp-sugerida").addEventListener("change", manejarCambioTempSugerida);

  const form = document.getElementById("calc-form");
  form.addEventListener("submit", manejarSubmit);
});
