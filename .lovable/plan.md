# Editable Registrations + Optional Payment

Two additions to the tournament registration system:

1. Admins can edit a registration page after it's created.
2. A registration can be marked "No payment required" — no amount, no Venmo link.

## 1. Edit an existing registration

On the registration detail screen (the page you're on now), add an **Edit Details** button next to the title. It opens the same form used for creating, pre-filled with the current values: name, description, location, event dates, payment setting, amount, amount type, Venmo link.

- Save updates the record and refreshes the page details immediately.
- Cancel discards changes.
- The share link, share code, entries, and Google Sheet link are unaffected by edits.

## 2. "No payment required" option

In the create/edit form, add a toggle: **Payment required for registration**.

- When ON (default): Amount, Amount Type, and Venmo Link show and are required, exactly as today.
- When OFF: those three fields are hidden and not required.

Downstream behavior when payment is not required:

- **Public registration page**: hides the amount line, the "Pay via Venmo" button, and the entire Payment section (the "I have sent / will send my payment" checkbox and amount field).
- **Confirmation email**: drops the "please submit payment / Venmo" paragraph and the Venmo button; keeps the congratulations + tournament name and the welcome/password-setup content for new accounts.
- **Admin registrant list and Google Sheet**: unchanged in structure; payment simply stays blank/No.

## Technical notes

- Migration: add `payment_required boolean not null default true` to `tournament_registration_configs`, and relax `amount` / `venmo_link` / `amount_label` to nullable so no-payment configs can be stored. Existing rows keep `payment_required = true`.
- `RegistrationConfigForm.tsx`: accept optional `initialValues` and a `mode` of create/edit, add the payment toggle, and make amount/Venmo validation conditional. Reused for both create and edit so the two stay in sync.
- `TournamentRegistrationAdmin.tsx`: add edit state + an update handler writing to `tournament_registration_configs`, and pass `payment_required` through on create.
- `TournamentRegistration.tsx`: conditional rendering of the payment/Venmo UI based on `config.payment_required`.
- `submit-tournament-registration` edge function: read `payment_required` with the other config fields and skip the payment paragraph/Venmo button when false.
