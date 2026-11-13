const slides = Array.from(document.querySelectorAll(".slide"));
const phaseLinks = Array.from(document.querySelectorAll(".phase-link"));
const gotoButtons = Array.from(document.querySelectorAll("[data-goto]"));
const currentEl = document.getElementById("current");
const totalEl = document.getElementById("total");
const progressBar = document.getElementById("progressBar");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const overview = document.getElementById("overview");
const overviewBtn = document.getElementById("overviewBtn");
const closeOverviewBtn = document.getElementById("closeOverview");

const phaseByStart = { 1: "1", 2: "2", 5: "3" };
let index = 0;
let lastFocused = null;
let touchStartX = 0;
let touchStartY = 0;

const pad = (value) => String(value).padStart(2, "0");

function slideIndexFromHash() {
  const match = window.location.hash.match(/^#slide-(\d+)$/);
  if (!match) return 0;
  const parsed = Number(match[1]) - 1;
  return Number.isInteger(parsed) && parsed >= 0 && parsed < slides.length ? parsed : 0;
}

function show(nextIndex, { updateHash = true } = {}) {
  if (!slides.length) return;

  index = ((nextIndex % slides.length) + slides.length) % slides.length;

  slides.forEach((slide, i) => {
    const active = i === index;
    slide.classList.toggle("is-active", active);
    slide.setAttribute("aria-hidden", active ? "false" : "true");
  });

  currentEl.textContent = pad(index + 1);
  totalEl.textContent = pad(slides.length);
  progressBar.style.width = `${((index + 1) / slides.length) * 100}%`;

  const phase = slides[index].dataset.phase;
  phaseLinks.forEach((link) => {
    const linkPhase = phaseByStart[link.dataset.goto];
    link.classList.toggle("is-active", linkPhase === phase);
    link.setAttribute("aria-current", linkPhase === phase ? "step" : "false");
  });

  if (updateHash) {
    const hash = `#slide-${index + 1}`;
    if (window.location.hash !== hash) {
      history.replaceState(null, "", hash);
    }
  }

  const activeSlide = slides[index];
  if (activeSlide) activeSlide.scrollTop = 0;
}

function next() { show(index + 1); }
function previous() { show(index - 1); }

function openOverview() {
  lastFocused = document.activeElement;
  overview.classList.add("is-open");
  overview.setAttribute("aria-hidden", "false");
  closeOverviewBtn.focus();
}

function closeOverview() {
  overview.classList.remove("is-open");
  overview.setAttribute("aria-hidden", "true");
  if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
}

function toggleOverview() {
  if (overview.classList.contains("is-open")) closeOverview();
  else openOverview();
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
}

prevBtn?.addEventListener("click", previous);
nextBtn?.addEventListener("click", next);
overviewBtn?.addEventListener("click", openOverview);
closeOverviewBtn?.addEventListener("click", closeOverview);
fullscreenBtn?.addEventListener("click", toggleFullscreen);

overview?.addEventListener("click", (event) => {
  if (event.target === overview) closeOverview();
});

gotoButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = Number(button.dataset.goto);
    if (Number.isInteger(target)) {
      closeOverview();
      show(target);
    }
  });
});

document.addEventListener("keydown", (event) => {
  const target = event.target;
  const isFormField = target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);

  if (event.key === "Escape" && overview.classList.contains("is-open")) {
    closeOverview();
    return;
  }

  if (isFormField) return;

  if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "PageDown") {
    event.preventDefault();
    next();
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "PageUp") {
    event.preventDefault();
    previous();
  } else if (event.key === "Home") {
    event.preventDefault();
    show(0);
  } else if (event.key === "End") {
    event.preventDefault();
    show(slides.length - 1);
  } else if (event.key === " " || event.key === "Spacebar") {
    if (target instanceof HTMLElement && target.closest("button, a")) return;
    event.preventDefault();
    next();
  } else if (event.key.toLowerCase() === "f") {
    toggleFullscreen();
  } else if (event.key.toLowerCase() === "o") {
    toggleOverview();
  }
});

document.addEventListener(
  "touchstart",
  (event) => {
    const touch = event.changedTouches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  },
  { passive: true },
);

document.addEventListener(
  "touchend",
  (event) => {
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    if (Math.abs(deltaX) > 56 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      if (deltaX < 0) next();
      else previous();
    }
  },
  { passive: true },
);

window.addEventListener("hashchange", () => {
  const target = slideIndexFromHash();
  if (target !== index) show(target, { updateHash: false });
});

show(slideIndexFromHash(), { updateHash: false });
