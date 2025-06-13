
# ClassVote

ClassVote is a real-time, interactive web application where users create or join voting sessions to collectively provide feedback, typically for presentations. Participants must set a unique nickname for the session before they can engage. This nickname cannot be changed later. Participants can cast "like" or "dislike" votes, and a live leaderboard tracks the scores. Session administrators have controls to manage the feedback rounds, sound settings, results visibility, presenter queues, kick participants, and end sessions. An overall leaderboard displays scores for all presenters once the queue is complete or the session ends. Users can sign in with Google to associate sessions and scores with their account.

## Tech Stack

*   **Frontend:** Next.js (App Router), React, TypeScript
*   **UI:** ShadCN UI Components, Tailwind CSS
*   **Real-time Backend:** Firebase (Firestore for database, Firebase Authentication for anonymous and Google users)
*   **Audio:** Tone.js for sound feedback on votes
*   **Markdown Rendering:** `react-markdown` with `remark-gfm`

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
            *   **Add your custom domain:** If you are using `classvote.online` or any other custom domain, add it here (e.g., `classvote.online`).
            *   **If using Google Cloud Workstations or other port-forwarding services:** You might get errors like `auth/requests-from-referer-...-are-blocked`. You need to add the specific domain shown in the error message to this "Authorized domains" list. For example, if the error shows `https://1234-my-workstation.cluster-xyz.cloudworkstations.dev`, you would add `1234-my-workstation.cluster-xyz.cloudworkstations.dev` here. Also add the non-port-prefixed version if applicable, e.g., `my-workstation.cluster-xyz.cloudworkstations.dev`.
            *   Your deployed app's domain (e.g., the one Vercel gives you, or `classvote.online`) will also need to be listed here (Firebase usually adds its own `*.firebaseapp.com` and `*.web.app` domains automatically when you set up Hosting).
    *   **Firestore:** In the Firebase console, navigate to Firestore Database (under Build) and create a database. Start in "production mode" and choose a region.
    *   **Register a Web App:** Go to Project Overview > Project settings (gear icon) > General tab. Scroll down to "Your apps" and click on the Web icon (</>) to add a web app. Follow the prompts.
    *   **Copy Configuration:** After registering the web app, Firebase will display a `firebaseConfig` object. Copy these values.
    *   **Update `src/lib/firebase.ts`:** Open the `src/lib/firebase.ts` file in your project and replace the placeholder values in the `firebaseConfig` object with the ones you copied from your Firebase project. **Ensure these are exactly correct, especially `apiKey` and `authDomain`.**
    *   **Firestore Security Rules:** Update your Firestore security rules. Navigate to Firestore Database > Rules tab in the Firebase console and replace the default rules with the following:
        ```firestore-rules
        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            // Rule for health check path
            match /_internal_health_check/{docId} {
              allow read: if true; 
              allow write: if false;
            }

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
                               request.resource.data.presenterScores is list && request.resource.data.presenterScores.size() == 0 &&
                               request.resource.data.isPermanentlySaved == false &&
                               request.resource.data.votingMode == 'single' && 
                               request.resource.data.generalRoundInstanceId == 1 &&
                               request.resource.data.createdAt == request.time;

              allow update: if request.auth != null && (
                              // ADMIN ACTIONS (Session must not be ended for most actions, unless explicitly allowed like toggling save on results page)
                              (resource.data.adminUid == request.auth.uid && resource.data.sessionEnded == false && (
                                // Toggle Pause/Resume Feedback 
                                (
                                  request.resource.data.diff(resource.data).affectedKeys().hasOnly(['isRoundActive'])
                                ) ||
                                // End session (may add final presenter score)
                                (
                                  request.resource.data.sessionEnded == true && resource.data.sessionEnded == false &&
                                  request.resource.data.isRoundActive == false && // Round must be closed when session ends
                                  (
                                    // Case 1: Ending without adding a new presenter score (e.g., no active presenter, or queue was empty)
                                    (
                                      request.resource.data.diff(resource.data).affectedKeys().hasOnly(['sessionEnded', 'isRoundActive'])
                                    ) ||
                                    // Case 2: Ending AND adding a new presenter score
                                    (
                                      request.resource.data.diff(resource.data).affectedKeys().hasOnly(['sessionEnded', 'isRoundActive', 'presenterScores']) &&
                                      request.resource.data.presenterScores.size() == resource.data.presenterScores.size() + 1 &&
                                      // Validate structure of the new score being added
                                      request.resource.data.presenterScores[resource.data.presenterScores.size()].name is string &&
                                      (request.resource.data.presenterScores[resource.data.presenterScores.size()].uid is string || request.resource.data.presenterScores[resource.data.presenterScores.size()].uid == null) &&
                                      request.resource.data.presenterScores[resource.data.presenterScores.size()].likes is number &&
                                      request.resource.data.presenterScores[resource.data.presenterScores.size()].dislikes is number &&
                                      request.resource.data.presenterScores[resource.data.presenterScores.size()].netScore is number &&
                                      // Validate the new score matches the current presenter details from *before* ending
                                      resource.data.currentPresenterIndex >= 0 && resource.data.currentPresenterIndex < resource.data.presenterQueue.size() &&
                                      request.resource.data.presenterScores[resource.data.presenterScores.size()].name == resource.data.presenterQueue[resource.data.currentPresenterIndex].name &&
                                      (
                                        request.resource.data.presenterScores[resource.data.presenterScores.size()].uid == resource.data.presenterQueue[resource.data.currentPresenterIndex].uid ||
                                        (request.resource.data.presenterScores[resource.data.presenterScores.size()].uid == null && resource.data.presenterQueue[resource.data.currentPresenterIndex].uid == null)
                                      )
                                    )
                                  )
                                ) ||
                                // Toggle soundsEnabled
                                (
                                  request.resource.data.diff(resource.data).affectedKeys().hasOnly(['soundsEnabled'])
                                ) ||
                                // Toggle resultsVisible
                                (
                                  request.resource.data.diff(resource.data).affectedKeys().hasOnly(['resultsVisible'])
                                ) ||
                                // Toggle votingMode
                                (
                                  request.resource.data.diff(resource.data).affectedKeys().hasOnly(['votingMode']) &&
                                  (request.resource.data.votingMode == 'single' || request.resource.data.votingMode == 'infinite')
                                ) ||
                                // Manage Presenter Queue (add, remove, clear)
                                (
                                  request.resource.data.presenterQueue is list &&
                                  (request.resource.data.presenterQueue.size() == 0 || ( // Validate structure if not empty
                                      request.resource.data.presenterQueue[0] is map &&
                                      request.resource.data.presenterQueue[0].name is string &&
                                      request.resource.data.presenterQueue[0].participantId is string &&
                                      (!('uid' in request.resource.data.presenterQueue[0]) || request.resource.data.presenterQueue[0].uid is string || request.resource.data.presenterQueue[0].uid == null)
                                  )) &&
                                  (
                                    // Clearing queue (which also resets scores and makes round active)
                                    (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['presenterQueue', 'currentPresenterIndex', 'likeClicks', 'dislikeClicks', 'isRoundActive', 'presenterScores'])) ||
                                    // Adding/removing from queue, and currentPresenterIndex might change, potentially resetting clicks & round
                                    (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['presenterQueue', 'currentPresenterIndex', 'likeClicks', 'dislikeClicks', 'isRoundActive'])) ||
                                    // Only adding/removing from queue - clicks and round must be reset, index might not change if not current
                                    (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['presenterQueue', 'likeClicks', 'dislikeClicks', 'isRoundActive'])) || 
                                    // Just updating the queue (e.g. a reorder not yet implemented client-side, but rule allows it if other fields match)
                                    (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['presenterQueue'])) 
                                  ) &&
                                  // When queue ops that reset votes occur:
                                  (
                                    ( request.resource.data.diff(resource.data).affectedKeys().hasAny(['likeClicks', 'dislikeClicks', 'isRoundActive', 'presenterScores']) ) ?
                                    ( request.resource.data.likeClicks == 0 && request.resource.data.dislikeClicks == 0 && request.resource.data.isRoundActive == true && 
                                      (request.resource.data.diff(resource.data).affectedKeys().hasAny(['presenterScores']) ? request.resource.data.presenterScores.size() == 0 : true)
                                    ) 
                                    : true 
                                  )
                                ) ||
                                // Advancing Presenter ("Start Next Feedback Round")
                                (
                                  request.resource.data.presenterQueue == resource.data.presenterQueue && 
                                  request.resource.data.currentPresenterIndex == resource.data.currentPresenterIndex + 1 && 
                                  request.resource.data.likeClicks == 0 && request.resource.data.dislikeClicks == 0 && 
                                  (
                                    // Case 1: Recording score for previous presenter
                                    ( request.resource.data.presenterScores.size() == resource.data.presenterScores.size() + 1 &&
                                      request.resource.data.presenterScores[resource.data.presenterScores.size()].name is string && 
                                      (request.resource.data.presenterScores[resource.data.presenterScores.size()].uid is string || request.resource.data.presenterScores[resource.data.presenterScores.size()].uid == null) &&
                                      request.resource.data.presenterScores[resource.data.presenterScores.size()].likes is number &&
                                      request.resource.data.presenterScores[resource.data.presenterScores.size()].dislikes is number &&
                                      request.resource.data.presenterScores[resource.data.presenterScores.size()].netScore is number &&
                                      resource.data.currentPresenterIndex >=0 && resource.data.currentPresenterIndex < resource.data.presenterQueue.size() && 
                                      request.resource.data.presenterScores[resource.data.presenterScores.size()].name == resource.data.presenterQueue[resource.data.currentPresenterIndex].name &&
                                      (request.resource.data.presenterScores[resource.data.presenterScores.size()].uid == resource.data.presenterQueue[resource.data.currentPresenterIndex].uid || (request.resource.data.presenterScores[resource.data.presenterScores.size()].uid == null && resource.data.presenterQueue[resource.data.currentPresenterIndex].uid == null) ) &&
                                      request.resource.data.diff(resource.data).affectedKeys().hasOnly(['currentPresenterIndex', 'likeClicks', 'dislikeClicks', 'isRoundActive', 'presenterScores'])
                                    ) ||
                                    // Case 2: Not recording score
                                    ( request.resource.data.presenterScores.size() == resource.data.presenterScores.size() && 
                                      request.resource.data.diff(resource.data).affectedKeys().hasOnly(['currentPresenterIndex', 'likeClicks', 'dislikeClicks', 'isRoundActive'])
                                    )
                                  ) &&
                                  request.resource.data.isRoundActive == (request.resource.data.currentPresenterIndex < request.resource.data.presenterQueue.size())
                                ) ||
                                // Admin Resetting Current Presenter's Votes (when presenter queue is active)
                                (
                                  resource.data.presenterQueue.size() > 0 &&
                                  resource.data.currentPresenterIndex >= 0 && resource.data.currentPresenterIndex < resource.data.presenterQueue.size() && 
                                  request.resource.data.diff(resource.data).affectedKeys().hasOnly(['likeClicks', 'dislikeClicks']) &&
                                  request.resource.data.likeClicks == 0 && request.resource.data.dislikeClicks == 0
                                ) ||
                                // Admin Restarting General Session (when presenter queue is empty)
                                (
                                  resource.data.presenterQueue.size() == 0 && 
                                  request.resource.data.diff(resource.data).affectedKeys().hasOnly(['likeClicks', 'dislikeClicks', 'isRoundActive', 'generalRoundInstanceId']) &&
                                  request.resource.data.likeClicks == 0 &&
                                  request.resource.data.dislikeClicks == 0 &&
                                  request.resource.data.isRoundActive == true &&
                                  request.resource.data.generalRoundInstanceId == resource.data.generalRoundInstanceId + 1
                                ) ||
                                // Admin kicking a participant
                                (
                                  request.resource.data.diff(resource.data).affectedKeys().hasAny(['participants', 'presenterQueue', 'currentPresenterIndex']) && 
                                  (request.auth.uid in resource.data.participants ? request.auth.uid in request.resource.data.participants : true) && 
                                  request.resource.data.participants.keys().size() < resource.data.participants.keys().size() &&
                                  ( (request.resource.data.presenterQueue != resource.data.presenterQueue || request.resource.data.currentPresenterIndex != resource.data.currentPresenterIndex) ?
                                      (request.resource.data.likeClicks == 0 && request.resource.data.dislikeClicks == 0)
                                      : (request.resource.data.likeClicks == resource.data.likeClicks && request.resource.data.dislikeClicks == resource.data.dislikeClicks)
                                  )
                                ) ||
                                // Admin toggling permanent save status (on session page)
                                (
                                  request.resource.data.diff(resource.data).affectedKeys().hasOnly(['isPermanentlySaved'])
                                )
                                // Ensuring other crucial fields aren't changed accidentally by these simpler rules
                                && ( 
                                  !request.resource.data.diff(resource.data).affectedKeys().hasAny(['adminUid', 'createdAt', 'sessionType']) &&
                                  ( // generalRoundInstanceId should only change if it's the *only* other field in the "Restart Session" diff
                                    request.resource.data.diff(resource.data).affectedKeys().hasOnly(['likeClicks', 'dislikeClicks', 'isRoundActive', 'generalRoundInstanceId']) ?
                                      true // generalRoundInstanceId change is allowed here
                                    : request.resource.data.generalRoundInstanceId == resource.data.generalRoundInstanceId // otherwise, it must not change
                                  )
                                )
                              )) || 

                              // USER VOTING ACTIONS
                              (
                                request.resource.data.isRoundActive == true && 
                                resource.data.isRoundActive == true && 
                                resource.data.sessionEnded == false && 
                                ( 
                                  (resource.data.presenterQueue.size() == 0) || 
                                  ( resource.data.presenterQueue.size() > 0 &&
                                    resource.data.currentPresenterIndex >= 0 &&
                                    resource.data.currentPresenterIndex < resource.data.presenterQueue.size() 
                                  )
                                ) &&
                                ( 
                                  ( 
                                    request.resource.data.diff(resource.data).affectedKeys().hasOnly(['likeClicks']) &&
                                    request.resource.data.likeClicks == resource.data.likeClicks + 1
                                  ) ||
                                  ( 
                                    request.resource.data.diff(resource.data).affectedKeys().hasOnly(['dislikeClicks']) &&
                                    request.resource.data.dislikeClicks == resource.data.dislikeClicks + 1
                                  )
                                )
                                && request.resource.data.diff(resource.data).affectedKeys().size() == 1 // Ensure ONLY like or dislike changed
                                && request.resource.data.generalRoundInstanceId == resource.data.generalRoundInstanceId // generalRoundInstanceId must not change during voting
                              ) ||

                              // USER SETTING THEIR OWN NICKNAME
                              (
                                request.resource.data.diff(resource.data).affectedKeys().hasOnly(['participants']) &&
                                request.resource.data.participants is map &&
                                request.auth.uid in request.resource.data.participants &&
                                request.resource.data.participants[request.auth.uid].nickname is string &&
                                request.resource.data.participants[request.auth.uid].nickname.size() > 0 &&
                                request.resource.data.participants[request.auth.uid].nickname.size() <= 25 &&
                                request.resource.data.participants[request.auth.uid].uid == request.auth.uid &&
                                (
                                  (!(request.auth.uid in resource.data.participants)) || 
                                  (request.auth.uid in resource.data.participants && !('joinedAt' in resource.data.participants[request.auth.uid])) || 
                                  (request.auth.uid in resource.data.participants && resource.data.participants[request.auth.uid].joinedAt == null) 
                                ) ? request.resource.data.participants[request.auth.uid].joinedAt == request.time
                                  : request.resource.data.participants[request.auth.uid].joinedAt == resource.data.participants[request.auth.uid].joinedAt &&
                                (
                                  (resource.data.participants == null && request.resource.data.participants.keys().hasOnly([request.auth.uid])) ||
                                  (resource.data.participants != null && request.resource.data.participants.diff(resource.data.participants).affectedKeys().hasOnly([request.auth.uid]))
                                )
                                && request.resource.data.generalRoundInstanceId == resource.data.generalRoundInstanceId // generalRoundInstanceId must not change
                              )
                            ) || 

                            // ADMIN ACTION WHEN SESSION *IS* ENDED
                            (
                                resource.data.adminUid == request.auth.uid &&
                                resource.data.sessionEnded == true && 
                                request.resource.data.sessionEnded == true && 
                                (
                                  (
                                    request.resource.data.diff(resource.data).affectedKeys().hasOnly(['isPermanentlySaved'])
                                  )
                                )
                                && request.resource.data.generalRoundInstanceId == resource.data.generalRoundInstanceId // generalRoundInstanceId must not change
                            ); 

              allow delete: if request.auth.uid == resource.data.adminUid;
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
            *   **Your custom domain:** `classvote.online`
            *   **Your custom domain (with wildcard for Vercel/Netlify previews or other subdomains):** `*.classvote.online` (if applicable)
            *   **Your Vercel deployment URL (if applicable):** `YOUR_VERCEL_PROJECT_NAME.vercel.app`
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
            *   **Verify "Authorized JavaScript origins":** This list MUST include `https://YOUR_PROJECT_ID.firebaseapp.com`, `https://classvote.online` (and any other custom/Vercel domains), AND your app's origin (e.g., `https://YOUR_CLOUD_WORKSTATION_URL`, `http://localhost:PORT`).
            *   **Verify "Authorized redirect URIs":** This list MUST include `https://YOUR_PROJECT_ID.firebaseapp.com/__/auth/handler` AND `https://classvote.online/__/auth/handler` (and similar for other custom/Vercel domains).
            *   If these are incorrect, it can cause this error. Firebase *should* manage these, but discrepancies can occur. Modifying these directly is an advanced step; proceed with caution.

    *   **Troubleshooting "auth/popup-closed-by-user" error:**
        This error means the Google Sign-In pop-up appeared, but was closed before authentication completed.
        1.  **Browser Pop-up Blocker / Extensions:** The most common cause. Even if the pop-up appears, an aggressive blocker or extension (ad blocker, privacy tool) might interfere.
            *   **Try in an Incognito/Private window.** This usually disables extensions.
            *   Temporarily disable your browser's pop-up blocker and relevant extensions.
        2.  **Redirect URI Mismatch (Less likely if "action invalid" was fixed, but re-check):** Ensure `https://YOUR_PROJECT_ID.firebaseapp.com/__/auth/handler` AND `https://classvote.online/__/auth/handler` are *exactly* correct in the GCP OAuth 2.0 Client ID's "Authorized redirect URIs".
        3.  **`authDomain` in `firebaseConfig`:** Double-check it's `YOUR_PROJECT_ID.firebaseapp.com` in `src/lib/firebase.ts`.
        4.  **Third-party Cookies:** Ensure your browser isn't blocking third-party cookies, as this can sometimes interfere with pop-up authentication flows.
        5.  **Manually Closing:** The user might have accidentally closed the pop-up too soon.


