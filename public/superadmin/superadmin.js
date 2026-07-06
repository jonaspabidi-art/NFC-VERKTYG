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
      document.getElementById("edit-message").classList.add("hidden");
      editCard.classList.remove("hidden");
      editCard.scrollIntoView({ behavior: "smooth" });
    }

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
        ["new-slug", "new-name", "new-place-id", "new-password"].forEach((id) => {
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
