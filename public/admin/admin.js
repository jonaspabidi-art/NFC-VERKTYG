(function () {
  const TOKEN_KEY = "rr_admin_token";
  const NAME_KEY = "rr_admin_restaurant_name";

  function authHeaders() {
    const token = localStorage.getItem(TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // --- Login-sida ---
  const loginBtn = document.getElementById("login-btn");
  if (loginBtn) {
    const slugInput = document.getElementById("slug");
    const passwordInput = document.getElementById("password");
    const loginError = document.getElementById("login-error");

    async function doLogin() {
      loginError.classList.add("hidden");
      loginBtn.disabled = true;

      try {
        const res = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: slugInput.value.trim(), password: passwordInput.value }),
        });
        const data = await res.json();

        if (!res.ok) {
          loginError.textContent = data.error || "Kunde inte logga in.";
          loginError.classList.remove("hidden");
          loginBtn.disabled = false;
          return;
        }

        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(NAME_KEY, data.restaurantName);
        window.location.href = "/admin/dashboard.html";
      } catch (err) {
        loginError.textContent = "Kunde inte nå servern, försök igen.";
        loginError.classList.remove("hidden");
        loginBtn.disabled = false;
      }
    }

    loginBtn.addEventListener("click", doLogin);
    passwordInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doLogin();
    });
  }

  // --- Dashboard-sida ---
  const logoutLink = document.getElementById("logout-link");
  if (logoutLink) {
    if (!localStorage.getItem(TOKEN_KEY)) {
      window.location.href = "/admin/login.html";
      return;
    }

    document.getElementById("restaurant-name").textContent = localStorage.getItem(NAME_KEY) || "";

    logoutLink.addEventListener("click", () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(NAME_KEY);
      window.location.href = "/admin/login.html";
    });

    async function authedFetch(url, options) {
      const res = await fetch(url, { ...options, headers: { ...authHeaders(), ...(options && options.headers) } });
      if (res.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = "/admin/login.html";
        throw new Error("unauthorized");
      }
      return res;
    }

    async function loadStats() {
      const res = await authedFetch("/api/admin/stats");
      const stats = await res.json();

      document.getElementById("stat-total").textContent = stats.totalReviews;
      document.getElementById("stat-average").textContent = stats.averageRating.toFixed(2);
      document.getElementById("stat-clicks").textContent = stats.googleClicks;
      document.getElementById("stat-discounts").textContent = `${stats.discountsUsed} / ${stats.discountsIssued}`;

      const distributionEl = document.getElementById("distribution");
      distributionEl.innerHTML = "";
      const max = Math.max(1, ...Object.values(stats.distribution));

      for (let rating = 5; rating >= 1; rating--) {
        const count = stats.distribution[rating] || 0;
        const row = document.createElement("div");
        row.className = "bar-row";
        row.innerHTML = `
          <span class="bar-label">${rating} stjärnor</span>
          <span class="bar-track"><span class="bar-fill" style="width:${(count / max) * 100}%"></span></span>
          <span class="bar-count">${count}</span>
        `;
        distributionEl.appendChild(row);
      }
    }

    let currentPage = 1;
    const pageSize = 20;

    async function loadReviews(page) {
      currentPage = page;
      const res = await authedFetch(`/api/admin/reviews?page=${page}&pageSize=${pageSize}`);
      const data = await res.json();

      const body = document.getElementById("reviews-body");
      body.innerHTML = "";

      data.reviews.forEach((review) => {
        const row = document.createElement("tr");
        const date = new Date(review.created_at).toLocaleDateString("sv-SE");
        row.innerHTML = `
          <td>${date}</td>
          <td class="rating-badge">${review.rating}</td>
          <td>${review.comment ? escapeHtml(review.comment) : '<span class="muted">-</span>'}</td>
          <td>${review.clicked_google ? "Ja" : "Nej"}</td>
        `;
        body.appendChild(row);
      });

      const totalPages = Math.max(1, Math.ceil(data.total / pageSize));
      document.getElementById("page-label").textContent = `Sida ${page} av ${totalPages}`;
      document.getElementById("prev-page").disabled = page <= 1;
      document.getElementById("next-page").disabled = page >= totalPages;
    }

    function escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }

    document.getElementById("prev-page").addEventListener("click", () => {
      if (currentPage > 1) loadReviews(currentPage - 1);
    });
    document.getElementById("next-page").addEventListener("click", () => {
      loadReviews(currentPage + 1);
    });

    document.getElementById("redeem-btn").addEventListener("click", async () => {
      const codeInput = document.getElementById("redeem-code");
      const messageEl = document.getElementById("redeem-message");
      const code = codeInput.value.trim();
      if (!code) return;

      messageEl.classList.add("hidden");

      try {
        const res = await authedFetch(`/api/admin/discounts/${encodeURIComponent(code)}/redeem`, {
          method: "POST",
        });
        const data = await res.json();

        messageEl.textContent = res.ok ? "Rabattkoden är inlöst." : data.error || "Kunde inte lösa in koden.";
        messageEl.classList.remove("hidden");

        if (res.ok) {
          codeInput.value = "";
          loadStats();
        }
      } catch (err) {
        messageEl.textContent = "Kunde inte nå servern, försök igen.";
        messageEl.classList.remove("hidden");
      }
    });

    loadStats();
    loadReviews(1);
  }
})();
