# Little Wins

A shared family chore board hosted on GitHub Pages and backed by Supabase.

## Features

- Add, edit, complete, and remove chores.
- Track chore name, date added, assigned family member, and points.
- Filter chores by family member or completion status.
- Keep the points total and list updates synchronized across devices.

## Family access

The board uses a private invite link, so family members do not need accounts. Anyone with the link can view and change the list. Share it only with your family. Use the Reset link button in the board to invalidate the old link and copy a replacement.

The invite code is stored as a SHA-256 hash in the database. It is kept in the link fragment, which the browser does not send as part of the page request. The public Supabase API key in app.js is intended for browser use; the server key stays in Supabase Edge Function secrets.

## Project files

- index.html — family board interface.
- app.js — browser app and shared-list connection.
- supabase/schema.sql — database tables and access settings.
- supabase/functions/family-board/index.ts — server-side list operations.

The Supabase Edge Function is deployed as family-board. GitHub Pages publishes the site from the repository root.
