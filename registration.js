document.addEventListener("DOMContentLoaded", () => {
  const supabaseUrl = "https://gfkqnumndbddqqwtkzrb.supabase.co";
  const supabaseKey = "sb_publishable_UxSj6m1Fs09le4GhMh7H3g_-nTfCsmi";
  const tableName = "attendees";

  if (!window.supabase) {
    console.error("Supabase SDK not loaded.");
    return;
  }

  const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
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
    const payload = {
      "FIRST_NAME": formData.get("firstName"),
      "LAST_NAME": formData.get("lastName"),
      "MIDDLE_NAME": formData.get("middleName"),
      "CAN_ATTEND": formData.get("attendance") === "can-attend"
    };

    try {
      const { error } = await supabaseClient
        .from(tableName)
        .insert(payload);

      if (error) {
        throw new Error(error.message);
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
