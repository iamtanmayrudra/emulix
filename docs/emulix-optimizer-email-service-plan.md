# Emulix Optimizer — Email Service Provider Implementation Plan

## 1. Objective

Implement a reliable transactional email service for Emulix Optimizer.

The email service will initially support:

- Email verification
- Password reset
- Welcome email
- Security/login notification
- Resend verification email

### Recommended provider

**Resend**

### Application stack

- Next.js
- TypeScript
- Node.js
- Resend API
- React Email
- MySQL
- Prisma

---

## 2. Email Architecture

```text
                    User
                     |
                     v
              Next.js Frontend
                     |
                     v
              Next.js API Route
                     |
              Authentication
                     |
                     v
                Email Service
                     |
                     v
                  Resend
                     |
                     v
              User's Email
          Gmail / Outlook / etc.
```

### Important

The frontend must never call Resend directly.

```text
Frontend
    X
    |
    | Do not expose API key
    |
    v
Next.js Server
    |
    v
Resend API
```

---

## 3. Resend Setup

### Step 1 — Create Resend account

Create a Resend account and generate an API key.

### Step 2 — Verify sending domain

Configure the sending domain in Resend.

Typical DNS configuration includes:

```text
SPF
DKIM
DMARC
```

Use a dedicated sender:

```text
auth@yourdomain.com
```

or:

```text
noreply@yourdomain.com
```

### Step 3 — Configure environments

Maintain separate configuration for:

```text
Development
Staging
Production
```

---

# 4. Environment Variables

Create:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=Emulix Optimizer <auth@yourdomain.com>
APP_URL=http://localhost:3000
```

Production:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=Emulix Optimizer <auth@yourdomain.com>
APP_URL=https://your-production-domain.com
```

### Security rule

Never expose the Resend API key using:

```env
NEXT_PUBLIC_RESEND_API_KEY=
```

The API key must remain server-side.

---

# 5. Project Structure

Recommended structure:

```text
src/
├── app/
│   └── api/
│       └── auth/
│           ├── register/
│           │   └── route.ts
│           ├── verify-email/
│           │   └── route.ts
│           ├── resend-verification/
│           │   └── route.ts
│           ├── forgot-password/
│           │   └── route.ts
│           └── reset-password/
│               └── route.ts
│
├── lib/
│   ├── email/
│   │   ├── resend.ts
│   │   ├── email.service.ts
│   │   ├── email.types.ts
│   │   └── templates/
│   │       ├── verification.tsx
│   │       ├── password-reset.tsx
│   │       ├── welcome.tsx
│   │       └── security-alert.tsx
│   │
│   ├── auth/
│   │   ├── tokens.ts
│   │   └── password.ts
│   │
│   └── db.ts
│
└── prisma/
    └── schema.prisma
```

---

# 6. Email Service Layer

Create a dedicated email service.

### `resend.ts`

Responsible for:

- Creating the Resend client
- Reading the server-side API key

### `email.service.ts`

Responsible for:

```text
sendVerificationEmail()
sendPasswordResetEmail()
sendWelcomeEmail()
sendSecurityAlertEmail()
```

Authentication routes should call the email service rather than calling Resend directly.

```text
Register API
     |
     v
Email Service
     |
     v
Resend
```

This keeps the architecture maintainable and makes it easier to replace the provider later.

---

# 7. Email Verification Flow

```text
User registers
      |
      v
Validate input
      |
      v
Create user
      |
      v
Generate verification token
      |
      v
Hash token
      |
      v
Store token in database
      |
      v
Email Service
      |
      v
Resend
      |
      v
Verification Email
      |
      v
User clicks link
      |
      v
/verify-email?token=TOKEN
      |
      v
Validate token
      |
      v
Mark email as verified
      |
      v
Redirect to login/dashboard
```

### Verification token requirements

- Cryptographically random
- Short-lived
- Single-use
- Stored securely
- Invalidated after successful verification

Recommended expiration:

```text
30–60 minutes
```

---

# 8. Password Reset Flow

```text
User clicks "Forgot Password"
          |
          v
Enter email
          |
          v
Generate reset token
          |
          v
Hash token
          |
          v
Store token
          |
          v
Send email through Resend
          |
          v
User clicks reset link
          |
          v
/reset-password?token=TOKEN
          |
          v
Validate token
          |
          v
Set new password
          |
          v
Invalidate token
          |
          v
Redirect to login
```

Recommended reset-token expiration:

```text
15–30 minutes
```

---

# 9. Database Design

Use Prisma with MySQL.

## User

```text
User
├── id
├── name
├── email
├── passwordHash
├── emailVerifiedAt
├── createdAt
└── updatedAt
```

## VerificationToken

