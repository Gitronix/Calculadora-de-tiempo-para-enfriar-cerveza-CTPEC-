const METODOS = {
  vidrio_freezer_servilleta: { label: "Botella 750 ml – Freezer + servilleta mojada", k: 0.0004 },
  lata_freezer: { label: "Lata 350 ml – Freezer", k: 0.0006 },
  vidrio_heladera: { label: "Botella 750 ml – Heladera", k: 0.00013 },
  vidrio_hielo: { label: "Botella 750 ml – Balde con hielo", k: 0.00055 }
};

function getK(methodKey) {
  return METODOS[methodKey]?.k ?? null;
}

/**
 * Calcula el tiempo usando la Ley de Enfriamiento de Newton:
 * T(t) = T_env + (T0 - T_env) * e^(-k * t)
 * Despejamos t: t = (1 / k) * ln((T0 - T_env) / (T_obj - T_env))
 */
function calcularTiempo(T0, Ttarget, Tenv, k) {
  if (!k || k <= 0) return null;

  const deltaInicial = T0 - Tenv;
  const deltaObjetivo = Ttarget - Tenv;

  // Evitamos logs o divisiones inválidas
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

function renderResultado({ minutesRounded, pretty }) {
  const contenedor = document.getElementById("resultado");
  contenedor.classList.remove("error");
  contenedor.innerHTML = `
    <p><strong>Tiempo estimado:</strong> ${minutesRounded.toFixed(1)} minutos.</p>
    <p>${pretty}</p>
  `;
}

function renderError(message) {
  const contenedor = document.getElementById("resultado");
  contenedor.classList.add("error");
  contenedor.textContent = message;
}

function manejarSubmit(event) {
  event.preventDefault();

  const T0 = parseFloat(document.getElementById("temp-inicial").value);
  const Ttarget = parseFloat(document.getElementById("temp-objetivo").value);
  const Tenv = parseFloat(document.getElementById("temp-entorno").value);
  const methodKey = document.getElementById("metodo").value;

  if ([T0, Ttarget, Tenv].some(Number.isNaN) || !methodKey) {
    renderError("Por favor, completa todos los valores numéricos y selecciona un método.");
    return;
  }

  if (Ttarget <= Tenv) {
    renderError("La temperatura objetivo debe ser mayor que la temperatura del entorno; de otro modo el cálculo no tiene sentido porque el entorno es más frío o igual que el objetivo.");
    return;
  }

  if (T0 <= Ttarget) {
    renderError("La cerveza ya está a la temperatura objetivo o más fría.");
    return;
  }

  const k = getK(methodKey);
  const resultado = calcularTiempo(T0, Ttarget, Tenv, k);

  if (!resultado) {
    renderError("Los valores ingresados generan un cálculo inválido. Revisa que las temperaturas tengan sentido físico.");
    return;
  }

  renderResultado(resultado);
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("calc-form");
  form.addEventListener("submit", manejarSubmit);
});
