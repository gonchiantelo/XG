// =============================================
// XPENSES GAME — Data Layer (localStorage)
// =============================================

const DB = (() => {
  const KEYS = {
    USERS: 'xg_users',
    GROUPS: 'xg_groups',
    EXPENSES: 'xg_expenses',
    BUDGETS: 'xg_budgets',
    PAYMENTS: 'xg_payments',
    SESSION: 'xg_session',
    ALERTS: 'xg_alerts',
  };

  // ── Generic helpers ──────────────────────────────────────
  const load = (key) => JSON.parse(localStorage.getItem(key) || '[]');
  const save = (key, data) => localStorage.setItem(key, JSON.stringify(data));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const today = () => new Date().toISOString().split('T')[0];
  const now = () => new Date().toISOString();

  // ── Session ──────────────────────────────────────────────
  const session = {
    get: () => JSON.parse(localStorage.getItem(KEYS.SESSION) || 'null'),
    set: (userId) => localStorage.setItem(KEYS.SESSION, JSON.stringify({ userId, token: uid(), ts: now() })),
    clear: () => localStorage.removeItem(KEYS.SESSION),
    user: () => {
      const s = session.get();
      if (!s) return null;
      return users.findById(s.userId);
    }
  };

  // ── Users ────────────────────────────────────────────────
  const users = {
    all: () => load(KEYS.USERS),
    findById: (id) => load(KEYS.USERS).find(u => u.id === id) || null,
    findByEmail: (email) => load(KEYS.USERS).find(u => u.email.toLowerCase() === email.toLowerCase()) || null,
    create: (data) => {
      const all = load(KEYS.USERS);
      const user = {
        id: uid(),
        name: data.name,
        lastName: data.lastName,
        email: data.email.toLowerCase(),
        password: data.password,
        phone: data.phone || '',
        country: data.country || '',
        birthdate: data.birthdate || '',
        avatarColor: data.avatarColor || '#8B5CF6',
        isPremium: false,
        createdAt: now(),
        verificationCode: Math.floor(100000 + Math.random() * 900000).toString(),
        verified: false,
      };
      all.push(user);
      save(KEYS.USERS, all);
      return user;
    },
    update: (id, data) => {
      const all = load(KEYS.USERS);
      const i = all.findIndex(u => u.id === id);
      if (i === -1) return null;
      all[i] = { ...all[i], ...data };
      save(KEYS.USERS, all);
      return all[i];
    },
    verify: (id) => users.update(id, { verified: true }),
    initials: (user) => `${user.name[0]}${user.lastName[0]}`.toUpperCase(),
  };

  // ── Groups ───────────────────────────────────────────────
  const groups = {
    all: () => load(KEYS.GROUPS),
    forUser: (userId) => load(KEYS.GROUPS).filter(g => g.members.some(m => m.userId === userId)),
    findById: (id) => load(KEYS.GROUPS).find(g => g.id === id) || null,
    create: (data, ownerId) => {
      const all = load(KEYS.GROUPS);
      const group = {
        id: uid(),
        name: data.name,
        type: data.type || 'monthly',   // monthly | travel | event | custom
        currency: data.currency || 'ARS',
        currencySymbol: CURRENCIES[data.currency] || '$',
        palette: data.palette || 'violet',
        ownerId,
        members: [{ userId: ownerId, role: 'owner', joinedAt: now() }],
        createdAt: now(),
        isActive: true,
        startDate: data.startDate || today(),
        endDate: data.endDate || null,
      };
      all.push(group);
      save(KEYS.GROUPS, all);
      return group;
    },
    addMember: (groupId, userId, role = 'editor') => {
      const all = load(KEYS.GROUPS);
      const g = all.find(g => g.id === groupId);
      if (!g) return null;
      if (g.members.some(m => m.userId === userId)) return g;
      g.members.push({ userId, role, joinedAt: now() });
      save(KEYS.GROUPS, all);
      return g;
    },
    removeMember: (groupId, userId) => {
      const all = load(KEYS.GROUPS);
      const g = all.find(g => g.id === groupId);
      if (!g) return null;
      // Redistribute debts before removing
      g.members = g.members.filter(m => m.userId !== userId);
      save(KEYS.GROUPS, all);
      // Update expense splits for this user -> redistribute
      const allExp = load(KEYS.EXPENSES);
      allExp.forEach(e => {
        if (e.groupId === groupId) {
          e.splits = e.splits.filter(s => s.userId !== userId);
          const remaining = g.members.filter(m => m.userId !== e.paidBy);
          if (remaining.length > 0) {
            const share = e.amount / (remaining.length + 1);
            e.splits = remaining.map(m => ({ userId: m.userId, amount: share, percentage: 100 / (remaining.length + 1), settled: false }));
          }
        }
      });
      save(KEYS.EXPENSES, allExp);
      return g;
    },
    update: (id, data) => {
      const all = load(KEYS.GROUPS);
      const i = all.findIndex(g => g.id === id);
      if (i === -1) return null;
      all[i] = { ...all[i], ...data };
      save(KEYS.GROUPS, all);
      return all[i];
    },
    getMemberRole: (group, userId) => {
      const m = group.members.find(m => m.userId === userId);
      return m ? m.role : null;
    },
    canEdit: (group, userId) => {
      const role = groups.getMemberRole(group, userId);
      return role === 'owner' || role === 'editor';
    }
  };

  // ── Expenses ─────────────────────────────────────────────
  const CATEGORIES = [
    { id: 'food', label: 'Comida', icon: '🍔' },
    { id: 'home', label: 'Vivienda', icon: '🏠' },
    { id: 'transport', label: 'Transporte', icon: '🚗' },
    { id: 'leisure', label: 'Ocio', icon: '🎬' },
    { id: 'health', label: 'Salud', icon: '💊' },
    { id: 'travel', label: 'Viaje', icon: '✈️' },
    { id: 'shopping', label: 'Compras', icon: '🛒' },
    { id: 'services', label: 'Servicios', icon: '📱' },
    { id: 'other', label: 'Otro', icon: '💰' },
  ];

  const expenses = {
    all: () => load(KEYS.EXPENSES),
    forGroup: (groupId) => load(KEYS.EXPENSES).filter(e => e.groupId === groupId && e.isActive),
    forGroupMonth: (groupId, year, month) => {
      return load(KEYS.EXPENSES).filter(e => {
        if (e.groupId !== groupId || !e.isActive) return false;
        const d = new Date(e.date);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      });
    },
    create: (data) => {
      const all = load(KEYS.EXPENSES);
      const group = groups.findById(data.groupId);
      const memberIds = group.members.map(m => m.userId);
      const others = memberIds.filter(id => id !== data.paidBy);
      const perPerson = data.amount / memberIds.length;

      // Default: equitative split among all members except payer
      const defaultSplits = others.map(uid => ({
        userId: uid,
        amount: perPerson,
        percentage: 100 / memberIds.length,
        settled: false,
      }));

      const splits = data.splits || defaultSplits;

      const expense = {
        id: uid(),
        groupId: data.groupId,
        amount: parseFloat(data.amount),
        category: data.category || 'other',
        date: data.date || today(),
        paidBy: data.paidBy,
        splits,
        comment: data.comment || '',
        isFixed: data.isFixed || false,
        fixedDayOfMonth: data.isFixed ? new Date().getDate() : null,
        isActive: true,
        createdAt: now(),
        createdBy: data.createdBy || data.paidBy,
      };
      all.push(expense);
      save(KEYS.EXPENSES, all);
      // Trigger alerts
      _createExpenseAlerts(expense, group);
      return expense;
    },
    update: (id, data) => {
      const all = load(KEYS.EXPENSES);
      const i = all.findIndex(e => e.id === id);
      if (i === -1) return null;
      all[i] = { ...all[i], ...data };
      save(KEYS.EXPENSES, all);
      return all[i];
    },
    delete: (id) => {
      const all = load(KEYS.EXPENSES);
      const i = all.findIndex(e => e.id === id);
      if (i === -1) return false;
      all[i].isActive = false;
      save(KEYS.EXPENSES, all);
      return true;
    },
    processFixedExpenses: (groupId) => {
      // Called on group load — generate fixed expenses for current month if not yet done
      const all = load(KEYS.EXPENSES);
      const fixed = all.filter(e => e.groupId === groupId && e.isFixed && e.isActive);
      const curMonth = new Date().getMonth() + 1;
      const curYear = new Date().getFullYear();

      fixed.forEach(fe => {
        const alreadyGenerated = all.some(e =>
          e.groupId === groupId &&
          e.fixedParentId === fe.id &&
          new Date(e.date).getFullYear() === curYear &&
          new Date(e.date).getMonth() + 1 === curMonth
        );
        if (!alreadyGenerated) {
          const newDate = `${curYear}-${String(curMonth).padStart(2,'0')}-${String(fe.fixedDayOfMonth || 1).padStart(2,'0')}`;
          const newExp = {
            ...fe,
            id: uid(),
            date: newDate,
            fixedParentId: fe.id,
            isFixed: false,
            createdAt: now(),
          };
          all.push(newExp);
          // Alert
          const group = groups.findById(groupId);
          _createFixedExpenseAlert(newExp, group);
        }
      });
      save(KEYS.EXPENSES, all);
    },
    CATEGORIES,
    getCategory: (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1],
  };

  // ── Budgets ──────────────────────────────────────────────
  const budgets = {
    get: (userId, groupId) => {
      const all = load(KEYS.BUDGETS);
      return all.find(b => b.userId === userId && b.groupId === groupId) || null;
    },
    set: (userId, groupId, amount) => {
      const all = load(KEYS.BUDGETS);
      const i = all.findIndex(b => b.userId === userId && b.groupId === groupId);
      const budget = { userId, groupId, amount: parseFloat(amount), updatedAt: now() };
      if (i === -1) all.push(budget);
      else all[i] = budget;
      save(KEYS.BUDGETS, all);
      return budget;
    },
    getUserSpent: (userId, groupId) => {
      const curMonth = new Date().getMonth() + 1;
      const curYear = new Date().getFullYear();
      const exps = expenses.forGroupMonth(groupId, curYear, curMonth);
      // Amount user paid that they also owe a share of (their own share)
      return exps.reduce((sum, e) => {
        const mySplit = e.splits.find(s => s.userId === userId);
        if (e.paidBy === userId) {
          // They paid: their cost = their share
          return sum + (e.amount / (e.splits.length + 1));
        }
        return sum + (mySplit ? mySplit.amount : 0);
      }, 0);
    },
    checkAlert: (userId, groupId) => {
      const b = budgets.get(userId, groupId);
      if (!b || b.amount <= 0) return null;
      const spent = budgets.getUserSpent(userId, groupId);
      const remaining = b.amount - spent;
      const pct = remaining / b.amount;
      if (pct <= 0) return 'over';
      if (pct <= 0.1) return 'low';
      return null;
    }
  };

  // ── Payments / Settlements ───────────────────────────────
  const payments = {
    all: () => load(KEYS.PAYMENTS),
    forGroup: (groupId) => load(KEYS.PAYMENTS).filter(p => p.groupId === groupId),
    settle: (groupId, fromUser, toUser, amount, expenseId = null) => {
      const all = load(KEYS.PAYMENTS);
      const payment = {
        id: uid(),
        groupId, fromUser, toUser,
        amount: parseFloat(amount),
        expenseId,
        date: today(),
        createdAt: now(),
      };
      all.push(payment);
      save(KEYS.PAYMENTS, all);
      // Mark split as settled on expense if expenseId provided
      if (expenseId) {
        const allExp = load(KEYS.EXPENSES);
        const ei = allExp.findIndex(e => e.id === expenseId);
        if (ei !== -1) {
          const si = allExp[ei].splits.findIndex(s => s.userId === fromUser);
          if (si !== -1) allExp[ei].splits[si].settled = true;
          save(KEYS.EXPENSES, allExp);
        }
      }
      return payment;
    }
  };

  // ── Balance calculation ───────────────────────────────────
  const balance = {
    /**
     * Returns array of { from, to, amount, debts: [{expenseId, amount, label}] }
     * where "from" owes "to" the total amount.
     */
    forGroup: (groupId) => {
      const exps = expenses.forGroup(groupId);
      const settledPayments = payments.forGroup(groupId);

      // Build net balance map: balance[userId] = net amount (positive = owed to them, negative = owes others)
      const net = {};
      const debtDetail = {}; // debtDetail[from][to] = [{expenseId, amount, label, settled}]

      exps.forEach(e => {
        e.splits.forEach(s => {
          if (s.userId === e.paidBy) return;
          const from = s.userId;
          const to = e.paidBy;
          const amt = s.amount;

          if (!net[from]) net[from] = 0;
          if (!net[to]) net[to] = 0;

          if (!debtDetail[from]) debtDetail[from] = {};
          if (!debtDetail[from][to]) debtDetail[from][to] = [];

          debtDetail[from][to].push({
            expenseId: e.id,
            amount: amt,
            label: `${expenses.getCategory(e.category).icon} ${e.comment || expenses.getCategory(e.category).label}`,
            date: e.date,
            settled: s.settled,
          });

          if (!s.settled) {
            net[from] -= amt;
            net[to] += amt;
          }
        });
      });

      // Apply manual payments
      settledPayments.forEach(p => {
        if (!net[p.fromUser]) net[p.fromUser] = 0;
        if (!net[p.toUser]) net[p.toUser] = 0;
        net[p.fromUser] += p.amount;
        net[p.toUser] -= p.amount;
      });

      // Simplify: positive net = creditor, negative = debtor
      const creditors = Object.entries(net).filter(([,v]) => v > 0).map(([id,v]) => ({ id, amount: v }));
      const debtors = Object.entries(net).filter(([,v]) => v < 0).map(([id,v]) => ({ id, amount: -v }));

      const result = [];
      let ci = 0, di = 0;
      while (ci < creditors.length && di < debtors.length) {
        const c = creditors[ci];
        const d = debtors[di];
        const amt = Math.min(c.amount, d.amount);
        result.push({
          from: d.id,
          to: c.id,
          amount: parseFloat(amt.toFixed(2)),
          debts: (debtDetail[d.id]?.[c.id] || []),
        });
        c.amount -= amt;
        d.amount -= amt;
        if (c.amount < 0.01) ci++;
        if (d.amount < 0.01) di++;
      }
      return result;
    },

    forUser: (userId, groupId) => {
      return balance.forGroup(groupId).filter(b => b.from === userId || b.to === userId);
    },

    totalOwedBy: (userId, groupId) => {
      return balance.forGroup(groupId)
        .filter(b => b.from === userId)
        .reduce((s, b) => s + b.amount, 0);
    },

    totalOwedTo: (userId, groupId) => {
      return balance.forGroup(groupId)
        .filter(b => b.to === userId)
        .reduce((s, b) => s + b.amount, 0);
    },

    userSpentThisMonth: (userId, groupId) => {
      const d = new Date();
      const exps = expenses.forGroupMonth(groupId, d.getFullYear(), d.getMonth() + 1);
      return exps.filter(e => e.paidBy === userId).reduce((s, e) => s + e.amount, 0);
    }
  };

  // ── Monthly stats ─────────────────────────────────────────
  const stats = {
    byCategory: (groupId, year, month) => {
      const exps = expenses.forGroupMonth(groupId, year, month);
      const map = {};
      exps.forEach(e => {
        if (!map[e.category]) map[e.category] = 0;
        map[e.category] += e.amount;
      });
      return Object.entries(map).map(([catId, total]) => ({
        ...expenses.getCategory(catId), total
      })).sort((a, b) => b.total - a.total);
    },

    monthlyTotals: (groupId, numMonths = 6) => {
      const result = [];
      const now = new Date();
      for (let i = numMonths - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const exps = expenses.forGroupMonth(groupId, d.getFullYear(), d.getMonth() + 1);
        const total = exps.reduce((s, e) => s + e.amount, 0);
        result.push({
          label: d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
          total,
          year: d.getFullYear(),
          month: d.getMonth() + 1,
        });
      }
      return result;
    },

    groupTotal: (groupId) => {
      return expenses.forGroup(groupId).reduce((s, e) => s + e.amount, 0);
    }
  };

  // ── Alerts ───────────────────────────────────────────────
  const alerts = {
    all: (userId) => {
      const all = load(KEYS.ALERTS);
      return all.filter(a => a.userId === userId).sort((a, b) => new Date(b.ts) - new Date(a.ts));
    },
    unread: (userId) => alerts.all(userId).filter(a => !a.read),
    add: (userId, type, message, meta = {}) => {
      const all = load(KEYS.ALERTS);
      all.push({ id: uid(), userId, type, message, meta, read: false, ts: now() });
      save(KEYS.ALERTS, all);
    },
    markRead: (alertId) => {
      const all = load(KEYS.ALERTS);
      const i = all.findIndex(a => a.id === alertId);
      if (i !== -1) { all[i].read = true; save(KEYS.ALERTS, all); }
    },
    markAllRead: (userId) => {
      const all = load(KEYS.ALERTS);
      all.forEach(a => { if (a.userId === userId) a.read = true; });
      save(KEYS.ALERTS, all);
    }
  };

  // ── Internal alert creators ────────────────────────────────
  const _createExpenseAlerts = (expense, group) => {
    const cat = expenses.getCategory(expense.category);
    const paidByUser = users.findById(expense.paidBy);
    const sym = group.currencySymbol;
    expense.splits.forEach(s => {
      if (s.userId === expense.paidBy) return;
      const msg = `${paidByUser.name} pagó ${sym}${expense.amount.toLocaleString('es-AR')} en ${cat.label}. Te corresponden ${sym}${s.amount.toLocaleString('es-AR', {maximumFractionDigits:2})}.`;
      alerts.add(s.userId, 'new_debt', msg, { expenseId: expense.id, groupId: expense.groupId });
    });
    // Also alert group members
    group.members.forEach(m => {
      if (m.userId !== expense.paidBy && !expense.splits.some(s => s.userId === m.userId)) {
        const msg = `${paidByUser.name} agregó un gasto de ${sym}${expense.amount.toLocaleString('es-AR')} en ${cat.label}.`;
        alerts.add(m.userId, 'new_expense', msg, { expenseId: expense.id, groupId: expense.groupId });
      }
    });
  };

  const _createFixedExpenseAlert = (expense, group) => {
    const cat = expenses.getCategory(expense.category);
    const sym = group.currencySymbol;
    group.members.forEach(m => {
      alerts.add(m.userId, 'fixed_expense', `📅 Gasto fijo "${cat.icon} ${cat.label}" de ${sym}${expense.amount.toLocaleString('es-AR')} registrado automáticamente.`, { expenseId: expense.id, groupId: expense.groupId });
    });
  };

  // ── Currencies ────────────────────────────────────────────
  const CURRENCIES = {
    ARS: '$', USD: 'US$', EUR: '€', BRL: 'R$', CLP: '$', MXN: '$', COP: '$', UYU: '$U', PEN: 'S/', GBP: '£'
  };

  const CURRENCY_LIST = [
    { code: 'ARS', symbol: '$', name: 'Peso argentino' },
    { code: 'USD', symbol: 'US$', name: 'Dólar estadounidense' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'BRL', symbol: 'R$', name: 'Real brasileño' },
    { code: 'CLP', symbol: '$', name: 'Peso chileno' },
    { code: 'MXN', symbol: '$', name: 'Peso mexicano' },
    { code: 'UYU', symbol: '$U', name: 'Peso uruguayo' },
    { code: 'GBP', symbol: '£', name: 'Libra esterlina' },
  ];

  // ── Freemium checks ───────────────────────────────────────
  const freemium = {
    MAX_MEMBERS_FREE: 4,
    MAX_GROUPS_FREE: 3,
    canAddMember: (group, user) => {
      if (user.isPremium) return true;
      return group.members.length < freemium.MAX_MEMBERS_FREE;
    },
    canCreateGroup: (userId) => {
      const user = users.findById(userId);
      if (user?.isPremium) return true;
      return groups.forUser(userId).length < freemium.MAX_GROUPS_FREE;
    }
  };

  return {
    uid, today, now,
    session, users, groups, expenses, budgets,
    payments, balance, stats, alerts, freemium,
    CURRENCIES, CURRENCY_LIST,
    CATEGORIES: expenses.CATEGORIES,
    getCategory: expenses.getCategory,
  };
})();

window.DB = DB;
