/* ============================================================
   search.js — Global search
   ============================================================ */

let searchDebounce = null;

document.getElementById('search-btn').addEventListener('click', () => {
  document.getElementById('search-overlay').classList.remove('hidden');
  document.getElementById('search-input').focus();
});

document.getElementById('search-close').addEventListener('click', () => {
  document.getElementById('search-overlay').classList.add('hidden');
  document.getElementById('search-input').value = '';
  document.getElementById('search-results').innerHTML = '';
});

document.getElementById('search-input').addEventListener('input', (e) => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => performSearch(e.target.value.trim()), 200);
});

async function performSearch(query) {
  const resultsEl = document.getElementById('search-results');
  if (!query || query.length < 2) {
    resultsEl.innerHTML = '<div style="color:var(--text3);font-size:14px;text-align:center;padding:40px">Type to search...</div>';
    return;
  }

  const q = query.toLowerCase();
  const results = {};

  const matchText = (...texts) => texts.some(t => t && t.toLowerCase().includes(q));
  const matchLabels = (labels) => (labels || []).some(l => l.toLowerCase().includes(q));

  // Search each domain
  const checkins = (await DB.getLive('checkins')).filter(c => matchText(c.title) || matchLabels(c.labels));
  const tasks = (await DB.getLive('tasks')).filter(t => matchText(t.title, t.notes) || matchLabels(t.labels));
  const habits = (await DB.getLive('habits')).filter(h => matchText(h.title, h.description) || matchLabels(h.labels));
  const prayers = (await DB.getLive('prayers')).filter(p => matchText(p.title, p.text) || matchLabels(p.labels));
  const journal = (await DB.getLive('journal_entries')).filter(j => matchText(j.title, j.body));

  if (checkins.length) results['Check-ins'] = { items: checkins, section: 'checkins', keyFn: c => c.title, metaFn: c => `Every ${c.frequency_value} ${c.frequency_unit}` };
  if (tasks.length) results['Tasks'] = { items: tasks, section: 'tasks', keyFn: t => t.title, metaFn: t => t.status === 'DONE' ? 'Completed' : 'Open' };
  if (habits.length) results['Habits'] = { items: habits, section: 'habits', keyFn: h => h.title, metaFn: h => h.description || '' };
  if (prayers.length) results['Prayers'] = { items: prayers, section: 'prayers', keyFn: p => p.title, metaFn: p => p.text ? p.text.slice(0, 50) + '…' : '' };
  if (journal.length) results['Journal'] = { items: journal, section: 'journal', keyFn: j => j.title || j.date, metaFn: j => j.body ? j.body.slice(0, 60) + '…' : '' };

  if (Object.keys(results).length === 0) {
    resultsEl.innerHTML = `<div style="color:var(--text3);font-size:14px;text-align:center;padding:40px">No results for "${query}"</div>`;
    return;
  }

  resultsEl.innerHTML = '';
  for (const [groupName, { items, section, keyFn, metaFn }] of Object.entries(results)) {
    const groupTitle = el('div', 'search-group-title', groupName);
    resultsEl.appendChild(groupTitle);
    items.slice(0, 5).forEach(item => {
      const si = el('div', 'search-item');
      si.innerHTML = `
        <div class="search-item-title">${highlight(keyFn(item), q)}</div>
        <div class="search-item-meta">${metaFn(item)}</div>
      `;
      si.addEventListener('click', () => {
        document.getElementById('search-overlay').classList.add('hidden');
        App.navigate(section);
      });
      resultsEl.appendChild(si);
    });
  }
}

function highlight(text, query) {
  if (!text) return '';
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text;
  return text.slice(0, idx) + `<mark style="background:rgba(201,169,110,0.3);color:var(--accent);border-radius:2px">${text.slice(idx, idx + query.length)}</mark>` + text.slice(idx + query.length);
}
