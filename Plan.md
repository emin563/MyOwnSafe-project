Prompt Blueprint Architecture & Development Plan

Based on the provided screenshots, the target UI features a highly polished, deep dark-mode aesthetic with pill-shaped buttons, subtle borders, generous spacing, and a clear side-drawer navigation pattern. This architecture plan is tailored to natively support this design while ensuring fast, offline-first performance.

1. Expo Router Navigation Structure

To mimic the reference design (a main screen with a comprehensive side menu), a Drawer Navigator combined with Stack Navigators for deeper interactions is the optimal approach.

graph TD
    Root["app/_layout.tsx (Root Layout)"] --> Drawer["app/(drawer)/_layout.tsx (Drawer Navigator)"]
    Root --> PromptView["app/prompt/[id].tsx (Stack Screen)"]
    Root --> Modals["app/modals/ (Presentation: Modal)"]
    
    Drawer --> Home["app/(drawer)/index.tsx (Main Dashboard)"]
    Drawer --> CustomDrawer["components/layout/CustomDrawer.tsx"]
    
    Modals --> CreatePrompt["create-prompt.tsx"]
    Modals --> CreateCategory["create-category.tsx"]





Custom Drawer: The drawer will be heavily customized to match Image 2, housing the search bar, "New Project/Prompt" buttons, and the scrollable list of categories and past prompts.



Main Dashboard: Matches Image 1, displaying quick actions, category pills, and a central input area if needed.



Modals/Stacks: Used for full-screen editing or creating new prompts without losing the context of the underlying list.

2. Scalable Component-Based Folder Structure

/src
  /app                  # Expo Router file-based routing
    _layout.tsx         # Root layout providers (Theme, DB)
    /(drawer)           # Drawer navigation group
      _layout.tsx       # Custom drawer configuration
      index.tsx         # Main UI (Image 1 reference)
    /prompt
      [id].tsx          # Prompt editor/viewer
    /modals
      create.tsx        # Action modals
  /components
    /ui                 # Atomic UI (PillButton, SearchInput, IconButton)
    /prompt             # Domain components (PromptCard, CategoryList)
    /layout             # Structural (CustomDrawerContent, Header)
  /store                # Zustand state slices
  /db                   # SQLite schema, queries, and migrations
  /theme                # Colors, Typography, Spacing constants
  /hooks                # useClipboard, useKeyboard, useHaptics

3. State Management & Local Database

For a lightning-fast, offline-first personal utility app, **expo-sqlite (Next API)** paired with Zustand is the absolute best choice.





Local Database (expo-sqlite): Handles all data persistence. It operates synchronously and ensures zero-latency reads/writes.



State Management (Zustand): Used to hold the current UI state (e.g., currently selected category, search query, drawer open/close state) and to cache frequently accessed DB data for instant UI updates.

Database Schema

erDiagram
    CATEGORIES ||--o{ PROMPTS : contains
    CATEGORIES {
        INTEGER id PK
        TEXT name
        TIMESTAMP created_at
    }
    PROMPTS {
        INTEGER id PK
        INTEGER category_id FK
        TEXT title
        TEXT content
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

4. Phase-by-Phase Development Roadmap

Phase 1: Foundation & Architecture (Setup)





Initialize Expo project with Expo Router and TypeScript.



Set up absolute path aliases (@/components, @/db).



Configure expo-sqlite and run initial DB migrations for Categories and Prompts.



Initialize Zustand store.

Phase 2: Design System & Core UI





Define the dark theme palette matching the screenshots (True blacks #000000, surface grays #1E1E1E or #202123, primary accents).



Build atomic UI components: Custom Text, Pill-shaped Buttons, Search Inputs, and Icons (using @expo/vector-icons).



Implement the Custom Drawer UI (matching Image 2) and the Main Dashboard layout (matching Image 1).

Phase 3: Core Functionality (CRUD)





Categories: Implement create, read, update, delete logic.



Prompts: Implement the prompt editor form, linking prompts to categories.



Wire up the UI components to execute SQLite queries and update the Zustand store.

Phase 4: Polish & Device Integration





Integrate expo-clipboard for the 1-tap "Quick Copy" feature.



Add expo-haptics to provide tactile feedback when copying prompts or navigating, giving the app a premium feel.



Implement search filtering in the drawer to quickly find prompts.



Test offline capabilities and keyboard avoiding behavior.

