/* ============================================================
   auth.js — Supabase auth + config management
   ============================================================ */

let supabaseClient = null;
let currentUser = null;

async function initSupabase() {
  const url = await DB.getConfig('supabase_url');
  const key = await DB.getConfig('supabase_key');
  if (!url || !key) return null;

  // Load Supabase dynamically
  if (!window.supabase) {
    await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js');
  }

  supabaseClient = window.supabase.createClient(url, key);
  return supabaseClient;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function getSupabase() {
  if (supabaseClient) return supabaseClient;
  return initSupabase();
}

async function getCurrentUser() {
  if (currentUser) return currentUser;
  const sb = await getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  currentUser = data?.session?.user || null;
  return currentUser;
}

async function signInWithGoogle() {
  const sb = await getSupabase();
  if (!sb) { showToast('Supabase not configured'); return; }
  const redirectTo = window.location.href.split('#')[0];
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo }
  });
  if (error) showToast('Sign in failed: ' + error.message);
}

async function signOut() {
  const sb = await getSupabase();
  if (sb) await sb.auth.signOut();
  currentUser = null;
  location.reload();
}

async function checkAuth() {
  // Check if Supabase is configured
  const url = await DB.getConfig('supabase_url');
  const key = await DB.getConfig('supabase_key');

  if (!url || !key) {
    showScreen('setup');
    return false;
  }

  await initSupabase();

  // Check session
  const user = await getCurrentUser();
  if (!user) {
    // Check if we're returning from OAuth
    const sb = await getSupabase();
    const { data } = await sb.auth.getSession();
    if (!data?.session) {
      showScreen('auth');
      return false;
    }
    currentUser = data.session.user;
  }

  return true;
}

function showScreen(name) {
  document.getElementById('setup-screen').classList.add('hidden');
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('main-app').classList.add('hidden');
  document.getElementById(`${name}-screen`)?.classList.remove('hidden');
  if (name === 'main') document.getElementById('main-app').classList.remove('hidden');
}

// Setup form
document.getElementById('setup-save').addEventListener('click', async () => {
  const url = document.getElementById('setup-url').value.trim();
  const key = document.getElementById('setup-key').value.trim();
  if (!url || !key) { showToast('Please fill in both fields'); return; }
  await DB.setConfig('supabase_url', url);
  await DB.setConfig('supabase_key', key);
  App.init();
});

// Google sign in
document.getElementById('auth-google-btn').addEventListener('click', signInWithGoogle);
