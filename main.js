/* ═══════════════════════════════════════════════════════
   HW8 Portfolio — JavaScript
   Handles:
     1. Book overlay open/close
     2. Keyboard accessibility
     3. Focus management
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── DOM References ───
  const bookBtn     = document.getElementById('book-btn');
  const bookOverlay = document.getElementById('book-overlay');
  const bookSpread  = document.getElementById('book-spread');
  const scene       = document.getElementById('scene');

  // Track the element that opened the book so we can return focus
  let lastFocusedElement = null;


  /* ═══════════════════════════════════════════════════
     1. BOOK OVERLAY — OPEN / CLOSE
     ═══════════════════════════════════════════════════ */

  /**
   * Open the book overlay.
   */
  function openBook() {
    lastFocusedElement = document.activeElement;

    bookOverlay.removeAttribute('hidden');

    // Force reflow so the transition triggers
    void bookOverlay.offsetHeight;

    bookOverlay.classList.add('active');
    bookBtn.setAttribute('aria-expanded', 'true');

    // Move focus into the book spread for screen readers
    bookSpread.setAttribute('tabindex', '-1');
    bookSpread.focus({ preventScroll: true });
  }

  /**
   * Close the book overlay.
   */
  function closeBook() {
    bookOverlay.classList.remove('active');
    bookBtn.setAttribute('aria-expanded', 'false');

    // Wait for the fade-out transition to finish before hiding
    bookOverlay.addEventListener('transitionend', function handler() {
      bookOverlay.removeEventListener('transitionend', handler);
      bookOverlay.setAttribute('hidden', '');
      bookSpread.removeAttribute('tabindex');
    });

    // Return focus to the book button
    if (lastFocusedElement) {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    }
  }

  // Click to open
  bookBtn.addEventListener('click', openBook);

  // Click anywhere on overlay (including the book spread) to close
  bookOverlay.addEventListener('click', closeBook);


  /* ═══════════════════════════════════════════════════
     2. KEYBOARD ACCESSIBILITY
     ═══════════════════════════════════════════════════ */

  // Open book with Enter or Space on the button
  bookBtn.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openBook();
    }
  });

  // Close book with Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && bookOverlay.classList.contains('active')) {
      e.preventDefault();
      closeBook();
    }
  });


  /* ═══════════════════════════════════════════════════
     3. FOCUS TRAP INSIDE BOOK OVERLAY
     ═══════════════════════════════════════════════════ */

  bookOverlay.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') {
      // Keep focus inside the overlay when it's open
      // Since the entire overlay is one clickable area,
      // we simply keep focus on the book spread
      e.preventDefault();
    }
  });

})();
