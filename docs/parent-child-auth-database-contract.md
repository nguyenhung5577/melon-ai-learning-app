# Parent/Child Auth Database Contract

This document describes the database and backend work required for the Melon parent/child auth flow.

## Required Behavior

- Parents authenticate with Google/Firebase Auth and have `role: "parent"`.
- Parents create child accounts from the Family page.
- Children do not need Gmail. They log in with `loginId` and `passwordOrPin`.
- Child credentials are verified server-side. The server returns a Firebase custom token for the child UID.
- Raw PIN/password must never be stored in Firestore.

## API Contract

### Create Child Account

`POST /api/parents/children`

Auth: Firebase-authenticated parent.

Request:

```json
{
  "loginId": "melon_hero",
  "displayName": "Minh Khoi",
  "passwordOrPin": "123456",
  "grade": "Grade 3",
  "avatarEmoji": "🦊",
  "learningPreferences": {
    "primaryGoal": "improve_math_score",
    "domain": "math",
    "gradeLevel": "grade_4",
    "currentScore": 7,
    "targetScore": 9,
    "targetSchool": "Optional School Name",
    "weakTopics": ["fractions", "word_problems"],
    "practiceSource": "both",
    "sessionMinutes": 30,
    "sessionsPerWeek": 5,
    "reminderPreference": "evening",
    "parentReportPreference": "weekly"
  }
}
```

Validation:

- Auth user must exist in `users/{uid}` with `role: "parent"`.
- `loginId` must be unique case-insensitively. Store lookup keys lowercased.
- `passwordOrPin` must be hashed server-side before persistence.
- `learningPreferences.domain` is fixed to `math` for v1.
- `learningPreferences.gradeLevel` is limited to `grade_4` or `grade_5`.
- `currentScore` and `targetScore` must be numbers from `0` to `10`.
- `weakTopics` must contain at least one topic.

Response:

```json
{
  "child": {
    "uid": "childUid",
    "loginId": "melon_hero",
    "displayName": "Minh Khoi",
    "grade": "Grade 3",
    "avatarEmoji": "🦊",
    "learningPreferences": {
      "primaryGoal": "improve_math_score",
      "domain": "math",
      "gradeLevel": "grade_4",
      "currentScore": 7,
      "targetScore": 9,
      "targetSchool": "Optional School Name",
      "weakTopics": ["fractions", "word_problems"],
      "practiceSource": "both",
      "sessionMinutes": 30,
      "sessionsPerWeek": 5,
      "reminderPreference": "evening",
      "parentReportPreference": "weekly",
      "createdAt": "2026-05-31T00:00:00.000Z",
      "updatedAt": "2026-05-31T00:00:00.000Z"
    },
    "linkedParentUid": "parentUid",
    "createdAt": "2026-05-31T00:00:00.000Z",
    "status": "active"
  }
}
```

### Child Login

`POST /api/auth/child/login`

Request:

```json
{
  "loginId": "melon_hero",
  "passwordOrPin": "123456"
}
```

Server flow:

1. Normalize `loginId` to lowercase.
2. Load credential record by normalized login ID.
3. Reject disabled accounts.
4. Verify the submitted secret against the stored hash.
5. Mint a Firebase custom token for `childUid`.

Response:

```json
{
  "customToken": "firebase-custom-token"
}
```

## Firestore Schema

### `users/{parentUid}`

```json
{
  "uid": "parentUid",
  "role": "parent",
  "email": "parent@gmail.com",
  "displayName": "Parent Name",
  "photoURL": "https://...",
  "childUids": ["childUid"],
  "coppaConsented": true,
  "createdAt": "2026-05-31T00:00:00.000Z"
}
```

### `users/{childUid}`

```json
{
  "uid": "childUid",
  "role": "kid",
  "email": null,
  "displayName": "Minh Khoi",
  "photoURL": null,
  "loginId": "melon_hero",
  "linkedParentUid": "parentUid",
  "coppaConsented": true,
  "createdAt": "2026-05-31T00:00:00.000Z"
}
```

