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
      document.getElementById("stat-discounts").textContent = stats.discountsIssued;

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
        const contactLines = [];
        if (review.contact_email) contactLines.push(escapeHtml(review.contact_email));
        if (review.contact_phone) contactLines.push(escapeHtml(review.contact_phone));
        const contactHtml = contactLines.length > 0 ? contactLines.join("<br>") : '<span class="muted">-</span>';

        let actionHtml = '<span class="muted">-</span>';
        if (review.discount_code) {
          const percentText = review.discount_percent
            ? ` (${review.discount_percent}%${review.discount_bonus_applied ? ", bonus" : ""})`
            : "";
          actionHtml = `<span class="rating-badge">${escapeHtml(review.discount_code)}${percentText}</span>`;
        } else if (review.contact_email || review.contact_phone) {
          actionHtml = `<button class="secondary recovery-btn">Skicka gottgörelsekod</button>`;
        }

        row.innerHTML = `
          <td>${date}</td>
          <td class="rating-badge">${review.rating}</td>
          <td>${review.comment ? escapeHtml(review.comment) : '<span class="muted">-</span>'}</td>
          <td>${review.clicked_google ? "Ja" : "Nej"}</td>
          <td>${contactHtml}</td>
          <td>${actionHtml}</td>
        `;

        const recoveryBtn = row.querySelector(".recovery-btn");
        if (recoveryBtn) {
          recoveryBtn.addEventListener("click", async () => {
            recoveryBtn.disabled = true;
            recoveryBtn.textContent = "Skickar...";
            try {
              const res = await authedFetch(`/api/admin/reviews/${review.id}/recovery-discount`, {
                method: "POST",
              });
              const result = await res.json();
              if (res.ok) {
                recoveryBtn.outerHTML = `<span class="rating-badge">${escapeHtml(result.discountCode)}</span>`;
              } else {
                recoveryBtn.textContent = result.error || "Kunde inte skicka koden.";
                recoveryBtn.disabled = false;
              }
            } catch (err) {
              recoveryBtn.textContent = "Kunde inte nå servern.";
              recoveryBtn.disabled = false;
            }
          });
        }

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

    async function loadSettings() {
      const res = await authedFetch("/api/admin/settings");
      const settings = await res.json();

      document.getElementById("setting-percent").value = settings.discountPercent;
      document.getElementById("setting-valid-days").value = settings.discountValidDays;
      document.getElementById("setting-threshold").value = settings.highRatingThreshold;
      document.getElementById("setting-owner-email").value = settings.ownerEmail || "";
      document.getElementById("setting-logo-url").value = settings.logoUrl || "";
      document.getElementById("setting-accent-color").value = settings.accentColor || "#d4af37";
    }

    document.getElementById("save-settings-btn").addEventListener("click", async () => {
      const messageEl = document.getElementById("settings-message");
      messageEl.classList.add("hidden");

      try {
        const res = await authedFetch("/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            discountPercent: Number(document.getElementById("setting-percent").value),
            discountValidDays: Number(document.getElementById("setting-valid-days").value),
            highRatingThreshold: Number(document.getElementById("setting-threshold").value),
            ownerEmail: document.getElementById("setting-owner-email").value.trim(),
            logoUrl: document.getElementById("setting-logo-url").value.trim(),
            accentColor: document.getElementById("setting-accent-color").value,
          }),
        });
        const data = await res.json();

        messageEl.textContent = res.ok ? "Inställningarna sparades." : data.error || "Kunde inte spara.";
        messageEl.classList.remove("hidden");
      } catch (err) {
        messageEl.textContent = "Kunde inte nå servern, försök igen.";
        messageEl.classList.remove("hidden");
      }
    });

    loadStats();
    loadReviews(1);
    loadSettings();
  }
})();
