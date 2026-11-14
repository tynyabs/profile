import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  setDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  query,
  orderBy,
  limit,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const OWNER_EMAIL = 'tinotendanyabereka@gmail.com';
const CLICK_EVENTS_COLLECTION = 'click_events';

const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write'
};

let app = null;
let auth = null;
let db = null;
let currentUser = null;
let analyticsUnsubscribe = null;
let cachedEvents = [];
let activeCategory = 'all';
let showOnPageBadges = false;
let ignoreOwnerClicks = true;

function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid ?? null,
      email: auth?.currentUser?.email ?? null,
      emailVerified: auth?.currentUser?.emailVerified ?? null,
      isAnonymous: auth?.currentUser?.isAnonymous ?? null,
      tenantId: auth?.currentUser?.tenantId ?? null,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email
        })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function isOwnerUser(user) {
  return Boolean(user && user.emailVerified && user.email === OWNER_EMAIL);
}

async function initFirebase() {
  try {
    const res = await fetch('./firebase-applet-config.json');
    if (!res.ok) throw new Error('Failed to load firebase-applet-config.json');
    const firebaseConfig = await res.json();

    app = initializeApp(firebaseConfig);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    auth = getAuth(app);

    await testConnection();

    onAuthStateChanged(auth, (user) => {
      currentUser = user;
      updateAnalyticsAuthUI();
    });
  } catch (err) {
    console.error('Firebase initialization error:', err);
  }
}

async function testConnection() {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

function generateEventId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `evt_${Date.now()}_${random}`;
}

async function recordClickEvent(targetId, label, category) {
  if (!db) return;
  if (ignoreOwnerClicks && isOwnerUser(currentUser)) return;

  const safeId = String(targetId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const safeLabel = String(label || safeId).trim().slice(0, 120);
  const allowedCategories = ['hero', 'nav', 'service', 'stack', 'project', 'social', 'contact', 'ui'];
  const safeCategory = allowedCategories.includes(category) ? category : 'ui';

  if (!safeId || !safeLabel) return;

  const eventId = generateEventId();
  const path = `${CLICK_EVENTS_COLLECTION}/${eventId}`;
  try {
    await setDoc(doc(db, CLICK_EVENTS_COLLECTION, eventId), {
      targetId: safeId,
      label: safeLabel,
      category: safeCategory,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.CREATE, path);
    } catch {
      // Do not block visitor navigation/actions if tracking fails
    }
  }
}

/* ---------- Mobile Navigation ---------- */

const menuIcon = document.getElementById('menu-icon');
const navLinks = document.querySelector('.nav-links');
const themeToggle = document.getElementById('theme-toggle');
const scrollProgress = document.getElementById('scroll-progress');
const backToTop = document.getElementById('back-to-top');

function setMenu(open) {
  if (!navLinks || !menuIcon) return;
  navLinks.classList.toggle('active', open);
  menuIcon.classList.toggle('fa-bars', !open);
  menuIcon.classList.toggle('fa-xmark', open);
  menuIcon.setAttribute('aria-expanded', String(open));
}

if (menuIcon && navLinks) {
  menuIcon.addEventListener('click', () => {
    setMenu(!navLinks.classList.contains('active'));
  });

  menuIcon.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setMenu(!navLinks.classList.contains('active'));
    }
  });

  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setMenu(false));
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('header')) setMenu(false);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) setMenu(false);
  });
}

/* ---------- Dark / Light Theme ---------- */

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (!themeToggle) return;
  const icon = themeToggle.querySelector('i');
  if (icon) {
    icon.classList.toggle('fa-moon', theme !== 'dark');
    icon.classList.toggle('fa-sun', theme === 'dark');
  }
  themeToggle.setAttribute(
    'aria-label',
    theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
  );
}

const savedTheme = localStorage.getItem('portfolio-theme');
if (savedTheme === 'dark' || savedTheme === 'light') {
  applyTheme(savedTheme);
} else {
  applyTheme('light');
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('portfolio-theme', next);
  });
}

