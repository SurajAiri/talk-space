/**
 * What the Privacy Policy page and the forms around it say.
 *
 * PRIVACY_POLICY_VERSION must match apps/api/src/config/legal.config.ts: the API stores the version
 * a person accepted and asks everyone again when it changes. Bump both together when the policy
 * changes in a way people should be told about; a typo fix does not need a new version.
 */
export const APP_NAME = "Talk Space";
export const PRIVACY_POLICY_PATH = "/privacy";
export const PRIVACY_POLICY_VERSION = "2026-11-01";

/**
 * Where people send privacy requests (access, correction, deletion).
 * TODO before launch: replace with a real, monitored address. ".example" can never receive mail.
 */
export const PRIVACY_CONTACT_EMAIL = "surajairi08@gmail.com";

/** The youngest age the policy says the service is for. */
export const MIN_AGE = 13;

/** "1 November 2026", in the reader's own language and format. The version is the date, in UTC. */
export function policyDate(
  version: string = PRIVACY_POLICY_VERSION,
  locale?: string,
): string {
  const date = new Date(`${version}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return version;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}
