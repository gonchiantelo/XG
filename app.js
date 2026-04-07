/* =============================================
   XPENSES GAME — App Logic v5 (Refactored)
   ============================================= */
'use strict';

// ─────────────────────────────────────────────
// STATE — Single source of truth
// ─────────────────────────────────────────────
const State = {
  currentPage:   null,
  currentGroup:  null,
  currentUser:   null,
  currentNav:    'dashboard',
  pieChart:      null,
  pendingUserId: null,
  expenseStep:   1,
  expenseData:   {},
};

// ─────────────────────────────────────────────
// ROUTER — instant SPA transitions
// ─────────────────────────────────────────────
function showPage(id, params = {}) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  const page = document.getElementById('page-' + id);
  if (!page) { console.warn('Page not found:', id); return; }

  page.classList.add('active');
  State.currentPage = id;
  if (params) Object.assign(State, params);

  const navKey = id === 'group' ? 'dashboard' : id;
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.nav === navKey);
  });

  const isGroupPage = ['group','expenses','debts','budget'].includes(id);
  const isAuthPage  = ['login','register','verify'].includes(id);
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.style.display = (isGroupPage) ? '' : 'none';

  // Global FAB: show on any group-related page (desktop), hide otherwise
  const fab = document.getElementById('fab-global');
  if (fab) {
    if (isGroupPage && State.currentGroup) {
      fab.classList.remove('hidden');
    } else {
      fab.classList.add('hidden');
    }
  }

  // Hide bottom nav on non-group pages
  const bottomNav = document.getElementById('group-bottom-nav');
  if (bottomNav) {
    bottomNav.style.display = isGroupPage ? '' : 'none';
  }

  const init = PAGE_INITS[id];
  if (init) init(params);
}

// Navigate back to home/lobby (all groups)
window.goToHome = function() {
  State.currentGroup = null;
  State.currentNav = 'dashboard';
  showPage('home');
};

window.navTo = function(section) {
  if (!State.currentGroup) { showPage('home'); return; }
  State.currentNav = section;
  if (section === 'dashboard') showPage('group');
  else showPage(section);
};

const PAGE_INITS = {
  login:    initLogin,
  register: initRegister,
  verify:   initVerify,
  home:     initHome,
  group:    initGroup,
  expenses: initExpenses,
  debts:    initDebts,
  budget:   initBudget,
  profile:  initProfile,
};

// ─────────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────────
function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  el.innerHTML = `<span>${icon}</span> <span>${msg}</span>`;
  const container = document.getElementById('toast-container');
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .3s';
    setTimeout(() => el.remove(), 320);
  }, 3000);
}

function showModal(html, onShow) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'active-modal';
  overlay.innerHTML = `<div class="modal-sheet"><div class="modal-handle"></div>${html}</div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('modal-container').appendChild(overlay);
  if (onShow) onShow(overlay);
}
function closeModal() { document.getElementById('active-modal')?.remove(); }

const AVATAR_COLORS = ['#8B5CF6','#EC4899','#3B82F6','#10B981','#F59E0B','#EF4444','#06B6D4','#F97316'];
function avatarColor(user) { return user?.avatarColor || AVATAR_COLORS[0]; }
function avatarEl(user, cls = '') {
  if (!user) return `<div class="avatar ${cls}" style="background:#555">?</div>`;
  return `<div class="avatar ${cls}" style="background:${avatarColor(user)}">${DB.users.initials(user)}</div>`;
}

function fmt(amount, group) {
  const sym = group?.currencySymbol || '$';
  const val = isFinite(amount) ? Math.max(0, Math.round(Math.abs(amount))) : 0;
  return `${sym}${val.toLocaleString('es-AR')}`;
}
function fmtSigned(amount, group) {
  const sym = group?.currencySymbol || '$';
  if (!isFinite(amount)) return `${sym}0`;
  const val = Math.round(amount);
  return val < 0
    ? `-${sym}${Math.abs(val).toLocaleString('es-AR')}`
    : `${sym}${val.toLocaleString('es-AR')}`;
}
function applyPalette(palette) {
  document.documentElement.setAttribute('data-palette', palette || 'violet');
}

// ─────────────────────────────────────────────
// AUTH — Login page
// ─────────────────────────────────────────────
function initLogin() {
  // Clear errors
  const errEl = document.getElementById('login-error');
  if (errEl) { errEl.textContent = ''; errEl.classList.add('hidden'); }

  // ── OAuth buttons ──────────────────────────
  const btnGoogle = document.getElementById('btn-google-auth');
  const btnApple  = document.getElementById('btn-apple-auth');

  if (btnGoogle) {
    btnGoogle.onclick = async () => {
      btnGoogle.disabled = true;
      btnGoogle.textContent = 'Conectando…';
      try {
        await SupabaseRepo.auth.signInWithOAuth('google');
        // onAuthStateChange listener in supabase-repo.js takes over after redirect
      } catch (e) {
        toast('Error Google: ' + e.message, 'error');
        btnGoogle.disabled = false;
        btnGoogle.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="18" height="18"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Continuar con Google`;
      }
    };
  }

  if (btnApple) {
    btnApple.onclick = async () => {
      btnApple.disabled = true;
      btnApple.textContent = 'Conectando…';
      try {
        await SupabaseRepo.auth.signInWithOAuth('apple');
      } catch (e) {
        toast('Error Apple: ' + e.message, 'error');
        btnApple.disabled = false;
        btnApple.textContent = ' Continuar con Apple';
      }
    };
  }

  // ── Email/password (local + Supabase fallback) ──
  const btnLogin = document.getElementById('btn-login');
  const passIn   = document.getElementById('login-password');
  const btnReg   = document.getElementById('btn-go-register');

  if (btnLogin) btnLogin.onclick = doLogin;
  if (btnReg)   btnReg.onclick   = () => showPage('register');
  if (passIn)   passIn.onkeydown = e => { if (e.key === 'Enter') doLogin(); };
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');

  // Try Supabase email auth first (if configured)
  const sb = typeof SupabaseRepo !== 'undefined' && SupabaseRepo.getClient();
  if (sb) {
    try {
      const btnLogin = document.getElementById('btn-login');
      btnLogin.disabled = true;
      btnLogin.textContent = 'Ingresando…';
      await SupabaseRepo.auth.signInWithEmail(email, pass);
      // onAuthStateChange handles the rest
      return;
    } catch (e) {
      console.warn('[doLogin] Supabase error:', e.message);
      document.getElementById('btn-login').disabled = false;
      document.getElementById('btn-login').textContent = 'Ingresar';
      toast('Error de autenticación: ' + e.message, 'error');
      return; 
    }
  }

  // ── Fallback: local DB (demo / offline mode) ──
  const user = DB.users.findByEmail(email);
  if (!user || user.password !== pass) {
    errEl.textContent = 'Email o contraseña incorrectos';
    errEl.classList.remove('hidden');
    return;
  }
  errEl.classList.add('hidden');
  if (!user.verified) { State.pendingUserId = user.id; showPage('verify'); return; }
  DB.session.set(user.id);
  State.currentUser = user;
  applyPalette(user.palette || 'violet');
  showPage('home');
}

