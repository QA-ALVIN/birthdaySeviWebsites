document.addEventListener("DOMContentLoaded", () => {
  const supabaseUrl = "https://gfkqnumndbddqqwtkzrb.supabase.co";
  const supabaseKey = "sb_publishable_UxSj6m1Fs09le4GhMh7H3g_-nTfCsmi";
  const tableName = "attendees";
  const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const supabaseClient = window.supabase
    ? window.supabase.createClient(supabaseUrl, supabaseKey)
    : null;
  const registerBtn = document.getElementById("btnhompage");
  const registerModal = document.getElementById("registerModal");
  const closeBtn = registerModal?.querySelector(".modal-close");
  const registerForm = registerModal?.querySelector(".modal-form");
  const toast = document.getElementById("toast");
  let toastTimer;

  if (!registerBtn || !registerModal || !closeBtn || !registerForm || !toast) {
    return;
  }

  const openModal = () => {
    registerModal.classList.add("is-open");
    registerModal.setAttribute("aria-hidden", "false");
  };

  const closeModal = () => {
    registerModal.classList.remove("is-open");
    registerModal.setAttribute("aria-hidden", "true");
  };

  const showToast = (message) => {
    toast.textContent = message;
    toast.classList.add("is-visible");
    toast.setAttribute("aria-hidden", "false");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("is-visible");
      toast.setAttribute("aria-hidden", "true");
    }, 2200);
  };

  registerBtn.addEventListener("click", (event) => {
    event.preventDefault();
    openModal();
  });

  closeBtn.addEventListener("click", closeModal);

  registerModal.addEventListener("click", (event) => {
    if (event.target === registerModal) {
      closeModal();
    }
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(registerForm);
    const normalizeName = (value) => (value || "")
      .trim()
      .replace(/\s+/g, " ");

    const firstName = normalizeName(formData.get("firstName"));
    const lastName = normalizeName(formData.get("lastName"));
    const middleName = normalizeName(formData.get("middleName"));

    const canAttend = formData.get("attendance") === "can-attend";
    const supabasePayload = {
      "FIRST_NAME": firstName,
      "LAST_NAME": lastName,
      "MIDDLE_NAME": middleName,
      "CAN_ATTEND": canAttend
    };
    const localPayload = {
      firstName,
      lastName,
      middleName,
      canAttend
    };

    try {
      if (isLocalHost) {
        const response = await fetch("/api/attendees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(localPayload)
        });

        const result = await response.json().catch(() => ({}));
        if (response.status === 409) {
          showToast("already registered.");
          return;
        }
        if (!response.ok) {
          throw new Error(result.error || "Submit failed. Please try again.");
        }
      } else {
        if (!supabaseClient) {
          throw new Error("Supabase SDK not loaded.");
        }

        const { data: existingRows, count, error: existsError } = await supabaseClient
          .from(tableName)
          .select("PK_ATTENDEES", { count: "exact" })
          .ilike("FIRST_NAME", firstName)
          .ilike("LAST_NAME", lastName)
          .limit(1);

        if (existsError) {
          console.warn("Duplicate check failed:", existsError);
        } else {
          const exists = (typeof count === "number" ? count : (existingRows?.length || 0)) > 0;
          if (exists) {
            showToast("already registered.");
            return;
          }
        }

        const { error } = await supabaseClient
          .from(tableName)
          .insert(supabasePayload);

        if (error) {
          if (error.code === "23505") {
            showToast("User already registered.");
            return;
          }
          throw new Error(error.message);
        }
      }

      closeModal();
      showToast("Submitted successfully.");
      registerForm.reset();
    } catch (error) {
      console.error(error);
      showToast(error.message || "Submit failed. Please try again.");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && registerModal.classList.contains("is-open")) {
      closeModal();
    }
  });
});
