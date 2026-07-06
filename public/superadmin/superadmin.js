(function () {
  const TOKEN_KEY = "rr_superadmin_token";

  function authHeaders() {
    const token = localStorage.getItem(TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // --- Login-sida ---
  const loginBtn = document.getElementById("login-btn");
  if (loginBtn) {
    const passwordInput = document.getElementById("password");
    const loginError = document.getElementById("login-error");

    async function doLogin() {
      loginError.classList.add("hidden");
      loginBtn.disabled = true;

      try {
        const res = await fetch("/api/superadmin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: passwordInput.value }),
        });
        const data = await res.json();

        if (!res.ok) {
          loginError.textContent = data.error || "Kunde inte logga in.";
          loginError.classList.remove("hidden");
          loginBtn.disabled = false;
          return;
        }

        localStorage.setItem(TOKEN_KEY, data.token);
        window.location.href = "/superadmin/dashboard.html";
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
      window.location.href = "/superadmin/login.html";
      return;
    }

    logoutLink.addEventListener("click", () => {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = "/superadmin/login.html";
    });

    async function authedFetch(url, options) {
      const res = await fetch(url, { ...options, headers: { ...authHeaders(), ...(options && options.headers) } });
      if (res.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = "/superadmin/login.html";
        throw new Error("unauthorized");
      }
      return res;
    }

    const editCard = document.getElementById("edit-card");
    let editingId = null;

    async function loadRestaurants() {
      const res = await authedFetch("/api/superadmin/restaurants");
      const data = await res.json();

      const body = document.getElementById("restaurants-body");
      body.innerHTML = "";

      data.restaurants.forEach((restaurant) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${escapeHtml(restaurant.name)}</td>
          <td>${escapeHtml(restaurant.slug)}</td>
          <td>${restaurant.totalReviews}</td>
          <td>${restaurant.averageRating.toFixed(2)}</td>
          <td>${restaurant.discountPercent}%</td>
          <td><button class="secondary edit-row-btn">Redigera</button></td>
        `;
        row.querySelector(".edit-row-btn").addEventListener("click", () => openEdit(restaurant));
        body.appendChild(row);
      });
    }

    function escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }

    function openEdit(restaurant) {
      editingId = restaurant.id;
      document.getElementById("edit-name-label").textContent = restaurant.name;
      document.getElementById("edit-name").value = restaurant.name;
      document.getElementById("edit-place-id").value = restaurant.googlePlaceId;
      document.getElementById("edit-password").value = "";
      document.getElementById("edit-percent").value = restaurant.discountPercent;
      document.getElementById("edit-valid-days").value = restaurant.discountValidDays;
      document.getElementById("edit-threshold").value = restaurant.highRatingThreshold;
      document.getElementById("edit-owner-email").value = restaurant.ownerEmail || "";
      document.getElementById("edit-logo-url").value = restaurant.logoUrl || "";
      document.getElementById("edit-accent-color").value = restaurant.accentColor || "#d4af37";
      document.getElementById("edit-message").classList.add("hidden");
      editCard.classList.remove("hidden");
      editCard.scrollIntoView({ behavior: "smooth" });

      loadDetailStats(restaurant.id);
      loadDetailReviews(restaurant.id, 1);
    }

    async function loadDetailStats(restaurantId) {
      const res = await authedFetch(`/api/superadmin/restaurants/${restaurantId}/stats`);
      const stats = await res.json();

      document.getElementById("sa-stat-total").textContent = stats.totalReviews;
      document.getElementById("sa-stat-average").textContent = stats.averageRating.toFixed(2);
      document.getElementById("sa-stat-clicks").textContent = stats.googleClicks;
      document.getElementById("sa-stat-discounts").textContent = `${stats.discountsUsed} / ${stats.discountsIssued}`;

      const distributionEl = document.getElementById("sa-distribution");
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

    let detailPage = 1;
    const detailPageSize = 10;

    async function loadDetailReviews(restaurantId, page) {
      detailPage = page;
      const res = await authedFetch(
        `/api/superadmin/restaurants/${restaurantId}/reviews?page=${page}&pageSize=${detailPageSize}`
      );
      const data = await res.json();

      const body = document.getElementById("sa-reviews-body");
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

      const totalPages = Math.max(1, Math.ceil(data.total / detailPageSize));
      document.getElementById("sa-page-label").textContent = `Sida ${page} av ${totalPages}`;
      document.getElementById("sa-prev-page").disabled = page <= 1;
      document.getElementById("sa-next-page").disabled = page >= totalPages;
    }

    document.getElementById("sa-prev-page").addEventListener("click", () => {
      if (detailPage > 1) loadDetailReviews(editingId, detailPage - 1);
    });
    document.getElementById("sa-next-page").addEventListener("click", () => {
      loadDetailReviews(editingId, detailPage + 1);
    });

    document.getElementById("cancel-edit-btn").addEventListener("click", () => {
      editingId = null;
      editCard.classList.add("hidden");
    });

    document.getElementById("save-edit-btn").addEventListener("click", async () => {
      const messageEl = document.getElementById("edit-message");
      messageEl.classList.add("hidden");

      const body = {
        name: document.getElementById("edit-name").value.trim(),
        googlePlaceId: document.getElementById("edit-place-id").value.trim(),
        discountPercent: Number(document.getElementById("edit-percent").value),
        discountValidDays: Number(document.getElementById("edit-valid-days").value),
        highRatingThreshold: Number(document.getElementById("edit-threshold").value),
        ownerEmail: document.getElementById("edit-owner-email").value.trim(),
        logoUrl: document.getElementById("edit-logo-url").value.trim(),
        accentColor: document.getElementById("edit-accent-color").value,
      };
      const newPassword = document.getElementById("edit-password").value;
      if (newPassword) body.password = newPassword;

      try {
        const res = await authedFetch(`/api/superadmin/restaurants/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();

        if (!res.ok) {
          messageEl.textContent = data.error || "Kunde inte spara.";
          messageEl.classList.remove("hidden");
          return;
        }

        editCard.classList.add("hidden");
        loadRestaurants();
      } catch (err) {
        messageEl.textContent = "Kunde inte nå servern, försök igen.";
        messageEl.classList.remove("hidden");
      }
    });

    document.getElementById("send-report-btn").addEventListener("click", async () => {
      if (!editingId) return;
      const messageEl = document.getElementById("edit-message");
      messageEl.classList.add("hidden");

      try {
        const res = await authedFetch(`/api/superadmin/restaurants/${editingId}/send-report`, {
          method: "POST",
        });
        const data = await res.json();

        messageEl.textContent = res.ok ? "Rapporten skickades." : data.error || "Kunde inte skicka rapporten.";
        messageEl.classList.remove("hidden");
      } catch (err) {
        messageEl.textContent = "Kunde inte nå servern, försök igen.";
        messageEl.classList.remove("hidden");
      }
    });

    document.getElementById("delete-btn").addEventListener("click", async () => {
      if (!editingId) return;
      if (!window.confirm("Ta bort restaurangen? Detta går inte att ångra.")) return;

      try {
        await authedFetch(`/api/superadmin/restaurants/${editingId}`, { method: "DELETE" });
        editCard.classList.add("hidden");
        loadRestaurants();
      } catch (err) {
        // authedFetch hanterar redan 401, andra fel visas inte separat här -
        // en misslyckad borttagning gör bara att raden lever kvar i listan.
      }
    });

    document.getElementById("create-btn").addEventListener("click", async () => {
      const messageEl = document.getElementById("create-message");
      messageEl.classList.add("hidden");

      const body = {
        slug: document.getElementById("new-slug").value.trim(),
        name: document.getElementById("new-name").value.trim(),
        googlePlaceId: document.getElementById("new-place-id").value.trim(),
        password: document.getElementById("new-password").value,
        discountPercent: Number(document.getElementById("new-percent").value),
        discountValidDays: Number(document.getElementById("new-valid-days").value),
        highRatingThreshold: Number(document.getElementById("new-threshold").value),
        ownerEmail: document.getElementById("new-owner-email").value.trim(),
        logoUrl: document.getElementById("new-logo-url").value.trim(),
        accentColor: document.getElementById("new-accent-color").value,
      };

      try {
        const res = await authedFetch("/api/superadmin/restaurants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();

        if (!res.ok) {
          messageEl.textContent = data.error || "Kunde inte skapa restaurangen.";
          messageEl.classList.remove("hidden");
          return;
        }

        messageEl.textContent = `Restaurangen "${data.name}" skapades.`;
        messageEl.classList.remove("hidden");
        ["new-slug", "new-name", "new-place-id", "new-password", "new-owner-email", "new-logo-url"].forEach((id) => {
          document.getElementById(id).value = "";
        });
        loadRestaurants();
      } catch (err) {
        messageEl.textContent = "Kunde inte nå servern, försök igen.";
        messageEl.classList.remove("hidden");
      }
    });

    loadRestaurants();
  }
})();
