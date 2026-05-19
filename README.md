# PollApp

PollApp is an Angular 21 survey application. Users can create surveys, publish them, answer questions, and view live results. The app stores survey data in Supabase and keeps a local fallback in `localStorage` so recently created surveys can still be shown if a database request fails.

## What this app does

- Create a new survey with:
  - survey title
  - optional description
  - end date
  - category
  - one or more questions
  - single-choice or multiple-choice answers
- Publish surveys to Supabase
- Show active and past surveys on the home page
- Highlight surveys that are ending soon
- Open a survey detail page to vote
- Display live result bars for each answer
- Use a short client-side cooldown to prevent immediate repeat voting
- Use hash routing for stable deployment on simple web hosting

## How the app works

### Home page

The home page shows all available surveys. Users can:

- browse active surveys
- switch between active and past surveys
- filter surveys by category
- open a survey detail page
- start the create-survey flow

### Create survey

The create page is the survey builder. A user fills out the form and adds questions plus answers. Before publishing, the app validates:

- survey title
- end date
- category
- every question title
- every answer field

If something is missing, the app shows a detailed red error message with exact missing fields.

After a successful publish:

- on desktop, a success popup is shown for 2 seconds
- after that, the app automatically redirects to the new survey
- on mobile, the app opens the new survey directly

### Survey detail

The survey detail page shows:

- survey title
- description
- category
- end date
- all questions and answers
- a live results section

Users can select answers and submit the survey. After voting, the app starts a 3-second cooldown so the same user cannot immediately submit the survey again.

### Data storage

The app uses Supabase for:

- loading surveys
- saving surveys
- loading votes
- saving votes

The app also uses `localStorage` for:

- local survey fallback data
- temporary UI fallback if a survey cannot be loaded from Supabase
- short client-side vote cooldowns

## Tech stack

- Angular 21
- TypeScript
- SCSS
- Supabase
- npm

## Routes

Because the project uses hash routing, the URLs look like this:

- Home: `/#/`
- Create survey: `/#/create`
- Survey detail: `/#/survey/:id`

This was done so the app works reliably on simple hosting without server-side Angular route rewrites.

## Setup after cloning

After cloning the Angular project, dependencies must be installed first. Without that step, the app will not start because the packages from `package.json` are missing.

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd poll-app
```

### 2. Install dependencies

```bash
npm install
```

This reads `package.json` and installs all required Angular, Supabase, TypeScript, and tooling packages into `node_modules`.

### 3. Start the development server

```bash
npm start
```

or

```bash
ng serve
```

Then open:

```text
http://localhost:4200/
```

## Available npm scripts

### Start development server

```bash
npm start
```

### Build production files

```bash
npm run build
```

### Run tests

```bash
npm test
```

### Generate documentation

```bash
npm run docs
```

## Build for deployment

For this project, deployment is usually done into the `/angular-projects/` subfolder on the server.

Use:

```bash
npm run build -- --base-href /angular-projects/
```

The final build output is created in:

```text
dist/poll-app/browser
```

## Upload with FileZilla

Do not upload the full Angular source project.

Upload only the generated build files from:

```text
dist/poll-app/browser
```

Typical workflow:

1. Run the production build.
2. Open FileZilla.
3. Open `dist/poll-app/browser` on the local side.
4. Open `/angular-projects` on the server side.
5. Upload the full content of the `browser` folder.
6. Replace old files on the server.

Do not upload:

- `src`
- `node_modules`
- `.angular`
- the full project root

## Project structure

- `src/app/pages/home`
  - survey overview
  - category filter
  - ending-soon cards
- `src/app/pages/create-survey`
  - survey builder
  - validation
  - publish flow
- `src/app/pages/survey-detail`
  - survey voting
  - live result rendering
  - load and submit logic
- `src/app/supabase.ts`
  - Supabase client configuration

## Notes

- The create-survey date picker only allows dates from today onward.
- Mobile animations are disabled for a calmer mobile experience.
- The app uses a local fallback so recently created surveys can still appear even if the remote request fails.
