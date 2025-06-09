
# ClassVote

ClassVote is a real-time, interactive web application where users can create or join voting sessions to collectively provide feedback, typically for presentations. Participants can cast "like" or "dislike" votes, and a live leaderboard tracks the scores. Session administrators have controls to manage the feedback rounds, sound settings, results visibility, presenter queues, and end sessions.

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
    *   **Firestore Security Rules:** Update your Firestore security rules. Navigate to Firestore Database > Rules tab in the Firebase console and replace the default rules with the following (or the latest recommended version from this project if it has been updated):
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
                               request.resource.data.presenterQueue is list &&
                               request.resource.data.presenterQueue.size() == 0 &&
                               request.resource.data.currentPresenterIndex == -1 &&
                               request.resource.data.currentPresenterName == "" &&
                               request.resource.data.createdAt == request.time;

              allow update: if request.auth != null && resource.data.sessionEnded == false && (
                              // Admin actions
                              (resource.data.adminUid == request.auth.uid &&
                                request.resource.data.adminUid == resource.data.adminUid &&
                                request.resource.data.createdAt == resource.data.createdAt &&
                                request.resource.data.sessionType == resource.data.sessionType &&
                                request.resource.data.participants == resource.data.participants &&
                                (
                                  // Toggle round (optionally resets scores)
                                  (
                                    request.resource.data.isRoundActive != resource.data.isRoundActive &&
                                    (request.resource.data.likeClicks == 0 || request.resource.data.likeClicks == resource.data.likeClicks) &&
                                    (request.resource.data.dislikeClicks == 0 || request.resource.data.dislikeClicks == resource.data.dislikeClicks) &&
                                    request.resource.data.sessionEnded == resource.data.sessionEnded &&
                                    request.resource.data.soundsEnabled == resource.data.soundsEnabled &&
                                    request.resource.data.resultsVisible == resource.data.resultsVisible &&
                                    request.resource.data.presenterQueue == resource.data.presenterQueue &&
                                    request.resource.data.currentPresenterIndex == resource.data.currentPresenterIndex &&
                                    request.resource.data.currentPresenterName == resource.data.currentPresenterName
                                  ) ||
                                  // Clear scores
                                  (
                                    request.resource.data.likeClicks == 0 && request.resource.data.dislikeClicks == 0 &&
                                    request.resource.data.isRoundActive == resource.data.isRoundActive &&
                                    request.resource.data.sessionEnded == resource.data.sessionEnded &&
                                    request.resource.data.soundsEnabled == resource.data.soundsEnabled &&
                                    request.resource.data.resultsVisible == resource.data.resultsVisible &&
                                    request.resource.data.presenterQueue == resource.data.presenterQueue &&
                                    request.resource.data.currentPresenterIndex == resource.data.currentPresenterIndex &&
                                    request.resource.data.currentPresenterName == resource.data.currentPresenterName
                                  ) ||
                                  // End session
                                  (
                                    request.resource.data.sessionEnded == true && resource.data.sessionEnded == false &&
                                    request.resource.data.isRoundActive == false &&
                                    request.resource.data.diff(resource.data).affectedKeys().hasOnly(['sessionEnded', 'isRoundActive'])
                                  ) ||
                                  // Toggle soundsEnabled
                                  (
                                    request.resource.data.soundsEnabled != resource.data.soundsEnabled &&
                                    request.resource.data.isRoundActive == resource.data.isRoundActive &&
                                    request.resource.data.likeClicks == resource.data.likeClicks &&
                                    request.resource.data.dislikeClicks == resource.data.dislikeClicks &&
                                    request.resource.data.sessionEnded == resource.data.sessionEnded &&
                                    request.resource.data.resultsVisible == resource.data.resultsVisible &&
                                    request.resource.data.presenterQueue == resource.data.presenterQueue &&
                                    request.resource.data.currentPresenterIndex == resource.data.currentPresenterIndex &&
                                    request.resource.data.currentPresenterName == resource.data.currentPresenterName
                                  ) ||
                                  // Toggle resultsVisible
                                  (
                                    request.resource.data.resultsVisible != resource.data.resultsVisible &&
                                    request.resource.data.isRoundActive == resource.data.isRoundActive &&
                                    request.resource.data.likeClicks == resource.data.likeClicks &&
                                    request.resource.data.dislikeClicks == resource.data.dislikeClicks &&
                                    request.resource.data.sessionEnded == resource.data.sessionEnded &&
                                    request.resource.data.soundsEnabled == resource.data.soundsEnabled &&
                                    request.resource.data.presenterQueue == resource.data.presenterQueue &&
                                    request.resource.data.currentPresenterIndex == resource.data.currentPresenterIndex &&
                                    request.resource.data.currentPresenterName == resource.data.currentPresenterName
                                  ) ||
                                  // Set/Update Presenter Queue
                                  (
                                    request.resource.data.presenterQueue is list &&
                                    request.resource.data.currentPresenterIndex is number && (request.resource.data.currentPresenterIndex == 0 || request.resource.data.currentPresenterIndex == -1) &&
                                    request.resource.data.currentPresenterName is string &&
                                    request.resource.data.likeClicks == 0 && 
                                    request.resource.data.dislikeClicks == 0 && 
                                    (request.resource.data.isRoundActive == (request.resource.data.presenterQueue.size() > 0)) && 
                                    request.resource.data.sessionEnded == resource.data.sessionEnded &&
                                    request.resource.data.soundsEnabled == resource.data.soundsEnabled &&
                                    request.resource.data.resultsVisible == resource.data.resultsVisible
                                  ) ||
                                  // Advance to Next Presenter
                                  (
                                    request.resource.data.presenterQueue == resource.data.presenterQueue && 
                                    request.resource.data.currentPresenterIndex == resource.data.currentPresenterIndex + 1 &&
                                    request.resource.data.currentPresenterName is string && 
                                    request.resource.data.likeClicks == 0 && 
                                    request.resource.data.dislikeClicks == 0 && 
                                    request.resource.data.isRoundActive == true && 
                                    request.resource.data.sessionEnded == resource.data.sessionEnded &&
                                    request.resource.data.soundsEnabled == resource.data.soundsEnabled &&
                                    request.resource.data.resultsVisible == resource.data.resultsVisible
                                  ) ||
                                  // Admin ending queue
                                  (
                                    request.resource.data.presenterQueue == resource.data.presenterQueue &&
                                    request.resource.data.currentPresenterName == "End of Queue" && 
                                    request.resource.data.isRoundActive == false && 
                                    request.resource.data.likeClicks == 0 && 
                                    request.resource.data.dislikeClicks == 0 && 
                                    request.resource.data.currentPresenterIndex == resource.data.currentPresenterIndex && 
                                    request.resource.data.sessionEnded == resource.data.sessionEnded &&
                                    request.resource.data.soundsEnabled == resource.data.soundsEnabled &&
                                    request.resource.data.resultsVisible == resource.data.resultsVisible
                                  )
                                )
                              ) ||
                              // User voting actions
                              (
                                resource.data.isRoundActive == true &&
                                ( 
                                  (resource.data.presenterQueue == null || resource.data.presenterQueue.size() == 0) ||
                                  (
                                    resource.data.presenterQueue.size() > 0 &&
                                    resource.data.currentPresenterIndex >= 0 &&
                                    resource.data.currentPresenterIndex < resource.data.presenterQueue.size() &&
                                    resource.data.currentPresenterName != "" &&
                                    resource.data.currentPresenterName != "End of Queue"
                                  )
                                ) &&
                                (
                                  (request.resource.data.likeClicks == resource.data.likeClicks + 1 && request.resource.data.dislikeClicks == resource.data.dislikeClicks) ||
                                  (request.resource.data.dislikeClicks == resource.data.dislikeClicks + 1 && request.resource.data.likeClicks == resource.data.likeClicks)
                                ) &&
                                request.resource.data.adminUid == resource.data.adminUid &&
                                request.resource.data.isRoundActive == resource.data.isRoundActive &&
                                request.resource.data.sessionEnded == resource.data.sessionEnded &&
                                request.resource.data.createdAt == resource.data.createdAt &&
                                request.resource.data.soundsEnabled == resource.data.soundsEnabled &&
                                request.resource.data.resultsVisible == resource.data.resultsVisible &&
                                request.resource.data.sessionType == resource.data.sessionType &&
                                request.resource.data.participants == resource.data.participants &&
                                request.resource.data.presenterQueue == resource.data.presenterQueue &&
                                request.resource.data.currentPresenterIndex == resource.data.currentPresenterIndex &&
                                request.resource.data.currentPresenterName == resource.data.currentPresenterName
                              ) ||
                              // User setting/updating their own nickname
                              (
                                request.resource.data.diff(resource.data).affectedKeys().hasOnly(['participants']) &&
                                request.resource.data.participants is map &&
                                request.auth.uid in request.resource.data.participants &&
                                request.resource.data.participants[request.auth.uid].nickname is string &&
                                (
                                  ( !(resource.data.participants is map) || (resource.data.participants is map && !(request.auth.uid in resource.data.participants)) ) &&
                                  request.resource.data.participants[request.auth.uid].joinedAt == request.time
                                ) ||
                                (
                                  (resource.data.participants is map && request.auth.uid in resource.data.participants) &&
                                  request.resource.data.participants[request.auth.uid].joinedAt == resource.data.participants[request.auth.uid].joinedAt
                                ) &&
                                (
                                  !(resource.data.participants is map) &&
                                  request.resource.data.participants.keys().hasOnly([request.auth.uid])
                                ) ||
                                (
                                  resource.data.participants is map &&
                                  request.resource.data.participants.diff(resource.data.participants).affectedKeys().hasOnly([request.auth.uid])
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

*   Create new voting sessions with a unique 6-digit code.
*   Join existing sessions using the code.
*   Admin can optionally define a list of presenters for the session.
*   Admin can add current participants (with nicknames) to the presenter list textarea.
*   Admin can advance through presenters, resetting scores and feedback rounds for each.
*   Current presenter's name (if any) is displayed to all participants.
*   If no presenters are defined, feedback applies to the general session.
*   Real-time "like" and "dislike" voting.
*   Admin controls for vote sounds (on/off) and live results visibility (show/hide).
*   Live leaderboard displaying current scores (admin can hide/reveal), adapts to general session or specific presenter.
*   Admin controls to start/stop feedback rounds (for current presenter or general session), clear scores, and end sessions.
*   Participants can set a session-specific nickname.
*   User-friendly interface built with ShadCN UI and Tailwind CSS.
*   Anonymous user authentication via Firebase for quick sessions.
*   Informational tooltips for admin controls.

