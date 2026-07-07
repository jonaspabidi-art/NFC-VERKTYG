(function () {
  // Delas av admin- och superadmin-dashboardens sidebar/mobilmeny.
  const menuToggle = document.getElementById("menu-toggle");
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  const closeBtn = document.getElementById("sidebar-close");

  function openSidebar() {
    if (sidebar) sidebar.classList.add("open");
    if (backdrop) backdrop.classList.add("visible");
  }

  function closeSidebar() {
    if (sidebar) sidebar.classList.remove("open");
    if (backdrop) backdrop.classList.remove("visible");
  }

  if (menuToggle) menuToggle.addEventListener("click", openSidebar);
  if (backdrop) backdrop.addEventListener("click", closeSidebar);
  if (closeBtn) closeBtn.addEventListener("click", closeSidebar);

  const navItems = document.querySelectorAll(".nav-item[data-view]");
  const views = document.querySelectorAll(".view[data-view]");
  const pageTitle = document.getElementById("page-title");

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const target = item.dataset.view;

      navItems.forEach((n) => n.classList.toggle("active", n === item));
      views.forEach((v) => v.classList.toggle("active", v.dataset.view === target));

      if (pageTitle) pageTitle.textContent = item.textContent.trim();
      closeSidebar();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
})();
