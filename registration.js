document.addEventListener("DOMContentLoaded", () => {
  const supabaseUrl = "https://gfkqnumndbddqqwtkzrb.supabase.co";
  const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdma3FudW1uZGJkZHFxd3RrenJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0ODcwNTMsImV4cCI6MjA4NTA2MzA1M30.OxJtvZKMTnLIqRrOcotWqPVDn32QpQ1DzQ_6-PtZ9OI";
  const tableName = "attendees";
  const duplicateCode = "DUPLICATE_ATTENDEE";
  const localUnavailableCode = "LOCAL_API_UNAVAILABLE";
  const isHostedSite = /(^|\.)github\.io$/i.test(window.location.hostname)
    || /(^|\.)github\.com$/i.test(window.location.hostname);
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
    const hostCandidates = [
      isLikelyLocalHost(hostname) ? hostname : null,
      "127.0.0.1",
      "localhost"
    ].filter(Boolean);
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

      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      const result = await response.json().catch(() => null);
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
        throw new Error(result?.error || "Submit failed. Please try again.");
      }

      if (!contentType.includes("application/json")) {
        lastUnavailableError = new Error("Unexpected local API response format.");
        continue;
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
      if (error.code === "42501") {
        const policyError = new Error("Supabase policy blocks registration. Enable INSERT policy for attendees.");
        policyError.code = "SUPABASE_POLICY_BLOCKED";
        throw policyError;
      }
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
      if (isHostedSite) {
        await submitToSupabase(supabasePayload, firstName, lastName);
      } else {
        await submitToLocalApi(localPayload);
      }

      closeModal();
      showToast("Submitted successfully.");
      registerForm.reset();
    } catch (error) {
      if (error?.code === duplicateCode) {
        showToast("already registered.");
        return;
      }
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
