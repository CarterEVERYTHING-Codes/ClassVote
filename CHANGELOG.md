# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Voting now correctly resets for all users when an admin restarts a general feedback session. This was achieved by:
  - Introducing a `generalRoundInstanceId` field in the Firestore session document (initialized to `1` on creation, incremented on restart).
  - Updating client-side logic in `GoodBadButtons` to use this `generalRoundInstanceId` to generate unique `localStorage` keys for votes within each instance of a general round (e.g., `hasVoted_SESSIONID_general_INSTANCEID`).
  - Modifying Firestore security rules to allow the creation and update of `generalRoundInstanceId`.
- Corrected a missing `useCallback` import in `src/components/good-bad-buttons.tsx`.
- Addressed previous issues with admin-only vote reset for general sessions by implementing the `generalRoundInstanceId` strategy.

### Added
- Initial `CHANGELOG.md` file to track updates.

## [0.1.0] - (Date of Initial Setup)
- Initial setup of the ClassVote application.
- Core features including session creation (quick and account-based), joining sessions, nickname setting, like/dislike voting, basic admin controls (pause/resume, sounds, results visibility, end session), and presenter queue management.
- Firebase integration for authentication (Anonymous, Google, Email/Password) and Firestore for data persistence.
- UI built with Next.js, React, ShadCN UI components, and Tailwind CSS.
