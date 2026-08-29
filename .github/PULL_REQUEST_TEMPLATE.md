### What this changes

A sentence or two on what the change does, and why. Link the issue it closes.

### How you tested it

What you ran, and on what. `pytest` at minimum; say so if you also ran the
panel against a real Xray core or a node.

### Checklist

- [ ] `pytest` passes
- [ ] Tests added or updated for the behaviour this changes
- [ ] A change to `app/db/models.py` comes with an Alembic migration, and no
      existing table is renamed or revision reordered — the schema stays
      compatible with Marzban so installs can still migrate
- [ ] New settings are documented in `.env.example`
- [ ] User-visible changes are noted in `CHANGELOG.md` under *Unreleased*
- [ ] Python formatted with `autopep8 <file> --max-line-length 120`
