-- RLS Policies for agent_actions and agent_stats
--
-- Both tables have RLS enabled. The server uses the service_role key, which
-- bypasses RLS entirely — so these policies only affect anon/authenticated
-- callers (e.g. a misconfigured client using the anon key).
--
-- Apply in: Supabase Dashboard → SQL Editor → Run

-- ── agent_actions ─────────────────────────────────────────────────────────────
-- Contains server-side logs of agent tool executions (private operational data).
-- No client-side reads or writes should be permitted.

CREATE POLICY "agent_actions_deny_anon_all"
  ON public.agent_actions
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "agent_actions_deny_authenticated_all"
  ON public.agent_actions
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ── agent_stats ───────────────────────────────────────────────────────────────
-- Contains aggregate usage statistics (non-PII, suitable for public dashboards).
-- Reads are open; all writes are service_role-only.

CREATE POLICY "agent_stats_allow_public_select"
  ON public.agent_stats
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "agent_stats_deny_anon_insert"
  ON public.agent_stats
  FOR INSERT
  TO anon
  WITH CHECK (false);

CREATE POLICY "agent_stats_deny_authenticated_insert"
  ON public.agent_stats
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "agent_stats_deny_anon_update"
  ON public.agent_stats
  FOR UPDATE
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "agent_stats_deny_authenticated_update"
  ON public.agent_stats
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "agent_stats_deny_anon_delete"
  ON public.agent_stats
  FOR DELETE
  TO anon
  USING (false);

CREATE POLICY "agent_stats_deny_authenticated_delete"
  ON public.agent_stats
  FOR DELETE
  TO authenticated
  USING (false);
