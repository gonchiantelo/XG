/* =============================================
   XPENSES GAME — Supabase Repository Layer
   Implements OAuth2 (Google/Apple) + async CRUD
   respecting RLS policies per user/group.

   SETUP: Replace the two constants below with
   your actual Supabase project credentials.
   ============================================= */
'use strict';

// ─────────────────────────────────────────────
// CONFIG  ← replace with your project values
// ─────────────────────────────────────────────
const SUPABASE_URL = 'https://kpaesshzpquanvnarjth.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwYWVzc2h6cHF1YW52bmFyanRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1Njc4NDUsImV4cCI6MjA5MTE0Mzg0NX0.BDxqoqaGF7BTFn3di5_QjV4NrZcUz03Ey_MjAVulyTc';

// ─────────────────────────────────────────────
// CLIENT — singleton
// ─────────────────────────────────────────────
let _client = null;

function getSupabaseClient() {
  if (_client) return _client;
  // supabase-js v2 UMD exposes `window.supabase`
  if (typeof window.supabase === 'undefined') {
    console.warn('[SupabaseRepo] SDK not loaded — OAuth will be disabled.');
    return null;
  }
  _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: {
      persistSession: true,          // keeps session in localStorage
      autoRefreshToken: true,
      detectSessionInUrl: true,      // handles OAuth redirect fragment
    }
  });
  return _client;
}

// ─────────────────────────────────────────────
// AUTH REPOSITORY
// ─────────────────────────────────────────────
const AuthRepo = {
  /**
   * Sign in with an OAuth provider (Google | Apple).
   * Supabase handles the full PKCE redirect flow.
   * @param {'google'|'apple'} provider
   */
  async signInWithOAuth(provider) {
    const sb = getSupabaseClient();
    if (!sb) {
      toast('Supabase no configurado. Usá email/contraseña.', 'error');
      return;
    }
    const { error } = await sb.auth.signInWithOAuth({
      provider,
      options: {
        // After OAuth redirect, land back on the app
        redirectTo: window.location.origin + window.location.pathname,
        // Request profile scopes for Google
        scopes: provider === 'google' ? 'profile email' : undefined,
      },
    });
    if (error) {
      console.error('[Auth] OAuth error:', error.message);
      toast('Error al iniciar sesión: ' + error.message, 'error');
    }
  },

  /**
   * Sign in with email + password (Supabase Auth).
   */
  async signInWithEmail(email, password) {
    const sb = getSupabaseClient();
    if (!sb) return null;
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  },

  /**
   * Register a new user via email + password.
   */
  async signUp(email, password, metadata = {}) {
    const sb = getSupabaseClient();
    if (!sb) return null;
    const { data, error } = await sb.auth.signUp({
      email, password,
      options: { 
        data: metadata,
        emailRedirectTo: 'https://gonchiantelo.github.io/XG/'
      }
    });
    if (error) throw error;
    return data.user;
  },

  /** Sign out current session. */
  async signOut() {
    const sb = getSupabaseClient();
    if (!sb) return;
    await sb.auth.signOut();
  },

  /** Get current session synchronously from cache. */
  async getSession() {
    const sb = getSupabaseClient();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session;
  },

  /**
   * Subscribe to auth state changes.
   * Callback receives (event, session).
   * Events: SIGNED_IN | SIGNED_OUT | TOKEN_REFRESHED | USER_UPDATED
   */
  onAuthStateChange(callback) {
    const sb = getSupabaseClient();
    if (!sb) return { unsubscribe: () => { } };
    const { data: { subscription } } = sb.auth.onAuthStateChange(callback);
    return subscription;
  },
};

