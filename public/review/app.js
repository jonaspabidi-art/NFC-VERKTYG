(function () {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("r");

  const loadingEl = document.getElementById("loading");
  const notFoundEl = document.getElementById("not-found");
  const formEl = document.getElementById("review-form");
  const resultHighEl = document.getElementById("result-high");
  const resultThanksEl = document.getElementById("result-thanks");

  function show(el) {
    [loadingEl, notFoundEl, formEl, resultHighEl, resultThanksEl].forEach((e) => e.classList.add("hidden"));
    el.classList.remove("hidden");
  }

  if (!slug) {
    show(notFoundEl);
    return;
  }

  const starsContainer = document.getElementById("stars");
  const stars = document.querySelectorAll("#stars .star");
  const formError = document.getElementById("form-error");
  let currentReviewId = null;

  const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

  function applyBranding(restaurant) {
    if (restaurant.logoUrl) {
      const logo = document.getElementById("restaurant-logo");
      logo.addEventListener("error", () => logo.classList.add("hidden"));
      logo.src = restaurant.logoUrl;
      logo.classList.remove("hidden");
    }

    if (restaurant.accentColor && HEX_COLOR_PATTERN.test(restaurant.accentColor)) {
      const root = document.documentElement.style;
      root.setProperty("--gold", restaurant.accentColor);
      const r = parseInt(restaurant.accentColor.slice(1, 3), 16);
      const g = parseInt(restaurant.accentColor.slice(3, 5), 16);
      const b = parseInt(restaurant.accentColor.slice(5, 7), 16);
      root.setProperty("--gold-soft", `rgba(${r}, ${g}, ${b}, 0.15)`);
    }
  }

  fetch(`/api/restaurants/${encodeURIComponent(slug)}`)
    .then((res) => {
      if (!res.ok) throw new Error("not-found");
      return res.json();
    })
    .then((restaurant) => {
      document.getElementById("restaurant-name").textContent = restaurant.name;
      applyBranding(restaurant);
      show(formEl);
    })
    .catch(() => {
      show(notFoundEl);
    });

  stars.forEach((star) => {
    star.addEventListener("click", () => submitRating(Number(star.dataset.value)));
  });

  async function submitRating(rating) {
    stars.forEach((s) => s.classList.toggle("active", Number(s.dataset.value) <= rating));
    starsContainer.classList.add("disabled");
    formError.classList.add("hidden");

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantSlug: slug,
          rating,
          website: document.getElementById("website").value,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        formError.textContent = data.error || "Något gick fel, försök igen.";
        formError.classList.remove("hidden");
        starsContainer.classList.remove("disabled");
        return;
      }

      currentReviewId = data.reviewId;

      if (data.status === "high_rating") {
        document.getElementById("discount-percent").textContent = `${data.discountPercent}% rabatt`;
        document.getElementById("discount-code").textContent = data.discountCode;
        const validUntil = new Date(data.discountValidUntil);
        document.getElementById("discount-valid").textContent =
          "Giltig till " + validUntil.toLocaleDateString("sv-SE");

        const googleLink = document.getElementById("google-link");
        googleLink.href = data.googleReviewUrl;
        googleLink.addEventListener("click", () => {
          fetch(`/api/reviews/${data.reviewId}/google-click`, { method: "POST" }).catch(() => {});
        });

        show(resultHighEl);
      } else {
        document.getElementById("thanks-message").textContent = data.message || "Tack för din feedback!";
        show(resultThanksEl);
      }
    } catch (err) {
      formError.textContent = "Kunde inte nå servern, försök igen.";
      formError.classList.remove("hidden");
      starsContainer.classList.remove("disabled");
    }
  }

  function wireCommentFollowup(textareaId, buttonId, messageId) {
    const textarea = document.getElementById(textareaId);
    const button = document.getElementById(buttonId);
    const message = document.getElementById(messageId);

    button.addEventListener("click", async () => {
      const comment = textarea.value.trim();
      if (!comment || !currentReviewId) return;

      message.classList.add("hidden");
      button.disabled = true;

      try {
        const res = await fetch(`/api/reviews/${currentReviewId}/comment`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment }),
        });
        const data = await res.json();

        message.textContent = res.ok ? "Tack, kommentaren sparades!" : data.error || "Kunde inte spara kommentaren.";
        message.classList.remove("hidden");
        if (res.ok) {
          textarea.disabled = true;
          button.disabled = true;
        } else {
          button.disabled = false;
        }
      } catch (err) {
        message.textContent = "Kunde inte nå servern, försök igen.";
        message.classList.remove("hidden");
        button.disabled = false;
      }
    });
  }

  wireCommentFollowup("comment-high", "save-comment-high", "comment-message-high");
  wireCommentFollowup("comment-thanks", "save-comment-thanks", "comment-message-thanks");

  document.getElementById("save-contact").addEventListener("click", async () => {
    const emailInput = document.getElementById("contact-email");
    const phoneInput = document.getElementById("contact-phone");
    const button = document.getElementById("save-contact");
    const message = document.getElementById("contact-message");

    const email = emailInput.value.trim();
    const phone = phoneInput.value.trim();
    if (!email && !phone) return;

    message.classList.add("hidden");
    button.disabled = true;

    try {
      const res = await fetch(`/api/reviews/${currentReviewId}/contact`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone }),
      });
      const data = await res.json();

      message.textContent = res.ok ? "Tack, vi hör av oss!" : data.error || "Kunde inte spara uppgifterna.";
      message.classList.remove("hidden");
      if (res.ok) {
        emailInput.disabled = true;
        phoneInput.disabled = true;
      } else {
        button.disabled = false;
      }
    } catch (err) {
      message.textContent = "Kunde inte nå servern, försök igen.";
      message.classList.remove("hidden");
      button.disabled = false;
    }
  });
})();
