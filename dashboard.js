document.addEventListener("DOMContentLoaded", () => {
  const supabaseUrl = "https://gfkqnumndbddqqwtkzrb.supabase.co";
  const supabaseKey = "sb_publishable_UxSj6m1Fs09le4GhMh7H3g_-nTfCsmi";
  const tableName = "attendees";
  const localUnavailableCode = "LOCAL_API_UNAVAILABLE";
  const isHostedSite = /(^|\.)github\.io$/i.test(window.location.hostname)
    || /(^|\.)github\.com$/i.test(window.location.hostname);

  const yesTotal = document.getElementById("yesTotal");
  const noTotal = document.getElementById("noTotal");
  const yesBar = document.getElementById("yesBar");
  const noBar = document.getElementById("noBar");
  const yesBarCount = document.getElementById("yesBarCount");
  const noBarCount = document.getElementById("noBarCount");
  const noList = document.getElementById("noList");
  const yesList = document.getElementById("yesList");
  const graph = document.getElementById("graph");
  const statusMessage = document.getElementById("statusMessage");
  const respondentsSection = document.getElementById("respondentsSection");

  if (
    !yesTotal ||
    !noTotal ||
    !yesBar ||
    !noBar ||
    !yesBarCount ||
    !noBarCount ||
    !noList ||
    !yesList ||
    !graph ||
    !statusMessage ||
    !respondentsSection
  ) {
    return;
  }

  const readField = (item, candidates) => {
    for (const key of candidates) {
      if (Object.prototype.hasOwnProperty.call(item || {}, key)) {
        return item[key];
      }
    }

    const loweredEntries = Object.entries(item || {}).map(([key, value]) => [key.toLowerCase(), value]);
    for (const key of candidates) {
      const match = loweredEntries.find(([existingKey]) => existingKey === key.toLowerCase());
      if (match) {
        return match[1];
      }
    }

    return undefined;
  };

  const normalizeAttendee = (item) => {
    const firstName = String(readField(item, ["firstName", "FIRST_NAME", "first_name"]) || "").trim();
    const lastName = String(readField(item, ["lastName", "LAST_NAME", "last_name"]) || "").trim();
    const middleName = String(readField(item, ["middleName", "MIDDLE_NAME", "middle_name"]) || "").trim();
    const rawCanAttend = readField(item, ["canAttend", "CAN_ATTEND", "can_attend"]);
    const canAttend = typeof rawCanAttend === "boolean"
      ? rawCanAttend
      : String(rawCanAttend || "").toLowerCase() === "true" || String(rawCanAttend) === "1";

    return {
      firstName,
      lastName,
      middleName,
      canAttend
    };
  };

  const toFullName = (attendee) => {
    return [attendee.firstName, attendee.middleName, attendee.lastName]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  };

  const renderList = (target, attendees) => {
    target.innerHTML = "";
    if (!attendees.length) {
      const item = document.createElement("li");
      item.textContent = "No respondents yet.";
      target.appendChild(item);
      return;
    }

    attendees.forEach((attendee) => {
      const item = document.createElement("li");
      item.textContent = toFullName(attendee) || "Unnamed attendee";
      target.appendChild(item);
    });
  };

  const renderBars = (yesCount, noCount) => {
    const max = Math.max(yesCount, noCount, 1);
    const maxBarHeight = 170;
    const minBarHeight = 14;
    const yesHeight = Math.max(minBarHeight, Math.round((yesCount / max) * maxBarHeight));
    const noHeight = Math.max(minBarHeight, Math.round((noCount / max) * maxBarHeight));
    yesBar.style.height = `${yesHeight}px`;
    noBar.style.height = `${noHeight}px`;
    yesBarCount.textContent = `${yesCount}`;
    noBarCount.textContent = `${noCount}`;
  };

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

  const loadFromLocalApi = async () => {
    let lastUnavailableError = null;
    const endpoints = getLocalApiEndpoints();

    for (const endpoint of endpoints) {
      let response;
      try {
        response = await fetch(endpoint);
      } catch (error) {
        lastUnavailableError = error;
        continue;
      }

      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 404 || response.status === 405) {
          lastUnavailableError = new Error("Local API route not found.");
          continue;
        }
        throw new Error(payload?.error || "Unable to load attendees.");
      }

      if (!contentType.includes("application/json") || !Array.isArray(payload?.attendees)) {
        lastUnavailableError = new Error("Unexpected local API response format.");
        continue;
      }

      return (payload.attendees || []).map(normalizeAttendee);
    }

    const unavailableError = lastUnavailableError || new Error("Local API unavailable.");
    unavailableError.code = localUnavailableCode;
    throw unavailableError;
  };

  const loadFromSupabase = async () => {
    if (!window.supabase) {
      throw new Error("Supabase SDK not loaded.");
    }

    const client = window.supabase.createClient(supabaseUrl, supabaseKey);
    const queries = [
      () => client.from(tableName).select("FIRST_NAME, LAST_NAME, MIDDLE_NAME, CAN_ATTEND"),
      () => client.from(tableName).select("first_name, last_name, middle_name, can_attend"),
      () => client.from(tableName).select("*")
    ];

    let lastError = null;

    for (const runQuery of queries) {
      const { data, error } = await runQuery();
      if (error) {
        lastError = error;
        continue;
      }

      const normalized = (data || []).map(normalizeAttendee);
      return normalized.sort((a, b) => {
        const byLast = a.lastName.localeCompare(b.lastName, undefined, { sensitivity: "base" });
        if (byLast !== 0) {
          return byLast;
        }
        return a.firstName.localeCompare(b.firstName, undefined, { sensitivity: "base" });
      });
    }

    if (lastError) {
      if (lastError.code === "42501") {
        throw new Error("Supabase read is blocked by policy. Enable SELECT for attendees.");
      }
      throw new Error(lastError.message || "Unable to read attendees from Supabase.");
    }

    return [];
  };

  const setActiveBar = (category) => {
    const bars = graph.querySelectorAll(".bar-wrap");
    bars.forEach((bar) => {
      bar.classList.toggle("is-active", bar.dataset.category === category);
    });
  };

  const setupInteraction = () => {
    graph.addEventListener("click", (event) => {
      const trigger = event.target.closest(".bar-wrap");
      if (!trigger) {
        return;
      }
      setActiveBar(trigger.dataset.category);
      respondentsSection.hidden = false;
    });
  };

  const run = async () => {
    statusMessage.textContent = "Loading dashboard...";
    const loaders = isHostedSite
      ? [
        { label: "local API", fn: loadFromLocalApi },
        { label: "Supabase", fn: loadFromSupabase }
      ]
      : [
        { label: "local API", fn: loadFromLocalApi },
        { label: "Supabase", fn: loadFromSupabase }
      ];

    let attendees = [];
    let sourceLabel = "";
    let lastError = null;

    for (const loader of loaders) {
      try {
        attendees = await loader.fn();
        sourceLabel = loader.label;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!sourceLabel) {
      throw lastError || new Error("Failed to load dashboard.");
    }

    const yesAttendees = attendees.filter((attendee) => attendee.canAttend);
    const noAttendees = attendees.filter((attendee) => !attendee.canAttend);

    yesTotal.textContent = `${yesAttendees.length}`;
    noTotal.textContent = `${noAttendees.length}`;
    renderBars(yesAttendees.length, noAttendees.length);
    renderList(yesList, yesAttendees);
    renderList(noList, noAttendees);
    setupInteraction();
    if (isHostedSite && sourceLabel === "Supabase" && attendees.length === 0) {
      statusMessage.textContent = "Loaded 0 response(s) from Supabase. If records exist, enable SELECT policy for attendees.";
      return;
    }
    statusMessage.textContent = `Loaded ${attendees.length} response(s) from ${sourceLabel}.`;
  };

  run().catch((error) => {
    console.error(error);
    renderBars(0, 0);
    renderList(yesList, []);
    renderList(noList, []);
    statusMessage.textContent = error.message || "Failed to load dashboard.";
  });
});
