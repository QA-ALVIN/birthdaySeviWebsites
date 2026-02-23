document.addEventListener("DOMContentLoaded", () => {
  const supabaseUrl = "https://gfkqnumndbddqqwtkzrb.supabase.co";
  const supabaseKey = "sb_publishable_UxSj6m1Fs09le4GhMh7H3g_-nTfCsmi";
  const tableName = "attendees";
  const localUnavailableCode = "LOCAL_API_UNAVAILABLE";

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

  const normalizeAttendee = (item) => ({
    firstName: (item?.firstName || item?.FIRST_NAME || "").trim(),
    lastName: (item?.lastName || item?.LAST_NAME || "").trim(),
    middleName: (item?.middleName || item?.MIDDLE_NAME || "").trim(),
    canAttend:
      typeof item?.canAttend === "boolean"
        ? item.canAttend
        : typeof item?.CAN_ATTEND === "boolean"
          ? item.CAN_ATTEND
          : Boolean(item?.canAttend ?? item?.CAN_ATTEND)
  });

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

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 404 || response.status === 405) {
          lastUnavailableError = new Error("Local API route not found.");
          continue;
        }
        throw new Error(payload.error || "Unable to load attendees.");
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
    const { data, error } = await client
      .from(tableName)
      .select("FIRST_NAME, LAST_NAME, MIDDLE_NAME, CAN_ATTEND")
      .order("LAST_NAME", { ascending: true })
      .order("FIRST_NAME", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map(normalizeAttendee);
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
    let attendees = [];
    let sourceLabel = "local API";

    try {
      attendees = await loadFromLocalApi();
    } catch (localError) {
      if (localError?.code !== localUnavailableCode) {
        throw localError;
      }
      attendees = await loadFromSupabase();
      sourceLabel = "Supabase";
    }

    attendees.sort((a, b) => {
      const byLast = a.lastName.localeCompare(b.lastName, undefined, { sensitivity: "base" });
      if (byLast !== 0) {
        return byLast;
      }
      return a.firstName.localeCompare(b.firstName, undefined, { sensitivity: "base" });
    });

    const yesAttendees = attendees.filter((attendee) => attendee.canAttend);
    const noAttendees = attendees.filter((attendee) => !attendee.canAttend);

    yesTotal.textContent = `${yesAttendees.length}`;
    noTotal.textContent = `${noAttendees.length}`;
    renderBars(yesAttendees.length, noAttendees.length);
    renderList(yesList, yesAttendees);
    renderList(noList, noAttendees);
    setupInteraction();
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
