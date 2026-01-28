const friendData = {
  "Sara": {
    nombre: "Sara Cambero",
    msj: "¡FELIZ CUMPLEAÑOS SARA! 👮‍♀️🎂 Aunque seas la futura oficial, hoy tienes permiso para saltarte todas las normas. Que este año sea de ley y lleno de celebraciones.",
    avatar: "img/Sara.jpg",
    color: "#00f3ff", // Color Cian Tech
    fotos: ["img/Sara_1.jpeg", "img/Sara_2.jpeg", "img/Sara_3.jpeg", "img/Sara_4.jpeg"]
  },
  "Andrea": {
    nombre: "Andrea",
    msj: "¡MUCHÍSIMAS FELICIDADES ANDREA! 🎉 Hoy es tu gran día. Aunque hoy no acabemos en La China dando el espectáculo, espero que lo celebres como si estuviéramos allí. Que tengas un día increíble, ¡te lo mereces todo!",
    avatar: "img/Andrea.jpg",
    color: "#7e637c", // Color Magenta Glitch
    fotos: ["img/Andrea_1.jpeg", "img/Andrea_2.jpeg", "img/Andrea_3.jpeg", "img/Andrea_4.jpeg"]
  }
};

const terminalStrings = [
  "> Verificando si hay mesa libre en La China...",
  "> Analizando tasa de alcohol en sangre...",
  "> Comprobando si Mario ya ha llegado...",
  "> ¡Portal de felicitación listo!"
];

function launchPortal(userId) {
  const data = friendData[userId];
  if (!data) return;

  // Cambiar el color global del sistema según el sujeto
  document.documentElement.style.setProperty('--accent', data.color);

  document.getElementById("selector-screen").classList.add("hidden");
  setTimeout(() => {
    document.getElementById("loading-screen").classList.remove("hidden");
    startLoadingSequence(data);
  }, 600);
}

function startLoadingSequence(data) {
  const output = document.getElementById("terminal-output");
  const fill = document.getElementById("progress-fill");
  output.innerHTML = "";
  let i = 0;

  const interval = setInterval(() => {
    if (i < terminalStrings.length) {
      const p = document.createElement("p");
      p.textContent = terminalStrings[i];
      p.style.marginBottom = "5px";
      output.appendChild(p);
      fill.style.width = `${(i + 1) * 25}%`;
      i++;
    } else {
      clearInterval(interval);
      setTimeout(() => transitionToPortal(data), 800);
    }
  }, 700);
}

function transitionToPortal(data) {
  document.getElementById("loading-screen").classList.add("hidden");

  setTimeout(() => {
    document.getElementById("portal-screen").classList.remove("hidden");
    document.getElementById("friend-avatar").src = data.avatar;
    document.getElementById("data-name").textContent = data.nombre;

    const btn = document.getElementById("access-btn");
    btn.onclick = () => showCapsule(data);
  }, 600);
}

function showCapsule(data) {
  document.getElementById("portal-screen").classList.add("hidden");

  setTimeout(() => {
    document.getElementById("capsule-screen").classList.remove("hidden");
    document.getElementById("personal-message").textContent = data.msj;

    const grid = document.getElementById("photo-grid");
    grid.innerHTML = "";

    data.fotos.forEach(src => {
      const img = document.createElement("img");
      img.src = src;
      img.onerror = () => img.style.display = 'none';
      grid.appendChild(img);
    });
  }, 600);
}