/* ---------- Scroll Progress, Scroll-Spy & Back to Top ---------- */

const sections = Array.from(document.querySelectorAll('main section[id]'));
const navItems = Array.from(document.querySelectorAll('.nav-links a[data-section]'));

function updateScrollUI() {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;

  if (scrollProgress && docHeight > 0) {
    const pct = Math.min(100, Math.max(0, (scrollTop / docHeight) * 100));
    scrollProgress.style.width = `${pct}%`;
  }

  if (backToTop) {
    backToTop.classList.toggle('visible', scrollTop > 400);
  }

  let currentId = sections[0]?.id || 'home';
  const offset = scrollTop + window.innerHeight * 0.35;
  for (const section of sections) {
    if (offset >= section.offsetTop) {
      currentId = section.id;
    }
  }

  navItems.forEach((link) => {
    link.classList.toggle('active-link', link.dataset.section === currentId);
  });
}

window.addEventListener('scroll', updateScrollUI, { passive: true });
updateScrollUI();

if (backToTop) {
  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ---------- Scroll Reveal ---------- */

const revealElements = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -30px 0px' }
  );

  revealElements.forEach((el) => observer.observe(el));
} else {
  revealElements.forEach((el) => el.classList.add('is-visible'));
}

/* ---------- Project Case-Study Modal ---------- */

const PROJECTS = {
  pos: {
    tag: 'JavaFX · SQLite · Cloud Sync',
    title: 'Offline-First Desktop POS',
    image: 'project1.png',
    alt: 'Desktop Offline-First POS Machine',
    description:
      'A point-of-sale desktop application built for uninterrupted retail operations even during power or network outages, pairing a responsive JavaFX UI with resilient local persistence and automated cloud synchronization.',
    highlights: [
      'Power-safe local transactional storage ensuring zero lost sales during outages.',
      'Background sync engine that reconciles queued receipts and inventory updates once connectivity returns.',
      'Structured keyboard-friendly JavaFX cashier workflows designed for fast checkout.'
    ],
    links: [
      { label: 'GitHub Profile', href: 'https://github.com/tynyabs', icon: 'fa-brands fa-github' }
    ]
  },
  pharmacy: {
    tag: 'HTML5 · CSS3 · Responsive UI',
    title: 'Responsive Web Design — No. 1 Pharmacy',
    image: 'project2.png',
    alt: 'No. 1 Pharmacy Website',
    description:
      'Modern, accessible web presence engineered for fast page loads, clear service discovery, and fluid responsiveness across mobile, tablet, and desktop screens.',
    highlights: [
      'Semantic HTML5 and clean CSS layout optimized for mobile-first browsing.',
      'Clear information architecture highlighting pharmacy branches, services, and contact details.',
      'Lightweight asset footprint for reliable performance on varying network speeds.'
    ],
    links: [
      { label: 'Visit No. 1 Pharmacy', href: 'https://no1pharmacy.co.zw/about', icon: 'fa-solid fa-arrow-up-right-from-square' }
    ]
  },
  azure: {
    tag: 'Microsoft Azure · NSG · TLS',
    title: 'Azure Cloud Management',
    image: 'project3.png',
    alt: 'Azure Cloud Infrastructure Management',
    description:
      'End-to-end cloud infrastructure setup and operations on Microsoft Azure covering virtual machine orchestration, strict network security boundaries, and automated encrypted traffic delivery.',
    highlights: [
      'Multi-environment VM provisioning with repeatable configuration and monitoring.',
      'Network Security Group (NSG) and host firewall hardening enforcing least-privilege access.',
      'Automated Nginx reverse-proxy routing and SSL/TLS certificate renewal pipelines.'
    ],
    links: [
      { label: 'GitHub Profile', href: 'https://github.com/tynyabs', icon: 'fa-brands fa-github' }
    ]
  }
};

