# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

No build step. Open `index.html` directly in a browser:

```bash
open index.html
```

## API

Uses OpenWeatherMap REST API (`https://api.openweathermap.org/data/2.5/weather`). The API key is hardcoded as a `const key` in `searchWeather()` inside `script.js`. `config.js` is gitignored and no longer used.

Key response fields used:
- `data.weather[0].main` — condition category (Clear, Clouds, Rain, Drizzle, Snow, Thunderstorm)
- `data.weather[0].description` — localized description (zh_cn)
- `data.main.temp`, `data.main.humidity`, `data.wind.speed`

## Architecture

Single-page app, no framework, no bundler.

- `showResult(data)` in `script.js` is the central display function — all UI updates after a successful fetch flow through here.
- Weather theming works by adding a `.theme-*` class to `.weather-card`. Each theme class overrides the card's `background` gradient and optionally redefines CSS custom properties (`--text`, `--muted`, `--muted-hi`) for light-background themes (Clear, Snow).
- The `THEMES` map in `script.js` is the single source of truth for condition → class/icon mapping. Add new conditions there.
