# Little Wins

A shared family chore board hosted on GitHub Pages and backed by Supabase.

## Features

- Add, edit, complete, and remove chores.
- Track chore name, date added, assigned family member, and points.
- Filter chores by family member or completion status.
- Award personal points to whoever checks off each completed chore, including chores assigned to Anyone.
- Keep list updates synchronized across devices.

## Family access

The board uses a shared family password, so family members do not need accounts. Anyone with the password can view and change the list. Share it only with your family.

The password is stored as a SHA-256 hash in the database. The public Supabase API key in app.js is intended for browser use; the server key stays in Supabase Edge Function secrets.

## Project files

- index.html — family board interface.
- app.js — browser app and shared-list connection.
- supabase/schema.sql — database tables and access settings.
- supabase/functions/family-board/index.ts — server-side list operations.

The Supabase Edge Function is deployed as family-board. GitHub Pages publishes the site from the repository root.
