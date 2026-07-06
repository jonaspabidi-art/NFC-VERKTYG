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

  let selectedRating = 0;
  const stars = document.querySelectorAll("#stars .star");
  const submitBtn = document.getElementById("submit-btn");
  const formError = document.getElementById("form-error");

  stars.forEach((star) => {
    star.addEventListener("click", () => {
      selectedRating = Number(star.dataset.value);
      stars.forEach((s) => s.classList.toggle("active", Number(s.dataset.value) <= selectedRating));
      submitBtn.disabled = false;
    });
  });

  fetch(`/api/restaurants/${encodeURIComponent(slug)}`)
    .then((res) => {
      if (!res.ok) throw new Error("not-found");
      return res.json();
    })
    .then((restaurant) => {
      document.getElementById("restaurant-name").textContent = restaurant.name;
      show(formEl);
    })
    .catch(() => {
      show(notFoundEl);
    });

  submitBtn.addEventListener("click", async () => {
    if (selectedRating < 1) return;

    formError.classList.add("hidden");
    submitBtn.disabled = true;
    submitBtn.textContent = "Skickar...";

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantSlug: slug,
          rating: selectedRating,
          comment: document.getElementById("comment").value,
          website: document.getElementById("website").value,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        formError.textContent = data.error || "Något gick fel, försök igen.";
        formError.classList.remove("hidden");
        submitBtn.disabled = false;
        submitBtn.textContent = "Skicka recension";
        return;
      }

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
        document.getElementById("thanks-message").textContent =
          data.message || "Tack för din feedback!";
        show(resultThanksEl);
      }
    } catch (err) {
      formError.textContent = "Kunde inte nå servern, försök igen.";
      formError.classList.remove("hidden");
      submitBtn.disabled = false;
      submitBtn.textContent = "Skicka recension";
    }
  });
})();
