# PollApp

PollApp is an Angular survey application for creating polls, publishing them, collecting answers, and viewing live results. Surveys are stored in Supabase, and the app also keeps a local fallback in `localStorage` so the UI can still show recently created surveys if the database request fails.

## How To Use

1. Open the home page to browse active and past surveys.
2. Click `New survey` or `Create survey` to open the survey builder.
3. Enter a title, end date, category, and at least one question with answers.
4. Click `Publish` to save the survey.
5. Open a survey detail page to answer the questions and view the result bars.

## Start The App

Run the development server with:

```bash
ng serve
```

Then open `http://localhost:4200/` in the browser.

## Build

Create a production build with:

```bash
ng build
```

The compiled output is written to `dist/`.

## Tests

Run unit tests with:

```bash
ng test
```

## Project Structure

- `src/app/pages/home`: survey overview, filters, and ending-soon cards
- `src/app/pages/create-survey`: survey builder and publish flow
- `src/app/pages/survey-detail`: survey answering and live results
- `src/app/supabase.ts`: Supabase client setup
