-- ONE-TIME FIX: exam times were stored as IST wall-clock in UTC slot
-- (e.g. 11:00 AM IST was stored as 11:00 UTC instead of 05:30 UTC)
-- This migration subtracts 5h30m from all scheduled/in_progress exam timestamps.
-- Safe to run only ONCE immediately after deploying the +05:30 schedule-API fix.

UPDATE exams
SET
    start_time        = start_time        - INTERVAL '5 hours 30 minutes',
    end_time          = end_time          - INTERVAL '5 hours 30 minutes',
    reporting_time    = CASE WHEN reporting_time    IS NOT NULL
                             THEN reporting_time    - INTERVAL '5 hours 30 minutes' END,
    gate_closing_time = CASE WHEN gate_closing_time IS NOT NULL
                             THEN gate_closing_time - INTERVAL '5 hours 30 minutes' END
WHERE status IN ('scheduled', 'in_progress');
