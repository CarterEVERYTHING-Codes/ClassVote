
# ClassVote

ClassVote is a real-time, interactive web application where users create or join voting sessions to collectively provide feedback, typically for presentations. Participants must set a unique nickname for the session before they can engage. This nickname cannot be changed later. Participants can cast "like" or "dislike" votes, and a live leaderboard tracks the scores. Session administrators have controls to manage the feedback rounds, sound settings, results visibility, presenter queues, kick participants, and end sessions. An overall leaderboard displays scores for all presenters once the queue is complete or the session ends. Users can sign in with Google to (eventually) associate sessions and scores with their account.

## Tech Stack

*   **Frontend:** Next.js (App Router), React, TypeScript
*   **UI:** ShadCN UI Components, Tailwind CSS
*   **Real-time Backend:** Firebase (Firestore for database, Firebase Authentication for anonymous and Google users)
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
    *   **Authentication:** In the Firebase console, navigate to Authentication (under Build).
        *   Go to the **Sign-in method** tab:
            *   Enable the "Anonymous" sign-in provider.
            *   Enable the "Google" sign-in provider. Ensure you add your app's SHA-1 certificate fingerprint if prompted (for Android, not strictly necessary for web-only but good practice if you might expand).
        *   Go to the **Settings** tab (within Authentication):
            *   Scroll to **Authorized domains**.
            *   Click **Add domain** and add `localhost` if it's not already present. This is crucial for local development to work. Your deployed app's domain will also need to be listed here (Firebase usually adds this automatically when you set up Hosting).
    *   **Firestore:** In the Firebase console, navigate to Firestore Database (under Build) and create a database. Start in "production mode" and choose a region.
    *   **Register a Web App:** Go to Project Overview > Project settings (gear icon) > General tab. Scroll down to "Your apps" and click on the Web icon (</>) to add a web app. Follow the prompts.
    *   **Copy Configuration:** After registering the web app, Firebase will display a `firebaseConfig` object. Copy these values.
    *   **Update `src/lib/firebase.ts`:** Open the `src/lib/firebase.ts` file in your project and replace the placeholder values in the `firebaseConfig` object with the ones you copied from your Firebase project. **Ensure these are exactly correct.**
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
                               (request.resource.data.sessionType == 'quick' || request.resource.data.sessionType == 'account') &&
                               request.resource.data.participants is map &&
                               request.resource.data.participants.size() == 0 &&
                               request.resource.data.presenterQueue is list &&
                               request.resource.data.presenterQueue.size() == 0 &&
                               request.resource.data.currentPresenterIndex == -1 &&
                               request.resource.data.currentPresenterName == "" &&
                               request.resource.data.presenterScores is list && request.resource.data.presenterScores.size() == 0 &&
                               request.resource.data.createdAt == request.time;

              allow update: if request.auth != null && resource.data.sessionEnded == false && (
                              // Admin actions
                              (resource.data.adminUid == request.auth.uid &&
                                request.resource.data.adminUid == resource.data.adminUid && 
                                request.resource.data.createdAt == resource.data.createdAt && 
                                request.resource.data.sessionType == resource.data.sessionType && 
                                (
                                  // Participants map itself is not directly modified by these general admin actions (except kick)
                                  (
                                    request.resource.data.participants == resource.data.participants &&
                                    ( // Allow presenterScores to be reset or an item added by specific admin actions
                                      (request.resource.data.presenterScores.size() == 0 && request.resource.data.presenterQueue.size() >= 0) || // Resetting queue also resets scores
                                      (request.resource.data.presenterScores.size() == resource.data.presenterScores.size() + 1 && request.resource.data.presenterScores[-1].name is string) // Adding a score
                                    ) &&
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
                                      // Clear scores (does not affect presenterScores array)
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
                                      // End session (may add final presenter score)
                                      (
                                        request.resource.data.sessionEnded == true && resource.data.sessionEnded == false &&
                                        request.resource.data.isRoundActive == false &&
                                        (
                                            request.resource.data.diff(resource.data).affectedKeys().hasOnly(['sessionEnded', 'isRoundActive']) ||
                                            request.resource.data.diff(resource.data).affectedKeys().hasOnly(['sessionEnded', 'isRoundActive', 'presenterScores']) 
                                        )
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
                                      // Set/Update Presenter Queue (resets scores, presenterScores)
                                      (
                                        request.resource.data.presenterQueue is list &&
                                        request.resource.data.currentPresenterIndex is number && (request.resource.data.currentPresenterIndex == 0 || request.resource.data.currentPresenterIndex == -1) &&
                                        request.resource.data.currentPresenterName is string &&
                                        request.resource.data.likeClicks == 0 &&
                                        request.resource.data.dislikeClicks == 0 &&
                                        (request.resource.data.isRoundActive == (request.resource.data.presenterQueue.size() > 0)) &&
                                        request.resource.data.presenterScores.size() == 0 && // presenterScores is reset
                                        request.resource.data.sessionEnded == resource.data.sessionEnded &&
                                        request.resource.data.soundsEnabled == resource.data.soundsEnabled &&
                                        request.resource.data.resultsVisible == resource.data.resultsVisible
                                      ) ||
                                      // Advance to Next Presenter (adds to presenterScores, resets current scores)
                                      (
                                        request.resource.data.presenterQueue == resource.data.presenterQueue &&
                                        request.resource.data.currentPresenterIndex == resource.data.currentPresenterIndex + 1 &&
                                        request.resource.data.currentPresenterName is string &&
                                        request.resource.data.likeClicks == 0 && 
                                        request.resource.data.dislikeClicks == 0 &&
                                        request.resource.data.isRoundActive == true &&
                                        request.resource.data.presenterScores.size() == resource.data.presenterScores.size() + 1 && // One score added
                                        request.resource.data.sessionEnded == resource.data.sessionEnded &&
                                        request.resource.data.soundsEnabled == resource.data.soundsEnabled &&
                                        request.resource.data.resultsVisible == resource.data.resultsVisible
                                      ) ||
                                      // Admin ending queue (current presenter is "End of Queue", scores reset)
                                      (
                                        request.resource.data.presenterQueue == resource.data.presenterQueue &&
                                        request.resource.data.currentPresenterName == "End of Queue" &&
                                        request.resource.data.isRoundActive == false &&
                                        request.resource.data.likeClicks == 0 &&
                                        request.resource.data.dislikeClicks == 0 &&
                                        request.resource.data.currentPresenterIndex == resource.data.currentPresenterIndex &&
                                        // presenterScores might have been updated by the last "next presenter"
                                        (request.resource.data.presenterScores.size() == resource.data.presenterScores.size() || request.resource.data.presenterScores.size() == resource.data.presenterScores.size() +1 ) &&
                                        request.resource.data.sessionEnded == resource.data.sessionEnded &&
                                        request.resource.data.soundsEnabled == resource.data.soundsEnabled &&
                                        request.resource.data.resultsVisible == resource.data.resultsVisible
                                      )
                                    )
                                  ) ||
                                  // Admin kicking a participant
                                  (
                                    request.resource.data.diff(resource.data).affectedKeys().hasOnly(['participants']) &&
                                    (request.auth.uid in resource.data.participants ? request.auth.uid in request.resource.data.participants : true) && // Admin cannot kick self if present
                                    request.resource.data.participants.keys().size() < resource.data.participants.keys().size() && // Ensure a participant is removed
                                    request.resource.data.isRoundActive == resource.data.isRoundActive &&
                                    request.resource.data.likeClicks == resource.data.likeClicks &&
                                    request.resource.data.dislikeClicks == resource.data.dislikeClicks &&
                                    request.resource.data.sessionEnded == resource.data.sessionEnded &&
                                    request.resource.data.soundsEnabled == resource.data.soundsEnabled &&
                                    request.resource.data.resultsVisible == resource.data.resultsVisible &&
                                    request.resource.data.presenterQueue == resource.data.presenterQueue &&
                                    request.resource.data.currentPresenterIndex == resource.data.currentPresenterIndex &&
                                    request.resource.data.currentPresenterName == resource.data.currentPresenterName &&
                                    request.resource.data.presenterScores == resource.data.presenterScores // Kicking does not affect presenterScores
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
                                request.resource.data.currentPresenterName == resource.data.currentPresenterName &&
                                request.resource.data.presenterScores == resource.data.presenterScores // Voting does not affect overall presenterScores array
                              ) ||
                              // User setting their own nickname (immutable after first set)
                              (
                                request.resource.data.diff(resource.data).affectedKeys().hasOnly(['participants']) &&
                                request.resource.data.participants is map &&
                                request.auth.uid in request.resource.data.participants &&
                                request.resource.data.participants[request.auth.uid].nickname is string &&
                                request.resource.data.participants[request.auth.uid].uid == request.auth.uid &&
                                (
                                  (!(resource.data.participants is map) || (resource.data.participants is map && !(request.auth.uid in resource.data.participants))) && // User not in participants map yet
                                  request.resource.data.participants[request.auth.uid].joinedAt == request.time // joinedAt is set on creation
                                ) ||
                                (
                                  (resource.data.participants is map && request.auth.uid in resource.data.participants) && // User already in participants map
                                  request.resource.data.participants[request.auth.uid].nickname == resource.data.participants[request.auth.uid].nickname && // Nickname is immutable
                                  request.resource.data.participants[request.auth.uid].joinedAt == resource.data.participants[request.auth.uid].joinedAt // joinedAt is immutable
                                ) &&
                                ( // Ensure only the user's own entry is being added/affected
                                  (!(resource.data.participants is map) && request.resource.data.participants.keys().hasOnly([request.auth.uid])) ||
                                  (resource.data.participants is map && request.resource.data.participants.diff(resource.data.participants).affectedKeys().hasOnly([request.auth.uid]))
                                ) &&
                                request.resource.data.adminUid == resource.data.adminUid &&
                                request.resource.data.isRoundActive == resource.data.isRoundActive &&
                                request.resource.data.likeClicks == resource.data.likeClicks &&
                                request.resource.data.dislikeClicks == resource.data.dislikeClicks &&
                                request.resource.data.sessionEnded == resource.data.sessionEnded &&
                                request.resource.data.createdAt == resource.data.createdAt &&
                                request.resource.data.soundsEnabled == resource.data.soundsEnabled &&
                                request.resource.data.resultsVisible == resource.data.resultsVisible &&
                                request.resource.data.sessionType == resource.data.sessionType &&
                                request.resource.data.presenterQueue == resource.data.presenterQueue &&
                                request.resource.data.currentPresenterIndex == resource.data.currentPresenterIndex &&
                                request.resource.data.currentPresenterName == resource.data.currentPresenterName &&
                                request.resource.data.presenterScores == resource.data.presenterScores
                              )
                            );
            }
          }
        }
        ```
    *   **IMPORTANT: API Key Restrictions (Google Cloud Console):** If `auth/unauthorized-domain` persists after adding `localhost` to Firebase Auth domains:
        *   Go to [Google Cloud Console](https://console.cloud.google.com/).
        *   Select your project.
        *   Navigate to **APIs & Services > Credentials**.
        *   Find the API key used by your web app (usually "Browser key" or matching your `firebaseConfig.apiKey`). Click its name.
        *   Under **Application restrictions**, choose "HTTP referrers (web sites)".
        *   Under **Website restrictions**, click "ADD" and add these entries if they are missing:
            *   `localhost`
            *   `localhost:*` (wildcard for any port)
            *   `http://localhost:YOUR_PORT_NUMBER` (e.g., `http://localhost:9002`)
        *   Under **API restrictions**, if "Restrict key" is chosen, ensure **"Identity Toolkit API"** is in the list of allowed APIs. "Don't restrict key" is often simpler for development.
        *   **Click SAVE at the bottom of the GCP page.** Changes can take a few minutes to propagate.

