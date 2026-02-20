/* ============================================================
   app.js — Main app controller and router
   ============================================================ */

const SECTIONS = {
  today:    { title: 'Today',     render: () => TodaySection.render() },
  checkins: { title: 'Check-ins', render: () => CheckinsSection.render() },
  tasks:    { title: 'Tasks',     render: () => TasksSection.render() },
  habits:   { title: 'Habits',    render: () => HabitsSection.render() },
  prayers:  { title: 'Prayers',   render: () => PrayersSection.render() },
  journal:  { title: 'Journal',   render: () => JournalSection.render() },
  settings: { title: 'Settings',  render: () => SettingsSection.render() },
};

const App = {
  currentSection: 'today',

  async init() {
    const authed = await checkAuth();
    if (!authed) return;

    showScreen('main');
    App.navigate('today');

    // Wire up nav
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        App.navigate(btn.dataset.section);
      });
    });

    // Wire up "All →" links in today
    document.getElementById('content').addEventListener('click', (e) => {
      const nav = e.target.closest('[data-nav]');
      if (nav) { e.preventDefault(); App.navigate(nav.dataset.nav); }
    });

    // Start sync
    syncAll();
  },

  navigate(section) {
    if (!SECTIONS[section]) return;

    // Clean up previous section (e.g. remove FAB)
    const content = document.getElementById('content');
    if (content._cleanup) { content._cleanup(); content._cleanup = null; }

    App.currentSection = section;

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.section === section);
    });

    // Update topbar title
    document.getElementById('topbar-title').textContent = SECTIONS[section].title;

    // Render section
    SECTIONS[section].render();
  },

  refresh() {
    App.navigate(App.currentSection);
  }
};

// Service worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  });
}

// Boot
App.init();
