(function () {
  const LANG_KEY = "rr_lang";
  const GOOGLE_BONUS_PERCENT = 10;

  const I18N = {
    sv: {
      pageTitle: "Lämna en recension",
      loading: "Laddar...",
      notfound_title: "Restaurangen hittades inte",
      notfound_body: "Kontrollera länken eller be personalen om hjälp.",
      form_title: "Betygsätt ditt besök",
      form_subtitle: "Tryck på en stjärna",
      honeypot_label: "Lämna detta fält tomt",
      high_title: "Tack för ditt fina betyg!",
      high_body: "Dela gärna din upplevelse på Google - det hjälper oss enormt.",
      google_btn: "Recensera på Google",
      reward_label: "Din belöning",
      reward_suffix: "rabatt vid nästa besök",
      redeem_text: "Visa din recension för personalen i kassan för att få rabatten.",
      bonus_prompt: `Lämna ditt nummer och få <strong>${GOOGLE_BONUS_PERCENT}% extra</strong> rabatt`,
      phone_ph: "Ditt telefonnummer",
      save: "Spara",
      comment_prompt: "Vill du lämna en kommentar? (valfritt)",
      comment_ph: "Skriv här...",
      commentSuccess: "Tack, kommentaren sparades!",
      thanks_title: "Tack för din feedback",
      thanks_body: "Din åsikt hjälper oss att bli bättre.",
      low_comment_prompt: "Berätta gärna vad vi kan förbättra",
      contact_prompt: "Vill du att vi hör av oss?",
      email_ph: "E-post",
      phone_opt_ph: "Telefon (valfritt)",
      send: "Skicka",
      contactSuccess: "Tack, vi hör av oss!",
      phoneSuccessScheduled: "Tack! Vi påminner dig om du inte hunnit dela än.",
      phoneSuccessSms: "Tack! Vi har skickat en bekräftelse på din rabatt via SMS.",
      phoneBonusUnlocked: "Grattis, din rabatt är uppdaterad!",
      genericServerError: "Kunde inte nå servern, försök igen.",
      genericError: "Något gick fel, försök igen.",
    },
    en: {
      pageTitle: "Leave a review",
      loading: "Loading...",
      notfound_title: "Restaurant not found",
      notfound_body: "Check the link or ask staff for help.",
      form_title: "Rate your visit",
      form_subtitle: "Tap a star",
      honeypot_label: "Leave this field empty",
      high_title: "Thanks for your great rating!",
      high_body: "Please share your experience on Google - it helps us enormously.",
      google_btn: "Review on Google",
      reward_label: "Your reward",
      reward_suffix: "discount on your next visit",
      redeem_text: "Show your review to staff at checkout to get the discount.",
      bonus_prompt: `Leave your number to get <strong>${GOOGLE_BONUS_PERCENT}% extra</strong> discount`,
      phone_ph: "Your phone number",
      save: "Save",
      comment_prompt: "Want to leave a comment? (optional)",
      comment_ph: "Write here...",
      commentSuccess: "Thanks, your comment was saved!",
      thanks_title: "Thanks for your feedback",
      thanks_body: "Your opinion helps us improve.",
      low_comment_prompt: "Tell us what could be better",
      contact_prompt: "Want us to reach out?",
      email_ph: "Email",
      phone_opt_ph: "Phone (optional)",
      send: "Send",
      contactSuccess: "Thanks, we'll be in touch!",
      phoneSuccessScheduled: "Thanks! We'll remind you if you haven't shared yet.",
      phoneSuccessSms: "Thanks! We've sent a confirmation of your discount by SMS.",
      phoneBonusUnlocked: "Congrats, your discount has been updated!",
      genericServerError: "Could not reach the server, please try again.",
      genericError: "Something went wrong, please try again.",
    },
  };

  const ERROR_MESSAGES = {
    sv: {
      restaurant_not_found: "Restaurangen hittades inte.",
      server_error: "Något gick fel, försök igen.",
      invalid_rating: "Ogiltigt betyg eller restaurang.",
      already_reviewed: "Du har redan lämnat en recension nyligen. Tack!",
      review_not_found: "Recensionen hittades inte.",
      comment_empty: "Kommentaren kan inte vara tom.",
      contact_required: "Ange e-post eller telefonnummer.",
      invalid_email: "Ogiltig e-postadress.",
      invalid_phone: "Ogiltigt telefonnummer.",
      thanks_low: "Tack för din feedback! Den går direkt till restaurangen.",
      thanks_no_discount: "Tack för din recension!",
    },
    en: {
      restaurant_not_found: "Restaurant not found.",
      server_error: "Something went wrong, please try again.",
      invalid_rating: "Invalid rating or restaurant.",
      already_reviewed: "You've already left a review recently. Thanks!",
      review_not_found: "Review not found.",
      comment_empty: "The comment cannot be empty.",
      contact_required: "Please enter an email or phone number.",
      invalid_email: "Invalid email address.",
      invalid_phone: "Invalid phone number.",
      thanks_low: "Thank you for your feedback! It goes straight to the restaurant.",
      thanks_no_discount: "Thank you for your review!",
    },
  };

  function detectDefaultLang() {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "sv" || saved === "en") return saved;
    return navigator.language && navigator.language.toLowerCase().startsWith("sv") ? "sv" : "en";
  }

  let currentLang = detectDefaultLang();

  function t(key) {
    return (I18N[currentLang] && I18N[currentLang][key]) || I18N.sv[key] || key;
  }

  function resolveMessage(code, fallbackText) {
    if (code && ERROR_MESSAGES[currentLang] && ERROR_MESSAGES[currentLang][code]) {
      return ERROR_MESSAGES[currentLang][code];
    }
    return fallbackText || t("genericError");
  }

  function applyStaticTranslations() {
    document.documentElement.lang = currentLang;
    document.title = t("pageTitle");

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      el.innerHTML = t(el.dataset.i18nHtml);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === currentLang);
    });
  }

  function setLang(lang) {
    currentLang = lang;
    localStorage.setItem(LANG_KEY, lang);
    applyStaticTranslations();
  }

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => setLang(btn.dataset.lang));
  });

  applyStaticTranslations();

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

  function getInitials(name) {
    const words = name.trim().split(/\s+/).filter(Boolean);
    const initials = words.slice(0, 2).map((word) => word[0].toUpperCase());
    return initials.join("") || "?";
  }

  function applyBranding(restaurant) {
    if (restaurant.accentColor && HEX_COLOR_PATTERN.test(restaurant.accentColor)) {
      const root = document.documentElement.style;
      root.setProperty("--gold", restaurant.accentColor);
      const r = parseInt(restaurant.accentColor.slice(1, 3), 16);
      const g = parseInt(restaurant.accentColor.slice(3, 5), 16);
      const b = parseInt(restaurant.accentColor.slice(5, 7), 16);
      root.setProperty("--gold-soft", `rgba(${r}, ${g}, ${b}, 0.15)`);
    }

    const logo = document.getElementById("restaurant-logo");
    const avatar = document.getElementById("restaurant-avatar");

    if (restaurant.logoUrl) {
      logo.addEventListener("error", () => {
        logo.classList.add("hidden");
        avatar.textContent = getInitials(restaurant.name);
        avatar.classList.remove("hidden");
      });
      logo.src = restaurant.logoUrl;
      logo.classList.remove("hidden");
    } else {
      avatar.textContent = getInitials(restaurant.name);
      avatar.classList.remove("hidden");
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

  function renderResultStars(rating) {
    const container = document.getElementById("result-stars");
    container.innerHTML = "";
    for (let i = 1; i <= 5; i++) {
      const span = document.createElement("span");
      span.className = i <= rating ? "star-filled" : "star-empty";
      span.innerHTML = "&#9733;";
      container.appendChild(span);
    }
  }

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
        formError.textContent = resolveMessage(data.code, data.error);
        formError.classList.remove("hidden");
        starsContainer.classList.remove("disabled");
        return;
      }

      currentReviewId = data.reviewId;

      if (data.status === "high_rating") {
        renderResultStars(rating);
        document.getElementById("discount-percent").textContent = data.discountPercent;

        const googleLink = document.getElementById("google-link");
        googleLink.href = data.googleReviewUrl;
        googleLink.addEventListener("click", () => {
          fetch(`/api/reviews/${data.reviewId}/google-click`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lang: currentLang }),
          })
            .then((r) => r.json())
            .then((clickData) => {
              if (clickData.bonusApplied) {
                showBonusUnlocked(clickData.discountPercent);
              }
            })
            .catch(() => {});
        });

        show(resultHighEl);
      } else {
        document.getElementById("thanks-message").textContent = resolveMessage(
          data.messageCode,
          data.message || t("thanks_body")
        );
        show(resultThanksEl);
      }
    } catch (err) {
      formError.textContent = t("genericServerError");
      formError.classList.remove("hidden");
      starsContainer.classList.remove("disabled");
    }
  }

  function showBonusUnlocked(discountPercent) {
    document.getElementById("discount-percent").textContent = discountPercent;
    const phoneMessage = document.getElementById("phone-message");
    phoneMessage.textContent = t("phoneBonusUnlocked");
    phoneMessage.classList.remove("hidden");
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

        message.textContent = res.ok ? t("commentSuccess") : resolveMessage(data.code, data.error);
        message.classList.remove("hidden");
        if (res.ok) {
          textarea.disabled = true;
          button.disabled = true;
        } else {
          button.disabled = false;
        }
      } catch (err) {
        message.textContent = t("genericServerError");
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

      message.textContent = res.ok ? t("contactSuccess") : resolveMessage(data.code, data.error);
      message.classList.remove("hidden");
      if (res.ok) {
        emailInput.disabled = true;
        phoneInput.disabled = true;
      } else {
        button.disabled = false;
      }
    } catch (err) {
      message.textContent = t("genericServerError");
      message.classList.remove("hidden");
      button.disabled = false;
    }
  });

  document.getElementById("save-phone").addEventListener("click", async () => {
    const phoneInput = document.getElementById("bonus-phone");
    const button = document.getElementById("save-phone");
    const message = document.getElementById("phone-message");

    const phone = phoneInput.value.trim();
    if (!phone) return;

    message.classList.add("hidden");
    button.disabled = true;

    try {
      const res = await fetch(`/api/reviews/${currentReviewId}/phone`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, lang: currentLang }),
      });
      const data = await res.json();

      if (!res.ok) {
        message.textContent = resolveMessage(data.code, data.error);
        message.classList.remove("hidden");
        button.disabled = false;
        return;
      }

      phoneInput.disabled = true;
      if (data.bonusApplied) {
        showBonusUnlocked(data.discountPercent);
      } else {
        message.textContent = data.smsSent ? t("phoneSuccessSms") : t("phoneSuccessScheduled");
        message.classList.remove("hidden");
      }
    } catch (err) {
      message.textContent = t("genericServerError");
      message.classList.remove("hidden");
      button.disabled = false;
    }
  });
})();
