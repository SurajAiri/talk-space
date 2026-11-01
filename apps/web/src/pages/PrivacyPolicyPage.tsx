import { useEffect } from 'react'
import { Link } from 'react-router'
import Logo from '../components/Logo'
import {
  APP_NAME,
  MIN_AGE,
  policyDate,
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_POLICY_VERSION,
} from '../lib/legal'
import { useAuthStore } from '../store/auth.store'
import './legal.css'

/**
 * The Privacy Policy. Public: it has to be readable before signing up, and by someone who is signed
 * in but has not accepted yet. Everything here describes what the app really does; when the code
 * changes what is collected or kept, change this page and bump PRIVACY_POLICY_VERSION (lib/legal.ts
 * and apps/api/src/config/legal.config.ts) so people are asked again.
 */
export default function PrivacyPolicyPage() {
  const signedIn = useAuthStore((s) => Boolean(s.user))

  useEffect(() => {
    const previous = document.title
    document.title = `Privacy Policy · ${APP_NAME}`
    return () => {
      document.title = previous
    }
  }, [])

  return (
    <div className="legal">
      <header className="legal-top">
        <Logo />
        <Link to="/" className="btn btn-ghost btn-small">
          {signedIn ? 'Back to the app' : 'Back to home'}
        </Link>
      </header>

      <main className="legal-doc">
        <p className="legal-eyebrow">Legal</p>
        <h1>Privacy Policy</h1>
        <p className="legal-meta">
          Version {PRIVACY_POLICY_VERSION} · Last updated {policyDate()}
        </p>

        <p>
          {APP_NAME} (“we”, “us”) runs voice rooms you can walk around in. This policy explains what personal
          information we handle, why, who can see it, and what you can do about it. We’ve tried to keep it plain.
        </p>

        <aside className="legal-summary" aria-label="The short version">
          <h2>The short version</h2>
          <ul>
            <li>
              We keep the details you give us: your name, username, email, and the answers on your profile.
            </li>
            <li>
              <strong>Your voice, text chat and movement are not recorded or stored by us.</strong> They travel
              directly between the people in a room.
            </li>
            <li>We don’t sell your personal information, and we don’t run advertising or analytics trackers.</li>
            <li>You can edit your profile at any time, and ask us to delete your account.</li>
          </ul>
        </aside>

        <h2>1. Information we collect</h2>
        <div className="legal-scroll">
          <table className="legal-table">
            <thead>
              <tr>
                <th scope="col">What</th>
                <th scope="col">Details</th>
                <th scope="col">Why</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Account details</th>
                <td>
                  Your name, username and email address. If you sign up with an email, a password — which we store
                  only as a one-way hash, so we can’t read it. Accounts created with Google have no password.
                </td>
                <td>To create and secure your account, and to show other people who you are.</td>
              </tr>
              <tr>
                <th scope="row">Profile answers</th>
                <td>
                  What you tell us when you join and when you edit your profile: gender (you can choose “Prefer not
                  to say”), languages you speak, interests, things you’re good at, and an optional short bio.
                </td>
                <td>So people have an easy way to start a conversation with you.</td>
              </tr>
              <tr>
                <th scope="row">Sign-in with Google</th>
                <td>
                  Your name, your email address, and whether Google has verified that address. We don’t receive
                  your Google password, contacts or files.
                </td>
                <td>To sign you in and, the first time, to create your account.</td>
              </tr>
              <tr>
                <th scope="row">Your agreement to this policy</th>
                <td>The date and time you accepted it, and which version.</td>
                <td>To keep a record of what you agreed to and when.</td>
              </tr>
              <tr>
                <th scope="row">Safety records</th>
                <td>
                  Your account status, any strikes or reputation score, and reports about you or made by you. A
                  report holds the reason, optional details, and a short excerpt (up to 500 characters) of a message,
                  as sent by the person reporting.
                </td>
                <td>To keep rooms safe and act on abuse.</td>
              </tr>
              <tr>
                <th scope="row">Technical information</th>
                <td>
                  Your IP address and basic request details, and the rooms you create or join while they are
                  active.
                </td>
                <td>To run the service, block abuse and limit repeated attempts (for example, wrong passwords).</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>2. Voice, chat and movement</h2>
        <p>
          Inside a room, your microphone audio, text chat and position are sent directly from your browser to the
          other people in the room (peer to peer). Our servers help your browsers find each other, but the audio,
          messages and positions themselves don’t pass through our servers, and we don’t record, transcribe or store
          them. These connections are encrypted by your browser.
        </p>
        <p>This has some consequences worth knowing:</p>
        <ul>
          <li>
            Everyone in a room can hear and read what you share there. Someone could record it on their own device,
            and we can’t stop that. Don’t share anything you wouldn’t say out loud in front of that group.
          </li>
          <li>
            Because browsers connect directly, the other people in a room may be able to see your IP address. If you
            turn on <em>Hide my IP address</em> when joining (offered when a relay server is available), your
            connection goes through our relay instead, and they won’t.
          </li>
          <li>
            Your browser asks for permission before using your microphone. We only use it while you are in a room,
            and you can mute at any time.
          </li>
        </ul>

        <h2>3. How we use your information</h2>
        <ul>
          <li>To provide {APP_NAME}: sign you in, run rooms, and show your profile to other people.</li>
          <li>To keep people safe: review reports, give warnings, and suspend or ban accounts that break the rules.</li>
          <li>To protect the service: detect abuse, prevent break-ins, and limit repeated attempts.</li>
          <li>To meet our legal obligations and handle legal claims.</li>
        </ul>
        <p>
          Where the law asks us for a legal basis, we rely on: providing the service you asked for, our legitimate
          interest in keeping {APP_NAME} safe and secure, our legal obligations, and your consent where we ask for it.
        </p>

        <h2>4. What other people can see</h2>
        <ul>
          <li>Your name and username are shown to people in the rooms you join.</li>
          <li>
            Your profile details (such as your bio, languages and interests) are meant to help people get to know
            you, and are shown to other people as the app’s profile views display them.
          </li>
          <li>
            Your email address is never shown to other users. Your password is never visible to anyone, including us.
          </li>
        </ul>

        <h2>5. Who we share information with</h2>
        <p>We don’t sell your personal information. We share it only:</p>
        <ul>
          <li>
            With service providers who help us run {APP_NAME} — such as hosting, databases, and the connection helper
            servers (STUN/TURN) that let browsers find and reach each other. They may only use it to provide that
            service to us.
          </li>
          <li>With Google, when you choose to sign in with Google (see Google’s own privacy policy).</li>
          <li>
            With our moderators, when someone makes a report, so they can review it.
          </li>
          <li>
            When the law requires it, or when we believe it’s necessary to protect someone’s safety or our rights.
          </li>
        </ul>

        <h2>6. Cookies and local storage</h2>
        <p>
          We store a sign-in token in your browser’s local storage so you stay signed in; it is replaced regularly
          and cleared when you log out. Signing in with Google uses a short-lived cookie during the sign-in
          itself. We don’t use advertising cookies or third-party analytics trackers.
        </p>

        <h2>7. How long we keep it</h2>
        <ul>
          <li>
            <strong>Account and profile:</strong> until you ask us to delete your account.
          </li>
          <li>
            <strong>Safety records and reports:</strong> as long as needed to keep people safe, to stop banned
            accounts from coming back, and to meet legal obligations.
          </li>
          <li>
            <strong>Your agreement to this policy:</strong> for as long as your account exists, and as needed to show
            that you agreed.
          </li>
          <li>
            <strong>Rooms:</strong> only while they are in use; a room is removed shortly after the last person
            leaves.
          </li>
          <li>
            <strong>Security counters</strong> (for example, how many times a login was attempted from an IP address):
            kept briefly, and they expire automatically within hours.
          </li>
        </ul>

        <h2>8. Your choices and rights</h2>
        <ul>
          <li>You can change your name, username and profile from your profile page at any time.</li>
          <li>You can change your password, or log out of every device, from your profile page.</li>
          <li>
            You can ask us for a copy of the information we hold about you, to correct it, or to delete your
            account and its data.
          </li>
          <li>
            Depending on where you live, you may also have the right to object to or limit some uses of your
            information, to withdraw consent, and to complain to your local data protection authority.
          </li>
        </ul>
        <p>
          Because we need this policy to run your account, withdrawing your agreement means we can no longer provide
          the service, and we will delete your account. To make a request, email{' '}
          <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>.
        </p>

        <h2>9. Security</h2>
        <p>
          We protect information with measures such as hashed passwords, short-lived sign-in tokens, and limits on
          repeated sign-in attempts. No system is perfectly secure, so we can’t promise absolute security — if you
          think your account has been compromised, change your password and contact us.
        </p>

        <h2>10. Children</h2>
        <p>
          {APP_NAME} is not for children under {MIN_AGE}, and we don’t knowingly collect information from them. If you
          believe a child has created an account, please contact us and we’ll remove it.
        </p>

        <h2>11. Where information is processed</h2>
        <p>
          Our service providers may process information in countries other than your own. Where we can, we choose
          providers that protect it to a comparable standard.
        </p>

        <h2>12. Changes to this policy</h2>
        <p>
          If we change this policy in a way that matters, we’ll update the version and date at the top and ask you to
          accept the new version the next time you open {APP_NAME}.
        </p>

        <h2>13. Contact us</h2>
        <p>
          Questions or requests about your privacy: <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>
          .
        </p>
      </main>
    </div>
  )
}
