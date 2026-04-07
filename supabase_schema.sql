-- =============================================
-- XPENSES GAME — Supabase SQL Schema
-- Copiar y pegar COMPLETO en el SQL Editor de Supabase
-- (Dashboard → SQL Editor → New Query → Pegar → Run)
-- =============================================

-- ══════════════════════════════════════════════
-- 1. PROFILES — Datos del usuario
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL DEFAULT '',
  full_name   TEXT NOT NULL DEFAULT '',
  avatar_url  TEXT DEFAULT '',
  phone       TEXT DEFAULT '',
  country     TEXT DEFAULT '',
  birthdate   DATE,
  provider    TEXT DEFAULT 'email',
  is_premium  BOOLEAN NOT NULL DEFAULT FALSE,
  palette     TEXT NOT NULL DEFAULT 'violet',
  avatar_color TEXT DEFAULT '#8B5CF6',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ══════════════════════════════════════════════
-- 2. GROUPS — Grupos de gastos
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'monthly',
  currency      TEXT NOT NULL DEFAULT 'ARS',
  currency_symbol TEXT NOT NULL DEFAULT '$',
  palette       TEXT NOT NULL DEFAULT 'violet',
  owner_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  is_monthly    BOOLEAN NOT NULL DEFAULT TRUE,
  initial_budget NUMERIC DEFAULT 0,
  start_date    DATE DEFAULT CURRENT_DATE,
  end_date      DATE,
  invite_code   TEXT UNIQUE DEFAULT UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 6)),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Users can see groups they belong to
CREATE POLICY "groups_select_member"
  ON public.groups FOR SELECT
  USING (
    id IN (
      SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    )
  );

-- Any authenticated user can create a group
CREATE POLICY "groups_insert_auth"
  ON public.groups FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Only the owner can update the group
CREATE POLICY "groups_update_owner"
  ON public.groups FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- ══════════════════════════════════════════════
-- 3. GROUP_MEMBERS — Relación N:N users↔groups
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.group_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'editor',
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Members can see other members of their groups
CREATE POLICY "group_members_select"
  ON public.group_members FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    )
  );

-- Members and owners can add members
CREATE POLICY "group_members_insert"
  ON public.group_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR
    group_id IN (
      SELECT id FROM public.groups WHERE owner_id = auth.uid()
    )
  );

-- Only owner can remove members
CREATE POLICY "group_members_delete"
  ON public.group_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR
    group_id IN (
      SELECT id FROM public.groups WHERE owner_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════
-- 4. EXPENSES — Gastos compartidos
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.expenses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  amount         NUMERIC NOT NULL CHECK (amount > 0),
  category       TEXT NOT NULL DEFAULT 'other',
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  paid_by        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment        TEXT DEFAULT '',
  is_fixed       BOOLEAN NOT NULL DEFAULT FALSE,
  fixed_day      INTEGER,
  fixed_parent_id UUID REFERENCES public.expenses(id),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Members of the group can see expenses
CREATE POLICY "expenses_select"
  ON public.expenses FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    )
  );

-- Members can insert expenses in their groups
CREATE POLICY "expenses_insert"
  ON public.expenses FOR INSERT
  WITH CHECK (
    group_id IN (
      SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    )
    AND auth.uid() = created_by
  );

-- Creator or group owner can update expenses
CREATE POLICY "expenses_update"
  ON public.expenses FOR UPDATE
  USING (
    created_by = auth.uid()
    OR group_id IN (
      SELECT id FROM public.groups WHERE owner_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════
-- 5. SPLITS — División de cada gasto
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.splits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id  UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      NUMERIC NOT NULL DEFAULT 0,
  percentage  NUMERIC DEFAULT 0,
  settled     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.splits ENABLE ROW LEVEL SECURITY;

-- Members can see splits for their group expenses
CREATE POLICY "splits_select"
  ON public.splits FOR SELECT
  USING (
    expense_id IN (
      SELECT e.id FROM public.expenses e
      JOIN public.group_members gm ON gm.group_id = e.group_id
      WHERE gm.user_id = auth.uid()
    )
  );

-- Members can insert splits
CREATE POLICY "splits_insert"
  ON public.splits FOR INSERT
  WITH CHECK (
    expense_id IN (
      SELECT e.id FROM public.expenses e
      JOIN public.group_members gm ON gm.group_id = e.group_id
      WHERE gm.user_id = auth.uid()
    )
  );

-- Members can update splits (mark as settled)
CREATE POLICY "splits_update"
  ON public.splits FOR UPDATE
  USING (
    user_id = auth.uid()
    OR expense_id IN (
      SELECT e.id FROM public.expenses e
      JOIN public.groups g ON g.id = e.group_id
      WHERE g.owner_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════
-- 6. PAYMENTS — Registros de pago/saldo
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  from_user   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      NUMERIC NOT NULL CHECK (amount > 0),
  settled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select"
  ON public.payments FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "payments_insert"
  ON public.payments FOR INSERT
  WITH CHECK (
    from_user = auth.uid()
    OR group_id IN (
      SELECT id FROM public.groups WHERE owner_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════
-- 7. BUDGETS — Presupuesto por usuario/grupo
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.budgets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id   UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  amount     NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, group_id)
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budgets_select_own"
  ON public.budgets FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "budgets_upsert_own"
  ON public.budgets FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "budgets_update_own"
  ON public.budgets FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ══════════════════════════════════════════════
-- 8. TRIGGER — Auto-crear perfil al registrarse
-- ══════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, provider)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ══════════════════════════════════════════════
-- 9. ÍNDICES — Para performance
-- ══════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_group_members_user  ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_group      ON public.expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date       ON public.expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by    ON public.expenses(paid_by);
CREATE INDEX IF NOT EXISTS idx_splits_expense      ON public.splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_splits_user         ON public.splits(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_group      ON public.payments(group_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_group  ON public.budgets(user_id, group_id);