// ─────────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────────
function initRegister() {
  document.getElementById('btn-register').onclick = doRegister;
  document.getElementById('btn-go-login').onclick  = () => showPage('login');
}

async function doRegister() {
  const name     = document.getElementById('reg-name').value.trim();
  const lastName = document.getElementById('reg-lastname').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl    = document.getElementById('reg-error');

  if (!name || !lastName || !email || !password) {
    errEl.textContent = 'Completá todos los campos'; errEl.classList.remove('hidden'); return;
  }
  if (password.length < 6) {
    errEl.textContent = 'La contraseña debe tener al menos 6 caracteres'; errEl.classList.remove('hidden'); return;
  }
  errEl.classList.add('hidden');

  // Try Supabase sign-up first
  const sb = typeof SupabaseRepo !== 'undefined' && SupabaseRepo.getClient();
  if (sb) {
    try {
      const btnReg = document.getElementById('btn-register');
      btnReg.disabled = true; btnReg.textContent = 'Creando cuenta…';
      await SupabaseRepo.auth.signUp(email, password, { full_name: `${name} ${lastName}` });
      toast('¡Cuenta creada! Revisá tu email para confirmar.', 'success');
      showPage('login');
      return;
    } catch (e) {
      console.warn('[doRegister] Supabase error:', e.message);
      document.getElementById('btn-register').disabled = false;
      document.getElementById('btn-register').textContent = 'Crear cuenta';
      toast('Error al crear perfil: ' + e.message, 'error');
      return;
    }
  }

  // Fallback: local DB
  if (DB.users.findByEmail(email)) {
    errEl.textContent = 'Ya existe una cuenta con ese email'; errEl.classList.remove('hidden'); return;
  }
  const user = DB.users.create({
    name, lastName, email, password,
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
  });
  State.pendingUserId = user.id;
  showPage('verify');
}

// ─────────────────────────────────────────────
// VERIFY (OTP — local demo mode only)
// ─────────────────────────────────────────────
function initVerify() {
  const user = DB.users.findById(State.pendingUserId);
  if (!user) { showPage('login'); return; }

  document.getElementById('verify-desc').textContent = `Enviamos un código a ${user.email}`;
  document.getElementById('verify-code-hint').innerHTML = `🔑 Código demo: <strong>${user.verificationCode}</strong>`;

  const inputs = document.querySelectorAll('.otp-input');
  inputs.forEach((inp, i) => {
    inp.oninput = () => {
      inp.value = inp.value.replace(/[^0-9]/g, '');
      if (inp.value && i < inputs.length - 1) inputs[i + 1].focus();
    };
    inp.onkeydown = e => { if (e.key === 'Backspace' && !inp.value && i > 0) inputs[i - 1].focus(); };
  });
  inputs[0].focus();

  document.getElementById('btn-verify').onclick = () => {
    const code = Array.from(inputs).map(i => i.value).join('');
    if (code.length < 6) { toast('Ingresá los 6 dígitos', 'error'); return; }
    if (code === user.verificationCode) {
      DB.users.verify(user.id);
      DB.session.set(user.id);
      State.currentUser = DB.users.findById(user.id);
      toast('¡Bienvenido! 🎉', 'success');
      showPage('home');
    } else {
      toast('Código incorrecto', 'error');
      inputs.forEach(i => { i.value = ''; });
      inputs[0].focus();
    }
  };

  const backBtn = document.getElementById('btn-back-login');
  if (backBtn) backBtn.onclick = () => showPage('login');
}

// ─────────────────────────────────────────────
// HOME (Lobby)
// ─────────────────────────────────────────────
function initHome() {
  document.getElementById('btn-home-profile').onclick = () => showPage('profile');
  document.getElementById('btn-new-group').onclick    = showNewGroupModal;
  document.getElementById('btn-join-group').onclick   = showJoinGroupModal;
  renderHomeStatus();
  renderHomeGroups();
}

function renderHomeStatus() {
  const u = State.currentUser;
  const groups = DB.groups.forUser(u.id);
  let totalOwed = 0, totalToReceive = 0;
  groups.forEach(g => {
    totalOwed      += DB.balance.totalOwedBy(u.id, g.id);
    totalToReceive += DB.balance.totalOwedTo(u.id, g.id);
  });
  const safeFmt = v => '$' + Math.max(0, Math.round(v)).toLocaleString('es-AR');
  document.getElementById('home-total-spent').textContent = safeFmt(totalOwed + totalToReceive);
  document.getElementById('home-to-receive').textContent  = safeFmt(totalToReceive);
  document.getElementById('home-to-pay').textContent      = safeFmt(totalOwed);
}

