

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
            *   Enable the "Google" sign-in provider. Ensure you select your project support email.
            *   Enable the "Email/Password" sign-in provider.
        *   Go to the **Settings** tab (within Authentication):
            *   Scroll to **Authorized domains**.
            *   Click **Add domain** and add `localhost` if it's not already present. This is crucial for local development.
            *   **If using Google Cloud Workstations or other port-forwarding services:** You might get errors like `auth/requests-from-referer-...-are-blocked`. You need to add the specific domain shown in the error message to this "Authorized domains" list. For example, if the error shows `https://1234-my-workstation.cluster-xyz.cloudworkstations.dev`, you would add `1234-my-workstation.cluster-xyz.cloudworkstations.dev` here. Also add the non-port-prefixed version if applicable, e.g., `my-workstation.cluster-xyz.cloudworkstations.dev`.
            *   Your deployed app's domain will also need to be listed here (Firebase usually adds this automatically when you set up Hosting).
    *   **Firestore:** In the Firebase console, navigate to Firestore Database (under Build) and create a database. Start in "production mode" and choose a region.
    *   **Register a Web App:** Go to Project Overview > Project settings (gear icon) > General tab. Scroll down to "Your apps" and click on the Web icon (</>) to add a web app. Follow the prompts.
    *   **Copy Configuration:** After registering the web app, Firebase will display a `firebaseConfig` object. Copy these values.
    *   **Update `src/lib/firebase.ts`:** Open the `src/lib/firebase.ts` file in your project and replace the placeholder values in the `firebaseConfig` object with the ones you copied from your Firebase project. **Ensure these are exactly correct, especially `apiKey` and `authDomain`.**
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
                               request.resource.data.currentPresenterUid == null && // Ensure currentPresenterUid starts null or undefined
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
                                  // Note: All other fields must be explicitly checked for equality or allowed change.
                                  ( // General admin actions not related to presenter queue or kicking
                                    request.resource.data.participants == resource.data.participants &&
                                    request.resource.data.presenterQueue == resource.data.presenterQueue &&
                                    request.resource.data.currentPresenterIndex == resource.data.currentPresenterIndex &&
                                    request.resource.data.currentPresenterName == resource.data.currentPresenterName &&
                                    request.resource.data.currentPresenterUid == resource.data.currentPresenterUid &&
                                    request.resource.data.presenterScores == resource.data.presenterScores &&
                                    (
                                      // Toggle round (optionally resets scores if going from inactive to active in general mode)
                                      (
                                        request.resource.data.isRoundActive != resource.data.isRoundActive &&
                                        (request.resource.data.likeClicks == 0 || request.resource.data.likeClicks == resource.data.likeClicks) && // Scores reset or unchanged
                                        (request.resource.data.dislikeClicks == 0 || request.resource.data.dislikeClicks == resource.data.dislikeClicks) && // Scores reset or unchanged
                                        request.resource.data.sessionEnded == resource.data.sessionEnded && // Must not change sessionEnded status
                                        request.resource.data.soundsEnabled == resource.data.soundsEnabled &&
                                        request.resource.data.resultsVisible == resource.data.resultsVisible &&
                                        request.resource.data.diff(resource.data).affectedKeys().hasAny(['isRoundActive', 'likeClicks', 'dislikeClicks']) &&
                                        request.resource.data.diff(resource.data).affectedKeys().size() <= 3 // Only these fields can change
                                      ) ||
                                      // Clear scores (does not affect presenterScores array)
                                      (
                                        request.resource.data.likeClicks == 0 && request.resource.data.dislikeClicks == 0 &&
                                        request.resource.data.isRoundActive == resource.data.isRoundActive && // Round status itself does not change here
                                        request.resource.data.sessionEnded == resource.data.sessionEnded &&
                                        request.resource.data.soundsEnabled == resource.data.soundsEnabled &&
                                        request.resource.data.resultsVisible == resource.data.resultsVisible &&
                                        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['likeClicks', 'dislikeClicks'])
                                      ) ||
                                      // End session (may add final presenter score)
                                      (
                                        request.resource.data.sessionEnded == true && resource.data.sessionEnded == false &&
                                        request.resource.data.isRoundActive == false &&
                                        (
                                            request.resource.data.diff(resource.data).affectedKeys().hasOnly(['sessionEnded', 'isRoundActive']) ||
                                            (
                                                request.resource.data.diff(resource.data).affectedKeys().hasOnly(['sessionEnded', 'isRoundActive', 'presenterScores']) &&
                                                request.resource.data.presenterScores.size() == resource.data.presenterScores.size() + 1 // Only allow adding one score
                                            )
                                        )
                                      ) ||
                                      // Toggle soundsEnabled
                                      (
                                        request.resource.data.soundsEnabled != resource.data.soundsEnabled &&
                                        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['soundsEnabled'])
                                      ) ||
                                      // Toggle resultsVisible
                                      (
                                        request.resource.data.resultsVisible != resource.data.resultsVisible &&
                                        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['resultsVisible'])
                                      )
                                    )
                                  ) ||
                                  // Set/Update Presenter Queue (resets scores, presenterScores, current presenter details)
                                  (
                                    request.resource.data.presenterQueue is list &&
                                    request.resource.data.currentPresenterIndex is number && (request.resource.data.currentPresenterIndex == 0 || request.resource.data.currentPresenterIndex == -1) &&
                                    request.resource.data.currentPresenterName is string &&
                                    (request.resource.data.currentPresenterUid is string || request.resource.data.currentPresenterUid == null) &&
                                    request.resource.data.likeClicks == 0 &&
                                    request.resource.data.dislikeClicks == 0 &&
                                    (request.resource.data.isRoundActive == (request.resource.data.presenterQueue.size() > 0)) &&
                                    request.resource.data.presenterScores.size() == 0 && // presenterScores is reset
                                    request.resource.data.sessionEnded == resource.data.sessionEnded && // Must not change sessionEnded status
                                    request.resource.data.soundsEnabled == resource.data.soundsEnabled &&
                                    request.resource.data.resultsVisible == resource.data.resultsVisible &&
                                    request.resource.data.participants == resource.data.participants && // Participants map should not change
                                    request.resource.data.diff(resource.data).affectedKeys().hasOnly([
                                      'presenterQueue', 'currentPresenterIndex', 'currentPresenterName', 'currentPresenterUid',
                                      'likeClicks', 'dislikeClicks', 'isRoundActive', 'presenterScores'
                                    ])
                                  ) ||
                                  // Advancing Presenter (to next valid or to "End of Queue")
                                  (
                                    request.resource.data.presenterQueue == resource.data.presenterQueue && // Queue itself must not change
                                    request.resource.data.currentPresenterIndex == resource.data.currentPresenterIndex + 1 && // Index must advance by 1
                                    request.resource.data.likeClicks == 0 && // Current scores must reset
                                    request.resource.data.dislikeClicks == 0 && // Current scores must reset
                                    request.resource.data.sessionEnded == resource.data.sessionEnded && // Session not ending
                                    request.resource.data.soundsEnabled == resource.data.soundsEnabled &&
                                    request.resource.data.resultsVisible == resource.data.resultsVisible &&
                                    request.resource.data.participants == resource.data.participants &&
                                    (
                                      // Case 1: Advancing to a valid next presenter in the queue
                                      (
                                        request.resource.data.currentPresenterIndex < request.resource.data.presenterQueue.size() &&
                                        request.resource.data.currentPresenterName == request.resource.data.presenterQueue[request.resource.data.currentPresenterIndex].name &&
                                        (request.resource.data.currentPresenterUid == request.resource.data.presenterQueue[request.resource.data.currentPresenterIndex].uid || (request.resource.data.currentPresenterUid == null && request.resource.data.presenterQueue[request.resource.data.currentPresenterIndex].uid == null)) &&
                                        request.resource.data.isRoundActive == true &&
                                        (
                                          // Subcase 1.1: Score for previous presenter IS recorded
                                          (
                                            request.resource.data.presenterScores.size() == resource.data.presenterScores.size() + 1 &&
                                            request.resource.data.presenterScores[-1].name == resource.data.currentPresenterName && // Ensure the name matches the one being scored
                                            request.resource.data.diff(resource.data).affectedKeys().hasOnly([
                                              'currentPresenterIndex', 'currentPresenterName', 'currentPresenterUid',
                                              'likeClicks', 'dislikeClicks', 'isRoundActive', 'presenterScores'
                                            ])
                                          ) ||
                                          // Subcase 1.2: Score for previous presenter IS NOT recorded (e.g. first presenter, or previous was "End of Queue")
                                          (
                                            request.resource.data.presenterScores.size() == resource.data.presenterScores.size() &&
                                            request.resource.data.diff(resource.data).affectedKeys().hasOnly([
                                              'currentPresenterIndex', 'currentPresenterName', 'currentPresenterUid',
                                              'likeClicks', 'dislikeClicks', 'isRoundActive'
                                            ])
                                          )
                                        )
                                      ) ||
                                      // Case 2: Advancing to "End of Queue"
                                      (
                                        request.resource.data.currentPresenterIndex >= request.resource.data.presenterQueue.size() && // Index is at or beyond queue end
                                        request.resource.data.currentPresenterName == "End of Queue" &&
                                        request.resource.data.currentPresenterUid == null && // currentPresenterUid should be null for "End of Queue"
                                        request.resource.data.isRoundActive == false &&
                                        (
                                          // Subcase 2.1: Score for the actual last presenter IS recorded
                                          (
                                            request.resource.data.presenterScores.size() == resource.data.presenterScores.size() + 1 &&
                                            request.resource.data.presenterScores[-1].name == resource.data.currentPresenterName && // Ensure the name matches the one being scored
                                            request.resource.data.diff(resource.data).affectedKeys().hasOnly([
                                              'currentPresenterIndex', 'currentPresenterName', 'currentPresenterUid',
                                              'likeClicks', 'dislikeClicks', 'isRoundActive', 'presenterScores'
                                            ])
                                          ) ||
                                          // Subcase 2.2: Score for last presenter IS NOT recorded (e.g. clicked "Next" when already at "End of Queue")
                                          (
                                            request.resource.data.presenterScores.size() == resource.data.presenterScores.size() &&
                                            request.resource.data.diff(resource.data).affectedKeys().hasOnly([
                                              'currentPresenterIndex', 'currentPresenterName', 'currentPresenterUid',
                                              'likeClicks', 'dislikeClicks', 'isRoundActive'
                                            ])
                                          )
                                        )
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
                                    request.resource.data.currentPresenterUid == resource.data.currentPresenterUid &&
                                    request.resource.data.presenterScores == resource.data.presenterScores // Kicking does not affect presenterScores
                                  )
                                )
                              ) ||
                              // User voting actions
                              (
                                request.resource.data.isRoundActive == true && // Round must remain active
                                resource.data.isRoundActive == true && // Round must have been active
                                ( 
                                  (resource.data.presenterQueue == null || resource.data.presenterQueue.size() == 0) || // General session OR
                                  ( // Specific presenter is active
                                    resource.data.presenterQueue.size() > 0 &&
                                    resource.data.currentPresenterIndex >= 0 &&
                                    resource.data.currentPresenterIndex < resource.data.presenterQueue.size() &&
                                    resource.data.currentPresenterName != "" &&
                                    resource.data.currentPresenterName != "End of Queue"
                                  )
                                ) &&
                                ( // Only one counter can change by exactly 1
                                  ( 
                                    request.resource.data.likeClicks == resource.data.likeClicks + 1 &&
                                    request.resource.data.dislikeClicks == resource.data.dislikeClicks &&
                                    request.resource.data.diff(resource.data).affectedKeys().hasOnly(['likeClicks'])
                                  ) ||
                                  ( 
                                    request.resource.data.dislikeClicks == resource.data.dislikeClicks + 1 &&
                                    request.resource.data.likeClicks == resource.data.likeClicks &&
                                    request.resource.data.diff(resource.data).affectedKeys().hasOnly(['dislikeClicks'])
                                  )
                                ) &&
                                // Ensure no other critical fields are changed by a vote
                                request.resource.data.adminUid == resource.data.adminUid &&
                                request.resource.data.sessionEnded == resource.data.sessionEnded &&
                                request.resource.data.createdAt == resource.data.createdAt &&
                                request.resource.data.soundsEnabled == resource.data.soundsEnabled &&
                                request.resource.data.resultsVisible == resource.data.resultsVisible &&
                                request.resource.data.sessionType == resource.data.sessionType &&
                                request.resource.data.participants == resource.data.participants && 
                                request.resource.data.presenterQueue == resource.data.presenterQueue &&
                                request.resource.data.currentPresenterIndex == resource.data.currentPresenterIndex &&
                                request.resource.data.currentPresenterName == resource.data.currentPresenterName &&
                                request.resource.data.currentPresenterUid == resource.data.currentPresenterUid &&
                                request.resource.data.presenterScores == resource.data.presenterScores
                              ) ||
                              // User setting their own nickname (immutable after first set)
                              (
                                request.resource.data.diff(resource.data).affectedKeys().hasOnly(['participants']) &&
                                request.resource.data.participants is map &&
                                request.auth.uid in request.resource.data.participants &&
                                request.resource.data.participants[request.auth.uid].nickname is string &&
                                request.resource.data.participants[request.auth.uid].uid == request.auth.uid &&
                                (
                                  (!(resource.data.participants is map) || (resource.data.participants is map && !(request.auth.uid in resource.data.participants))) && 
                                  request.resource.data.participants[request.auth.uid].joinedAt == request.time 
                                ) ||
                                (
                                  (resource.data.participants is map && request.auth.uid in resource.data.participants) && 
                                  request.resource.data.participants[request.auth.uid].nickname == resource.data.participants[request.auth.uid].nickname && 
                                  request.resource.data.participants[request.auth.uid].joinedAt == resource.data.participants[request.auth.uid].joinedAt 
                                ) &&
                                ( 
                                  (!(resource.data.participants is map) && request.resource.data.participants.keys().hasOnly([request.auth.uid])) ||
                                  (resource.data.participants is map && request.resource.data.participants.diff(resource.data.participants).affectedKeys().hasOnly([request.auth.uid]))
                                ) &&
                                // Ensure no other critical fields are changed
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
                                request.resource.data.currentPresenterUid == resource.data.currentPresenterUid &&
                                request.resource.data.presenterScores == resource.data.presenterScores
                              )
                            );
            }
          }
        }
        ```
    *   **IMPORTANT: API Key Restrictions (Google Cloud Console):** If `auth/unauthorized-domain` or `auth/requests-from-referer-...-are-blocked` persists after adding domains to Firebase Auth:
        *   Go to [Google Cloud Console](https://console.cloud.google.com/).
        *   Select your project.
        *   Navigate to **APIs & Services > Credentials**.
        *   Find the API key used by your web app (usually "Browser key" or matching your `firebaseConfig.apiKey`). Click its name.
        *   Under **Application restrictions**, choose "HTTP referrers (web sites)".
        *   Under **Website restrictions**, click "ADD" and add these entries if they are missing:
            *   `localhost`
            *   `localhost:*` (wildcard for any port)
            *   `http://localhost:YOUR_PORT_NUMBER` (e.g., `http://localhost:9002`)
            *   **If using Google Cloud Workstations or similar port-forwarding:** Add the specific `https://<your-workstation-subdomain>.cloudworkstations.dev/*` pattern that appears in the error message (e.g., `https://6000-my-workstation.cluster-xyz.cloudworkstations.dev/*`). Make sure to include `https://` and the trailing `/*`.
        *   Under **API restrictions**, if "Restrict key" is chosen, ensure **"Identity Toolkit API"** is in the list of allowed APIs. "Don't restrict key" is often simpler for development (but less secure for production).
        *   **Click SAVE at the bottom of the GCP page.** Changes can take a few minutes to propagate.

    *   **Troubleshooting "The requested action is invalid" error (on `...firebaseapp.com/__/auth/handler` page):**
        This usually means an issue with your `firebaseConfig` values in `src/lib/firebase.ts` or your Google Sign-In provider setup in Firebase, or deeper settings in Google Cloud.
        1.  **Re-verify `apiKey` and `authDomain` in `src/lib/firebase.ts`:** This is the MOST critical. Go to Firebase Console > Project settings (gear icon) > General > Your apps > Web App. Compare the `apiKey` and `authDomain` there with what's in your file. They MUST be IDENTICAL. The `authDomain` should be `YOUR_PROJECT_ID.firebaseapp.com`.
        2.  **Check Google Sign-In Provider in Firebase Console:** Go to Authentication > Sign-in method > Google.
            *   Ensure it's "Enabled".
            *   Ensure a "Project support email" is selected.
            *   Try disabling it, saving, then re-enabling it and re-selecting the support email. This can sometimes refresh the configuration.
        3.  **Check OAuth Consent Screen in GCP:** Go to GCP Console > APIs & Services > OAuth consent screen.
            *   If "Publishing status" is "Testing", add your Google account email to the "Test users" list.
            *   Ensure "App name", "User support email", and "Developer contact information" are filled.
        4.  **Advanced - Check OAuth 2.0 Client ID in GCP:**
            *   In GCP Console, go to APIs & Services > Credentials.
            *   Under "OAuth 2.0 Client IDs", find the client ID that was likely auto-created by Firebase (e.g., "Web client (auto created by Firebase)"). Click its name.
            *   **Verify "Authorized JavaScript origins":** This list MUST include `https://YOUR_PROJECT_ID.firebaseapp.com` AND your app's origin (e.g., `https://YOUR_CLOUD_WORKSTATION_URL`, `http://localhost:PORT`).
            *   **Verify "Authorized redirect URIs":** This list MUST include `https://YOUR_PROJECT_ID.firebaseapp.com/__/auth/handler`.
            *   If these are incorrect, it can cause this error. Firebase *should* manage these, but discrepancies can occur. Modifying these directly is an advanced step; proceed with caution.

    *   **Troubleshooting "auth/popup-closed-by-user" error:**
        This error means the Google Sign-In pop-up appeared, but was closed before authentication completed.
        1.  **Browser Pop-up Blocker / Extensions:** The most common cause. Even if the pop-up appears, an aggressive blocker or extension (ad blocker, privacy tool) might interfere.
            *   **Try in an Incognito/Private window.** This usually disables extensions.
            *   Temporarily disable your browser's pop-up blocker and relevant extensions.
        2.  **Redirect URI Mismatch (Less likely if "action invalid" was fixed, but re-check):** Ensure `https://YOUR_PROJECT_ID.firebaseapp.com/__/auth/handler` is *exactly* correct in the GCP OAuth 2.0 Client ID's "Authorized redirect URIs".
        3.  **`authDomain` in `firebaseConfig`:** Double-check it's `YOUR_PROJECT_ID.firebaseapp.com` in `src/lib/firebase.ts`.
        4.  **Third-party Cookies:** Ensure your browser isn't blocking third-party cookies, as this can sometimes interfere with pop-up authentication flows.
        5.  **Manually Closing:** The user might have accidentally closed the pop-up too soon.


4.  **Run the Development Server:**
    ```bash
    npm run dev
    ```
    The application will typically be available at `http://localhost:9002` or your Cloud Workstation URL.

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
*   Authentication via Firebase (Anonymous, Google Sign-In, Email/Password).
*   Informational tooltips for admin controls.
*   **Participant Count Display:** Shows the current number of participants in the session.
*   Global header with Login/Logout (to `/auth` page), Feedback link, Dashboard link (for logged-in users), and theme toggle.
*   **Admin Dashboard (`/dashboard`):** Logged-in (non-anonymous) users can view a history of sessions they administered, including the overall presenter scores for each.

## Next Steps (Future Enhancements - Not Yet Implemented)
*   **Student View of Past Scores:** Allow students to view their own scores from past presentations. This requires changes to the session data model to robustly link presenter scores to user UIDs.
*   Save presenter scores to their permanent user profiles (for logged-in Google users).
*   More detailed user profiles.
*   More formal mechanism for "sending" or sharing results with presenters post-session.

    




    
