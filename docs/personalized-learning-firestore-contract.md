# Personalized Learning Firestore Contract

This document defines the Firestore collections used by the pragmatic v1 personalized learning foundation.

## Write Policy

- Client UI should not write learning progress collections directly.
- Lesson and practice progress should be written through server APIs:
  - `POST /api/v1/progress/lesson-completion`
  - `POST /api/questions/attempts`
- Server routes use Firebase Admin SDK and maintain both event logs and aggregate documents.

## Canonical Collections

### `studentProgress/{childUid}`

Aggregate learning state for one child. This is the main document for dashboards and recommendation rules.

Important fields:

- `childUid`
- `schemaVersion`
- `totalLessonsCompleted`
- `totalLessonAttempts`
- `totalExerciseAttempts`
- `totalCorrectExerciseAttempts`
- `totalTimeOnTaskSeconds`
- `totalXpEarned`
- `averageQuizScore`
- `exerciseAccuracy`
- `level`
- `subjectStats`
- `conceptStats`
- `weakConcepts`
- `recommendedConcepts`
- `lastActivityAt`
- `createdAt`
- `updatedAt`

### `studentLessonProgress/{childUid_lessonId}`

Aggregate progress for one child on one lesson.

Important fields:

- `childUid`
- `lessonId`
- `lessonTitle`
- `subject`
- `status`
- `attemptCount`
- `completedCount`
- `totalTimeOnTaskSeconds`
- `totalXpEarned`
- `bestScorePercent`
- `latestScorePercent`
- `latestQuizScorePercent`
- `masteryState`
- `concepts`
- `skills`

### `studentLessonCompletions/{attemptId}`

Event log for each lesson completion.

Important fields:

- `childUid`
- `lessonId`
- `lessonTitle`
- `subject`
- `scorePercent`
- `quizCorrect`
- `quizTotal`
- `quizScorePercent`
- `xpEarned`
- `timeOnTaskSeconds`
- `concepts`
- `skills`
- `completedAt`

### `studentExerciseAttempts/{attemptId}`

Event log for each practice/question attempt.

Important fields:

- `childUid`
- `questionId`
- `questionSetId`
- `sourceTitle`
- `subject`
- `grade`
- `rubricLevel`
- `submittedAnswer`
- `isCorrect`
- `timeSpentMs`
- `timeSpentSeconds`
- `startedAt`
- `submittedAt`
- `source`
- `concepts`
- `skills`

### `studentPersonalizedPlans/{childUid}`

Active rule-based recommendation plan for one child.

Important fields:

- `childUid`
- `status`
- `generatedAt`
- `basedOnProgressUpdatedAt`
- `targetConcepts`
- `recommendedLessonIds`
- `recommendedQuestionFilters`
- `reasonSummary`
- `source`
- `updatedAt`

## V1 Recommendation Rules

- Before enough attempt data exists, seed weak concepts from `children/{childUid}.learningPreferences.weakTopics`.
- A concept is weak when it has at least 3 attempts and accuracy is below 70%.
- If exercise accuracy is below 70%, recommended question filters prefer `nhan_biet` and `thong_hieu`.
- Otherwise, recommended question filters prefer `thong_hieu` and `van_dung`.
- If question documents do not have `concepts`, the plan still falls back to parent weak topics and rubric/grade filters.

## Legacy Compatibility

`POST /api/questions/attempts` still writes legacy `questionAttempts` and `kidQuestionStats` so existing practice UI remains compatible. New personalized features should read from `studentExerciseAttempts`, `studentProgress`, and `studentPersonalizedPlans`.
