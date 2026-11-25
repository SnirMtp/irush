/* =========================================================
   SmarTicket – Scrollytelling
   GSAP + ScrollTrigger, rAF-synced video scrubbing
   ========================================================= */
(() => {
  'use strict';

  // Set to your CRM / form endpoint (POST JSON). Empty = demo mode (simulated success).
  const FORM_ENDPOINT = '';

  const root = document.documentElement;
  root.classList.add('js');

  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width: 767px)').matches;
  const isHttp = location.protocol.startsWith('http');
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---------------------------------------------------------
     Video scrubber
     - Fetches the file as a Blob (when served over http) so the whole
       clip sits in memory → instant seeks forwards and backwards.
     - Never queues a new seek while the previous one is in flight
       (the #1 cause of stutter), and eases currentTime towards the
       scroll target on GSAP's ticker (a single rAF loop).
     --------------------------------------------------------- */
  class VideoScrubber {
    constructor(scene) {
      this.scene = scene;
      this.video = $('.scene__video', scene);
      this.fallback = $('.scene__fallback', scene);
      this.progress = 0;
      this.current = 0;
      this.duration = 0;
      this.ready = false;
      this.failed = false;
      this.loading = null;
      this.objectUrl = null;
    }

    load() {
      if (this.loading) return this.loading;
      const { src, srcMobile } = this.video.dataset;
      const candidates = isMobile && srcMobile ? [srcMobile, src] : [src];
      this.loading = this._tryNext(candidates);
      return this.loading;
    }

    async _tryNext(list) {
      const src = list.shift();
      if (!src) { this._fail(); return false; }

      let url = src;
      if (isHttp && 'fetch' in window) {
        try {
          const res = await fetch(src);
          if (!res.ok) return this._tryNext(list);          // 404 → try next candidate
          const blob = await res.blob();
          this.objectUrl = URL.createObjectURL(blob);
          url = this.objectUrl;
        } catch (_) {
          url = src;                                        // network/CORS issue → stream directly
        }
      }

      const ok = await this._attach(url);
      if (ok) return true;
      if (this.objectUrl) { URL.revokeObjectURL(this.objectUrl); this.objectUrl = null; }
      return this._tryNext(list);
    }

    _attach(url) {
      const v = this.video;
      return new Promise((resolve) => {
        const cleanup = () => {
          v.removeEventListener('loadeddata', onData);
          v.removeEventListener('error', onError);
        };
        const onData = () => {
          cleanup();
          this.duration = Math.max(0, (v.duration || 0) - 0.04);
          this.ready = this.duration > 0;
          if (!this.ready) return resolve(false);
          // iOS Safari only paints seeked frames after the element has "played" once
          const p = v.play();
          if (p && p.then) p.then(() => { v.pause(); this._seek(this.current, true); }).catch(() => {});
          else v.pause();
          this._seek(this.progress * this.duration, true);
          this.scene.classList.add('has-video');
          resolve(true);
        };
        const onError = () => { cleanup(); resolve(false); };
        v.addEventListener('loadeddata', onData);
        v.addEventListener('error', onError);
        v.muted = true;
        v.src = url;
        v.load();
      });
    }

    _fail() {
      this.failed = true;
      this.scene.classList.add('no-video');
    }

    setProgress(p) {
      this.progress = p;
      if (this.fallback) this.fallback.style.setProperty('--p', p.toFixed(4));
    }

    _seek(t, force) {
      const v = this.video;
      if (!force && v.seeking) return;                     // don't stack seeks
      if (Math.abs(v.currentTime - t) < 0.001) return;
      v.currentTime = t;
    }

    tick(dtMs) {
      if (!this.ready) return;
      const target = this.progress * this.duration;
      const diff = target - this.current;
      if (Math.abs(diff) < 0.0008) {
        if (this.current !== target) { this.current = target; this._seek(target); }
        return;
      }
      // frame-rate independent easing (≈0.2 per frame at 60fps)
      const k = 1 - Math.pow(0.8, dtMs / 16.667);
      this.current += diff * k;
      this._seek(this.current);
    }
  }

  const scenes = $$('.scene');
  const scrubbers = scenes.map((s) => new VideoScrubber(s));

  // Load scene 1 right away, then the next ones in sequence (bandwidth goes to what's seen first)
  const loadSequential = async () => {
    for (const s of scrubbers) {
      try { await s.load(); } catch (_) { /* keep going */ }
    }
  };

  /* ---------------------------------------------------------
     Header / nav / smooth scroll
     --------------------------------------------------------- */
  const header = $('.site-header');
  const nav = $('#mainNav');
  const navToggle = $('#navToggle');

  const onScrollHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
  window.addEventListener('scroll', onScrollHeader, { passive: true });
  onScrollHeader();

  const closeNav = () => {
    nav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'פתיחת תפריט');
  };
  navToggle.addEventListener('click', () => {
    const open = !nav.classList.contains('is-open');
    nav.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'סגירת תפריט' : 'פתיחת תפריט');
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNav(); });

  const scrollToTarget = (el) => {
    const headerH = header.offsetHeight;
    const top = el.getBoundingClientRect().top + window.scrollY - headerH - 8;
    window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion ? 'auto' : 'smooth' });
  };
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = $(id);
      if (!target) return;
      e.preventDefault();
      closeNav();
      if (id === '#top') window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
      else scrollToTarget(target);
      if (id === '#contact') setTimeout(() => $('#f-name')?.focus({ preventScroll: true }), 900);
    });
  });

  /* ---------------------------------------------------------
     Clients ticker – duplicate items for a seamless loop
     --------------------------------------------------------- */
  const track = $('.ticker__track');
  if (track) {
    $$('li', track).forEach((li) => {
      const clone = li.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    });
  }

  /* ---------------------------------------------------------
     Industry cards – cursor spotlight
     --------------------------------------------------------- */
  $$('.industry-card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });

  /* ---------------------------------------------------------
     Counters
     --------------------------------------------------------- */
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const counters = $$('.counter');
  const setFinal = () => counters.forEach((c) => { c.textContent = fmt(+c.dataset.target); });

  /* ---------------------------------------------------------
     Contact form
     --------------------------------------------------------- */
  const form = $('#contactForm');
  const messages = {
    fullName: 'נא להזין שם מלא',
    organization: 'נא להזין את שם הארגון',
    phone: 'נא להזין מספר טלפון תקין',
    email: 'נא להזין כתובת אימייל תקינה',
    sector: 'נא לבחור ענף',
    consent: 'יש לאשר את מדיניות הפרטיות',
  };
  const validators = {
    fullName: (v) => v.trim().length >= 2,
    organization: (v) => v.trim().length >= 2,
    phone: (v) => {
      let d = v.replace(/[^\d+]/g, '');
      if (d.startsWith('+972')) d = '0' + d.slice(4);
      else if (d.startsWith('972')) d = '0' + d.slice(3);
      return /^0(?:[23489]\d{7}|5\d{8}|7\d{8})$/.test(d);
    },
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
    sector: (v) => !!v,
  };

  const validateField = (el) => {
    const field = el.closest('.field');
    const err = $('.field__error', field);
    const ok = el.type === 'checkbox' ? el.checked : validators[el.name](el.value);
    field.classList.toggle('is-invalid', !ok);
    el.setAttribute('aria-invalid', String(!ok));
    err.textContent = ok ? '' : messages[el.name];
    return ok;
  };

  if (form) {
    const inputs = $$('input, select', form);
    inputs.forEach((el) => {
      const evt = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'blur';
      el.addEventListener(evt, () => validateField(el));
      el.addEventListener('input', () => {
        if (el.closest('.field').classList.contains('is-invalid')) validateField(el);
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const results = inputs.map(validateField);
      const firstBad = inputs[results.indexOf(false)];
      if (firstBad) { firstBad.focus(); return; }

      const data = Object.fromEntries(new FormData(form).entries());
      data.consent = true;
      data.source = 'scrollytelling-landing';
      form.classList.add('is-loading');
      try {
        if (FORM_ENDPOINT) {
          const res = await fetch(FORM_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (!res.ok) throw new Error('bad status');
        } else {
          await new Promise((r) => setTimeout(r, 900));
        }
        const success = $('.form-success', form);
        success.hidden = false;
        if (hasGSAP && !reducedMotion) gsap.from(success, { autoAlpha: 0, scale: 0.96, duration: 0.6, ease: 'power3.out' });
        form.reset();
      } catch (_) {
        alert('אירעה שגיאה בשליחה. אפשר להתקשר אלינו ישירות: 072-2720770');
      } finally {
        form.classList.remove('is-loading');
      }
    });
  }

  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------------------------------------------------------
     No GSAP / reduced motion → static, accessible version
     --------------------------------------------------------- */
  if (!hasGSAP || reducedMotion) {
    root.classList.remove('js');
    setFinal();
    scrubbers.forEach((s) => s.setProgress(0.5));
    loadSequential();
    // park each video on a meaningful frame
    const park = () => scrubbers.forEach((s) => {
      if (s.ready) { s.current = s.duration * 0.5; s._seek(s.current, true); }
    });
    setTimeout(park, 1500);
    window.addEventListener('load', park);
    return;
  }

  /* =========================================================
     GSAP STORY
     ========================================================= */
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  // single rAF loop for all scrubbers, synced with GSAP rendering
  gsap.ticker.add((time, deltaTime) => {
    for (const s of scrubbers) if (s.active || s.settling) s.tick(deltaTime);
  });
  gsap.ticker.lagSmoothing(500, 33);

  const PIN_LENGTH = { chaos: '+=220%', transition: '+=320%', solution: '+=220%' };

  const makeSceneTrigger = (scene, scrubber, timeline) => ScrollTrigger.create({
    trigger: scene,
    start: 'top top',
    end: PIN_LENGTH[scene.dataset.scene],
    pin: true,
    pinSpacing: true,
    anticipatePin: 1,
    scrub: 0.6,
    animation: timeline,
    invalidateOnRefresh: true,
    onUpdate: (self) => scrubber.setProgress(self.progress),
    onToggle: (self) => {
      scrubber.active = self.isActive;
      if (!self.isActive) {
        // let the eased value reach its edge (0 or 1) after leaving
        scrubber.settling = true;
        gsap.delayedCall(1, () => { scrubber.settling = false; });
      }
    },
  });

  /* ---- Scene 1 – chaos ---- */
  {
    const scene = $('#scene1');
    const content = $('.scene__content', scene);

    // intro on load
    gsap.timeline({ defaults: { ease: 'power4.out' } })
      .from('.s1-eyebrow', { autoAlpha: 0, y: 20, duration: 0.9 }, 0.2)
      .from('.s1-title', { autoAlpha: 0, y: 50, duration: 1.2 }, 0.3)
      .from('.s1-sub', { autoAlpha: 0, y: 30, duration: 1.1 }, 0.55)
      .from('.scroll-hint', { autoAlpha: 0, duration: 1 }, 1.1);

    const tl = gsap.timeline({ defaults: { ease: 'none' } })
      .to('.scroll-hint', { autoAlpha: 0, duration: 0.08 }, 0)
      .to(content, { scale: 1.04, duration: 0.6 }, 0)
      .to(content, { autoAlpha: 0, y: -80, scale: 0.94, filter: 'blur(8px)', duration: 0.3, ease: 'power2.in' }, 0.68)
      .to({}, { duration: 0.02 }, 0.98);

    makeSceneTrigger(scene, scrubbers[0], tl);
  }

  /* ---- Scene 2 – bottlenecks ---- */
  {
    const scene = $('#scene2');
    const cards = $$('.pain-card', scene);
    const dots = $$('.scene-progress i', scene);
    const title = $('.s2-title', scene);

    const tl = gsap.timeline({ defaults: { ease: 'none' } });
    tl.fromTo(title, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.06, ease: 'power2.out' }, 0.01);

    cards.forEach((card, i) => {
      const start = 0.06 + i * 0.26;
      const fromX = isMobile ? 0 : (i === 0 ? -60 : i === 2 ? 60 : 0);
      tl.fromTo(card,
        { autoAlpha: 0, y: 140, x: fromX, scale: 0.86, rotateX: -22, transformPerspective: 900 },
        { autoAlpha: 1, y: 0, x: 0, scale: 1, rotateX: 0, duration: 0.14, ease: 'power3.out' },
        start)
        .to(card, { y: -20, duration: 0.22 }, start + 0.14)
        .to(card, { autoAlpha: 0, y: -130, scale: 0.92, duration: 0.14, ease: 'power2.in' }, start + 0.36);
      if (dots[i]) tl.fromTo(dots[i], { '--fill': 0 }, { '--fill': 1, duration: 0.26 }, start);
    });
    tl.to(title, { autoAlpha: 0, y: -20, duration: 0.06 }, 1.0);

    makeSceneTrigger(scene, scrubbers[1], tl);
  }

  /* ---- Scene 3 – solution ---- */
  {
    const scene = $('#scene3');
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      .fromTo('.s3-eyebrow', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.1 }, 0.04)
      .fromTo('.s3-title', { autoAlpha: 0, y: 70, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.2 }, 0.06)
      .fromTo('.s3-sub', { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.16 }, 0.2)
      .fromTo('.s3-cta', { autoAlpha: 0, y: 30, scale: 0.9 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.14 }, 0.3)
      .to({}, { duration: 0.56 }, 0.44); // hold until the pin releases

    makeSceneTrigger(scene, scrubbers[2], tl);
  }

  /* ---- Reveal on scroll ---- */
  ScrollTrigger.batch('.reveal', {
    start: 'top 88%',
    once: true,
    onEnter: (batch) => gsap.to(batch, {
      autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08, overwrite: true,
    }),
  });

  /* ---- Counters ---- */
  counters.forEach((el) => {
    const target = +el.dataset.target;
    const obj = { v: 0 };
    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter: () => gsap.to(obj, {
        v: target,
        duration: target > 1000 ? 2.4 : 1.8,
        ease: 'power3.out',
        onUpdate: () => { el.textContent = fmt(obj.v); },
      }),
    });
  });

  /* ---- Kick off video loading & keep layout in sync ---- */
  loadSequential();

  // iOS: unlock frame painting on the first touch as well
  const unlock = () => {
    scrubbers.forEach((s) => {
      if (!s.ready) return;
      const p = s.video.play();
      if (p && p.then) p.then(() => s.video.pause()).catch(() => {});
    });
  };
  window.addEventListener('touchstart', unlock, { once: true, passive: true });

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