4.  **Run the Development Server:**
    ```bash
    npm run dev
    ```
    The application will typically be available at `http://localhost:9002` or your Cloud Workstation URL.

5.  **(For Changelog Page)** **Move `CHANGELOG.md`**: Manually move the `CHANGELOG.md` file from the root of your project into the `public` folder (`public/CHANGELOG.md`). This step is necessary for the new Changelog page to fetch and display its content.


## Key Features

*   Create new voting sessions with a unique 6-digit code (either anonymously or linked to a Google account). Participants join at `classvote.online`.
*   Join existing sessions using the code at `classvote.online`.
*   **Mandatory Nicknames:** Users must enter a unique nickname (per session) before participating. Nicknames are immutable once set.
*   **Presenter Queue Management:** Admin can add participants (who have set a nickname) to an ordered presenter queue. Admin can remove presenters from the queue or clear it entirely.
*   **Voting Modes:** Admin can set the session to "Single Vote per Round" (default, one vote per user per presenter/general round instance) or "Infinite Votes per Round" (users can vote multiple times for the current presenter/general round).
*   **Round Controls (Contextual):**
    *   If Presenter Queue is active:
        *   "Start Next Feedback Round": Records scores for the current presenter, advances to the next, resets like/dislike counts, and opens voting. Handles end of queue.
        *   "Reset Current Presenter's Votes": Resets like/dislike counts for the active presenter without recording scores or advancing.
    *   If Presenter Queue is empty (General Feedback Mode):
        *   "Restart Session": Resets like/dislike counts, increments a `generalRoundInstanceId` in Firestore (which resets voting for all users for the general round), and ensures the voting round is active.