4.  **Run the Development Server:**
    ```bash
    npm run dev
    ```
    The application will typically be available at `http://localhost:9002`.

## Key Features

*   Create new voting sessions with a unique 6-digit code (either anonymously or linked to a Google account).
*   Join existing sessions using the code.
*   **Mandatory Nicknames:** Users must enter a unique nickname (per session) before participating. Nicknames are immutable once set.
*   Admin can optionally define a list of presenters for the session.
*   Admin can add current participants (with nicknames) to the presenter list textarea.
*   Admin can advance through presenters, resetting scores and feedback rounds for each. Scores for each presenter are recorded for an overall session leaderboard.
*   Current presenter's name (if any) is displayed to all participants.
*   If no presenters are defined, feedback applies to the general session.
*   Real-time "like" and "dislike" voting.
*   Admin controls for vote sounds (on/off) and live results visibility (show/hide).
*   Admin can kick participants from the session.
*   Live leaderboard displaying current scores (admin can hide/reveal), adapts to general session or specific presenter.
*   **Presenter Self-View:** A presenter can see their own scores even if general results are hidden by the admin.
*   **Overall Session Leaderboard:** Displayed when the presenter queue is finished or the session ends, showing scores for all presenters in that session.
*   Admin controls to start/stop feedback rounds, clear current scores, and end sessions.
*   User-friendly interface built with ShadCN UI and Tailwind CSS.
*   Authentication via Firebase (Anonymous or Google Sign-In).
*   Informational tooltips for admin controls.
*   **Participant Count Display:** Shows the current number of participants in the session.
*   Global header with Login/Logout and theme toggle.

## Next Steps (Future Enhancements - Not Yet Implemented)
*   Save presenter scores to their permanent user profiles (for logged-in Google users).
*   Admin dashboard to view history of sessions they've hosted.
*   More detailed user profiles.

```
