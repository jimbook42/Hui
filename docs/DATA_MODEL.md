# Data model (conceptual)

Initial entity map for design discussions. **Not** a final SQL schema.

## Core entities

| Entity | Purpose |
| --- | --- |
| Account / User | Auth identity (Supabase `auth.users`) |
| Person / Profile | Display name, dietary notes, preferences |
| Group | Recurring gathering unit; settings and permissions |
| Group Membership | Person in a group; role (e.g. admin, member) |
| Household | Optional grouping of people (e.g. family unit) |
| Recurrence Series | Cadence and rules for recurring gatherings |
| Event | A specific gathering instance (recurring or one-off) |
| Event Proposal / Candidate | Proposed times or options before consensus |
| Availability / Response | Member answer per candidate (yes / no / maybe if enabled) |
| Host Assignment | Who hosts this event |
| Contribution | What someone brings; fairness tracking |
| Dietary Information | Restrictions/preferences linked to person or event |
| Memory | Photos/notes/history after an event |

## Preferred shape (direction)

One-off events are events **without** a recurrence-series link. Same proposal, response, consensus, host, contribution, and memory machinery.

```text
Group
  └── Event
       ├── recurrence_series_id (optional)
       ├── proposal / candidates
       ├── responses
       ├── consensus state
       ├── host
       ├── contributions
       └── memory
```

## Relationships (informal)

- A **Group** has many **Members** and many **Events**.
- A **Recurrence Series** belongs to a **Group** and may spawn **Events**.
- An **Event** may reference zero or one **Recurrence Series**.
- **Responses** belong to an **Event** (and candidate) and a **Member**.
- **Host**, **Contributions**, and **Memory** attach to an **Event** (and relevant members).

Final normalisation, enums, and RLS policies will be defined when implementing each phase.