*   Current presenter's name (if any) is displayed to all participants.
*   Real-time "like" and "dislike" voting.
*   Admin controls for vote sounds (on/off) and live results visibility (show/hide).
*   Admin can kick participants from the session (also removes them from presenter queue if present).
*   Live leaderboard displaying current scores (admin can hide/reveal), adapts to general session or specific presenter.
*   **Presenter Self-View:** A presenter can see their own scores even if general results are hidden by the admin, if their UID is matched.
*   **Overall Session Leaderboard:** Displayed as presenters complete their rounds, or when the presenter queue is finished or the session ends, showing scores for all presenters in that session. Sorts by likes.
*   Admin controls to pause/resume feedback rounds and end sessions.
*   **Session Retention & Deletion:**
    *   Sessions are created with `isPermanentlySaved: false`.
    *   Admins can toggle a session to be "Permanently Saved" from the session management panel (`session/[sessionId]` page) or results page.
    *   If a "quick" session is ended by an admin and it is *not* marked "Permanently Saved", it is deleted immediately from Firestore.
    *   "Account" sessions or "quick" sessions marked "Permanently Saved" are *not* deleted immediately upon ending but are kept for historical review on the "Results" page (where they can be toggled or deleted by the admin).
    *   Admins can delete their "account" sessions or any "permanently saved" sessions they administer from the "Results" page.
    *   **Automatic Deletion (Requires Cloud Functions - See "Next Steps"):**
        *   Sessions that are `sessionEnded == true` and `isPermanentlySaved == false` are intended to be deleted after 30 days.
        *   "Quick" sessions (`sessionType == 'quick'`) that are `sessionEnded == false`, not `isPermanentlySaved`, and have seen no activity (based on `createdAt` or a `lastActivityTimestamp` if implemented) for ~50-60 minutes are intended to be deleted.
