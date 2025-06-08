
# ClassVote

ClassVote is a real-time, interactive web application where users can create or join voting sessions to collectively decide on sounds. Participants can cast "like" or "dislike" votes, and a live leaderboard tracks the scores. Session administrators have controls to manage the voting rounds and end sessions.

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
                               request.resource.data.sessionEnded == false; // Ensure sessionEnded is false on create

              allow update: if request.auth != null && resource.data.sessionEnded == false && ( // Can only update if session has not ended
                              // Admin actions: toggle round, clear scores, end session
                              (resource.data.adminUid == request.auth.uid &&
                                (
                                  // Toggle round (isRoundActive changes, like/dislike can be reset)
                                  (request.resource.data.isRoundActive != resource.data.isRoundActive && 
                                   (request.resource.data.likeClicks == 0 || request.resource.data.likeClicks == resource.data.likeClicks) &&
                                   (request.resource.data.dislikeClicks == 0 || request.resource.data.dislikeClicks == resource.data.dislikeClicks)
                                  ) || 
                                  // Clear scores (like/dislike become 0)
                                  (request.resource.data.likeClicks == 0 && request.resource.data.dislikeClicks == 0 && 
                                   request.resource.data.isRoundActive == resource.data.isRoundActive // isRoundActive doesn't change here
                                  ) ||
                                  // End session (sessionEnded becomes true, isRoundActive can become false)
                                  (request.resource.data.sessionEnded == true && resource.data.sessionEnded == false &&
                                   (request.resource.data.isRoundActive == false || request.resource.data.isRoundActive == resource.data.isRoundActive)
                                  )
                                ) &&
                                // Ensure admin cannot change other critical fields during these specific actions
                                request.resource.data.adminUid == resource.data.adminUid &&
                                request.resource.data.createdAt == resource.data.createdAt
                              ) || 
                              // User voting actions (like/dislike)
                              (
                                resource.data.isRoundActive == true && // Round must be active to vote
                                (
                                  (request.resource.data.likeClicks == resource.data.likeClicks + 1 && request.resource.data.dislikeClicks == resource.data.dislikeClicks) ||
                                  (request.resource.data.dislikeClicks == resource.data.dislikeClicks + 1 && request.resource.data.likeClicks == resource.data.likeClicks)
                                ) &&
                                // Ensure other critical fields are not changed by vote updates
                                request.resource.data.adminUid == resource.data.adminUid && 
                                request.resource.data.isRoundActive == resource.data.isRoundActive && // Should be true
                                request.resource.data.sessionEnded == false && // Should be false
                                request.resource.data.createdAt == resource.data.createdAt
                              )
                            );
              
              // Admin can delete a session document if needed.
              // However, the current application flow relies on the sessionEnded flag rather than deletion.
              // allow delete: if request.auth != null && resource.data.adminUid == request.auth.uid; 
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
*   Interactive sound feedback for votes.
*   Live leaderboard displaying current scores.
*   Admin controls to start/stop rounds, clear scores, and end sessions.
*   User-friendly interface built with ShadCN UI and Tailwind CSS.
*   Anonymous user authentication via Firebase.
```