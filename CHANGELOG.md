
# ClassVote Changelog

All notable changes to this project will be documented in this file.

## [v0.1.5] - 2025-06-13

### Fixed
- Resolved issue where "Restart Session" for general feedback rounds only reset voting for the admin, not other participants. Implemented `generalRoundInstanceId` in Firestore and client-side logic to correctly invalidate votes for all users on restart.
- Corrected syntax error (`catch (error) => {`) in `AuthContext`'s `signOut` function.
- Fixed type import issue for `SessionData` in `good-bad-buttons-loader.tsx` and `good-bad-buttons.tsx` that was causing Vercel build failures.
- Ensured custom error page (`src/app/error.tsx`) is displayed correctly for initial server connection failures by handling the error directly within `AuthProvider` instead of relying solely on the global error boundary for this specific case.

### Added
- Changelog page (`/changelog`) to display application updates. Fetches and renders this `CHANGELOG.md` file.
- Link to the new Changelog page in the main application header.
- Initial server health check on app load: Attempts to connect to Firestore. If it fails, a user-friendly error message is displayed.
- Global error page (`src/app/error.tsx`) to catch unhandled client-side or server-side errors during navigation or rendering.

## [v0.1.0] - 2025-06-12
### Added
- Initial project setup with Next.js, Firebase, ShadCN UI, and Tailwind CSS.
- Core features: Session creation (quick and account-based), joining sessions, nickname setting, real-time voting (like/dislike), admin controls (pause/resume, sounds, results visibility, end session), participant kicking.
- Presenter queue management: Add/remove presenters, start next feedback round, reset current presenter's votes.
- Overall session leaderboard and individual presenter score display.
- User authentication (Anonymous, Google, Email/Password).
- Results page for admins to view past sessions and for users to see their presentation scores.
- Account management page.
- Theme toggling (light/dark/system).
