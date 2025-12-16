# Trading Journal Web App

This is a React + Vite web application designed for Firebase Hosting. It includes:

- Journaling (track your thoughts and trades)
- Backtesting (upload and analyze trading data)
- Review Trading Data (visualize and review results)
- Goal Setting (set and track goals)
- Habit Tracker (daily/weekly habit check-ins)
- Daily Planner (to-do list and schedule)

## Features

- Modern UI with navigation bar
- Firebase integration (Firestore, Auth)
- Modular React components for each feature

## Getting Started

1. Install dependencies:
	```sh
	npm install
	```
2. Add your Firebase config to `src/firebase.js`.
3. Start the development server:
	```sh
	npm run dev
	```

## Firebase Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/).
2. Enable Firestore and Authentication.
3. Copy your config to `src/firebase.js`.

## Deployment

1. Build the app:
	```sh
	npm run build
	```
2. Deploy to Firebase Hosting:
	```sh
	firebase deploy
	```

## Folder Structure

- `src/pages/` — Feature pages/components
- `src/firebase.js` — Firebase config and initialization

---
This project was scaffolded with Vite and React, then customized for trading journal and productivity features.