const modal = document.getElementById('project-modal');
const modalBackdrop = document.getElementById('modal-backdrop');
const modalClose = document.getElementById('modal-close');
const modalImage = document.getElementById('modal-image');
const modalTag = document.getElementById('modal-tag');
const modalTitle = document.getElementById('modal-title');
const modalDescription = document.getElementById('modal-description');
const modalHighlights = document.getElementById('modal-highlights');
const modalLinks = document.getElementById('modal-links');

function openProjectModal(key) {
  const data = PROJECTS[key];
  if (!data || !modal) return;

  modalImage.src = data.image;
  modalImage.alt = data.alt;
  modalTag.textContent = data.tag;
  modalTitle.textContent = data.title;
  modalDescription.textContent = data.description;

  modalHighlights.innerHTML = '';
  data.highlights.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    modalHighlights.appendChild(li);
  });

  modalLinks.innerHTML = '';
  data.links.forEach((link) => {
    const a = document.createElement('a');
    a.href = link.href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'btn';
    a.innerHTML = `<i class="${link.icon}" aria-hidden="true"></i> ${link.label}`;
    modalLinks.appendChild(a);
  });

  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  if (modalClose) modalClose.focus();
}

function closeProjectModal() {
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = '';
}

document.querySelectorAll('.projects-card').forEach((card) => {
  card.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    const key = card.dataset.project;
    if (key) openProjectModal(key);
  });
});

document.querySelectorAll('.project-detail-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const key = btn.dataset.project;
    if (key) openProjectModal(key);
  });
});

if (modalClose) modalClose.addEventListener('click', closeProjectModal);
if (modalBackdrop) modalBackdrop.addEventListener('click', closeProjectModal);

/* ---------- Global Click Tracking Delegation ---------- */

document.addEventListener('click', (e) => {
  if (e.target.closest('#analytics-modal')) return;
  const tracked = e.target.closest('[data-track-id]');
  if (!tracked) return;

  const { trackId, trackLabel, trackCategory } = tracked.dataset;
  recordClickEvent(trackId, trackLabel, trackCategory);
});

/* ---------- Private Owner-Only Analytics Modal ---------- */

const analyticsModal = document.getElementById('analytics-modal');
const analyticsBackdrop = document.getElementById('analytics-backdrop');
const analyticsClose = document.getElementById('analytics-close');
const analyticsGate = document.getElementById('analytics-gate');
const analyticsGateMessage = document.getElementById('analytics-gate-message');
const analyticsSignInBtn = document.getElementById('analytics-signin-btn');
const analyticsAuthError = document.getElementById('analytics-auth-error');
const analyticsAuthControls = document.getElementById('analytics-auth-controls');
const analyticsDashboard = document.getElementById('analytics-dashboard');
const analyticsSummary = document.getElementById('analytics-summary');
const analyticsObjectsList = document.getElementById('analytics-objects-list');
const analyticsRecentList = document.getElementById('analytics-recent-list');
const analyticsFilters = document.getElementById('analytics-filters');
const toggleOnPageBadges = document.getElementById('toggle-onpage-badges');
const toggleIgnoreOwner = document.getElementById('toggle-ignore-owner');
const analyticsResetBtn = document.getElementById('analytics-reset-btn');
const copyrightTrigger = document.getElementById('copyright-trigger');

function openAnalyticsModal() {
  if (!analyticsModal) return;
  analyticsModal.hidden = false;
  document.body.style.overflow = 'hidden';
  if (analyticsClose) analyticsClose.focus();
}

function closeAnalyticsModal() {
  if (!analyticsModal) return;
  analyticsModal.hidden = true;
  document.body.style.overflow = '';
}

function stopAnalyticsListener() {
  if (analyticsUnsubscribe) {
    analyticsUnsubscribe();
    analyticsUnsubscribe = null;
  }
  cachedEvents = [];
  removeAllOnPageBadges();
}

