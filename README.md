# Faithful City ChurchCare

## Included updates

- Assign a shepherd to a visitor at registration or later from the visitor list. The assignment carries over when the visitor becomes a member.
- Mark up to four registered shepherds as main shepherds. Each main shepherd can oversee regular shepherds and can also have their own member group.
- Install the site on a phone home screen using the browser's Add to Home Screen / Install option.
- Glass-style translucent cards and navigation surfaces, with a solid fallback for browsers without backdrop blur.
- Browser notifications for program reminders and birthdays seven days ahead or on the day. Grant permission with the button in Programs.

## Phone notification limits

Home-screen installation makes ChurchCare easier to open but does not itself provide background push. Current browser alerts are evaluated while the site is open. To deliver push notifications when the site is fully closed, deploy a push service with VAPID keys and saved device subscriptions, then schedule birthday and program events on that service. The current Supabase setup stores ChurchCare records but does not include this push service or keys.

## Setup

Serve the folder over HTTPS, configure `supabase-config.js` with the church's Supabase project and publishable key, then open the site. In Shepherds & Groups, register each shepherd and use “Make main shepherd” for the four leads; use “Manage shepherds” on a lead's card to assign the reporting group. Assign members to leads or regular shepherds directly.