```text
VerificationToken
├── id
├── userId
├── tokenHash
├── expiresAt
├── usedAt
└── createdAt
```

## PasswordResetToken

```text
PasswordResetToken
├── id
├── userId
├── tokenHash
├── expiresAt
├── usedAt
└── createdAt
```

## EmailLog

```text
EmailLog
├── id
├── userId
├── type
├── recipient
├── providerMessageId
├── status
├── error
├── sentAt
└── createdAt
```

Possible email statuses:

```text
QUEUED
SENT
DELIVERED
FAILED
```

---

# 10. Email Templates

Use React Email for reusable templates.

## Verification Email

```text
Subject:
Verify your Emulix Optimizer account

Hello {{name}},

Thanks for creating your Emulix Optimizer account.

Please verify your email address to activate your account.

[Verify Email]

This link expires in {{expiration}}.

If you did not create this account, you can safely ignore this email.

Regards,
Emulix Optimizer Team
```

## Password Reset

```text
Subject:
Reset your Emulix Optimizer password

Hello {{name}},

We received a request to reset your password.

[Reset Password]

This link expires in 30 minutes.

If you did not request a password reset, no action is required.

Regards,
Emulix Optimizer Team
```

## Welcome Email

```text
Subject:
Welcome to Emulix Optimizer

Hello {{name}},

Welcome to Emulix Optimizer.

Your account is now ready.

[Open Dashboard]

Start testing your websites across devices and reviewing optimization reports.

Regards,
Emulix Optimizer Team
```

## Security Alert

```text
Subject:
Security alert for your Emulix Optimizer account

Hello {{name}},

A security-related event occurred on your account.

If you recognize this activity, no action is required.

If you do not recognize it, please secure your account immediately.

Regards,
Emulix Optimizer Team
```

---

# 11. Authentication APIs

## Register

```http
POST /api/auth/register
```

Flow:

```text
Validate request
      ↓
Check existing user
      ↓
Hash password
      ↓
Create user
      ↓
Create verification token
      ↓
Send verification email
      ↓
Return success
```

---

## Verify Email

```http
POST /api/auth/verify-email
```

Flow:

```text
Receive token
      ↓
Hash token
      ↓
Find valid token
      ↓
Check expiration
      ↓
Check usedAt
      ↓
Mark user verified
      ↓
Mark token used
```

---

## Resend Verification

```http
POST /api/auth/resend-verification
```

Flow:

```text
Receive email
      ↓
Check account
      ↓
Generate new token
      ↓
Invalidate old tokens
      ↓
Send new verification email
```

---

## Forgot Password

```http
POST /api/auth/forgot-password
```

Important:

Do not reveal whether an account exists.

Return a generic response:

```text
If an account exists for this email,
we've sent password-reset instructions.
```

---

## Reset Password

```http
POST /api/auth/reset-password
```

Flow:

```text
Receive token
      ↓
Validate token
      ↓
Check expiration
      ↓
Hash new password
      ↓
Update user
      ↓
Invalidate reset token
      ↓
Invalidate existing sessions if required
```

---

# 12. Security Requirements

## API Key protection

Never expose:

```text
RESEND_API_KEY
```

to the client.

---

## Token security

Generate secure random tokens.

```text
Random Token
      ↓
Hash Token
      ↓
Store Hash
```

When verifying:

```text
Submitted Token
      ↓
Hash Token
      ↓
Compare Database Hash
```

---

## Token expiration

Verification:

```text
30–60 minutes
```

Password reset:

```text
15–30 minutes
```

---

## Single-use tokens

After successful use:

```text
usedAt = current timestamp
```

The token must never work again.

---

# 13. Rate Limiting

Protect email-related endpoints from abuse.

Apply rate limits to:

```text
/register
/resend-verification
/forgot-password
/login
```

Example policy:

```text
3–5 requests
per user/IP
within a defined time window
```

For production, use Redis-based rate limiting if the application runs across multiple instances.

---

# 14. Email Enumeration Protection

Do not reveal whether an email exists.

Bad:

```text
User does not exist.
```

Good:

```text
If an account exists for this email,
we've sent password-reset instructions.
```

This prevents attackers from discovering registered accounts.

---

# 15. Error Handling

The application should distinguish between:

### Validation error

```text
Invalid email address.
```

### Provider error

```text
Unable to send email.
```

### Expired token

```text
This verification link has expired.
Please request a new one.
```

### Used token

```text
This link has already been used.
```

### Rate limit

```text
Too many requests.
Please try again later.
```

Never expose:

- Resend API keys
- Database errors
- Internal stack traces
- Provider secrets
- Sensitive authentication information

---

# 16. Email Logging

Record important email events.

Example:

