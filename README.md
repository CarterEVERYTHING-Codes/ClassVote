
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
        ```firestore-rules
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
                               request.resource.data.sessionType == 'quick' &&
                               request.resource.data.participants is map &&
                               request.resource.data.participants.size() == 0 &&
                               request.resource.data.createdAt == request.time;

              allow update: if request.auth != null && resource.data.sessionEnded == false && (
                              // Admin actions
                              (resource.data.adminUid == request.auth.uid &&
                                (
                                  // Toggle round (optionally resets scores)
                                  (request.resource.data.isRoundActive != resource.data.isRoundActive &&
                                   (request.resource.data.likeClicks == 0 || request.resource.data.likeClicks == resource.data.likeClicks) && // Allow resetting clicks or keeping them
                                   (request.resource.data.dislikeClicks == 0 || request.resource.data.dislikeClicks == resource.data.dislikeClicks) &&
                                   // For this action, other fields must match or be explicitly part of the change
                                   request.resource.data.sessionEnded == resource.data.sessionEnded &&
                                   request.resource.data.soundsEnabled == resource.data.soundsEnabled &&
                                   request.resource.data.resultsVisible == resource.data.resultsVisible &&
                                   request.resource.data.participants == resource.data.participants // Participants not changed by this action
                                  ) ||
                                  // Clear scores (round state doesn't change here)
                                  (request.resource.data.likeClicks == 0 && request.resource.data.dislikeClicks == 0 &&
                                   request.resource.data.isRoundActive == resource.data.isRoundActive && // isRoundActive should not change here
                                   // For this action, other fields must match
                                   request.resource.data.sessionEnded == resource.data.sessionEnded &&
                                   request.resource.data.soundsEnabled == resource.data.soundsEnabled &&
                                   request.resource.data.resultsVisible == resource.data.resultsVisible &&
                                   request.resource.data.participants == resource.data.participants // Participants not changed by this action
                                  ) ||
                                  // End session
                                  (request.resource.data.sessionEnded == true && resource.data.sessionEnded == false &&
                                   // When ending, isRoundActive might also be set to false by client, allow if other fields match
                                   (request.resource.data.isRoundActive == false || request.resource.data.isRoundActive == resource.data.isRoundActive) &&
                                   request.resource.data.likeClicks == resource.data.likeClicks &&
                                   request.resource.data.dislikeClicks == resource.data.dislikeClicks &&
                                   request.resource.data.soundsEnabled == resource.data.soundsEnabled &&
                                   request.resource.data.resultsVisible == resource.data.resultsVisible &&
                                   request.resource.data.participants == resource.data.participants // Participants not changed by this action
                                  ) ||
                                  // Toggle soundsEnabled
                                  (request.resource.data.soundsEnabled != resource.data.soundsEnabled &&
                                   // For this action, other fields must match
                                   request.resource.data.isRoundActive == resource.data.isRoundActive &&
                                   request.resource.data.likeClicks == resource.data.likeClicks &&
                                   request.resource.data.dislikeClicks == resource.data.dislikeClicks &&
                                   request.resource.data.sessionEnded == resource.data.sessionEnded &&
                                   request.resource.data.resultsVisible == resource.data.resultsVisible &&
                                   request.resource.data.participants == resource.data.participants // Participants not changed by this action
                                  ) ||
                                  // Toggle resultsVisible
                                  (request.resource.data.resultsVisible != resource.data.resultsVisible &&
                                   // For this action, other fields must match
                                   request.resource.data.isRoundActive == resource.data.isRoundActive &&
                                   request.resource.data.likeClicks == resource.data.likeClicks &&
                                   request.resource.data.dislikeClicks == resource.data.dislikeClicks &&
                                   request.resource.data.sessionEnded == resource.data.sessionEnded &&
                                   request.resource.data.soundsEnabled == resource.data.soundsEnabled &&
                                   request.resource.data.participants == resource.data.participants // Participants not changed by this action
                                  )
                                ) &&
                                // Ensure admin doesn't change other immutable fields during these specific actions
                                request.resource.data.adminUid == resource.data.adminUid &&
                                request.resource.data.createdAt == resource.data.createdAt &&
                                request.resource.data.sessionType == resource.data.sessionType // sessionType should not be changed by these admin actions
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
                                request.resource.data.sessionEnded == resource.data.sessionEnded &&
                                request.resource.data.createdAt == resource.data.createdAt &&
                                request.resource.data.soundsEnabled == resource.data.soundsEnabled &&
                                request.resource.data.resultsVisible == resource.data.resultsVisible &&
                                request.resource.data.sessionType == resource.data.sessionType &&
                                request.resource.data.participants == resource.data.participants // Participants map not changed by voting
                              ) ||
                              // User setting/updating their own nickname in participants map
                              (
                                // 1. Only the 'participants' field can be modified at the document level.
                                request.resource.data.diff(resource.data).affectedKeys().hasOnly(['participants']) &&

                                // 2. The incoming 'participants' data must be a map and contain an entry for the current user.
                                request.resource.data.participants is map &&
                                request.auth.uid in request.resource.data.participants &&

                                // 3. The nickname for the current user must be a string.
                                request.resource.data.participants[request.auth.uid].nickname is string &&

                                // 4. 'joinedAt' timestamp logic:
                                (
                                  // 4a. If user is NEW to the participants map (or participants map didn't exist/wasn't a map before):
                                  (
                                    ( !(resource.data.participants is map) || (resource.data.participants is map && !(request.auth.uid in resource.data.participants)) ) &&
                                    request.resource.data.participants[request.auth.uid].joinedAt == request.time
                                  ) ||
                                  // 4b. If user ALREADY EXISTED in a valid participants map:
                                  (
                                    (resource.data.participants is map && request.auth.uid in resource.data.participants) &&
                                    request.resource.data.participants[request.auth.uid].joinedAt == resource.data.participants[request.auth.uid].joinedAt
                                  )
                                ) &&

                                // 5. Ensure only the current user's data within the 'participants' map is being added/modified.
                                (
                                  // 5a. If existing 'participants' was not a map:
                                  //     The new 'participants' map must only contain the current user's key.
                                  (
                                    !(resource.data.participants is map) &&
                                    request.resource.data.participants.keys().hasOnly([request.auth.uid])
                                  ) ||
                                  // 5b. If existing 'participants' was a map:
                                  //     The diff between new and old 'participants' map must only affect the current user's key.
                                  (
                                    resource.data.participants is map &&
                                    request.resource.data.participants.diff(resource.data.participants).affectedKeys().hasOnly([request.auth.uid])
                                  )
                                )
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

*   Create new voting sessions with a unique 6-digit code ("Quick Session" or "Full Features" options).
*   Join existing sessions using the code.
*   Real-time "like" and "dislike" voting.
*   Admin controls for vote sounds (on/off) and live results visibility (show/hide).
*   Live leaderboard displaying current scores (admin can hide/reveal).
*   Admin controls to start/stop feedback rounds, clear scores, and end sessions.
*   Participants can set a session-specific nickname.
*   User-friendly interface built with ShadCN UI and Tailwind CSS.
*   Anonymous user authentication via Firebase for quick sessions.

    