### `children/{childUid}`

```json
{
  "uid": "childUid",
  "loginId": "melon_hero",
  "displayName": "Minh Khoi",
  "avatarEmoji": "🦊",
  "grade": "Grade 3",
  "learningPreferences": {
    "primaryGoal": "improve_math_score",
    "domain": "math",
    "gradeLevel": "grade_4",
    "currentScore": 7,
    "targetScore": 9,
    "targetSchool": "Optional School Name",
    "weakTopics": ["fractions", "word_problems"],
    "practiceSource": "both",
    "sessionMinutes": 30,
    "sessionsPerWeek": 5,
    "reminderPreference": "evening",
    "parentReportPreference": "weekly",
    "createdAt": "2026-05-31T00:00:00.000Z",
    "updatedAt": "2026-05-31T00:00:00.000Z"
  },
  "linkedParentUid": "parentUid",
  "status": "active",
  "createdAt": "2026-05-31T00:00:00.000Z"
}
```

## Learning Preferences

Parents set learning preferences while creating a child account. These preferences are stored on `children/{childUid}.learningPreferences` because they are child-specific.

### Question Set

Use concise, form-friendly questions:

1. `Mục tiêu chính của con là gì?`
2. `Điểm Toán hiện tại của con khoảng bao nhiêu?`
3. `Mục tiêu điểm số là bao nhiêu?`
4. `Con đang học lớp mấy?`
5. `Con yếu phần nào nhất?`
6. `Con muốn luyện theo nguồn nào?`
7. `Mỗi buổi con có thể học bao lâu?`
8. `Con học mấy buổi mỗi tuần?`
9. `Muốn nhận nhắc học khi nào?`
10. `Phụ huynh muốn nhận báo cáo thế nào?`

### Allowed Values

```json
{
  "primaryGoal": [
    "improve_math_score",
    "specialized_school_exam",
    "strengthen_current_grade"
  ],
  "domain": ["math"],
  "gradeLevel": ["grade_4", "grade_5"],
  "weakTopics": [
    "arithmetic",
    "fractions",
    "geometry",
    "word_problems",
    "logic",
    "mixed_exams"
  ],
  "practiceSource": ["school_lessons", "past_exams", "both"],
  "sessionMinutes": [15, 30, 45, 60],
  "sessionsPerWeek": [2, 3, 5, 7],
  "reminderPreference": ["after_school", "evening", "weekend", "none"],
  "parentReportPreference": [
    "after_each_lesson",
    "weekly",
    "struggling_only",
    "none"
  ]
}
```

### Optional Audit Trail

If preference editing is added later, store changes in:

`children/{childUid}/preferenceHistory/{eventId}`

```json
{
  "before": {},
  "after": {},
  "changedByParentUid": "parentUid",
  "changedAt": "2026-05-31T00:00:00.000Z"
}
```

### `childCredentials/{loginIdLower}`

Server-only collection. Client reads/writes must be denied.

```json
{
  "childUid": "childUid",
  "parentUid": "parentUid",
  "passwordHash": "argon2-or-bcrypt-hash",
  "hashVersion": "argon2id-v1",
  "disabled": false,
  "createdAt": "2026-05-31T00:00:00.000Z",
  "updatedAt": "2026-05-31T00:00:00.000Z"
}
```

## Security Rules Needed

- Parents can read `children/{childUid}` only when `linkedParentUid == request.auth.uid`.
- Children can read/update their own child profile when `request.auth.uid == childUid`.
- Parents can read progress, activity, and gamification data for linked children.
- Clients cannot read or write `childCredentials`.
- Child creation and credential updates must use backend/admin privileges.

## Indexes

- `children.linkedParentUid` must support parent family queries.
- `childCredentials` should use `loginIdLower` as document ID for direct lookup. If it is stored as a field instead, create an index for `loginIdLower`.