```text
EmailLog

type:
VERIFICATION
PASSWORD_RESET
WELCOME
SECURITY_ALERT

status:
QUEUED
SENT
DELIVERED
FAILED
```

Store the provider message ID when available.

This makes it easier to investigate:

```text
User says:
"I didn't receive the verification email."

Admin can check:
User
   ↓
EmailLog
   ↓
Provider message ID
   ↓
Delivery status
```

Do not store sensitive email content unnecessarily.

---

# 17. Development Workflow

## Local development

```text
Next.js
   ↓
Local API
   ↓
Email Service
   ↓
Resend
   ↓
Test mailbox
```

Use test addresses and a verified development sender/domain where appropriate.

## Staging

```text
Staging App
     ↓
Staging email configuration
     ↓
Resend
```

## Production

```text
Production App
     ↓
Production email configuration
     ↓
Resend
     ↓
Real users
```

Keep environment variables separate between environments.

---

# 18. Testing Plan

## Registration

Test:

```text
Valid registration
    ↓
User created
    ↓
Verification email sent
```

## Invalid registration

```text
Invalid email
    ↓
Validation error
    ↓
No email sent
```

## Verification

Test:

```text
Valid token
Expired token
Invalid token
Used token
Repeated verification
```

## Password reset

Test:

```text
Existing email
Unknown email
Expired token
Invalid token
Used token
Successful password change
```

## Rate limiting

Test:

```text
Repeated requests
      ↓
Rate limit triggered
      ↓
429 response
```

## Provider failure

Simulate:

```text
Resend unavailable
      ↓
Email marked FAILED
      ↓
Useful error logged
```

---

# 19. Production Checklist

```text
□ Resend account created
□ Sending domain verified
□ SPF configured
□ DKIM configured
□ DMARC configured
□ API key created
□ API key stored securely
□ EMAIL_FROM configured
□ APP_URL configured
□ Verification template created
□ Password-reset template created
□ Welcome template created
□ Security template created
□ Verification token implemented
□ Password-reset token implemented
□ Token expiration implemented
□ Single-use token implemented
□ Rate limiting implemented
□ Enumeration protection implemented
□ Email logging implemented
□ Error handling implemented
□ Delivery testing completed
□ Production domain configured
```

---

# 20. Implementation Order

Follow this order:

```text
1. Create Resend account
          ↓
2. Verify sending domain
          ↓
3. Create API key
          ↓
4. Configure environment variables
          ↓
5. Install Resend SDK
          ↓
6. Create Resend client
          ↓
7. Create Email Service
          ↓
8. Create React Email templates
          ↓
9. Create verification token system
          ↓
10. Connect registration API
          ↓
11. Implement verification API
          ↓
12. Implement resend verification
          ↓
13. Create password-reset token system
          ↓
14. Implement forgot-password API
          ↓
15. Implement reset-password API
          ↓
16. Add rate limiting
          ↓
17. Add email logging
          ↓
18. Add provider error handling
          ↓
19. Test all authentication emails
          ↓
20. Configure production domain
```

---

# 21. Definition of Done

The email service is complete when:

```text
□ User can register
□ Verification email is delivered
□ User can verify email
□ Expired verification links are rejected
□ User can request another verification email
□ User can request password reset
□ Password reset email is delivered
□ User can reset password
□ Reset token becomes invalid after use
□ Email requests are rate limited
□ Email enumeration is prevented
□ Provider errors are handled
□ Email events are logged
□ API key is server-side only
□ Production sender domain is verified
```

---

# 22. Final Architecture

```text
                         EMULIX OPTIMIZER
                               |
                               v
                       Authentication
                               |
                 ┌─────────────┴─────────────┐
                 |                           |
                 v                           v
            User Database                Email Service
                 |                           |
                 |                           v
                 |                         Resend
                 |                           |
                 |              ┌────────────┼────────────┐
                 |              v            v            v
                 |        Verification   Password      Welcome
                 |           Email         Reset        Email
                 |              |            |            |
                 └──────────────┴────────────┴────────────┘
                                |
                                v
                              User
```

---

# 23. Recommended Stack

```text
Frontend:
Next.js + React + TypeScript

Backend:
Next.js Server/API + Node.js

Database:
MySQL + Prisma

Email:
Resend

Templates:
React Email

Security:
Secure tokens + rate limiting + server-side API key

Storage:
Database for token metadata and email logs
```

---

## Immediate Implementation Target

Implement only these two flows first:

```text
1. Email Verification
2. Password Reset
```

Once both are stable:

```text
        Verification
              +
        Password Reset
              |
              v
         Welcome Email
              |
              v
        Security Alerts
              |
              v
       Email Analytics/Logs
```

This keeps the first implementation small while providing the complete email foundation required for Emulix Optimizer.
