document.addEventListener("DOMContentLoaded", () => {
  const supabaseUrl = "https://gfkqnumndbddqqwtkzrb.supabase.co";
  const supabaseKey = "sb_publishable_UxSj6m1Fs09le4GhMh7H3g_-nTfCsmi";
  const tableName = "attendees";
  const localUnavailableCode = "LOCAL_API_UNAVAILABLE";
  const duplicateCode = "DUPLICATE_ATTENDEE";
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

  const isPrivateIpv4Host = (hostname) => /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);

  const isLikelyLocalHost = (hostname) => {
    if (!hostname) {
      return false;
    }
    return hostname === "localhost"
      || hostname === "127.0.0.1"
      || hostname === "::1"
      || hostname.endsWith(".local")
      || isPrivateIpv4Host(hostname);
  };

  const getLocalApiEndpoints = () => {
    const endpoints = new Set(["/api/attendees"]);
    const hostname = window.location.hostname;
    const shouldTryDirectHosts = window.location.protocol === "file:" || isLikelyLocalHost(hostname);

    if (!shouldTryDirectHosts) {
      return Array.from(endpoints);
    }

    const hostCandidates = [hostname, "127.0.0.1", "localhost"].filter(Boolean);
    const portCandidates = [window.location.port, "8080", "5050", "5051", "3000", "4000"].filter(Boolean);

    hostCandidates.forEach((host) => {
      portCandidates.forEach((port) => {
        endpoints.add(`http://${host}:${port}/api/attendees`);
      });
    });

    return Array.from(endpoints);
  };

  const submitToLocalApi = async (payload) => {
    let lastUnavailableError = null;
    const endpoints = getLocalApiEndpoints();

    for (const endpoint of endpoints) {
      let response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } catch (error) {
        lastUnavailableError = error;
        continue;
      }

      const result = await response.json().catch(() => ({}));
      if (response.status === 409) {
        const error = new Error("already registered.");
        error.code = duplicateCode;
        throw error;
      }

      if (!response.ok) {
        if (response.status === 404 || response.status === 405) {
          lastUnavailableError = new Error("Local API route not found.");
          continue;
        }
        throw new Error(result.error || "Submit failed. Please try again.");
      }

      return;
    }

    const unavailableError = lastUnavailableError || new Error("Local API unavailable.");
    unavailableError.code = localUnavailableCode;
    throw unavailableError;
  };

  const submitToSupabase = async (payload, firstName, lastName) => {
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
        const duplicateError = new Error("already registered.");
        duplicateError.code = duplicateCode;
        throw duplicateError;
      }
    }

    const { error } = await supabaseClient
      .from(tableName)
      .insert(payload);

    if (error) {
      if (error.code === "23505") {
        const duplicateError = new Error("already registered.");
        duplicateError.code = duplicateCode;
        throw duplicateError;
      }
      throw new Error(error.message);
    }
  };

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
      try {
        await submitToLocalApi(localPayload);
      } catch (localError) {
        if (localError?.code === duplicateCode) {
          showToast("already registered.");
          return;
        }
        if (localError?.code !== localUnavailableCode) {
          throw localError;
        }
        try {
          await submitToSupabase(supabasePayload, firstName, lastName);
        } catch (supabaseError) {
          if (supabaseError?.code === duplicateCode) {
            showToast("already registered.");
            return;
          }
          throw supabaseError;
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
