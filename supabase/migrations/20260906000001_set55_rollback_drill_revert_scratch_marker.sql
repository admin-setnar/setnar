-- SET-55: forward-only "rollback" of 20260906000000 — the corrective
-- migration removes the object the previous one added. This is the drill's
-- entire point: prove that reverting an already-applied migration means
-- writing and applying a new one, never editing or DROP-outside-a-migration
-- the original. See docs/runbooks/BACKUP_RECOVERY.md for the timed result.
drop table public._set55_rollback_drill_marker;