function renderHomeGroups() {
  const list     = document.getElementById('home-groups-list');
  const myGroups = DB.groups.forUser(State.currentUser.id);

  if (!myGroups.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏠</div>
        <div class="empty-title">Sin grupos todavía</div>
        <div class="empty-desc">Creá un grupo o unite a uno con el ID que te compartieron</div>
      </div>`;
    return;
  }

  list.innerHTML = myGroups.map(g => {
    const members = g.members.map(m => DB.users.findById(m.userId)).filter(Boolean);
    const total   = DB.stats.groupTotal(g.id);
    const avatarStack = members.slice(0, 4).map(m => avatarEl(m, 'avatar-xs')).join('');
    const myOwed  = DB.balance.totalOwedBy(State.currentUser.id, g.id);
    const myGet   = DB.balance.totalOwedTo(State.currentUser.id, g.id);
    return `
    <button class="group-card-v2" onclick="openGroup('${g.id}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div>
          <div class="font-black text-lg">${g.name}</div>
          <div class="text-xs text-muted" style="font-family:'DM Mono',monospace">ID: ${g.id.toUpperCase()}</div>
        </div>
        <span class="badge badge-accent">${g.type || 'mensual'}</span>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:12px">
        <div class="avatar-stack">${avatarStack}</div>
        <span class="text-xs text-muted" style="align-self:center">${members.length} miembro${members.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="group-card-footer">
        <div class="text-xs text-muted">Total grupo: <strong class="text-sm">${g.currencySymbol}${Math.round(total).toLocaleString('es-AR')}</strong></div>
        ${myOwed > 0
          ? `<span class="badge badge-danger">Debés ${g.currencySymbol}${Math.round(myOwed).toLocaleString('es-AR')}</span>`
          : myGet > 0
            ? `<span class="badge badge-success">Recibís ${g.currencySymbol}${Math.round(myGet).toLocaleString('es-AR')}</span>`
            : `<span class="badge badge-success">Al día ✓</span>`}
      </div>
    </button>`;
  }).join('');
}

// ─────────────────────────────────────────────
// GROUP MODALS
// ─────────────────────────────────────────────
// ── State for email chips in group creation ──
let _newGroupEmails = [];

function showNewGroupModal() {
  _newGroupEmails = [];
  const currencies = DB.CURRENCY_LIST.map(c => `<option value="${c.code}">${c.symbol} ${c.name}</option>`).join('');
  const palettes = Object.entries({violet:'#8B5CF6',blue:'#3B82F6',emerald:'#10B981',amber:'#F59E0B',magenta:'#EC4899',cyan:'#06B6D4',orange:'#F97316',rose:'#EF4444'})
    .map(([k,v]) => `<button class="palette-swatch" data-p="${k}" style="background:${v}" onclick="selectPaletteNew('${k}',this)" title="${k}"></button>`).join('');

  showModal(`
    <div class="modal-title">Nuevo Grupo</div>
    <div class="modal-subtitle">Creá un espacio compartido para dividir gastos.</div>
    <div class="form-group">
      <label class="form-label">Nombre del grupo</label>
      <input id="ng-name" class="form-input" placeholder="Casa, Viaje, Pareja..." autocomplete="off"/>
    </div>
    <div class="form-group">
      <label class="form-label">¿Es un grupo mensual?</label>
      <div style="display:flex;align-items:center;gap:12px;margin-top:6px">
        <div class="toggle-switch active" id="ng-monthly-toggle" onclick="toggleMonthly(this)"></div>
        <span class="text-sm" id="ng-monthly-label">Sí, se renueva cada mes</span>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Tipo</label>
      <select id="ng-type" class="form-input">
        <option value="monthly">Mensual (hogar / pareja)</option>
        <option value="travel">Viaje</option>
        <option value="event">Evento</option>
        <option value="custom">Personalizado</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Presupuesto inicial (opcional)</label>
      <input id="ng-budget" class="form-input" type="number" placeholder="0" min="0"/>
    </div>
    <div class="form-group">
      <label class="form-label">Moneda</label>
      <select id="ng-currency" class="form-input">${currencies}</select>
    </div>
    <div class="form-group">
      <label class="form-label">Invitar personas (emails)</label>
      <div class="email-chips-container" id="ng-emails-container">
        <input class="email-chip-input" id="ng-email-input" placeholder="email@ejemplo.com" type="email"
          onkeydown="handleEmailChipKey(event)"/>
      </div>
      <div class="text-xs text-muted" style="margin-top:4px">Presioná Enter o coma para agregar</div>
    </div>
    <div class="form-group">
      <label class="form-label">Color</label>
      <div class="palette-grid" id="ng-palette">${palettes}</div>
      <input type="hidden" id="ng-palette-val" value="violet"/>
    </div>
    <div style="display:flex;gap:10px;margin-top:20px">
      <button class="btn btn-ghost flex-1" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary flex-1" onclick="createGroup()">Crear grupo</button>
    </div>
  `);
  setTimeout(() => {
    const sw = document.querySelector('[data-p="violet"]');
    if (sw) sw.style.outline = '2px solid #fff';
  }, 50);
}

window.toggleMonthly = function(el) {
  el.classList.toggle('active');
  const label = document.getElementById('ng-monthly-label');
  if (el.classList.contains('active')) {
    label.textContent = 'Sí, se renueva cada mes';
  } else {
    label.textContent = 'No, es un grupo puntual';
  }
};

window.handleEmailChipKey = function(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const input = document.getElementById('ng-email-input');
    const email = input.value.trim().replace(',','');
    if (email && email.includes('@') && !_newGroupEmails.includes(email)) {
      _newGroupEmails.push(email);
      renderEmailChips();
    }
    input.value = '';
  }
};

function renderEmailChips() {
  const container = document.getElementById('ng-emails-container');
  const input = document.getElementById('ng-email-input');
  // Remove old chips
  container.querySelectorAll('.email-chip').forEach(c => c.remove());
  // Add chips before input
  _newGroupEmails.forEach((email, i) => {
    const chip = document.createElement('div');
    chip.className = 'email-chip';
    chip.innerHTML = `${email}<button class="email-chip-remove" onclick="removeEmailChip(${i})">✕</button>`;
    container.insertBefore(chip, input);
  });
}

window.removeEmailChip = function(i) {
  _newGroupEmails.splice(i, 1);
  renderEmailChips();
};

window.selectPaletteNew = function(key, el) {
  document.getElementById('ng-palette-val').value = key;
  document.querySelectorAll('.palette-swatch').forEach(s => s.style.outline = 'none');
  el.style.outline = '2px solid #fff';
};

window.createGroup = async function() {
  const name     = document.getElementById('ng-name').value.trim();
  const type     = document.getElementById('ng-type').value;
  const currency = document.getElementById('ng-currency').value;
  const palette  = document.getElementById('ng-palette-val').value;
  const isMonthly = document.getElementById('ng-monthly-toggle').classList.contains('active');
  const budgetVal = parseFloat(document.getElementById('ng-budget').value) || 0;

  if (!name) { toast('Ingresá un nombre', 'error'); return; }
  if (!DB.freemium.canCreateGroup(State.currentUser.id)) {
    toast('Alcanzaste el límite de grupos gratuitos', 'error'); return;
  }
  
  let sbGroupId = undefined;
  const sb = typeof SupabaseRepo !== 'undefined' && SupabaseRepo.getClient();
  if (sb) {
    try {
      const typeVal = isMonthly ? 'monthly' : type;
      const sbGroup = await SupabaseRepo.groups.create({ 
        name, 
        type: typeVal, 
        currency, 
        currency_symbol: DB.CURRENCIES[currency] || '$',
        palette,
        is_monthly: isMonthly,
        initial_budget: budgetVal
      }, State.currentUser.id);
      sbGroupId = sbGroup.id;
    } catch (e) {
      console.error('[createGroup] Supabase error:', e);
      toast('Error guardando en la nube: ' + e.message, 'error');
    }
  }

  const g = DB.groups.create({ id: sbGroupId, name, type: isMonthly ? 'monthly' : type, currency, palette }, State.currentUser.id);

  // Set initial budget if provided
  if (budgetVal > 0) {
    DB.budgets.set(State.currentUser.id, g.id, budgetVal);
  }

  // Create alerts for invited emails
  _newGroupEmails.forEach(email => {
    const existingUser = DB.users.findByEmail(email);
    if (existingUser) {
      DB.groups.addMember(g.id, existingUser.id);
      if (sb && sbGroupId) {
        SupabaseRepo.groups.addMember(sbGroupId, existingUser.id).catch(console.error);
      }
      DB.alerts.add(existingUser.id, 'group_invite', `${State.currentUser.name} te invitó al grupo "${g.name}"`, { groupId: g.id });
    }
  });

  State.currentGroup = DB.groups.findById(g.id); // refresh
  applyPalette(g.palette);
  closeModal();

  // Show post-creation modal with invite code
  showGroupCreatedModal(g);
};

function showGroupCreatedModal(g) {
  const code = g.id.toUpperCase();
  showModal(`
    <div style="text-align:center">
      <div style="font-size:48px;margin-bottom:12px">🎉</div>
      <div class="modal-title" style="text-align:center">¡Grupo creado!</div>
      <div class="modal-subtitle" style="text-align:center">"${g.name}" está listo. Compartí el código para invitar.</div>
    </div>
    <div class="invite-code-display">
      <div class="invite-code-text">${code}</div>
      <div class="invite-code-label">Código de invitación</div>
    </div>
    <div style="display:flex;gap:10px;margin-bottom:12px">
      <button class="btn btn-secondary flex-1" onclick="copyInviteCode('${code}')">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        Copiar código
      </button>
      <button class="btn btn-secondary flex-1" onclick="shareInviteCode('${code}','${g.name}')">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        Compartir
      </button>
    </div>
    <button class="btn btn-primary btn-block btn-lg" onclick="closeModal();showPage('group');updateSidebarGroup(State.currentGroup)">
      Ir al grupo →
    </button>
  `);
}

window.copyInviteCode = function(code) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code).then(() => toast('Código copiado ✓', 'success'));
  } else {
    toast('Código: ' + code, 'success');
  }
};

window.shareInviteCode = function(code, name) {
  if (navigator.share) {
    navigator.share({
      title: 'Xpenses Game',
      text: `Unite a mi grupo "${name}" en Xpenses Game. Código: ${code}`,
    }).catch(() => {});
  } else {
    window.copyInviteCode(code);
  }
};

function showJoinGroupModal() {
  showModal(`
    <div class="modal-title">Unirse a un grupo</div>
    <div class="modal-subtitle">Ingresá el ID que te compartió el organizador.</div>
    <div class="form-group">
      <label class="form-label">ID del Grupo</label>
      <input id="join-id" class="form-input" placeholder="ej: K4X9P2" autocomplete="off" autocapitalize="characters"
        style="font-family:'DM Mono',monospace;letter-spacing:2px;text-transform:uppercase"/>
    </div>
    <div id="join-error" class="form-error hidden"></div>
    <div style="display:flex;gap:10px;margin-top:20px">
      <button class="btn btn-ghost flex-1" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary flex-1" onclick="joinGroup()">Unirse</button>
    </div>
  `);
}

window.joinGroup = async function() {
  const rawId = document.getElementById('join-id').value.trim().toLowerCase();
  const errEl = document.getElementById('join-error');
  
  const group = DB.groups.findById(rawId);
  if (!group) { errEl.textContent = 'No se encontró ningún grupo con ese ID localmente'; errEl.classList.remove('hidden'); return; }
  if (group.members.some(m => m.userId === State.currentUser.id)) {
    errEl.textContent = 'Ya sos miembro de este grupo'; errEl.classList.remove('hidden'); return;
  }
  if (!DB.freemium.canAddMember(group, State.currentUser)) {
    errEl.textContent = 'El grupo alcanzó el límite de miembros en plan gratuito'; errEl.classList.remove('hidden'); return;
  }
  
  const sb = typeof SupabaseRepo !== 'undefined' && SupabaseRepo.getClient();
  if (sb) {
    try {
      await SupabaseRepo.groups.addMember(group.id, State.currentUser.id);
    } catch(e) {
      console.warn('Supabase join warning', e);
    }
  }

  errEl.classList.add('hidden');
  DB.groups.addMember(group.id, State.currentUser.id);
  State.currentGroup = DB.groups.findById(group.id);
  applyPalette(group.palette);
  closeModal();
  toast(`¡Te uniste a "${group.name}"! 🎉`, 'success');
  showPage('group');
  updateSidebarGroup(State.currentGroup);
};

window.openGroup = function(groupId) {
  const g = DB.groups.findById(groupId);
  if (!g) { toast('Grupo no encontrado', 'error'); return; }
  State.currentGroup = g;
  applyPalette(g.palette);
  showPage('group');
  updateSidebarGroup(g);
};

// ─────────────────────────────────────────────
// SIDEBAR: Group Switcher
// ─────────────────────────────────────────────
function updateSidebarGroup(g) {
  const nameEl    = document.getElementById('switcher-group-name-desktop');
  const avatarEl_s = document.getElementById('switcher-group-avatar-desktop');
  if (nameEl) nameEl.textContent = g.name;
  if (avatarEl_s) {
    avatarEl_s.textContent = g.name[0].toUpperCase();
    avatarEl_s.style.background = 'var(--accent)';
  }
  // Update sidebar user info
  const u = State.currentUser;
  if (u) {
    const sidebarAvatar = document.getElementById('sidebar-avatar');
    const sidebarName   = document.getElementById('sidebar-user-name');
    const sidebarEmail  = document.getElementById('sidebar-user-email');
    if (sidebarAvatar) { sidebarAvatar.textContent = DB.users.initials(u); sidebarAvatar.style.background = avatarColor(u); }
    if (sidebarName)   sidebarName.textContent = `${u.name} ${u.lastName}`;
    if (sidebarEmail)  sidebarEmail.textContent = u.email;
  }
  // Group switcher dropdown
  renderGroupSwitcher();
}

function renderGroupSwitcher() {
  const dropdown = document.getElementById('switcher-dropdown-desktop');
  const current  = document.getElementById('switcher-current-desktop');
  if (!dropdown) return;

  current?.addEventListener('click', () => dropdown.classList.toggle('hidden'));

  const myGroups = DB.groups.forUser(State.currentUser.id);
  dropdown.innerHTML = myGroups.map(g => `
    <div class="switcher-item" onclick="openGroup('${g.id}');document.getElementById('switcher-dropdown-desktop').classList.add('hidden')">
      <div class="avatar avatar-xs" style="background:var(--accent)">${g.name[0]}</div>
      <span class="text-sm font-semibold truncate">${g.name}</span>
    </div>
  `).join('') + `
    <div class="switcher-item" onclick="showNewGroupModal();document.getElementById('switcher-dropdown-desktop').classList.add('hidden')" style="border-top:1px solid var(--border)">
      <span style="font-size:16px">+</span>
      <span class="text-sm font-semibold">Nuevo grupo</span>
    </div>`;
}

// ─────────────────────────────────────────────
// GROUP DASHBOARD
// ─────────────────────────────────────────────
function initGroup() {
  const g = State.currentGroup;
  if (!g) { showPage('home'); return; }

  document.getElementById('group-title').textContent = g.name;
  document.getElementById('btn-group-back').onclick     = () => showPage('home');
  document.getElementById('btn-group-members').onclick  = showMembersModal;
  document.getElementById('btn-group-settings').onclick = showGroupSettingsModal;
  document.getElementById('btn-see-all-debts').onclick   = () => navTo('debts');
  document.getElementById('btn-see-all-expenses').onclick = () => navTo('expenses');

  // FAB buttons (mobile bottom bar + global desktop FAB + header add button)
  const fab = document.getElementById('btn-fab-add');
  if (fab) fab.onclick = showAddExpenseModal;
  const fabGlobal = document.getElementById('fab-global');
  if (fabGlobal) fabGlobal.onclick = showAddExpenseModal;
  const addDesktop = document.getElementById('btn-group-add-desktop');
  if (addDesktop) addDesktop.onclick = showAddExpenseModal;

  // Interactive dashboard cards — click to navigate
  const healthCard = document.getElementById('financial-health-card');
  if (healthCard) healthCard.onclick = () => navTo('debts');

  const balanceCard = document.getElementById('dash-balance-card');
  if (balanceCard) balanceCard.onclick = () => navTo('budget');

  const chartCard = document.getElementById('dash-chart-card');
  if (chartCard) chartCard.onclick = () => navTo('expenses');

  const debtsCard = document.getElementById('dash-debts-card');
  if (debtsCard) debtsCard.onclick = (e) => {
    // Don't navigate if clicking internal buttons
    if (e.target.closest('button')) return;
    navTo('debts');
  };

  const expensesCard = document.getElementById('dash-expenses-card');
  if (expensesCard) expensesCard.onclick = (e) => {
    if (e.target.closest('button') || e.target.closest('.expense-item')) return;
    navTo('expenses');
  };

  updateSidebarGroup(g);
  renderDashboard();
}

function renderDashboard() {
  const g  = State.currentGroup;
  const u  = State.currentUser;
  const d  = new Date();

  // Financial health
  const toReceive = DB.balance.totalOwedTo(u.id, g.id);
  const toPay     = DB.balance.totalOwedBy(u.id, g.id);
  document.getElementById('dash-to-receive').textContent = fmt(toReceive, g);
  document.getElementById('dash-to-pay').textContent     = fmt(toPay, g);

  const healthFill = document.getElementById('health-fill');
  const healthBadge = document.getElementById('health-status-badge');
  const net = toReceive - toPay;
  if (net >= 0) {
    healthFill.className = 'health-fill green';
    healthFill.style.width = '100%';
    healthBadge.textContent = '✓ Al día';
    healthBadge.className   = 'badge badge-accent';
  } else {
    const pct = Math.min(100, Math.round((toPay / (toPay + toReceive + 1)) * 100));
    healthFill.className = pct > 60 ? 'health-fill red' : 'health-fill yellow';
    healthFill.style.width = pct + '%';
    healthBadge.textContent = 'Con deudas';
    healthBadge.className   = 'badge badge-warning';
  }

  // Balance card
  const budget  = DB.budgets.get(u.id, g.id);
  const spent   = DB.balance.userSpentThisMonth(u.id, g.id);
  const budgetAmt = budget?.amount || 0;
  const remaining = budgetAmt > 0 ? budgetAmt - spent : 0;

  document.getElementById('dash-currency').textContent = g.currencySymbol;
  document.getElementById('dash-balance').textContent  = budgetAmt > 0
    ? Math.max(0, Math.round(remaining)).toLocaleString('es-AR')
    : '–';
  document.getElementById('dash-budget').textContent = budgetAmt > 0 ? fmt(budgetAmt, g) : 'Sin configurar';
  document.getElementById('dash-spent').textContent  = fmt(spent, g);

  const budgetRow = document.getElementById('dash-budget-row');
  if (budgetAmt > 0) {
    const pct = Math.min(100, Math.round(spent / budgetAmt * 100));
    budgetRow.innerHTML = `
      <div class="progress-bar">
        <div class="progress-fill" style="width:${pct}%;background:${pct > 80 ? 'var(--danger)' : pct > 60 ? 'var(--warning)' : 'var(--success)'}"></div>
      </div>
      <div class="text-xs text-muted mt-2">${pct}% del presupuesto</div>`;
  } else { budgetRow.innerHTML = ''; }

  // Pie chart
  renderPieChart(g, d.getFullYear(), d.getMonth() + 1);

  // Debts preview
  renderDebtsPreview(g, u);

  // Recent expenses
  renderRecentExpenses(g);

  // Alerts
  renderAlerts(g, u);
}

function renderPieChart(g, year, month) {
  const cats   = DB.stats.byCategory(g.id, year, month);
  const total  = cats.reduce((s, c) => s + c.total, 0);
  const canvas = document.getElementById('pie-chart');
  const COLORS = ['#8B5CF6','#3B82F6','#EC4899','#10B981','#F59E0B','#EF4444','#06B6D4','#F97316','#94A3B8'];

  document.getElementById('dash-total').textContent = fmt(total, g);

  if (State.pieChart) { State.pieChart.destroy(); State.pieChart = null; }

  if (!cats.length) {
    canvas.style.display = 'none';
    document.getElementById('pie-legend').innerHTML = `<div class="empty-state" style="padding:16px"><div class="empty-icon" style="font-size:28px">📊</div><div class="empty-desc">Sin gastos este mes</div></div>`;
    return;
  }
  canvas.style.display = '';
  State.pieChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: cats.map(c => c.label),
      datasets: [{ data: cats.map(c => c.total), backgroundColor: COLORS, borderWidth: 0, hoverOffset: 4 }]
    },
    options: { cutout: '72%', plugins: { legend: { display: false }, tooltip: { enabled: false } }, animation: { duration: 600 } }
  });

  document.getElementById('pie-legend').innerHTML = cats.slice(0, 5).map((c, i) => `
    <div class="pie-legend-row">
      <div style="display:flex;align-items:center;gap:6px">
        <div class="pie-legend-dot" style="background:${COLORS[i % COLORS.length]}"></div>
        <span class="text-xs">${c.icon} ${c.label}</span>
      </div>
      <span class="text-xs font-bold">${fmt(c.total, g)}</span>
    </div>`).join('');
}

function renderDebtsPreview(g, u) {
  const list  = document.getElementById('dash-debts-list');
  const debts = DB.balance.forGroup(g.id).slice(0, 3);

  if (!debts.length) {
    list.innerHTML = `<div class="empty-state" style="padding:16px"><div class="empty-icon" style="font-size:24px">✅</div><div class="empty-desc">Sin deudas pendientes</div></div>`;
    return;
  }
  list.innerHTML = debts.map(b => {
    const from = DB.users.findById(b.from);
    const to   = DB.users.findById(b.to);
    const isMe = b.from === u.id;
    return `
    <div class="debt-item">
      ${avatarEl(from, 'avatar-xs')}
      <div class="flex-1 text-xs font-bold truncate">${from?.name || '?'} → ${to?.name || '?'}</div>
      <span class="font-black text-sm ${isMe ? 'text-danger' : 'text-success'}">${fmt(b.amount, g)}</span>
    </div>`;
  }).join('');
}

function renderRecentExpenses(g) {
  const container = document.getElementById('dash-recent-expenses');
  const exps = DB.expenses.forGroup(g.id).slice(0, 5);
  if (!exps.length) {
    container.innerHTML = `<div class="empty-state" style="padding:16px"><div class="empty-icon" style="font-size:24px">🧾</div><div class="empty-desc">Agregá el primer gasto</div></div>`;
    return;
  }
  container.innerHTML = exps.map(e => {
    const cat    = DB.expenses.getCategory(e.category);
    const paidBy = DB.users.findById(e.paidBy);
    return `
    <div class="expense-item">
      <div class="expense-icon">${cat.icon}</div>
      <div style="flex:1;min-width:0;padding:0 10px">
        <div class="text-sm font-bold truncate">${e.comment || cat.label}</div>
        <div class="text-xs text-muted">${paidBy?.name || '?'} · ${e.date}</div>
      </div>
      <div class="font-black text-sm">${fmt(e.amount, g)}</div>
    </div>`;
  }).join('');
}

function renderAlerts(g, u) {
  const container = document.getElementById('group-alerts');
  const unread = DB.alerts.unread(u.id).filter(a => a.meta?.groupId === g.id).slice(0, 2);
  container.innerHTML = unread.map(a => `
    <div class="alert-banner info mb-4" onclick="DB.alerts.markRead('${a.id}');this.remove()">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      ${a.message}
    </div>`).join('');
}

// ─────────────────────────────────────────────
// ADD EXPENSE MODAL (step-based numpad)
// ─────────────────────────────────────────────
function showAddExpenseModal() {
  State.expenseStep = 1;
  State.expenseData = {};
  showExpenseStep1();
}

function showExpenseStep1() {
  const g = State.currentGroup;
  showModal(`
    <div class="modal-title">Nuevo Gasto</div>
    <div class="modal-subtitle">Paso 1: ¿Cuánto?</div>
    <div class="amount-display" id="exp-amount-display">${g.currencySymbol}0</div>
    <div class="numpad">
      ${['1','2','3','4','5','6','7','8','9',',','0','⌫'].map(k => `
        <button class="numpad-btn" onclick="numpadPress('${k}')">${k}</button>`).join('')}
    </div>
    <div style="display:flex;gap:10px">
      <button class="btn btn-ghost flex-1" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary flex-1" onclick="expenseNext1()">Siguiente →</button>
    </div>
  `);
  State.expenseData._raw = '';
}

window.numpadPress = function(key) {
  const g = State.currentGroup;
  let raw = State.expenseData._raw || '';
  if (key === '⌫') { raw = raw.slice(0, -1); }
  else if (key === ',') { if (!raw.includes(',')) raw += ','; }
  else { if (raw.length < 10) raw += key; }
  State.expenseData._raw = raw;
  const numeric = parseFloat(raw.replace(',', '.')) || 0;
  State.expenseData.amount = numeric;
  document.getElementById('exp-amount-display').textContent = `${g.currencySymbol}${raw || '0'}`;
};

function expenseNext1() {
  if (!State.expenseData.amount) { toast('Ingresá un monto', 'error'); return; }
  const cats = DB.CATEGORIES || DB.expenses?.CATEGORIES || [];
  const catOptions = cats.map(c => `
    <button class="cat-pill" data-cat="${c.id}" onclick="selectExpenseCat('${c.id}',this)">${c.icon} ${c.label}</button>`).join('');

  const g = State.currentGroup;
  const memberOptions = g.members.map(m => {
    const u = DB.users.findById(m.userId);
    return `<option value="${m.userId}" ${m.userId === State.currentUser.id ? 'selected' : ''}>${u?.name || m.userId}</option>`;
  }).join('');

  showModal(`
    <div class="modal-title">Nuevo Gasto</div>
    <div class="modal-subtitle">Paso 2: Detalles</div>
    <div class="form-group">
      <label class="form-label">Categoría</label>
      <div class="flex flex-wrap gap-2">${catOptions}</div>
      <input type="hidden" id="exp-cat" value="other"/>
    </div>
    <div class="form-group">
      <label class="form-label">Pagó</label>
      <select id="exp-paidby" class="form-input">${memberOptions}</select>
    </div>
    <div class="form-group">
      <label class="form-label">Descripción (opcional)</label>
      <input id="exp-comment" class="form-input" placeholder="Pizza, alquiler, taxi…"/>
    </div>
    <div class="form-group">
      <label class="form-label">Fecha</label>
      <input id="exp-date" type="date" class="form-input" value="${DB.today()}"/>
    </div>
    <div style="display:flex;gap:10px;margin-top:20px">
      <button class="btn btn-ghost flex-1" onclick="showExpenseStep1()">← Atrás</button>
      <button class="btn btn-primary flex-1" onclick="submitExpense()">Guardar gasto</button>
    </div>
  `);
  // Pre-select 'other'
  setTimeout(() => {
    const firstCat = document.querySelector('.cat-pill[data-cat="other"]');
    if (firstCat) { firstCat.classList.add('active'); document.getElementById('exp-cat').value = 'other'; }
  }, 30);
}

window.selectExpenseCat = function(catId, el) {
  document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('exp-cat').value = catId;
};

window.submitExpense = function() {
  const g       = State.currentGroup;
  const paidBy  = document.getElementById('exp-paidby').value;
  const cat     = document.getElementById('exp-cat').value;
  const comment = document.getElementById('exp-comment').value.trim();
  const date    = document.getElementById('exp-date').value;

  DB.expenses.create({
    groupId: g.id,
    amount: State.expenseData.amount,
    category: cat,
    paidBy,
    comment,
    date,
    createdBy: State.currentUser.id,
  });
  closeModal();
  toast('Gasto registrado ✓', 'success');
  renderDashboard();
};

// ─────────────────────────────────────────────
// EXPENSES PAGE
// ─────────────────────────────────────────────
function initExpenses() {
  const g    = State.currentGroup;
  const back = document.getElementById('btn-expenses-back');
  const add  = document.getElementById('btn-add-expense-page');
  if (back) back.onclick = () => showPage('group');
  if (add)  add.onclick  = showAddExpenseModal;

  const d = new Date();
  const months = DB.stats.monthlyTotals(g.id, 4);
  let activeMonth = { year: d.getFullYear(), month: d.getMonth() + 1 };

  const tabs = document.getElementById('expenses-month-tabs');
  tabs.innerHTML = months.map(m => `
    <button class="month-tab ${m.year === activeMonth.year && m.month === activeMonth.month ? 'active' : ''}"
      onclick="switchExpenseMonth(${m.year},${m.month},this)">${m.label}</button>`).join('');

  renderExpensesList(activeMonth.year, activeMonth.month);
}

window.switchExpenseMonth = function(year, month, el) {
  document.querySelectorAll('.month-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderExpensesList(year, month);
};

function renderExpensesList(year, month) {
  const g    = State.currentGroup;
  const list = document.getElementById('expenses-list');
  const exps = DB.expenses.forGroupMonth(g.id, year, month);

  if (!exps.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">🧾</div><div class="empty-title">Sin gastos</div><div class="empty-desc">No hay gastos en este mes</div></div>`;
    return;
  }
  list.innerHTML = exps.map(e => {
    const cat    = DB.expenses.getCategory(e.category);
    const paidBy = DB.users.findById(e.paidBy);
    return `
    <div class="card expense-item" style="cursor:pointer" onclick="showExpenseDetail('${e.id}')">
      <div class="expense-icon">${cat.icon}</div>
      <div style="flex:1;min-width:0;padding:0 12px">
        <div class="text-sm font-bold truncate">${e.comment || cat.label}</div>
        <div class="text-xs text-muted">${paidBy?.name || '?'} · ${e.date}</div>
      </div>
      <div style="text-align:right">
        <div class="font-black text-sm">${fmt(e.amount, g)}</div>
        <div class="text-xs text-muted">${e.splits.length} split${e.splits.length !== 1 ? 's' : ''}</div>
      </div>
    </div>`;
  }).join('');
}

window.showExpenseDetail = function(expenseId) {
  const g = State.currentGroup;
  const e = DB.expenses.forGroup(g.id).find(x => x.id === expenseId);
  if (!e) return;
  const cat    = DB.expenses.getCategory(e.category);
  const paidBy = DB.users.findById(e.paidBy);
  const splitsHtml = e.splits.map(s => {
    const u = DB.users.findById(s.userId);
    return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
      <span class="text-sm">${u?.name || s.userId}</span>
      <span class="font-bold text-sm">${fmt(s.amount, g)}</span>
    </div>`;
  }).join('');

  showModal(`
    <div class="modal-title">${cat.icon} ${e.comment || cat.label}</div>
    <div class="modal-subtitle">${fmt(e.amount, g)} · ${e.date}</div>
    <div class="text-xs text-muted" style="margin-bottom:12px">Pagó: <strong>${paidBy?.name || '?'}</strong></div>
    <div class="text-xs font-bold uppercase tracking-widest text-muted" style="margin-bottom:8px">División</div>
    ${splitsHtml}
    ${DB.groups.canEdit(g, State.currentUser.id) ? `
    <div style="display:flex;gap:10px;margin-top:20px">
      <button class="btn btn-ghost flex-1" onclick="closeModal()">Cerrar</button>
      <button class="btn btn-danger flex-1" onclick="deleteExpense('${e.id}')">Eliminar</button>
    </div>` : `<button class="btn btn-ghost btn-block" style="margin-top:16px" onclick="closeModal()">Cerrar</button>`}
  `);
};

window.deleteExpense = function(expId) {
  DB.expenses.delete(expId);
  closeModal();
  toast('Gasto eliminado', 'success');
  initExpenses();
  renderDashboard();
};

// ─────────────────────────────────────────────
// DEBTS PAGE
// ─────────────────────────────────────────────
function initDebts() {
  const g    = State.currentGroup;
  const back = document.getElementById('btn-debts-back');
  if (back) back.onclick = () => showPage('group');
  renderDebtsList(g);
}

function renderDebtsList(g) {
  const list  = document.getElementById('debts-detail');
  const debts = DB.balance.forGroup(g.id);

  if (!debts.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎉</div>
        <div class="empty-title">¡Sin deudas!</div>
        <div class="empty-desc">Todos los gastos están al día.</div>
      </div>`;
    return;
  }

  list.innerHTML = debts.map(b => {
    const from = DB.users.findById(b.from);
    const to   = DB.users.findById(b.to);
    const isMe = b.from === State.currentUser.id;
    return `
    <div class="card" style="padding:18px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:10px">
          ${avatarEl(from, 'avatar-sm')}
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          ${avatarEl(to, 'avatar-sm')}
          <div>
            <div class="text-sm font-black">${from?.name || '?'} → ${to?.name || '?'}</div>
            <div class="text-xs text-muted">${isMe ? 'Tenés que pagar' : 'Deuda activa'}</div>
          </div>
        </div>
        <div class="text-xl font-black ${isMe ? 'text-danger' : 'text-success'}">${fmt(b.amount, g)}</div>
      </div>
      ${isMe || DB.groups.canEdit(g, State.currentUser.id)
        ? `<button class="btn btn-primary btn-block btn-sm" onclick="settleDebt('${b.from}','${b.to}',${b.amount})">
            ✓ Marcar como pagado
           </button>` : ''}
    </div>`;
  }).join('');
}

window.settleDebt = function(from, to, amount) {
  DB.payments.settle(State.currentGroup.id, from, to, amount);
  toast('¡Deuda saldada! 🎉', 'success');
  initDebts();
  renderDashboard();
};

// ─────────────────────────────────────────────
// BUDGET PAGE
// ─────────────────────────────────────────────
function initBudget() {
  const g    = State.currentGroup;
  const u    = State.currentUser;
  const b    = DB.budgets.get(u.id, g.id);
  const back = document.getElementById('btn-budget-back');
  if (back) back.onclick = () => showPage('group');

  const mySpent  = DB.balance.userSpentThisMonth(u.id, g.id);
  const budgetAmt = b?.amount ? parseFloat(b.amount) : 0;
  const pct = budgetAmt > 0 ? Math.min(100, Math.round(mySpent / budgetAmt * 100)) : 0;

  document.getElementById('budget-members-list').innerHTML = `
    <div class="card" style="padding:24px">
      <div class="text-xs font-bold uppercase text-muted tracking-widest" style="margin-bottom:8px">Tu Presupuesto Mensual</div>
      ${budgetAmt > 0 ? `
      <div style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span class="text-sm text-muted">Gastado</span>
          <span class="text-sm font-black">${fmt(mySpent, g)} / ${fmt(budgetAmt, g)}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${pct}%;background:${pct > 80 ? 'var(--danger)' : pct > 60 ? 'var(--warning)' : 'var(--success)'}"></div>
        </div>
        <div class="text-xs text-muted mt-2">${pct}% del presupuesto utilizado</div>
      </div>` : ''}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        <div style="font-size:24px;font-weight:900;color:var(--accent)">${g.currencySymbol}</div>
        <input id="budget-amt" type="number" class="form-input" value="${budgetAmt || ''}"
          placeholder="0" style="font-size:28px;font-weight:900;border:none;background:transparent;padding:4px 0;flex:1"/>
      </div>
      <button class="btn btn-primary btn-block btn-lg" onclick="saveBudget()">Guardar configuración</button>
    </div>`;
}

window.saveBudget = function() {
  const amt = document.getElementById('budget-amt').value;
  if (!amt || parseFloat(amt) <= 0) { toast('Ingresá un monto válido', 'error'); return; }
  DB.budgets.set(State.currentUser.id, State.currentGroup.id, parseFloat(amt));
  toast('Presupuesto guardado ✓', 'success');
  showPage('group');
};

// ─────────────────────────────────────────────
// PROFILE PAGE
// ─────────────────────────────────────────────
function initProfile() {
  const u    = State.currentUser;
  const back = document.getElementById('btn-profile-back');
  if (back) back.onclick = () => (State.currentGroup ? showPage('group') : showPage('home'));

  document.getElementById('profile-avatar').textContent      = DB.users.initials(u);
  document.getElementById('profile-avatar').style.background = avatarColor(u);
  document.getElementById('profile-name').textContent        = `${u.name} ${u.lastName}`;
  document.getElementById('profile-email').textContent       = u.email;

  // Edit toggle button
  const editBtn = document.getElementById('btn-profile-edit');
  const editForm = document.getElementById('profile-edit-form');
  if (editBtn) {
    editBtn.onclick = () => {
      const isHidden = editForm.classList.contains('hidden');
      if (isHidden) {
        editForm.classList.remove('hidden');
        populateProfileForm(u);
      } else {
        editForm.classList.add('hidden');
      }
    };
  }

  document.getElementById('btn-logout').onclick = async () => {
    if (typeof SupabaseRepo !== 'undefined') {
      await SupabaseRepo.auth.signOut().catch(() => {});
    }
    DB.session.clear();
    location.reload();
  };

  // Save profile handler
  const saveBtn = document.getElementById('btn-save-profile');
  if (saveBtn) saveBtn.onclick = saveProfile;
}

function populateProfileForm(u) {
  document.getElementById('profile-edit-name').value = u.name || '';
  document.getElementById('profile-edit-lastname').value = u.lastName || '';
  document.getElementById('profile-edit-email').value = u.email || '';
  document.getElementById('profile-edit-phone').value = u.phone || '';
  document.getElementById('profile-edit-birthdate').value = u.birthdate || '';
  document.getElementById('profile-edit-country').value = u.country || '';

  // Avatar color picker
  const colorGrid = document.getElementById('profile-avatar-colors');
  colorGrid.innerHTML = AVATAR_COLORS.map(c =>
    `<button class="palette-swatch ${c === avatarColor(u) ? 'active' : ''}" style="background:${c}"
       onclick="selectAvatarColor('${c}',this)"></button>`
  ).join('');

  // Theme palette picker
  const paletteGrid = document.getElementById('profile-palette-picker');
  const palettes = {violet:'#8B5CF6',blue:'#3B82F6',emerald:'#10B981',amber:'#F59E0B',magenta:'#EC4899',cyan:'#06B6D4',orange:'#F97316',rose:'#EF4444'};
  const currentPalette = u.palette || 'violet';
  paletteGrid.innerHTML = Object.entries(palettes).map(([k,v]) =>
    `<button class="palette-swatch ${k === currentPalette ? 'active' : ''}" style="background:${v}"
       onclick="selectProfilePalette('${k}',this)" title="${k}"></button>`
  ).join('');
}

window.selectAvatarColor = function(color, el) {
  document.querySelectorAll('#profile-avatar-colors .palette-swatch').forEach(s => s.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('profile-avatar').style.background = color;
};

window.selectProfilePalette = function(key, el) {
  document.querySelectorAll('#profile-palette-picker .palette-swatch').forEach(s => s.classList.remove('active'));
  el.classList.add('active');
  applyPalette(key);
};

window.saveProfile = function() {
  const name      = document.getElementById('profile-edit-name').value.trim();
  const lastName  = document.getElementById('profile-edit-lastname').value.trim();
  const phone     = document.getElementById('profile-edit-phone').value.trim();
  const birthdate = document.getElementById('profile-edit-birthdate').value;
  const country   = document.getElementById('profile-edit-country').value;

  const activeColor = document.querySelector('#profile-avatar-colors .palette-swatch.active');
  const avatarCol = activeColor ? activeColor.style.background : avatarColor(State.currentUser);

  const activePalette = document.querySelector('#profile-palette-picker .palette-swatch.active');
  const palette = activePalette ? activePalette.getAttribute('title') : (State.currentUser.palette || 'violet');

  if (!name || !lastName) { toast('Nombre y apellido son requeridos', 'error'); return; }

  const updated = DB.users.update(State.currentUser.id, {
    name, lastName, phone, birthdate, country,
    avatarColor: avatarCol,
    palette,
  });

  if (updated) {
    State.currentUser = updated;
    applyPalette(palette);
    document.getElementById('profile-avatar').textContent = DB.users.initials(updated);
    document.getElementById('profile-avatar').style.background = avatarCol;
    document.getElementById('profile-name').textContent = `${updated.name} ${updated.lastName}`;
    document.getElementById('profile-edit-form').classList.add('hidden');
    toast('Perfil actualizado ✓', 'success');

    // Update sidebar
    const sidebarName = document.getElementById('sidebar-user-name');
    if (sidebarName) sidebarName.textContent = `${updated.name} ${updated.lastName}`;
  }
};

// ─────────────────────────────────────────────
// GROUP SETTINGS MODAL
// ─────────────────────────────────────────────
function showGroupSettingsModal() {
  const g = State.currentGroup;
  showModal(`
    <div class="modal-title">Ajustes del Grupo</div>
    <div class="modal-subtitle">${g.name}</div>
    <div class="form-group">
      <label class="form-label">ID del Grupo (compartí para invitar)</label>
      <div style="display:flex;gap:8px">
        <input class="form-input" style="font-family:'DM Mono',monospace;letter-spacing:2px;text-transform:uppercase"
          value="${g.id.toUpperCase()}" readonly id="group-id-copy"/>
        <button class="btn-icon" onclick="copyGroupId()" title="Copiar">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
      </div>
    </div>
    <button class="btn btn-ghost btn-block" style="margin-top:20px" onclick="closeModal()">Cerrar</button>
  `);
}

window.copyGroupId = function() {
  const inp = document.getElementById('group-id-copy');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(inp.value).then(() => toast('ID copiado ✓', 'success'));
  } else {
    inp.select(); document.execCommand('copy'); toast('ID copiado ✓', 'success');
  }
};

// ─────────────────────────────────────────────
// MEMBERS MODAL
// ─────────────────────────────────────────────
function showMembersModal() {
  const g       = State.currentGroup;
  const isOwner = DB.groups.getMemberRole(g, State.currentUser.id) === 'owner';

  const membersHtml = g.members.map(m => {
    const u = DB.users.findById(m.userId);
    if (!u) return '';
    const badge = m.role === 'owner'
      ? `<span class="badge badge-accent">Admin</span>`
      : `<span class="badge" style="background:var(--bg-input);color:var(--text-muted)">Miembro</span>`;
    const removeBtn = isOwner && m.userId !== State.currentUser.id
      ? `<button class="btn btn-sm btn-danger" onclick="removeMember('${m.userId}')">Quitar</button>` : '';
    return `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
      ${avatarEl(u, 'avatar-sm')}
      <div style="flex:1">
        <div class="text-sm font-bold">${u.name} ${u.lastName}</div>
        <div class="text-xs text-muted">${u.email}</div>
      </div>
      ${badge}
      ${removeBtn}
    </div>`;
  }).join('');

  showModal(`
    <div class="modal-title">Miembros del grupo</div>
    <div class="modal-subtitle">${g.members.length} persona${g.members.length !== 1 ? 's' : ''}</div>
    <div>${membersHtml}</div>
    <div style="margin-top:16px;padding:12px;background:var(--bg-input);border-radius:var(--radius);display:flex;align-items:center;gap:8px">
      <span class="text-xs text-muted">ID: <strong style="font-family:'DM Mono',monospace;letter-spacing:1px">${g.id.toUpperCase()}</strong></span>
    </div>
    <button class="btn btn-ghost btn-block" style="margin-top:16px" onclick="closeModal()">Cerrar</button>
  `);
}

window.removeMember = function(userId) {
  DB.groups.removeMember(State.currentGroup.id, userId);
  State.currentGroup = DB.groups.findById(State.currentGroup.id);
  toast('Miembro eliminado', 'success');
  closeModal();
  renderDashboard();
};

// ─────────────────────────────────────────────
// STARTUP
// ─────────────────────────────────────────────
window.onload = async function() {
  // Check Supabase session first (handles OAuth redirect)
  if (typeof SupabaseRepo !== 'undefined') {
    try {
      const session = await SupabaseRepo.auth.getSession();
      if (session?.user) {
        // onAuthStateChange in supabase-repo.js will fire SIGNED_IN and route
        return;
      }
    } catch (e) {
      console.warn('[startup] Supabase session check failed:', e.message);
    }
  }

  // Fallback: local session
  const user = DB.session.user();
  if (user) {
    State.currentUser = user;
    applyPalette(user.palette || 'violet');
    showPage('home');
  } else {
    showPage('login');
  }
};

// Close dropdowns on outside click
window.addEventListener('click', e => {
  if (!e.target.closest('#sidebar-group-switcher')) {
    document.querySelectorAll('.switcher-dropdown').forEach(d => d.classList.add('hidden'));
  }
});
