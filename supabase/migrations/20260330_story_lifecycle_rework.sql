-- Story Lifecycle Rework: Trade-cycle seasons
-- Episodes now have types (analysis → position_entry → position_management)
-- and track which scenario triggered them.

ALTER TABLE story_episodes ADD COLUMN IF NOT EXISTS episode_type VARCHAR(30) DEFAULT 'analysis';
ALTER TABLE story_episodes ADD COLUMN IF NOT EXISTS triggered_scenario_id UUID REFERENCES story_scenarios(id);
