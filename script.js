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

const ZERO_ABSOLUTO_C = -273.15;
let currentUnit = "c";

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

// Genera puntos T(t) en el intervalo [0, totalSegundos] para graficar.
function generarSerieTemperatura(T0, Tenv, k, totalSegundos) {
  if (!totalSegundos || totalSegundos <= 0 || !k) return [];
  const pasos = Math.max(25, Math.min(180, Math.round(totalSegundos / 5)));
  const dt = totalSegundos / (pasos - 1);
  const puntos = [];

  for (let i = 0; i < pasos; i++) {
    const t = dt * i;
    const temp = Tenv + (T0 - Tenv) * Math.exp(-k * t);
    puntos.push({ t, temp });
  }
  return puntos;
}

function renderChart(puntos, datos) {
  const cont = document.getElementById("chart");
  if (!puntos.length) {
    cont.innerHTML = `<p class="muted">Calcula para ver la curva T(t).</p>`;
    return;
  }

  const width = 420;
  const height = 260;
  const pad = 28;
  const temps = puntos.map(p => p.temp);
  const minTemp = Math.min(...temps, datos.Tenv, datos.Ttarget);
  const maxTemp = Math.max(...temps, datos.T0);
  const rango = Math.max(1, maxTemp - minTemp);

  const mapX = t => pad + (t / puntos[puntos.length - 1].t) * (width - pad * 2);
  const mapY = temp => pad + (1 - (temp - minTemp) / rango) * (height - pad * 2);

  const path = puntos.map((p, idx) => `${idx === 0 ? "M" : "L"}${mapX(p.t).toFixed(2)} ${mapY(p.temp).toFixed(2)}`).join(" ");
  const areaPath = `${puntos.map((p, idx) => `${idx === 0 ? "M" : "L"}${mapX(p.t).toFixed(2)} ${mapY(p.temp).toFixed(2)}`).join(" ")} L${mapX(puntos[puntos.length - 1].t).toFixed(2)} ${height - pad} L${pad} ${height - pad} Z`;

  const gridLines = [];
  const gridSteps = 5;
  for (let i = 1; i < gridSteps; i++) {
    const gx = pad + ((width - pad * 2) / gridSteps) * i;
    const gy = pad + ((height - pad * 2) / gridSteps) * i;
    gridLines.push(`<line x1="${gx}" y1="${pad}" x2="${gx}" y2="${height - pad}" />`);
    gridLines.push(`<line x1="${pad}" y1="${gy}" x2="${width - pad}" y2="${gy}" />`);
  }

  cont.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Curva de enfriamiento">
      <g class="chart-grid">
        ${gridLines.join("")}
      </g>
      <g class="ejes">
        <line class="chart-axis" x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" />
        <line class="chart-axis" x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" />
      </g>
      <path class="chart-fill" d="${areaPath}"></path>
      <path class="chart-line" d="${path}"></path>
      <circle cx="${mapX(0).toFixed(2)}" cy="${mapY(puntos[0].temp).toFixed(2)}" r="4" fill="#d18c1d"></circle>
      <circle cx="${mapX(puntos[puntos.length - 1].t).toFixed(2)}" cy="${mapY(puntos[puntos.length - 1].temp).toFixed(2)}" r="4" fill="#3c5d42"></circle>
      <text x="${width - pad}" y="${height - pad + 14}" text-anchor="end" fill="#6f645f" font-size="10">Tiempo (s)</text>
      <text x="${pad - 8}" y="${pad}" text-anchor="end" fill="#6f645f" font-size="10">Temp (°C)</text>
    </svg>
    <div class="chart-meta">
      <span class="chart-legend"><span class="chart-dot"></span> T(t)</span>
      <span class="muted">Inicio: ${datos.T0} °C · Objetivo: ${datos.Ttarget} °C · Entorno: ${datos.Tenv} °C</span>
    </div>
  `;

  // Tooltip interactivo al hacer hover sobre la curva
  const svg = cont.querySelector("svg");
  const tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";
  cont.appendChild(tooltip);
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  marker.setAttribute("r", "5");
  marker.setAttribute("fill", "#d18c1d");
  marker.setAttribute("stroke", "#2f2a28");
  marker.setAttribute("stroke-width", "1");
  svg.appendChild(marker);
  marker.style.display = "none";

  function nearestPoint(mx) {
    const tTotal = puntos[puntos.length - 1].t;
    const tHover = ((mx - pad) / (width - pad * 2)) * tTotal;
    let nearest = puntos[0];
    let minDiff = Infinity;
    for (const p of puntos) {
      const d = Math.abs(p.t - tHover);
      if (d < minDiff) {
        minDiff = d;
        nearest = p;
      }
    }
    return nearest;
  }

  const minX = mapX(0);
  const maxX = mapX(puntos[puntos.length - 1].t);

  function onMove(evt) {
    const rect = svg.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const mx = (evt.clientX - rect.left) * scaleX;
    const my = (evt.clientY - rect.top) * scaleY;
    const hitPad = 10;
    if (mx < minX - hitPad || mx > maxX + hitPad || my < pad - hitPad || my > height - pad + hitPad) {
      tooltip.style.opacity = 0;
      marker.style.display = "none";
      return;
    }
    const p = nearestPoint(mx);
    const vx = mapX(p.t);
    const vy = mapY(p.temp);
    tooltip.style.left = `${vx / scaleX}px`;
    tooltip.style.top = `${vy / scaleY}px`;
    tooltip.style.opacity = 1;
    tooltip.textContent = `t=${Math.round(p.t)} s · ${p.temp.toFixed(1)} °C`;
    marker.style.display = "block";
    marker.setAttribute("cx", vx.toFixed(2));
    marker.setAttribute("cy", vy.toFixed(2));
  }

  function onLeave() {
    tooltip.style.opacity = 0;
    marker.style.display = "none";
  }

  svg.addEventListener("mousemove", onMove);
  svg.addEventListener("mouseleave", onLeave);
}

function renderResultado({ minutesRounded, pretty, escenario, infinito }) {
  const contenedor = document.getElementById("resultado");
  contenedor.classList.remove("error");
  const tiempoTexto = infinito ? "Infinito" : `${minutesRounded.toFixed(1)} minutos (${pretty})`;
  contenedor.innerHTML = `
    <p><strong>Tiempo estimado:</strong> ${tiempoTexto}.</p>
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
  const unidad = document.querySelector('input[name="unidad"]:checked')?.value || "c";
  const tipoEnvase = document.getElementById("envase-tipo").value;
  const volumenMl = parseFloat(document.getElementById("envase-volumen-input").value);
  const entornoId = document.getElementById("temp-sugerida").value;
  const usaServilleta = document.getElementById("servilleta").value === "si";

  const temps = { T0, Ttarget, Tenv };
  const tempsC = convertirA_C(temps, unidad);

  return { ...tempsC, unidad, tipoEnvase, volumenMl, entornoId, usaServilleta, rawTemps: temps };
}

