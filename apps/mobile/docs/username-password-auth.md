# Username and Password Authentication

## Overview
Username and password authentication has been successfully implemented for the Music Diary mobile app using Clerk's authentication system.

## What Was Implemented

### Sign In Screen (`SignInScreen.tsx`)
- Added username/email and password input fields
- Implemented `handlePasswordSignIn` function using Clerk's `useSignIn` hook
- Integrated with existing Convex user creation flow
- Maintained Google OAuth as an alternative sign-in option
- Added proper loading states and error handling
- **Enhanced error handling for unverified accounts**:
  - Detects when user tries to sign in with unverified account
  - Provides clear error message and directs to Sign Up to complete verification
  - Handles different sign-in statuses (complete, needs_first_factor, etc.)
  - Distinguishes between wrong password and unverified account errors

### Sign Up Screen (`SignUpScreen.tsx`)
- Complete two-step sign-up flow with:
  - **Step 1**: Email and password collection
  - **Step 2**: Email verification code input
- **Verification-only mode** for unverified accounts:
  - Pre-fills email from sign-in attempt
  - Hides password field (not needed for verification)
  - Changes button to "Send Verification Code"
  - Streamlined UX for completing verification
- Implemented `handleSignUp` function using Clerk's `useSignUp` hook
- Implemented `handleVerify` function for email verification
- Implemented `handleResendCode` function to request new verification codes
- Uses `prepareEmailAddressVerification()` to send verification code
- Uses `attemptEmailAddressVerification()` to verify the code
- Integrated with Convex user creation after successful verification
- **Enhanced error handling**:
  - Detects if email is already registered and offers to go to sign in
  - Detects unverified accounts and offers to resend verification code
  - Provides clear, actionable error messages
- **Resend code feature**: Users can request new verification codes if they didn't receive one
- Conditional UI rendering based on verification status and mode
- **Note**: Username field was removed as Clerk doesn't accept it in the initial sign-up request

## Clerk Configuration Requirements

For this implementation to work properly, ensure the following are enabled in your Clerk Dashboard:

1. **Email Authentication**:
   - Go to Clerk Dashboard → User & Authentication → Email, Phone, Username
   - Email must be enabled as an identifier
   - Configure email verification settings (optional or required)

2. **Password Authentication**:
   - Ensure password authentication is enabled
   - Configure password strength requirements as needed

**Note**: Username authentication is NOT required since we only use email + password for sign-up and sign-in.

## User Flow

### Sign Up
1. User enters email and password on the sign-up form
2. User taps "Continue"
3. Clerk creates the user account and sends a verification code email
4. UI switches to verification code input screen
5. User enters the 6-digit code from their email
6. User taps "Verify Email"
7. Clerk verifies the code using `attemptEmailAddressVerification()`
8. Upon successful verification, session is activated
9. Convex user document is created with retry logic
10. User is automatically signed in

### Sign In
1. User enters email and password
2. Clerk authenticates the credentials
3. **If account is unverified**:
   - Error alert appears: "Account Not Verified"
   - User taps "Go to Sign Up"
   - **Verification-only mode activated**:
     - Email is pre-filled and disabled
     - Password field is hidden
     - Button shows "Send Verification Code"
     - User taps button to receive verification code
4. **If account is verified**:
   - Session is activated
   - Convex user document is ensured (created if doesn't exist)
   - User is signed in

## Error Handling

Both screens include comprehensive error handling:
- Field validation (ensures all required fields are filled)
- Network error handling
- Clerk-specific error messages displayed to users
- Loading states to prevent duplicate submissions
- Retry logic for Convex user creation (up to 3 attempts)

## Testing

To test the implementation:

1. **Run the mobile app**:
   ```bash
   pnpm dev:mobile
   ```

2. **Test Sign Up**:
   - Navigate to Sign Up screen
   - Fill in email and password
   - Tap "Continue"
   - Check your email for the verification code
   - Enter the 6-digit verification code
   - Tap "Verify Email"
   - Verify user account is created in Clerk Dashboard
   - Verify Convex user document is created
   - Verify you're automatically signed in

3. **Test Sign In**:
   - Navigate to Sign In screen
   - Enter credentials (email and password)
   - Submit the form
   - Verify successful authentication

## Type Safety

All implementations maintain full TypeScript type safety:
- ✅ Type check passed: `pnpm --filter mobile type-check`
- ✅ Linter passed: `pnpm --filter mobile lint`
- No errors, only pre-existing warnings in other files

## Common Issues and Solutions

### "Identification claimed by another user" Error

This error occurs when:
- You previously started signup but didn't complete email verification
- You're trying to sign up with an email that already exists

**Solution**: The app now automatically detects this and offers two options:
1. **For unverified accounts**: Resend a new verification code to complete signup
2. **For verified accounts**: Navigate to the sign-in screen

### Password Mismatch with Unverified Account

**What happens:**
- You try to complete verification with a different password than the original
- You get a "Password Mismatch" error

**Why this happens:**
- Clerk stores the password from the first sign-up attempt
- Unverified accounts must use the original password for verification
- Password changes are only allowed after successful verification

**Solution:**
- Use the **same password** you originally used during sign-up
- If you forgot the original password, use "Forgot Password" on the Sign In screen
- The "Forgot Password" flow will work even for unverified accounts

### Leaving During Verification

If you leave the app during the verification step:
1. When you return and try to sign up again with the same email, the app will detect the unverified account
2. Choose "Send Code" when prompted to receive a new verification code
3. Enter the code to complete your signup

Alternatively, you can use the "Resend code" button on the verification screen if you're still on that screen.

### Trying to Sign In with Unverified Account

If you signed up but didn't verify, then try to sign in:

**What happens:**
- You'll see an error: "Account Not Verified" or "Verification Required"
- The app detects that your account exists but hasn't been verified

**Solution (Improved UX):**
1. Tap "Go to Sign Up" in the error dialog
2. **Verification-only mode activates**:
   - Your email is automatically filled in and locked
   - Password field is hidden (not needed for verification)
   - Button shows "Send Verification Code"
3. Tap "Send Verification Code"
4. Enter the verification code from your email
5. Your account will be verified and you'll be signed in

**Key Improvements:**
- ✅ **No password needed** - The app skips password validation for verification
- ✅ **Email pre-filled** - No need to re-enter your email
- ✅ **Streamlined flow** - Direct path to verification
- ✅ **Clear UI** - Button clearly indicates the action

**Why this happens:**
Clerk requires email verification before you can sign in. The app now provides a streamlined verification-only mode that eliminates the need to re-enter passwords.

## Notes

- Both authentication methods (password and Google OAuth) work side by side
- The UI maintains consistency with the existing design system
- All form inputs include proper accessibility attributes
- Loading states prevent multiple submissions
- Error messages are user-friendly and actionable
- Email verification flow follows Clerk's recommended two-step pattern:
  1. Create account with `signUp.create()`
  2. Send verification code with `prepareEmailAddressVerification()`
  3. Verify code with `attemptEmailAddressVerification()`
- Users can go back to the sign-up form from the verification screen if needed
- The "Resend code" button allows users to request new codes without restarting the flow

