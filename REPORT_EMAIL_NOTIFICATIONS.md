# Problem report email notifications

New reports create a private outbox row in the same database transaction. The report remains available in the administrator inbox even if mail delivery fails.

The connected Gmail dispatcher checks the outbox hourly and sends each report to the confirmed administrator email address from the application's account. The recipient is pinned in the dispatcher configuration, never taken from a report's message or snapshot. No mail credentials or administrator addresses are stored in this public repository.

The dispatcher claims pending rows with a lease, searches Sent mail for the full report UUID before retrying, and records the Gmail message ID after delivery. Failed deliveries return to pending. Rows marked sent are never claimed again. Only the administrator may read delivery status; clients cannot modify the outbox.

The dispatcher is the ChatGPT scheduled task named `문제 신고 관리자 메일 알림`. It requires the connected Supabase and Gmail apps. It does not require a browser session or a running workspace.

Verification: `tests/report-email-database.sql` uses a transaction that rolls back all test reports and queue rows.