function convertirA_C({ T0, Ttarget, Tenv }, unidad) {
  if (unidad === "f") {
    return {
      T0: (T0 - 32) * (5 / 9),
      Ttarget: (Ttarget - 32) * (5 / 9),
      Tenv: (Tenv - 32) * (5 / 9)
    };
  }
  if (unidad === "k") {
    return {
      T0: T0 - 273.15,
      Ttarget: Ttarget - 273.15,
      Tenv: Tenv - 273.15
    };
  }
  return {
    T0,
    Ttarget,
    Tenv
  };
}

function convertirDesdeC(valorC, unidad) {
  if (unidad === "f") return valorC * 9 / 5 + 32;
  if (unidad === "k") return valorC + 273.15;
  return valorC;
}

function validarEntradas({ T0, Ttarget, Tenv, tipoEnvase, volumenMl, entornoId }) {
  if ([T0, Ttarget, Tenv, volumenMl].some(Number.isNaN) || !tipoEnvase || !entornoId) {
    return "Completa todos los valores numéricos y elige tipo de envase y preset de temperatura.";
  }

  if (Ttarget >= T0) {
    return "La cerveza ya está a la temperatura objetivo o más fría.";
  }

  // Para enfriar, el entorno debe ser más frío que la temperatura objetivo.
  if (Ttarget <= Tenv) {
    return "La temperatura objetivo debe ser mayor que la del medio para que el enfriado tenga sentido.";
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
    },
    infinito: datos.Ttarget <= ZERO_ABSOLUTO_C || datos.Tenv <= ZERO_ABSOLUTO_C
  });

  // Alimentamos el temporizador con el tiempo calculado (segundos).
  inicializarTimer(Math.round(resultado.tSeconds));

  // Generamos y dibujamos la curva T(t).
  const serie = generarSerieTemperatura(datos.T0, datos.Tenv, kInfo.k, resultado.tSeconds);
  renderChart(serie, datos);

  mostrarEasterEgg(datos.Ttarget, datos.Tenv);
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
  const seleccionAnterior = select.value;
  select.innerHTML = `<option value="" disabled selected>Selecciona un preset</option>`;
  Object.entries(ENTORNOS).forEach(([key, { label, temp }]) => {
    const option = document.createElement("option");
    option.value = key;
    option.dataset.tempC = temp;
    const tempConv = convertirDesdeC(temp, currentUnit);
    option.textContent = `${label} (${Math.round(tempConv * 10) / 10} °${currentUnit.toUpperCase()})`;
    select.appendChild(option);
  });
  if (seleccionAnterior) select.value = seleccionAnterior;
  if (!select.value) select.selectedIndex = 1;
}

