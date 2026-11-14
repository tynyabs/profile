const menuIcon = document.getElementById('menu-icon');
const navLinks = document.querySelector('.nav-links');
const themeToggle = document.getElementById('theme-toggle');
const scrollProgress = document.getElementById('scroll-progress');
const backToTop = document.getElementById('back-to-top');

/* ---------- Mobile Navigation ---------- */

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
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal && !modal.hidden) {
    closeProjectModal();
  }
});

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