function removeAllOnPageBadges() {
  document.querySelectorAll('.owner-click-badge').forEach((badge) => badge.remove());
  document.querySelectorAll('.owner-track-host').forEach((el) => el.classList.remove('owner-track-host'));
}

function renderOnPageBadges(countsByTargetId) {
  removeAllOnPageBadges();
  if (!showOnPageBadges || !isOwnerUser(currentUser)) return;

  document.querySelectorAll('[data-track-id]').forEach((el) => {
    const id = el.dataset.trackId;
    const count = countsByTargetId.get(id)?.count ?? 0;
    const style = window.getComputedStyle(el);
    if (style.position === 'static') {
      el.classList.add('owner-track-host');
    }
    const badge = document.createElement('span');
    badge.className = 'owner-click-badge';
    badge.textContent = String(count);
    badge.title = `${el.dataset.trackLabel || id}: ${count} clicks`;
    el.appendChild(badge);
  });
}

function formatTime(ts) {
  if (!ts || typeof ts.toDate !== 'function') return 'Just now';
  return ts.toDate().toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function renderAnalyticsDashboard() {
  if (!analyticsSummary || !analyticsObjectsList || !analyticsRecentList) return;

  const countsMap = new Map();
  document.querySelectorAll('[data-track-id]').forEach((el) => {
    const id = el.dataset.trackId;
    if (!countsMap.has(id)) {
      countsMap.set(id, {
        targetId: id,
        label: el.dataset.trackLabel || id,
        category: el.dataset.trackCategory || 'ui',
        count: 0
      });
    }
  });

  for (const evt of cachedEvents) {
    const existing = countsMap.get(evt.targetId);
    if (existing) {
      existing.count += 1;
    } else {
      countsMap.set(evt.targetId, {
        targetId: evt.targetId,
        label: evt.label || evt.targetId,
        category: evt.category || 'ui',
        count: 1
      });
    }
  }

  renderOnPageBadges(countsMap);

  const allEntries = Array.from(countsMap.values()).sort((a, b) => b.count - a.count);
  const topEntry = allEntries.find((item) => item.count > 0);
  const activeObjectsCount = allEntries.filter((item) => item.count > 0).length;

  analyticsSummary.innerHTML = '';
  const summaryStats = [
    { title: 'Total Clicks', value: String(cachedEvents.length) },
    { title: 'Clicked Objects', value: `${activeObjectsCount} / ${allEntries.length}` },
    {
      title: 'Top Object',
      value: topEntry ? `${topEntry.label} (${topEntry.count})` : 'No clicks yet'
    }
  ];
  summaryStats.forEach((stat) => {
    const card = document.createElement('div');
    card.className = 'analytics-stat';
    const labelEl = document.createElement('span');
    labelEl.textContent = stat.title;
    const valEl = document.createElement('strong');
    valEl.textContent = stat.value;
    card.append(labelEl, valEl);
    analyticsSummary.appendChild(card);
  });

  const filtered =
    activeCategory === 'all'
      ? allEntries
      : allEntries.filter((item) => item.category === activeCategory);

  const maxCount = Math.max(1, ...filtered.map((i) => i.count));
  analyticsObjectsList.innerHTML = '';

  if (filtered.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'analytics-empty';
    emptyMsg.textContent = 'No tracked objects in this category.';
    analyticsObjectsList.appendChild(emptyMsg);
  } else {
    filtered.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'analytics-row';
      const pct = Math.round((item.count / maxCount) * 100);

      const top = document.createElement('div');
      top.className = 'analytics-row-top';
      const labelSpan = document.createElement('span');
      labelSpan.className = 'analytics-row-label';
      labelSpan.textContent = item.label;
      const countSpan = document.createElement('span');
      countSpan.className = 'analytics-row-count';
      countSpan.textContent = String(item.count);
      top.append(labelSpan, countSpan);

      const track = document.createElement('div');
      track.className = 'analytics-bar-track';
      const fill = document.createElement('div');
      fill.className = 'analytics-bar-fill';
      fill.style.width = `${pct}%`;
      track.appendChild(fill);

      row.append(top, track);
      analyticsObjectsList.appendChild(row);
    });
  }

  analyticsRecentList.innerHTML = '';
  const recentSlice = cachedEvents.slice(0, 25);
  if (recentSlice.length === 0) {
    analyticsRecentList.innerHTML = '<li class="analytics-empty">No visitor clicks recorded yet.</li>';
  } else {
    recentSlice.forEach((evt) => {
      const li = document.createElement('li');
      li.className = 'analytics-recent-item';
      const labelSpan = document.createElement('strong');
      labelSpan.textContent = evt.label || evt.targetId;
      const timeSpan = document.createElement('span');
      timeSpan.textContent = formatTime(evt.createdAt);
      li.appendChild(labelSpan);
      li.appendChild(timeSpan);
      analyticsRecentList.appendChild(li);
    });
  }
}

