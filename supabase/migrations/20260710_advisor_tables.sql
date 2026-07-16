-- Advisor Management System
-- Run this in the Supabase SQL editor: https://supabase.com/dashboard/project/bdjwhgwoztdocwdvzrem/sql

CREATE TABLE IF NOT EXISTS sg_advisors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  firm text,
  phone text,
  email text,
  mandate text,
  asset_classes text[],
  entities text[],
  fee_type text,
  fee_amount numeric,
  relationship_since date,
  active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sg_advisor_meetings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  advisor_id uuid REFERENCES sg_advisors(id) ON DELETE CASCADE,
  meeting_date date NOT NULL,
  meeting_type text NOT NULL,
  attendees text,
  raw_notes text,
  ai_summary text,
  next_meeting_date date,
  created_by text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sg_advisor_actions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id uuid REFERENCES sg_advisor_meetings(id) ON DELETE CASCADE,
  advisor_id uuid REFERENCES sg_advisors(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  description text NOT NULL,
  security_name text,
  asset_class text,
  entity_name text,
  target_amount numeric,
  timeline text,
  priority text DEFAULT 'Medium',
  status text DEFAULT 'Pending',
  acted_date date,
  pnl_impact numeric,
  auto_detected boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sg_advisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sg_advisor_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sg_advisor_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON sg_advisors FOR ALL USING (true);
CREATE POLICY "Allow all" ON sg_advisor_meetings FOR ALL USING (true);
CREATE POLICY "Allow all" ON sg_advisor_actions FOR ALL USING (true);
