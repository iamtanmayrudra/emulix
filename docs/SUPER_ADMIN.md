# Organization plan and the super admin

Status: **built as a working prototype** (section 13). Storage is in memory, and there is no way to buy the plan yet.
This document describes the Organization plan and the super admin role.
It follows the style of [AUTH_AND_SUBSCRIPTION.md](AUTH_AND_SUBSCRIPTION.md). Where it gives a concrete value, that
value is a proposed default to confirm before build. Open questions are collected in section 11.

## 1. Summary

- The **Organization plan** is for a company that wants control over who on its team uses Emulix.
- Only **4 members** of an organization can use the platform **at a time**. The limit is the number of **seats**.
- The **super admin** chooses, inside the app, which members hold the 4 seats. The choice can be changed at any time.
- The super admin has **one kind of permission: control of all user accounts** in the organization. The role cannot
  see or touch what members test, audit or upload, and it cannot change billing.

The plan appears on the pricing page as "Coming soon". Its price is not set (plan decision 4).

## 2. Terms

| Term | Meaning |
| --- | --- |
| Organization | A company account that groups users under one plan |
| Super admin | The one role that controls user accounts in an organization |
| Member | A person with an account in the organization |
| Seat | Permission to use the platform. The plan has 4 seats |
| Seated member | A member who currently holds a seat and can use the platform |
| Unseated member | A member with an account but no seat. They can sign in, but cannot use the platform |

## 3. Roles

There are two roles in an organization.

| Role | What it is for | Uses a seat? |
| --- | --- | --- |
| Super admin | Controls user accounts | No |
| Member | Uses the platform when they hold a seat | Yes, while seated |

The super admin account is an administrator account. It does **not** use a seat and does **not** run tests, audits or
APK uploads. A person who needs to do both holds two accounts: a super admin account and a member account. This keeps
the permission rule simple: the super admin role never touches member data.

An organization always has **at least one** super admin. The first super admin is the person who sets the
organization up. More than one super admin is allowed.

## 4. The seat rule: 4 at a time

1. An organization has **4 seats**. The number is a plan setting, so it can change without code changes.
2. A seat is held by one seated member. The super admin **selects** the members who hold seats, in the app.
3. At most 4 members are seated at any moment. The server refuses a 5th seat. The super admin must free a seat first.
4. An organization may have more than 4 member accounts. Members without a seat stay in the list as unseated.
5. Changing who holds a seat takes effect immediately.
6. Seat checks happen **on the server for every protected request**, never only in the browser. This follows the
   entitlement rules in section 4 of the subscription document.

Chosen reading of "4 at a time": **named seats**. The super admin picks four people, and only those four can use the
platform. An alternative, a shared pool where any four signed-in members can use it at once, is listed as an open
question (section 11). The named-seat reading matches "the super admin selects" and is the one specified here.

## 5. Super admin permissions

The super admin can do these, and only these:

| Permission | Detail |
| --- | --- |
| See all accounts | List every member: name, email, status, seated or unseated, last sign-in date |
| Invite a member | Send an email invitation. The person creates their own password |
| Select who holds a seat | Give a seat to an unseated member, or take it from a seated member. Never more than 4 at once |
| Deactivate a member | Blocks sign-in. All of that member's sessions end. Data is kept |
| Reactivate a member | Restores sign-in. The member returns to unseated and needs a seat to use the platform |
| Remove a member | Takes the account out of the organization. Needs confirmation |
| Send a password reset | Emails the member a reset link. The super admin never sees or sets the password |
| Unlock an account | Clears a temporary lockout after failed sign-ins |
| Sign a member out everywhere | Ends every session of that member |
| Rename or correct a member | Fix the display name or the email address, with re-verification of a new email |
| Manage other super admins | Add or remove a super admin. The last one cannot be removed |
| Read the account activity log | A record of every account action in the organization |

### What the super admin cannot do

| Not permitted | Why |
| --- | --- |
| See or open members' tests, results, reports, audits or uploaded files | The role controls accounts, not member data |
| Run tests, audits or APK uploads | An administrator account has no seat |
| View or set a password | Only a reset link is possible, and the member chooses the password |
| Sign in as a member, or impersonate one | Access to accounts is controlled, not borrowed |
| Change billing, the card, or the plan | Outside user-account control (see open question 11.2) |
| Delete another organization's data | Everything is scoped to one organization |
| Increase the seat count | The count belongs to the plan |

A request outside these permissions returns **403** with a short message, and is written to the activity log.

## 6. Permission matrix