function startAnalyticsListener() {
  if (!db || !isOwnerUser(currentUser) || analyticsUnsubscribe) return;
  const q = query(
    collection(db, CLICK_EVENTS_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(1000)
  );
  analyticsUnsubscribe = onSnapshot(
    q,
    (snapshot) => {
      cachedEvents = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderAnalyticsDashboard();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, CLICK_EVENTS_COLLECTION);
      } catch (wrapped) {
        if (analyticsAuthError) {
          analyticsAuthError.textContent = 'Permission denied while reading click analytics.';
          analyticsAuthError.hidden = false;
        }
      }
    }
  );
}

function updateAnalyticsAuthUI() {
  if (!analyticsGate || !analyticsDashboard || !analyticsAuthControls) return;

  analyticsAuthControls.innerHTML = '';
  if (analyticsAuthError) analyticsAuthError.hidden = true;

  if (isOwnerUser(currentUser)) {
    analyticsGate.hidden = true;
    analyticsDashboard.hidden = false;

    const emailSpan = document.createElement('span');
    emailSpan.className = 'analytics-user-email';
    emailSpan.textContent = currentUser.email;

    const signOutBtn = document.createElement('button');
    signOutBtn.type = 'button';
    signOutBtn.className = 'analytics-signout-btn';
    signOutBtn.innerHTML = '<i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i> Sign Out';
    signOutBtn.addEventListener('click', async () => {
      stopAnalyticsListener();
      if (auth) await signOut(auth);
    });

    analyticsAuthControls.appendChild(emailSpan);
    analyticsAuthControls.appendChild(signOutBtn);

    startAnalyticsListener();
  } else {
    stopAnalyticsListener();
    analyticsGate.hidden = false;
    analyticsDashboard.hidden = true;

    if (currentUser) {
      analyticsGateMessage.textContent = `Signed in as ${currentUser.email || 'guest'}, which is not authorized. Only the portfolio owner account can view analytics.`;
      const signOutBtn = document.createElement('button');
      signOutBtn.type = 'button';
      signOutBtn.className = 'analytics-signout-btn';
      signOutBtn.textContent = 'Sign Out';
      signOutBtn.addEventListener('click', async () => {
        if (auth) await signOut(auth);
      });
      analyticsAuthControls.appendChild(signOutBtn);
    } else {
      analyticsGateMessage.textContent =
        'Sign in with your owner Google account to view visitor click counts across portfolio objects.';
    }
  }
}

if (analyticsSignInBtn) {
  analyticsSignInBtn.addEventListener('click', async () => {
    if (!auth) return;
    if (analyticsAuthError) analyticsAuthError.hidden = true;
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (error) {
      if (analyticsAuthError) {
        analyticsAuthError.textContent =
          error instanceof Error ? error.message : 'Google sign-in failed.';
        analyticsAuthError.hidden = false;
      }
    }
  });
}

