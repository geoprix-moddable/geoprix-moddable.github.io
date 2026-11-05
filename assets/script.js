// Footer year
document.querySelectorAll("[data-year]").forEach((el) => {
  el.textContent = new Date().getFullYear();
});

// Mark the current page in the nav
const page = location.pathname.split("/").pop().replace(".html", "") || "index";
document.querySelectorAll("[data-page]").forEach((link) => {
  if (link.dataset.page === page) link.setAttribute("aria-current", "page");
});

// Download warning: confirm the rules before the file downloads
const dialog = document.getElementById("download-confirm");
const agree = document.getElementById("confirm-agree");
const ok = document.getElementById("confirm-ok");
if (dialog && typeof dialog.showModal === "function") {
  let target = null;
  document.querySelectorAll("[data-confirm-download]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      target = link.href;
      agree.checked = false;
      ok.disabled = true;
      dialog.showModal();
    });
  });
  agree.addEventListener("change", () => { ok.disabled = !agree.checked; });
  dialog.addEventListener("close", () => {
    if (dialog.returnValue === "ok" && agree.checked && target) location.href = target;
  });
}
