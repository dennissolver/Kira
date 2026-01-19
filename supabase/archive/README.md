# Archive - Historical Migrations

These files are **for reference only**. Do NOT run them.

The active schema is in `../migrations/20260119000000_kira_complete.sql`.

## Files

| File | Original Purpose |
|------|-----------------|
| `20260119000000_kira_standalone.sql` | Initial core tables |
| `20260119000001_add_knowledge_and_setup.sql` | Knowledge base + setup sessions |
| `add_conversation_messages.sql` | Conversation continuity feature |
| `add_email_logs.sql` | Email system |

## Why Archived?

These individual migrations were combined into a single `kira_complete.sql` for:
- Simpler deployment (one script to run)
- No dependency/ordering issues
- Single source of truth

## When to Reference

- Understanding what a specific feature needs
- Debugging table-specific issues
- Rolling back a specific feature (copy relevant DROP statements)