function poblarSelectObjetivo() {
  const select = document.getElementById("temp-objetivo-preset");
  const selectedIdx = select.selectedIndex;
  select.innerHTML = `<option value="" disabled selected>Selecciona un preset</option>`;
  OBJETIVO_PRESETS.forEach(({ label, temp }, idx) => {
    const option = document.createElement("option");
    option.dataset.tempC = temp;
    const tempConv = convertirDesdeC(temp, currentUnit);
    option.value = tempConv;
    option.textContent = `${label} (${Math.round(tempConv * 10) / 10} °${currentUnit.toUpperCase()})`;
    if (idx === 1) option.selected = true;
    select.appendChild(option);
  });
  if (selectedIdx >= 0 && selectedIdx < select.options.length) {
    select.selectedIndex = selectedIdx;
  }
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
    const tC = ENTORNOS[entornoId].temp;
    input.value = Math.round(convertirDesdeC(tC, currentUnit) * 10) / 10;
  }
  actualizarServilletaDisponibilidad(entornoId);
}

function manejarCambioObjetivo() {
  const val = document.getElementById("temp-objetivo-preset").value;
  if (val !== "") {
    document.getElementById("temp-objetivo").value = val;
  }
}

function manejarCambioUnidad() {
  const nueva = document.querySelector('input[name="unidad"]:checked')?.value || "c";
  const anterior = currentUnit;
  currentUnit = nueva;
  // Convertimos valores visibles para mantener coherencia al cambiar de unidad
  const campos = [
    { id: "temp-inicial" },
    { id: "temp-objetivo" },
    { id: "temp-entorno" }
  ];
  campos.forEach(({ id }) => {
    const input = document.getElementById(id);
    const val = parseFloat(input.value);
    if (Number.isFinite(val)) {
      const valC = convertirA_C({ T0: val, Ttarget: val, Tenv: val }, anterior).T0;
      const convertido = convertirDesdeC(valC, nueva);
      input.value = Math.round(convertido * 10) / 10;
    }
  });
  poblarSelectEntorno();
  poblarSelectObjetivo();
  manejarCambioEntorno();
  manejarCambioObjetivo();
}

function actualizarServilletaDisponibilidad(entornoId) {
  const select = document.getElementById("servilleta");
  const note = document.getElementById("servilleta-note");
  const esBalde = entornoId === "balde_hielo" || entornoId === "balde_hielo_sal";
  if (esBalde) {
    select.value = "no";
    select.disabled = true;
    select.title = "En balde no aplica servilleta mojada.";
    if (note) note.textContent = "En balde con agua/hielo la servilleta mojada no aplica.";
  } else {
    select.disabled = false;
    select.title = "";
    if (note) note.textContent = "";
  }
}

// --- Temporizador ---
let timerInterval = null;
let timerInicialSeg = 0;
let timerRestanteSeg = 0;

function formatearSegundos(seg) {
  const s = Math.max(0, Math.round(seg));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

function actualizarDisplayTimer() {
  document.getElementById("timer-display").textContent = formatearSegundos(timerRestanteSeg);
}

function inicializarTimer(segundos) {
  // Tiempo inicial proviene del cálculo pero se puede ajustar manualmente.
  timerInicialSeg = Math.max(0, segundos);
  timerRestanteSeg = timerInicialSeg;
  document.getElementById("timer-minutos").value = (timerInicialSeg / 60).toFixed(1);
  actualizarDisplayTimer();
}

function tomarValorTimerEditable() {
  const minutos = parseFloat(document.getElementById("timer-minutos").value);
  if (!Number.isFinite(minutos) || minutos < 0) return null;
  return Math.round(minutos * 60);
}

function reproducirSonido(id) {
  // Reproducimos audio si existe (destape/glup); si no existe el archivo, no rompe.
  try {
    const audio = document.getElementById(id);
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  } catch (e) {
    // Silenciosamente ignoramos.
  }
}

function finalizarTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerRestanteSeg = 0;
  actualizarDisplayTimer();
  reproducirSonido("audio-destape");
  setTimeout(() => reproducirSonido("audio-glup"), 600);
  renderMensajeTimer("¡Tu cerveza debería estar lista para tomar!");
}

