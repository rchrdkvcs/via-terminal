# One vault for every space

- Status: accepted
- Date: 2026-10-02

Hosts, groups, identities, keys and known hosts belong to a single application-wide vault; spaces only organize tabs. Per-workspace isolation (ADR-0001) forced users to recreate the same server in each workspace and made the "saved hosts" experience feel nothing like Termius. Isolation between clients is now expressed with vault groups.