*   User-friendly interface built with ShadCN UI and Tailwind CSS.
*   Authentication via Firebase (Anonymous, Google Sign-In, Email/Password).
*   Informational tooltips for admin controls.
*   **Participant Count Display:** Shows the current number of participants in the session.
*   Global header with Login/Logout (to `/auth` page), Feedback link, Results link (for logged-in users), Changelog link, and theme toggle.
*   **Results Page (`/results`):** Logged-in (non-anonymous) users can view:
    *   A history of sessions they administered (account sessions or those they manually saved), including the overall presenter scores for each. Admins can toggle a session to be "Permanently Saved" or delete it.
    *   A history of their own presentation scores from past sessions where their name/account was matched.
*   **Account Page (`/account`):** Logged-in (non-anonymous) users can manage their account, including sending a password reset email (for email/password accounts) and deleting their account.
*   **Changelog Page (`/changelog`):** Displays the application's update history by fetching and rendering `public/CHANGELOG.md`.
*   **Initial Server Check:** On app load, a quick check is made to Firestore. If unreachable, a global error page is displayed.

## Next Steps (Future Enhancements - Requires Server-Side Implementation)

*   **Automatic Deletion Cloud Functions:** Implement scheduled Firebase Cloud Functions for session cleanup:
    1.  **30-Day Cleanup for Ended, Unsaved Sessions:** Delete sessions where `sessionEnded == true`, `isPermanentlySaved == false`, and `createdAt` is older than 30 days.
        ```typescript
        // Conceptual Cloud Function (functions/src/index.ts)
        // import * as functions from 'firebase-functions';
        // import * as admin from 'firebase-admin';
        // admin.initializeApp();
        // const db = admin.firestore();

        // export const deleteOldEndedSessions = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
        //   const now = admin.firestore.Timestamp.now();
        //   const thirtyDaysInMillis = 30 * 24 * 60 * 60 * 1000;
        //   const thirtyDaysAgo = admin.firestore.Timestamp.fromMillis(now.toMillis() - thirtyDaysInMillis);

        //   const sessionsToDeleteQuery = db.collection('sessions')
        //     .where('sessionEnded', '==', true)
        //     .where('isPermanentlySaved', '==', false) 
        //     .where('createdAt', '<', thirtyDaysAgo);

        //   const snapshot = await sessionsToDeleteQuery.get();
        //   if (snapshot.empty) {
        //     console.log('No old, ended, unsaved sessions to delete.');
        //     return null;
        //   }
        //   const batch = db.batch();
        //   snapshot.docs.forEach(doc => {
        //     const createdAtDate = doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(0);
        //     console.log(`Deleting ended, unsaved session ${doc.id} created at ${createdAtDate.toISOString()}`);
        //     batch.delete(doc.ref);
        //   });
        //   await batch.commit();
        //   console.log(`Successfully deleted ${snapshot.size} old, ended, unsaved sessions.`);
        //   return null;
        // });
        ```
    2.  **Stale Quick Session Cleanup (e.g., 50-60 Minute Inactivity):** Delete "quick" sessions (`sessionType == 'quick'`) that are still active (`sessionEnded == false`), not permanently saved, and haven't seen activity for a defined period. This ideally requires a `lastActivityTimestamp` field updated on votes/admin actions. A simpler proxy is to check `createdAt`.
        ```typescript
        // Conceptual Cloud Function (functions/src/index.ts) - Simpler version using createdAt
        // export const deleteStaleQuickSessions = functions.pubsub.schedule('every 15 minutes').onRun(async (context) => {
        //   const now = admin.firestore.Timestamp.now();
        //   // Consider sessions older than 60 minutes (adjust as needed for typical session length)
        //   const sixtyMinutesInMillis = 60 * 60 * 1000; 
        //   const sixtyMinutesAgo = admin.firestore.Timestamp.fromMillis(now.toMillis() - sixtyMinutesInMillis);

        //   const sessionsToDeleteQuery = db.collection('sessions')
        //     .where('sessionType', '==', 'quick')
        //     .where('sessionEnded', '==', false) // Still "active"
        //     .where('isPermanentlySaved', '==', false) // Not marked to be saved
        //     .where('createdAt', '<', sixtyMinutesAgo); // Older than 60 mins based on creation

        //   const snapshot = await sessionsToDeleteQuery.get();
        //   if (snapshot.empty) {
        //     console.log('No stale, active, unsaved quick sessions to delete (based on createdAt).');
        //     return null;
        //   }
        //   const batch = db.batch();
        //   snapshot.docs.forEach(doc => {
        //     const createdAtDate = doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(0);
        //     console.log(`Deleting stale quick session ${doc.id} created at ${createdAtDate.toISOString()}`);
        //     batch.delete(doc.ref);
        //   });
        //   await batch.commit();
        //   console.log(`Successfully deleted ${snapshot.size} stale, active, unsaved quick sessions.`);
        //   return null;
        // });

        // // To implement a more accurate "lastActivityTimestamp":
        // // 1. Add `lastActivityTimestamp: serverTimestamp()` to session creation in your Next.js app.
        // // 2. Update `lastActivityTimestamp: serverTimestamp()` in Firestore for every vote, admin action, etc., in your Next.js app.
        // // 3. The Cloud Function would then query based on `lastActivityTimestamp` instead of `createdAt` for active sessions.
        ```
*   More granular privacy controls for viewing session results if needed.
*   More formal mechanism for "sending" or sharing results with presenters post-session beyond the "Results" page.
*   More detailed user profiles.
*   Further optimization of Firestore queries for the Results page if performance becomes an issue with a very large number of sessions.
*   UI for admin to reorder presenters in the queue (e.g., drag and drop).

    




    





    