// ─────────────────────────────────────────────
// PROFILES REPOSITORY (table: profiles)
// RLS: users can only SELECT/UPDATE their own row
// ─────────────────────────────────────────────
const ProfilesRepo = {
  /** Upsert profile after OAuth sign-in */
  async upsert(userId, fields = {}) {
    const sb = getSupabaseClient();
    if (!sb) return null;
    const { data, error } = await sb
      .from('profiles')
      .upsert({ id: userId, updated_at: new Date().toISOString(), ...fields }, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getById(userId) {
    const sb = getSupabaseClient();
    if (!sb) return null;
    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  },

  async update(userId, fields) {
    const sb = getSupabaseClient();
    if (!sb) return null;
    const { data, error } = await sb
      .from('profiles')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

// ─────────────────────────────────────────────
// GROUPS REPOSITORY (table: groups + group_members)
// RLS: user can only see groups they belong to
// ─────────────────────────────────────────────
const GroupsRepo = {
  /** Fetch all groups the current user belongs to */
  async forCurrentUser() {
    const sb = getSupabaseClient();
    if (!sb) return [];
    const { data, error } = await sb
      .from('groups')
      .select(`
        *,
        group_members(user_id, role, joined_at),
        expenses(id, amount)
      `)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getById(groupId) {
    const sb = getSupabaseClient();
    if (!sb) return null;
    const { data, error } = await sb
      .from('groups')
      .select(`*, group_members(user_id, role, joined_at)`)
      .eq('id', groupId)
      .single();
    if (error) throw error;
    return data;
  },

  async create(fields, ownerId) {
    const sb = getSupabaseClient();
    if (!sb) return null;
    // Insert group
    const { data: group, error } = await sb
      .from('groups')
      .insert({ ...fields, owner_id: ownerId })
      .select()
      .single();
    if (error) throw error;
    // Auto-add owner as member
    await sb.from('group_members').insert({ group_id: group.id, user_id: ownerId, role: 'owner' });
    return group;
  },

  async addMember(groupId, userId, role = 'editor') {
    const sb = getSupabaseClient();
    if (!sb) return null;
    const { error } = await sb
      .from('group_members')
      .upsert({ group_id: groupId, user_id: userId, role }, { onConflict: 'group_id,user_id' });
    if (error) throw error;
  },

  async removeMember(groupId, userId) {
    const sb = getSupabaseClient();
    if (!sb) return;
    await sb.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
  },
};

// ─────────────────────────────────────────────
// EXPENSES REPOSITORY (table: expenses + splits)
// RLS: user can read expenses of groups they belong to
// ─────────────────────────────────────────────
const ExpensesRepo = {
  /** All active expenses for a group */
  async forGroup(groupId) {
    const sb = getSupabaseClient();
    if (!sb) return [];
    const { data, error } = await sb
      .from('expenses')
      .select(`*, splits(*)`)
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** Expenses for a specific month */
  async forGroupMonth(groupId, year, month) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = new Date(year, month, 0).toISOString().split('T')[0]; // last day
    const sb = getSupabaseClient();
    if (!sb) return [];
    const { data, error } = await sb
      .from('expenses')
      .select(`*, splits(*)`)
      .eq('group_id', groupId)
      .eq('is_active', true)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async create(fields) {
    const sb = getSupabaseClient();
    if (!sb) return null;
    const { splits, ...expenseFields } = fields;
    const { data: expense, error } = await sb
      .from('expenses')
      .insert({ ...expenseFields, is_active: true })
      .select()
      .single();
    if (error) throw error;
    // Insert splits
    if (splits?.length) {
      const splitRows = splits.map(s => ({ expense_id: expense.id, ...s }));
      await sb.from('splits').insert(splitRows);
    }
    return expense;
  },

  async softDelete(expenseId) {
    const sb = getSupabaseClient();
    if (!sb) return;
    await sb.from('expenses').update({ is_active: false }).eq('id', expenseId);
  },
};

// ─────────────────────────────────────────────
// PAYMENTS REPOSITORY (table: payments)
// ─────────────────────────────────────────────
const PaymentsRepo = {
  async forGroup(groupId) {
    const sb = getSupabaseClient();
    if (!sb) return [];
    const { data, error } = await sb
      .from('payments')
      .select('*')
      .eq('group_id', groupId);
    if (error) throw error;
    return data || [];
  },

  async settle(groupId, fromUser, toUser, amount) {
    const sb = getSupabaseClient();
    if (!sb) return null;
    const { data, error } = await sb
      .from('payments')
      .insert({ group_id: groupId, from_user: fromUser, to_user: toUser, amount, settled_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

// ─────────────────────────────────────────────
// AUTH STATE LISTENER — bootstraps app on load
// ─────────────────────────────────────────────
(function initSupabaseAuthListener() {
  const sb = getSupabaseClient();
  if (!sb) return;

  AuthRepo.onAuthStateChange(async (event, session) => {
    console.log('[Auth] Event:', event);

    if (event === 'SIGNED_IN' && session?.user) {
      const user = session.user;

      // Upsert profile from OAuth metadata
      const meta = user.user_metadata || {};
      try {
        await ProfilesRepo.upsert(user.id, {
          email: user.email,
          full_name: meta.full_name || meta.name || '',
          avatar_url: meta.avatar_url || meta.picture || '',
          provider: user.app_metadata?.provider || 'email',
        });
      } catch (e) {
        console.warn('[Auth] Profile upsert failed:', e.message);
      }

      // Map Supabase user → app State format
      const appUser = _supabaseUserToAppUser(user);
      State.currentUser = appUser;
      applyPalette(appUser.palette || 'violet');
      showPage('home');
      return;
    }

    if (event === 'SIGNED_OUT') {
      State.currentUser = null;
      State.currentGroup = null;
      showPage('login');
    }

    if (event === 'TOKEN_REFRESHED') {
      console.log('[Auth] Token refreshed silently.');
    }
  });
})();

/**
 * Maps a Supabase User object to the shape that app.js expects.
 * Bridges OAuth users (Google/Apple) and email users.
 */
function _supabaseUserToAppUser(supabaseUser) {
  const meta = supabaseUser.user_metadata || {};
  const fullName = (meta.full_name || meta.name || supabaseUser.email || '').split(' ');
  return {
    id: supabaseUser.id,
    name: fullName[0] || 'Usuario',
    lastName: fullName.slice(1).join(' ') || '',
    email: supabaseUser.email || '',
    avatarUrl: meta.avatar_url || meta.picture || null,
    avatarColor: AVATAR_COLORS[
      Math.abs(supabaseUser.id.charCodeAt(0) + supabaseUser.id.charCodeAt(1)) % AVATAR_COLORS.length
    ],
    isPremium: false,
    palette: 'violet',
    verified: true, // OAuth users are pre-verified
    provider: supabaseUser.app_metadata?.provider || 'email',
  };
}

// ─────────────────────────────────────────────
// EXPOSE to window for app.js to consume
// ─────────────────────────────────────────────
window.SupabaseRepo = {
  auth: AuthRepo,
  profiles: ProfilesRepo,
  groups: GroupsRepo,
  expenses: ExpensesRepo,
  payments: PaymentsRepo,
  getClient: getSupabaseClient,
};
