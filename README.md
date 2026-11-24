# What Determines Time?

An almanac of sixteen engraved instruments for telling time, with a guessing game that unlocks them from the most literal to the most abstract.

## Publish

This folder is a complete static website. Upload the whole folder as-is to any static host
(GitHub Pages, Netlify, Cloudflare Pages, Vercel, S3, or a plain web server). `index.html` is the entry point and every path is relative, so it also works from a subfolder or opened straight from disk.

## What's inside

    index.html          entry point
    css/site.css        layout for wide screens (scaled plate) and phones/tablets (one scrolling column)
    js/runtime.js       small renderer for the page templates
    js/app.js           boots the site and keeps it sized to the screen
    js/screens/*.js     one file per page: Home, the 16 instruments, and shared parts
    img/favicon.svg     the eye emblem

The only external request is Google Fonts (IM Fell English, IM Fell English SC, IBM Plex Mono); without it the text falls back to Georgia and the system monospace.
The No Clock leaderboard is saved in each visitor's own browser (localStorage key `wdt-ledger`).
