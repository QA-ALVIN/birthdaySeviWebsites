document.addEventListener("DOMContentLoaded", () => {
  const buttons = Array.from(document.querySelectorAll(".tab-btn"));
  const sections = Array.from(document.querySelectorAll(".godparent-section"));
  const photoButtons = Array.from(document.querySelectorAll(".name-btn[data-photo]"));
  const photoModal = document.getElementById("photoModal");
  const photoModalImage = document.getElementById("photoModalImage");
  const photoModalClose = photoModal?.querySelector(".photo-modal-close");

  if (!buttons.length || !sections.length) {
    return;
  }

  const setActive = (targetId, pushHistory = true) => {
    buttons.forEach((button) => {
      const isActive = button.dataset.target === targetId;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    sections.forEach((section) => {
      const isActive = section.dataset.section === targetId;
      section.classList.toggle("is-hidden", !isActive);
    });

    if (pushHistory) {
      const hash = "#godparents";
      if (window.location.hash !== hash) {
        window.history.pushState(null, "", hash);
      }
    }
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      setActive(button.dataset.target);
    });
  });

  const initialHash = window.location.hash.replace("#", "");
  const initialTarget = initialHash === "godmother" ? "godmother" : "godfather";
  setActive(initialTarget, false);

  window.addEventListener("popstate", () => {
    const hash = window.location.hash.replace("#", "");
    const target = hash === "godmother" ? "godmother" : "godfather";
    setActive(target, false);
  });

  if (photoButtons.length && photoModal && photoModalImage && photoModalClose) {
    photoButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const photoSrc = button.dataset.photo || "";
        if (!photoSrc) {
          return;
        }
        photoModalImage.src = photoSrc;
        photoModalImage.alt = `${button.textContent?.trim() || "Photo"} enlarged`;
        photoModal.classList.add("is-open");
        photoModal.setAttribute("aria-hidden", "false");
      });
    });

    const closePhotoModal = () => {
      photoModal.classList.remove("is-open");
      photoModal.setAttribute("aria-hidden", "true");
      photoModalImage.src = "";
      photoModalImage.alt = "";
    };

    photoModalClose.addEventListener("click", closePhotoModal);
    photoModal.addEventListener("click", (event) => {
      if (event.target === photoModal) {
        closePhotoModal();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && photoModal.classList.contains("is-open")) {
        closePhotoModal();
      }
    });
  }
});
