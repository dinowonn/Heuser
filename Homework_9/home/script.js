const cards = document.querySelectorAll(".card");
const status = document.getElementById("status");
const resting = "The index is closed. Choose a wing.";

cards.forEach((card, index) => {
  const wing = card.dataset.wing;

  window.setTimeout(() => {
    card.classList.add("is-shown");
  }, 80 + index * 110);

  card.addEventListener("pointermove", (event) => {
    const bounds = card.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    card.style.setProperty("--mx", x + "%");
    card.style.setProperty("--my", y + "%");
  });

  card.addEventListener("pointerenter", () => {
    status.textContent = wing + " — the wing is unlatched.";
  });

  card.addEventListener("pointerleave", () => {
    card.style.removeProperty("--mx");
    card.style.removeProperty("--my");
    status.textContent = resting;
  });

  card.addEventListener("focus", () => {
    status.textContent = wing + " — the wing is unlatched.";
  });

  card.addEventListener("blur", () => {
    status.textContent = resting;
  });
});
