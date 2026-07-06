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
})();
