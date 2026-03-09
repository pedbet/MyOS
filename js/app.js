/* ============================================================
   app.js - Main app controller and router
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

    // Remote-first startup: pull from Supabase before first render.
    await syncAll({ forcePull: true });
    App.navigate('today');

    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        App.navigate(btn.dataset.section);
      });
    });

    document.getElementById('content').addEventListener('click', (e) => {
      const nav = e.target.closest('[data-nav]');
      if (nav) {
        e.preventDefault();
        App.navigate(nav.dataset.nav);
      }
    });

    // Keep local cache warm when app regains focus.
    window.addEventListener('focus', () => syncAll({ forcePull: true }));
  },

  navigate(section) {
    if (!SECTIONS[section]) return;

    const content = document.getElementById('content');
    if (content._cleanup) {
      content._cleanup();
      content._cleanup = null;
    }

    App.currentSection = section;

    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.section === section);
    });

    document.getElementById('topbar-title').textContent = SECTIONS[section].title;
    content.scrollTop = 0;
    SECTIONS[section].render();
  },

  refresh() {
    App.navigate(App.currentSection);
  }
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  });
}

App.init();
