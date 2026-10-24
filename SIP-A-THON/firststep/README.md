# SymbioNet MVP

A small functional demo connecting businesses, students, and mentors through real project work. One selected student and one assigned mentor per project; a completed project earns an experience record backed by its approved deliverables.

## Run locally

Requires Node.js 20 or newer. There are no packages to install and no build step.

From the SIP-A-THON workspace:

```powershell
cd firststep
node server.mjs
```

Open **http://localhost:4173**. `npm start` is an equivalent command from `firststep`. Stop the server with Ctrl+C. On PowerShell, a different port can be selected with `$env:PORT = '4174'` before running the server.

Serve the `dist` directory over HTTP; do not open `index.html` directly because the app uses JavaScript modules. The local server binds only to this computer. For a static host, publish only `dist`; no backend is required. The hosted web app uses this same static bundle at https://symbionet-mvp.citruspanda259.chatgpt.site. Hosting starts private to the owner. The local server is only needed for local development; the hosted version runs without it.

## Try the full journey

Use **Viewing as** in the top-right corner to switch roles. The in-app **How SymbioNet works** page also explains this walkthrough (`#/guide`).

1. **Alex Morgan · business:** Post a project with a brief, skills, duration, and first milestone.
2. **Maya Chen or Noah Williams · student:** Open that project under Discover projects and apply.
3. **Alex:** Open My workspace, select exactly one applicant, and assign Sofia or Daniel as mentor. Other applicants are marked not selected. Add any extra milestones before the first submission.
4. **The selected student:** Open the project and submit a deliverable link with notes.
5. **The assigned mentor:** Evaluate each deliverable with a 1–5 score and feedback. Approve it or request changes.
6. **Alex:** Approve mentor-reviewed work or request changes. A revision is a new submission and requires fresh mentor evaluation and client approval.
7. **The selected student:** Once all milestones are approved, view Experience and export the record as JSON.

All commands enforce the same rules in `dist/domain.js`; hiding a button is not the only workflow check. These are consistency checks inside a demo, not secure authorization.

## Seeded examples

All names and project scenarios are fictional. Seed data is created through the same workflow functions as the UI.

| Project | Starting point |
| --- | --- |
| Design a more useful resource library | Open for applications |
| Find our next community of customers | Open, with Noah's application |
| Make our impact visible | Maya + Daniel, two milestones ready for work |
| A clearer welcome for new customers | Mentor-approved, waiting for Alex's client approval |
| Turn customer feedback into a roadmap | Completed, with Maya's experience record |

**Reset demo** in the footer or guide restores these examples. Seeded deadlines are relative to when the demo is initialized. Reset generates new project and record IDs, so old project links no longer resolve.

## What is real and what is simulated

- **Functional:** posting, applications, exclusive student selection, manual mentor assignment, milestones, linked deliverables, scored mentor evaluations, client approval, revisions with preserved history, completion, record export, filtering, and browser persistence.
- **Simulated accounts:** the switcher impersonates fictional users. There is no sign-in, account creation, server authorization, or tenant isolation. Anyone using the demo can choose any role and inspect or alter its browser data.
- **Browser-only storage:** state is stored under `firststep-demo-v1` in localStorage, with the selected account under `firststep-account-v1`. The original storage key names are retained so the rename preserves existing local demo data. Data is specific to that browser and origin. Different ports or hosts have separate data. There is no database, cross-device collaboration, or dependable concurrent multi-user editing. Other tabs on the same origin refresh when saved state changes.
- **Linked deliverables:** students provide HTTP(S) links and notes. No files are uploaded or fetched by SymbioNet. Seeded example.com links are placeholders, not real work. A link's existence, permissions, or content is not validated.
- **Workflow verification only:** the app issues an illustrative record after the mentor and client approve every milestone's latest submission. It includes skills, participants, final evidence, feedback, dates, and mean mentor score. It is not a signed credential, public verification service, identity check, or external certification.
- **Deliberately omitted:** payments, contracts, email, messaging, automated mentor matching, user management, editing published briefs, and reassignment/cancellation after selection.
- **Scope is fixed once work is submitted:** milestones can be added before the first submission. Completed projects and their evidence are locked through the app. Feedback is required even for approval to keep the record useful.

The project is intended as a single-person prototype, not for hosting confidential real project data. A production implementation needs authenticated identities, server-enforced permissions and transitions, durable storage, and a real verification policy.

## Check the workflow

```powershell
node --test
```

Tests use Node's built-in runner. They exercise the complete lifecycle, role and assignment restrictions, exclusive selection, revision paths, review ordering, all-milestone completion, snapshot evidence, invalid input, and coherent seed data.

Initial validation: 12 tests pass. A browser walkthrough also completed posting, applying, selection, assignment, submission, a mentor change request, revision, mentor approval, client approval, experience issuance, refresh persistence, and JSON export. The exported record contains the final approved revision and both review decisions. The interface was checked at desktop and narrow mobile widths.

## Structure

- `dist/index.html`, `dist/styles.css`: responsive, dependency-free interface.
- `dist/app.js`: routes, forms, account switching, rendering, persistence, exports.
- `dist/domain.js`: immutable state transitions and workflow constraints.
- `dist/seed.js`: representative examples created through valid transitions.
- `server.mjs`: small loopback-only static server; does not handle business data.
- `tests/domain.test.js`: meaningful workflow and invariants tests.
- `MODEL.md`: implemented UML associations, multiplicities, and constraints.

The referenced chat exposed the Model A decision but not its detailed assistant-written UML. `MODEL.md` makes the concrete implementation choices explicit rather than claiming an exact recovery of that missing diagram.
