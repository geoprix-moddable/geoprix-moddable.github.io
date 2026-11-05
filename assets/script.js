// Footer year
document.querySelectorAll("[data-year]").forEach((el) => {
  el.textContent = new Date().getFullYear();
});

// Mark the current page in the tabs and bottom nav bar
const page = location.pathname.split("/").pop().replace(".html", "") || "index";
document.querySelectorAll("[data-page]").forEach((link) => {
  if (link.dataset.page === page) link.setAttribute("aria-current", "page");
});

// Top bar gets a raised colour once the page is scrolled (like Android)
const bar = document.querySelector(".top-bar");
const onScroll = () => bar && bar.classList.toggle("scrolled", scrollY > 4);
addEventListener("scroll", onScroll, { passive: true });
onScroll();

// Dark / light toggle (remembered per browser)
const root = document.documentElement;
try {
  const saved = localStorage.getItem("theme");
  if (saved) root.dataset.theme = saved;
} catch (e) {}

const toggle = document.getElementById("theme-toggle");
if (toggle) {
  toggle.addEventListener("click", () => {
    const isDark =
      root.dataset.theme === "dark" ||
      (!root.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
    root.dataset.theme = isDark ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
  });
}