if (analyticsFilters) {
  analyticsFilters.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    activeCategory = btn.dataset.category || 'all';
    analyticsFilters.querySelectorAll('.filter-btn').forEach((b) => {
      b.classList.toggle('active', b === btn);
    });
    renderAnalyticsDashboard();
  });
}

if (toggleOnPageBadges) {
  toggleOnPageBadges.addEventListener('change', () => {
    showOnPageBadges = toggleOnPageBadges.checked;
    renderAnalyticsDashboard();
  });
}

if (toggleIgnoreOwner) {
  toggleIgnoreOwner.addEventListener('change', () => {
    ignoreOwnerClicks = toggleIgnoreOwner.checked;
  });
}

if (analyticsResetBtn) {
  analyticsResetBtn.addEventListener('click', async () => {
    if (!db || !isOwnerUser(currentUser)) return;
    analyticsResetBtn.disabled = true;
    const originalHtml = analyticsResetBtn.innerHTML;
    analyticsResetBtn.textContent = 'Clearing...';

    try {
      const snap = await getDocs(collection(db, CLICK_EVENTS_COLLECTION));
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 450) {
        const batch = writeBatch(db);
        docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.DELETE, CLICK_EVENTS_COLLECTION);
      } catch {
        if (analyticsAuthError) {
          analyticsAuthError.textContent = 'Failed to clear click events.';
          analyticsAuthError.hidden = false;
        }
      }
    } finally {
      analyticsResetBtn.disabled = false;
      analyticsResetBtn.innerHTML = originalHtml;
    }
  });
}

if (analyticsClose) analyticsClose.addEventListener('click', closeAnalyticsModal);
if (analyticsBackdrop) analyticsBackdrop.addEventListener('click', closeAnalyticsModal);

// Discreet owner-only access triggers (never visible in public UI):
// 1. Ctrl+Shift+A / Cmd+Shift+A keyboard shortcut
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (modal && !modal.hidden) closeProjectModal();
    if (analyticsModal && !analyticsModal.hidden) closeAnalyticsModal();
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    if (analyticsModal && !analyticsModal.hidden) {
      closeAnalyticsModal();
    } else {
      openAnalyticsModal();
    }
  }
});

// 2. Triple-click on copyright notice
if (copyrightTrigger) {
  let clickCount = 0;
  let clickTimer = null;
  copyrightTrigger.addEventListener('click', () => {
    clickCount += 1;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      clickCount = 0;
    }, 650);
    if (clickCount >= 3) {
      clickCount = 0;
      openAnalyticsModal();
    }
  });
}

// 3. URL parameter (?analytics=1) or hash (#analytics)
const params = new URLSearchParams(window.location.search);
if (params.has('analytics') || window.location.hash === '#analytics') {
  openAnalyticsModal();
}

/* ---------- Contact Form (Web3Forms + Inline Feedback) ---------- */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form');
  const statusEl = document.getElementById('form-status');
  if (!form) return;

  const submitBtn = form.querySelector('button[type="submit"]');

  function showStatus(type, message) {
    if (!statusEl) return;
    statusEl.className = `form-status ${type}`;
    statusEl.textContent = message;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (statusEl) {
      statusEl.className = 'form-status';
      statusEl.textContent = '';
    }

    const formData = new FormData(form);
    const object = Object.fromEntries(formData);
    const json = JSON.stringify(object);

    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Sending...';
    submitBtn.disabled = true;

    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: json
      });

      const data = await response.json();

      if (response.status === 200) {
        showStatus('success', 'Thanks for reaching out — your message has been sent.');
        form.reset();
      } else {
        showStatus('error', data.message || 'Unable to send message right now. Please try again.');
      }
    } catch (error) {
      console.error(error);
      showStatus('error', 'Network error while sending. Please check your connection and try again.');
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
});

initFirebase();