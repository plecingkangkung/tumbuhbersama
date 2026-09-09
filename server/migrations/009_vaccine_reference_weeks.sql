ALTER TABLE calendar_events ADD COLUMN is_scheduled TINYINT(1) NOT NULL DEFAULT 0;
UPDATE calendar_events SET is_scheduled=1 WHERE vaccine_key IS NULL OR due_date<>window_start OR due_time IS NOT NULL OR doctor<>'' OR location<>'' OR status='done';
DELETE r FROM calendar_reminders r JOIN calendar_events e ON e.id=r.event_id WHERE e.vaccine_key IS NOT NULL AND e.is_scheduled=0 AND e.status='planned';