function renderMensajeTimer(msg) {
  const cont = document.getElementById("resultado");
  cont.insertAdjacentHTML("beforeend", `<p>${msg}</p>`);
}

function iniciarTimer() {
  const editableSeg = tomarValorTimerEditable();
  if (editableSeg !== null) {
    timerInicialSeg = editableSeg;
    timerRestanteSeg = editableSeg;
  }
  if (timerRestanteSeg <= 0) {
    renderError("Configura un tiempo mayor a 0 para iniciar el temporizador.");
    return;
  }

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timerRestanteSeg -= 1;
    if (timerRestanteSeg <= 0) {
      finalizarTimer();
    } else {
      actualizarDisplayTimer();
    }
  }, 1000);
  actualizarDisplayTimer();
}

function pausarTimer() {
  if (!timerInterval) return;
  clearInterval(timerInterval);
  timerInterval = null;
}

function reanudarTimer() {
  if (timerInterval || timerRestanteSeg <= 0) return;
  iniciarTimer();
}

function reiniciarTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerRestanteSeg = timerInicialSeg;
  actualizarDisplayTimer();
}

function toggleExplicacion() {
  const contenido = document.getElementById("explicacion-contenido");
  contenido.classList.toggle("mostrar");
  const btn = document.getElementById("toggle-explicacion");
  const abierto = contenido.classList.contains("mostrar");
  btn.textContent = abierto ? "Ocultar explicación" : "¿Cómo se hace el cálculo?";
}

function mostrarEasterEgg(TtargetC, TenvC) {
  const cont = document.getElementById("resultado");
  const existe = cont.querySelector(".easter");
  const unidad = currentUnit;
  const ceroAbs = convertirDesdeC(ZERO_ABSOLUTO_C, unidad);
  const etiquetaUnidad = unidad.toUpperCase();
  if (TtargetC <= ZERO_ABSOLUTO_C || TenvC <= ZERO_ABSOLUTO_C) {
    if (!existe) {
      cont.insertAdjacentHTML(
        "beforeend",
        `<p class="easter">¿Querés la cerveza más fría del universo? Tiempo infinito: no se puede bajar de 0 absoluto (${ceroAbs.toFixed(2)} °${etiquetaUnidad}).</p>`
      );
    }
  } else if (existe) {
    existe.remove();
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
  document.querySelectorAll('input[name="unidad"]').forEach(el => el.addEventListener("change", manejarCambioUnidad));
  document.getElementById("toggle-explicacion").addEventListener("click", toggleExplicacion);
  document.getElementById("timer-start").addEventListener("click", () => {
    iniciarTimer();
    document.getElementById("timer-pause").textContent = "Pausar";
  });
  document.getElementById("timer-pause").addEventListener("click", () => {
    if (timerInterval) {
      pausarTimer();
      document.getElementById("timer-pause").textContent = "Reanudar";
    } else {
      reanudarTimer();
      document.getElementById("timer-pause").textContent = "Pausar";
    }
  });
  document.getElementById("timer-reset").addEventListener("click", reiniciarTimer);

  // Inicializar valores por defecto
  manejarCambioVolumen();
  document.getElementById("temp-sugerida").selectedIndex = 1;
  manejarCambioEntorno();
  manejarCambioObjetivo();

  // Inicializamos timer en cero hasta que haya cálculo.
  inicializarTimer(0);

  // Audio opcional; si los archivos no están presentes, la app sigue funcionando.
  const audiosContainer = document.createElement("div");
  audiosContainer.innerHTML = `
    <audio id="audio-destape" src="destape.mp3" preload="auto"></audio>
    <audio id="audio-glup" src="glup.mp3" preload="auto"></audio>
  `;
  document.body.appendChild(audiosContainer);

  const form = document.getElementById("calc-form");
  form.addEventListener("submit", manejarSubmit);
});
