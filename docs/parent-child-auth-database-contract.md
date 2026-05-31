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
  "avatarEmoji": "🦊"
}
```

Validation:

- Auth user must exist in `users/{uid}` with `role: "parent"`.
- `loginId` must be unique case-insensitively. Store lookup keys lowercased.
- `passwordOrPin` must be hashed server-side before persistence.

Response:

```json
{
  "child": {
    "uid": "childUid",
    "loginId": "melon_hero",
    "displayName": "Minh Khoi",
    "grade": "Grade 3",
    "avatarEmoji": "🦊",
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
  "linkedParentUid": "parentUid",
  "status": "active",
  "createdAt": "2026-05-31T00:00:00.000Z"
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
