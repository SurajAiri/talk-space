/**
 * The version of the Privacy Policy that people agree to. It is stored next to the time of
 * acceptance (users.privacy_policy_version), so there is always a record of WHICH text someone
 * accepted, not only when.
 *
 * Bump it when the policy changes in a way people should be told about. Everyone whose stored
 * version differs is asked to accept again the next time they open the app (see
 * `needsPrivacyConsent` in features/user/services.ts). Fixing a typo does not need a new version.
 *
 * Keep it in step with PRIVACY_POLICY_VERSION in apps/web/src/lib/legal.ts, which is the version
 * the policy page displays.
 */
export const PRIVACY_POLICY_VERSION = "2026-11-01";