| Action | Super admin | Seated member | Unseated member |
| --- | --- | --- | --- |
| Use the platform (tests, audits, reports) | No | Yes | No |
| See own account and own results | Account only | Yes | Account only |
| List all accounts in the organization | Yes | No | No |
| Invite, deactivate, reactivate or remove members | Yes | No | No |
| Select who holds a seat | Yes | No | No |
| Send a reset link or unlock an account | Yes | No | No |
| Read the account activity log | Yes | No | No |
| See other members' results | No | No | No |
| Change billing | No | No | No |

## 7. Scenarios

### 7.1 Setting up the organization

1. A person chooses the Organization plan and completes sign-up. (The purchase flow is not built. See 11.2.)
2. The server creates the organization and makes that person its **super admin**.
3. They land on the **Users** screen. It is empty apart from themselves.

### 7.2 Inviting members

1. The super admin enters a name and an email address and sends the invitation.
2. The server creates a pending invitation that expires in 7 days and emails a single-use link.
3. The person opens the link, sets a password, and the account becomes a member, **unseated**.
4. The super admin sees the new member in the list as "Unseated".

An invitation for an email that already belongs to another organization gets the same response as any other. The
screen does not reveal that the account exists elsewhere.

### 7.3 Selecting who uses the platform

1. On the Users screen the super admin sees the seat counter, for example **3 of 4 seats used**.
2. They turn a seat on for an unseated member. The counter becomes **4 of 4**.
3. The member can use the platform from their next request.

### 7.4 The fifth seat

1. All 4 seats are used. The super admin tries to seat a fifth member.
2. The server refuses and the screen says: "All 4 seats are in use. Take a seat from a member first."
3. Nothing changes. The attempt is logged.

### 7.5 Swapping a seat

1. The super admin takes a seat from member A and gives it to member B, in one action.
2. A and B change together, so the count never goes above 4 during the swap.
3. A's open sessions stay signed in but lose platform access. A sees the "no seat" screen (7.6).
4. Tests that A started before the swap finish. New ones are refused.

### 7.6 A member without a seat signs in

1. The member signs in with the correct password. Sign-in works.
2. Every platform page shows one screen: "You don't have a seat. Ask your super admin to give you one."
3. The member can still change their own password and sign out.

### 7.7 Deactivating or removing a member

1. The super admin deactivates a member. Their sessions end at once and sign-in is blocked.
2. If the member held a seat, the seat is freed in the same action.
3. Removing a member takes the account out of the organization. The member's results follow the retention rules of
   the subscription document, and the super admin never gets access to them.

### 7.8 Helping someone who is locked out

1. The member forgot their password, or their account is locked after failed sign-ins.
2. The super admin sends a reset link, or unlocks the account. Neither exposes a password.
3. The member sets a new password themselves. All their older sessions end.

### 7.9 The super admin reaches outside the role

1. The super admin opens a link to a member's report, or calls an endpoint for member data.
2. The server answers **403**: "This is outside what a super admin can do."
3. The attempt appears in the activity log.

### 7.10 Handing over the role

1. The super admin adds a second super admin, or hands the role to someone else.
2. The action needs the current super admin's password again.
3. The last super admin cannot be removed or deactivated. The server refuses and explains why.

### 7.11 The subscription lapses

1. The Organization subscription expires or a renewal fails.
2. Following the downgrade rules in the subscription document, the organization drops to Free. Data is kept.
3. Member accounts and the seat choices are kept, so renewing restores the setup.

## 8. Data the feature needs

Sketch only. Names are proposals.

| Record | Fields |
| --- | --- |
| Organization | id, name, plan status, seat limit (4), created date |
| Membership | user id, organization id, role (`super_admin` or `member`), status (`invited`, `active`, `deactivated`), seat held (yes or no), invited by, dates |
| Invitation | token hash, email, organization id, expires at, used at |
| Account activity | actor, action, target member, result, time |

The Membership record is what the server reads on every request to answer two questions: does this person hold a
seat, and is this person a super admin.

## 9. Screens and endpoints

| Route | Who | Purpose |
| --- | --- | --- |
| `/admin/users` | Super admin | Member list, seat counter, invite, seat toggles, row actions |
| `/admin/activity` | Super admin | Account activity log |
| `/invite?token=…` | Invited person | Set a password and join |
| `/no-seat` | Unseated member | Explains why the platform is unavailable |

Proposed endpoints, all scoped to the caller's organization:

| Endpoint | Action |
| --- | --- |
| `GET /api/org/members` | List members |
| `POST /api/org/members/invite` | Invite a member |
| `PATCH /api/org/members/:id/seat` | Give or take a seat |
| `POST /api/org/members/:id/deactivate` and `/reactivate` | Change status |
| `DELETE /api/org/members/:id` | Remove a member |
| `POST /api/org/members/:id/reset-password` | Send a reset link |
| `POST /api/org/members/:id/unlock` | Clear a lockout |
| `POST /api/org/members/:id/sign-out` | End all sessions |
| `GET /api/org/activity` | Read the activity log |

Every endpoint checks, in order: signed in, member of this organization, role is super admin, and the target belongs
to the same organization. Anything else is refused.

## 10. Security rules

- Role and seat checks run on the server for every request. The browser is never trusted.
- Sensitive super admin actions need the password again when the session is older than 15 minutes: removing a member,
  adding or removing a super admin, and signing a member out everywhere.
- Every account action is written to the activity log with who did it, to whom, and when. Log entries cannot be edited.
- The super admin can only reach accounts in their own organization. Identifiers from other organizations return 404.
- Invitation and reset links are single use, stored hashed, and expire.
- Rate limits apply per super admin and per organization, so a stolen super admin session cannot mass-edit accounts.
- The server keeps one super admin at all times. A request that would leave none is refused.
- Responses never show whether an email belongs to an account in another organization.

## 11. Open questions

1. **Named seats or shared pool.** Section 4 chooses named seats. Should four people be chosen, or may any four
   members be signed in at once?
2. **Who buys and who pays.** The super admin cannot change billing. Which account buys the plan, updates the card
   and sees invoices, if it is not the super admin?
3. **Super admin as a user.** Can one person be both a super admin and a seated member, or must they hold two accounts?
4. **Member limit.** Is there a cap on how many unseated member accounts an organization can hold?
5. **Price and plan.** Price, billing period and whether each seat gets the full Pro feature set are not decided.
6. **Seat swaps.** Is there a limit on how often seats can change, so the 4-seat rule cannot be shared out by
   rotating one account through many people?
7. **Removed members.** What happens to a removed member's results, and can they keep the account as a Free user?
8. **Single sign-on.** Should members be able to join through the company's own login later?

## 12. Acceptance criteria

- An organization never has more than 4 seated members, even under simultaneous requests.
- A 5th seat request is refused and leaves everything unchanged.
- A swap moves a seat from one member to another without ever showing more than 4 seats in use.
- An unseated member can sign in and reach only the "no seat" screen and their own password settings.
- A super admin request for a member's tests, reports or files returns 403 and is logged.
- The super admin never sees or sets a password. Only reset links are sent.
- Deactivating a member ends all of their sessions and frees their seat in the same action.
- The last super admin cannot be removed or deactivated.
- Every account action appears in the activity log with actor, target and time.
- A super admin cannot read or change any record that belongs to another organization.
- When the subscription lapses, the organization drops to Free and the seat choices are kept.

## 13. What is built

The rules above run in the prototype today. Try them with the demo organization, which exists only outside production.
Each login's password is the login itself.

| Login | Role | Seat |
| --- | --- | --- |
| `superadmin` | Super admin | Not needed |
| `alice`, `bob`, `carol` | Member | Seated (3 of 4 seats used) |
| `dave`, `erin` | Member | No seat, so a fifth seat can be refused |

| Part | Where |
| --- | --- |
| Rules: seats, roles, activity log | `src/lib/org/service.ts` (30 tests in `tests/org.test.ts`) |
| Storage (in memory) | `src/lib/org/store.ts` |
| Super admin endpoints | `src/app/api/org/` |
| Screens | `/admin/users`, `/admin/activity`, `/invite`, `/no-seat` |
| Seat and role checks on every platform request | `platformGate` in `src/lib/org/runtime.ts`, used by the browser, test-job and billing endpoints |
| Sign-in block, redirects and Pro through the organization | the login route, `RequireSession`, `effectiveSubscription` |

Where the prototype differs from the text above:

- **Password confirmation is always asked** for the sensitive actions (remove a member, change a role, invite a super
  admin, sign a member out everywhere), not only after 15 minutes. This is stricter than section 10.
- **Added beyond the table in section 5:** moving a seat in one step (`POST /api/org/seats/swap`) and cancelling a
  pending invitation (`DELETE /api/org/invitations/:id`).
- **Chosen defaults for the open questions:** named seats (11.1), a separate account for anyone who needs to be both
  super admin and member (11.3), and a removed member keeps a plain Free account (11.7).
- **Not built:** buying the plan (the pricing card says "Coming soon"), a database, the lapse trigger from a real
  subscription, and single sign-on.
- A member without a seat can ask for a password reset link from the no-seat page. There is no separate
  change-password screen yet.
