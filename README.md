
# ClassVote

ClassVote is a real-time, interactive web application where users can create or join voting sessions to collectively provide feedback, typically for presentations. Participants can cast "like" or "dislike" votes, and a live leaderboard tracks the scores. Session administrators have controls to manage the feedback rounds, sound settings, results visibility, and end sessions.

## Tech Stack

*   **Frontend:** Next.js (App Router), React, TypeScript
*   **UI:** ShadCN UI Components, Tailwind CSS
*   **Real-time Backend:** Firebase (Firestore for database, Firebase Authentication for anonymous users)
*   **Audio:** Tone.js for sound feedback on votes

## Project Setup & Running Locally

1.  **Clone the Repository:**
    ```bash
    git clone <your-repository-url>
    cd <repository-name> 
    ```
    (Replace `<repository-name>` with the actual name of your repository folder, e.g., `classvote`)

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Set up Firebase:**
    *   Create a new project in the [Firebase Console](https://console.firebase.google.com/).
    *   **Authentication:** In the Firebase console, navigate to Authentication (under Build) > Sign-in method, and enable the "Anonymous" sign-in provider.
    *   **Firestore:** In the Firebase console, navigate to Firestore Database (under Build) and create a database. Start in "production mode" and choose a region.
    *   **Register a Web App:** Go to Project Overview > Project settings (gear icon) > General tab. Scroll down to "Your apps" and click on the Web icon (</>) to add a web app. Follow the prompts.
    *   **Copy Configuration:** After registering the web app, Firebase will display a `firebaseConfig` object. Copy these values.
    *   **Update `src/lib/firebase.ts`:** Open the `src/lib/firebase.ts` file in your project and replace the placeholder values in the `firebaseConfig` object with the ones you copied from your Firebase project.
    *   **Firestore Security Rules:** Update your Firestore security rules. Navigate to Firestore Database > Rules tab in the Firebase console and replace the default rules with the following:
        ```
        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            match /sessions/{sessionId} {
              allow read: if request.auth != null;
              
              allow create: if request.auth != null && 
                               request.resource.data.adminUid == request.auth.uid &&
                               request.resource.data.likeClicks == 0 &&
                               request.resource.data.dislikeClicks == 0 &&
                               request.resource.data.isRoundActive == true &&
                               request.resource.data.sessionEnded == false &&
                               request.resource.data.soundsEnabled == true &&
                               request.resource.data.resultsVisible == true &&
                               request.resource.data.participants == {};

              allow update: if request.auth != null && resource.data.sessionEnded == false && (
                              // Admin actions
                              (resource.data.adminUid == request.auth.uid &&
                                (
                                  // Toggle round
                                  (request.resource.data.isRoundActive != resource.data.isRoundActive &&
                                   (request.resource.data.likeClicks == 0 || request.resource.data.likeClicks == resource.data.likeClicks) &&
                                   (request.resource.data.dislikeClicks == 0 || request.resource.data.dislikeClicks == resource.data.dislikeClicks)
                                  ) ||
                                  // Clear scores
                                  (request.resource.data.likeClicks == 0 && request.resource.data.dislikeClicks == 0 &&
                                   request.resource.data.isRoundActive == resource.data.isRoundActive
                                  ) ||
                                  // End session
                                  (request.resource.data.sessionEnded == true && resource.data.sessionEnded == false) ||
                                  // Toggle soundsEnabled
                                  (request.resource.data.soundsEnabled != resource.data.soundsEnabled) ||
                                  // Toggle resultsVisible
                                  (request.resource.data.resultsVisible != resource.data.resultsVisible)
                                ) &&
                                // Ensure admin doesn't change other critical fields during these specific actions, except participants map
                                request.resource.data.adminUid == resource.data.adminUid &&
                                request.resource.data.createdAt == resource.data.createdAt &&
                                (request.resource.data.participants == resource.data.participants || request.resource.data.participants.diff(resource.data.participants).affectedKeys().size() > 0) // Allow admin to modify participants
                              ) ||
                              // User voting actions
                              (
                                resource.data.isRoundActive == true &&
                                (
                                  (request.resource.data.likeClicks == resource.data.likeClicks + 1 && request.resource.data.dislikeClicks == resource.data.dislikeClicks) ||
                                  (request.resource.data.dislikeClicks == resource.data.dislikeClicks + 1 && request.resource.data.likeClicks == resource.data.likeClicks)
                                ) &&
                                // Ensure other critical fields are not changed by vote updates
                                request.resource.data.adminUid == resource.data.adminUid && 
                                request.resource.data.isRoundActive == resource.data.isRoundActive &&
                                request.resource.data.sessionEnded == false &&
                                request.resource.data.createdAt == resource.data.createdAt &&
                                request.resource.data.soundsEnabled == resource.data.soundsEnabled &&
                                request.resource.data.resultsVisible == resource.data.resultsVisible &&
                                request.resource.data.participants == resource.data.participants // Participants map not changed by voting
                              ) ||
                              // User updating their own nickname in participants map
                              (
                                request.auth.uid in request.resource.data.participants &&
                                request.resource.data.participants[request.auth.uid].nickname is string &&
                                request.resource.data.participants[request.auth.uid].joinedAt != null &&
                                // Ensure only their own participant entry is being added/modified
                                resource.data.participants.keys().hasAny([request.auth.uid]) == false || // New participant
                                (
                                  resource.data.participants.keys().hasAll([request.auth.uid]) &&
                                  request.resource.data.participants.diff(resource.data.participants).affectedKeys().hasOnly([request.auth.uid])
                                ) &&
                                // Ensure other critical fields are not changed
                                request.resource.data.adminUid == resource.data.adminUid &&
                                request.resource.data.isRoundActive == resource.data.isRoundActive &&
                                request.resource.data.likeClicks == resource.data.likeClicks &&
                                request.resource.data.dislikeClicks == resource.data.dislikeClicks &&
                                request.resource.data.sessionEnded == false &&
                                request.resource.data.createdAt == resource.data.createdAt &&
                                request.resource.data.soundsEnabled == resource.data.soundsEnabled &&
                                request.resource.data.resultsVisible == resource.data.resultsVisible
                              )
                            );
            }
          }
        }
        ```

4.  **Run the Development Server:**
    ```bash
    npm run dev
    ```
    The application will typically be available at `http://localhost:9002` (or the port specified in your `package.json` dev script).

## Key Features

*   Create new voting sessions with a unique 6-digit code.
*   Join existing sessions using the code.
*   Real-time "like" and "dislike" voting.
*   Optional interactive sound feedback for votes (admin controlled).
*   Live leaderboard displaying current scores (admin can hide/reveal).
*   Admin controls to start/stop feedback rounds, clear scores, toggle sounds, toggle results visibility, and end sessions.
*   Participants can set a session-specific nickname.
*   User-friendly interface built with ShadCN UI and Tailwind CSS.
*   Anonymous user authentication via Firebase.
```
