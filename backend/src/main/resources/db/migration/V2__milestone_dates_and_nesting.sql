-- Milestones get a span and one level of nesting.
--
-- A milestone was a title and a deadline. In practice people write one that is
-- really several — "Deep understanding of Linux, foundation to advanced" — and
-- then have nowhere to put the parts. Sub-milestones give them somewhere, and a
-- start date turns a deadline into a span you can see yourself inside.

ALTER TABLE goal_milestones
    ADD COLUMN start_date DATE,
    -- Self-reference rather than a separate table: a sub-milestone is the same
    -- thing at a smaller size, and duplicating the columns would mean every
    -- future milestone field had to be added in two places.
    ADD COLUMN parent_id  UUID REFERENCES goal_milestones (id) ON DELETE CASCADE;

-- Both dates are optional, but a span that ends before it starts is a typo.
ALTER TABLE goal_milestones
    ADD CONSTRAINT ck_goal_milestones_range
    CHECK (start_date IS NULL OR target_date IS NULL OR target_date >= start_date);

-- A milestone cannot be its own parent. Deeper cycles are impossible because
-- the service refuses to nest more than one level (see GoalService), which this
-- constraint cannot express on its own.
ALTER TABLE goal_milestones
    ADD CONSTRAINT ck_goal_milestones_not_self_parent
    CHECK (parent_id IS NULL OR parent_id <> id);

-- Children are read per parent, and the top level is read as "parent_id IS NULL".
CREATE INDEX ix_goal_milestones_parent ON goal_milestones (parent_id, order_index)
    WHERE parent_id IS NOT NULL;

-- Replaces the index from V1: ordering is now per level, not per goal.
DROP INDEX IF EXISTS ix_goal_milestones_goal;
CREATE INDEX ix_goal_milestones_goal_top ON goal_milestones (goal_id, order_index);
