// Bloque de configuración (valores aproximados ajustables en producción).
const ENVASE_TIPOS = {
  lata: { label: "Lata de aluminio", material: "aluminio" },
  vidrio: { label: "Botella de vidrio", material: "vidrio" },
  pet: { label: "Botella de plástico / PET", material: "pet" }
};

const ENVASE_VOL_SUGERIDOS = [330, 355, 473, 500, 650, 750, 1000, 1500, 2000];

const ENTORNOS = {
  freezer_fuerte: {
    label: "Freezer fuerte (≈ -18 °C)",
    temp: -18,
    kBase: 0.0006,
    descripcion: "Freezer doméstico bien frío."
  },
  freezer_suave: {
    label: "Freezer suave (≈ -14 °C)",
    temp: -14,
    kBase: 0.0005,
    descripcion: "Freezer menos frío o muy lleno."
  },
  heladera: {
    label: "Heladera (≈ +4 °C)",
    temp: 4,
    kBase: 0.00018,
    descripcion: "Heladera doméstica."
  },
  balde_hielo: {
    label: "Balde con agua y hielo (≈ 0 °C)",
    temp: 0,
    kBase: 0.0007,
    descripcion: "Agua en contacto con hielo."
  },
  balde_hielo_sal: {
    label: "Balde con agua, hielo y sal (≈ -5 °C)",
    temp: -5,
    kBase: 0.0009,
    descripcion: "Salmuera que enfría más rápido."
  }
};

const OBJETIVO_PRESETS = [
  { label: "Muy fría (2–4 °C)", temp: 3 },
  { label: "Fría (4–6 °C)", temp: 5 },
  { label: "Suave (7–10 °C)", temp: 8 }
];

// Factores de corrección aproximados.
const FACTORES_MATERIAL = {
  aluminio: 1.12,
  vidrio: 0.95,
  pet: 0.8
};

const FACTOR_SERVILLETA = {
  con: 1.1,
  sin: 1
};

function obtenerFactorVolumen(volumenMl) {
  if (!volumenMl || volumenMl <= 0) return 0;
  const referencia = 500; // ml
  const ratio = referencia / volumenMl;
  // Acotamos para evitar extremos irreales
  return Math.min(Math.max(ratio, 0.6), 1.2);
}

function obtenerKFinal(tipoEnvase, volumenMl, entornoId, usaServilleta) {
  const envase = ENVASE_TIPOS[tipoEnvase];
  const entorno = ENTORNOS[entornoId];
  if (!envase || !entorno) return null;

  const kBase = entorno.kBase;
  const factorMaterial = FACTORES_MATERIAL[envase.material] ?? 1;
  const factorVolumen = obtenerFactorVolumen(volumenMl);
  const factorServilleta = usaServilleta ? FACTOR_SERVILLETA.con : FACTOR_SERVILLETA.sin;

  return {
    k: kBase * factorMaterial * factorVolumen * factorServilleta,
    detalle: { kBase, factorMaterial, factorVolumen, factorServilleta }
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
    <p><strong>Escenario:</strong> ${escenario.envase}; Volumen: ${escenario.volumen} ml; Servilleta: ${escenario.servilleta ? "Sí" : "No"}.</p>
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
  const tipoEnvase = document.getElementById("envase-tipo").value;
  const volumenMl = parseFloat(document.getElementById("envase-volumen-input").value);
  const entornoId = document.getElementById("temp-sugerida").value;
  const usaServilleta = document.getElementById("servilleta").value === "si";

  return { T0, Ttarget, Tenv, tipoEnvase, volumenMl, entornoId, usaServilleta };
}

function validarEntradas({ T0, Ttarget, Tenv, tipoEnvase, volumenMl, entornoId }) {
  if ([T0, Ttarget, Tenv, volumenMl].some(Number.isNaN) || !tipoEnvase || !entornoId) {
    return "Completa todos los valores numéricos y elige tipo de envase y preset de temperatura.";
  }

  if (Ttarget >= T0) {
    return "La cerveza ya está a la temperatura objetivo o más fría.";
  }

  if (Ttarget >= Tenv) {
    return "La temperatura objetivo debe ser menor que la del medio para que el enfriado tenga sentido.";
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

  const kInfo = obtenerKFinal(datos.tipoEnvase, datos.volumenMl, datos.entornoId, datos.usaServilleta);
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
      envase: ENVASE_TIPOS[datos.tipoEnvase]?.label ?? datos.tipoEnvase,
      volumen: datos.volumenMl,
      servilleta: datos.usaServilleta,
      T0: datos.T0,
      Ttarget: datos.Ttarget,
      Tenv: datos.Tenv
    }
  });
}

function poblarSelectTipoEnvase() {
  const select = document.getElementById("envase-tipo");
  select.innerHTML = `<option value="" disabled selected>Selecciona un tipo</option>`;
  Object.entries(ENVASE_TIPOS).forEach(([key, { label }]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = label;
    select.appendChild(option);
  });
}

function poblarSelectVolumen() {
  const select = document.getElementById("envase-volumen");
  select.innerHTML = `<option value="" disabled selected>Selecciona volumen</option>`;
  ENVASE_VOL_SUGERIDOS.forEach((vol, idx) => {
    const option = document.createElement("option");
    option.value = vol;
    option.textContent = `${vol} ml`;
    if (idx === 1) option.selected = true;
    select.appendChild(option);
  });
}

function poblarSelectEntorno() {
  const select = document.getElementById("temp-sugerida");
  select.innerHTML = `<option value="" disabled selected>Selecciona un preset</option>`;
  Object.entries(ENTORNOS).forEach(([key, { label, temp }]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = `${label} (${temp} °C)`;
    select.appendChild(option);
  });
}

function poblarSelectObjetivo() {
  const select = document.getElementById("temp-objetivo-preset");
  select.innerHTML = `<option value="" disabled selected>Selecciona un preset</option>`;
  OBJETIVO_PRESETS.forEach(({ label, temp }, idx) => {
    const option = document.createElement("option");
    option.value = temp;
    option.textContent = `${label} (${temp} °C)`;
    if (idx === 1) option.selected = true;
    select.appendChild(option);
  });
}

function manejarCambioVolumen() {
  const selectVal = document.getElementById("envase-volumen").value;
  if (selectVal) {
    document.getElementById("envase-volumen-input").value = selectVal;
  }
}

function manejarCambioEntorno() {
  const entornoId = document.getElementById("temp-sugerida").value;
  const input = document.getElementById("temp-entorno");
  if (entornoId && ENTORNOS[entornoId]) {
    input.value = ENTORNOS[entornoId].temp;
  }
}

function manejarCambioObjetivo() {
  const val = document.getElementById("temp-objetivo-preset").value;
  if (val !== "") {
    document.getElementById("temp-objetivo").value = val;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  poblarSelectTipoEnvase();
  poblarSelectVolumen();
  poblarSelectEntorno();
  poblarSelectObjetivo();

  document.getElementById("envase-volumen").addEventListener("change", manejarCambioVolumen);
  document.getElementById("temp-sugerida").addEventListener("change", manejarCambioEntorno);
  document.getElementById("temp-objetivo-preset").addEventListener("change", manejarCambioObjetivo);

  // Inicializar valores por defecto
  manejarCambioVolumen();
  document.getElementById("temp-sugerida").selectedIndex = 1;
  manejarCambioEntorno();
  manejarCambioObjetivo();

  const form = document.getElementById("calc-form");
  form.addEventListener("submit", manejarSubmit);
});
