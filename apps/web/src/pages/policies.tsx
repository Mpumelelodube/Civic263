import { Link } from 'react-router-dom';
import {
  DATA_LICENCE,
  OPERATOR,
  PILOT_AREA,
  SUPPORT_EMAIL,
  SUPPORT_PENDING_TEXT,
} from '@civic263/domain';

const UPDATED = '26 November 2026';

export function SupportContact() {
  return SUPPORT_EMAIL ? (
    <a className="text-link" href={`mailto:${SUPPORT_EMAIL}`}>
      {SUPPORT_EMAIL}
    </a>
  ) : (
    <span>{SUPPORT_PENDING_TEXT}</span>
  );
}

export function PrivacyPage() {
  return (
    <>
      <header className="page-header">
        <div>
          <h1>Privacy notice</h1>
          <p className="muted">Civic263 pilot · last updated {UPDATED}</p>
        </div>
      </header>
      <article className="panel content-panel">
        <h2>Who is responsible</h2>
        <p>
          Civic263 is run by {OPERATOR.name}, which decides how your information is used (the data
          controller). It is an independent pilot across {PILOT_AREA}; no council or service
          provider runs it or receives your private details from it.
        </p>
        <p>
          Contact for support and privacy requests: <SupportContact />
        </p>

        <h2>What we collect and why</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Information</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  An anonymous account the app creates for you, and a check that requests come from
                  the genuine app on a real device
                </td>
                <td>So only you can see and manage your reports, and to stop abuse.</td>
              </tr>
              <tr>
                <td>
                  Your reports: the service, your description, the place you name, the exact map
                  pin, up to three photos, and the time
                </td>
                <td>
                  To review and publish the issue. Photos are re-encoded, which removes hidden
                  details such as their GPS position.
                </td>
              </tr>
              <tr>
                <td>An email address and password, only if you choose to save your account</td>
                <td>So you can recover your reports on another device.</td>
              </tr>
              <tr>
                <td>Text you type into address search</td>
                <td>Sent to Google Maps to find the place. It is not kept with your account.</td>
              </tr>
              <tr>
                <td>
                  Community visits: your exact position at the site and the new photos you take, if
                  you check whether an issue is fixed
                </td>
                <td>
                  To show the visit was made on site. The position is never published; approved
                  photo copies may be.
                </td>
              </tr>
              <tr>
                <td>
                  Your reminder settings, your in-app inbox, and a notification address for your
                  device if you allow notifications
                </td>
                <td>
                  To send the reminders and updates you asked for. Nearby reminders are worked out
                  on your device; we do not keep a history of where you have been.
                </td>
              </tr>
              <tr>
                <td>Appeals and concerns you send</td>
                <td>
                  So a person can review them. For concerns we keep only a scrambled form of your
                  account ID, never who you are.
                </td>
              </tr>
              <tr>
                <td>Technical logs, including your IP address and the map area you looked at</td>
                <td>To keep the service running and secure. Kept for 30 days.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>What becomes public</h2>
        <p>
          Only after review, and never your identity: a short neutral title and summary written
          during review, a general area, a map position rounded to about 100 metres, approved photo
          copies, dates and progress, including community visit outcomes. Your own words, your exact
          pin and your original photos stay private. Reports kept private by review are never
          published.
        </p>

        <h2>Who processes it for us</h2>
        <ul>
          <li>
            Google (Firebase and Google Cloud) stores and processes Civic263's data in Belgium, in
            the European Union. Your information is therefore held outside Zimbabwe.
          </li>
          <li>Google Maps Platform handles address search.</li>
          <li>
            OpenAI checks a report&rsquo;s text and photos when automatic review is switched on.
            They are processed in the United States. OpenAI does not use them to train its models,
            and keeps them for up to 30 days to detect abuse of its service. While automatic review
            is switched off, a person reviews each report instead.
          </li>
          <li>Apple and Google deliver notifications to your device if you allow them.</li>
        </ul>

        <h2>How long we keep it</h2>
        <ul>
          <li>Unpublished reports: until you withdraw them or delete your account.</li>
          <li>
            Published issues: kept as the public record. If you delete your account they stay
            without any link to you; withdraw a report first to remove it.
          </li>
          <li>
            Leftover uploads from unfinished attempts: removed by a weekly clean-up once they are 7
            days old.
          </li>
          <li>Backups: anything you erase is also gone from our backups within 7 days.</li>
          <li>Technical logs: 30 days.</li>
        </ul>

        <h2>Your choices and rights</h2>
        <p>
          In the app you can see your reports, correct a report before it is published, withdraw a
          report, ask for a human review of a report kept private, and delete your account and data
          (under Account). To ask for a copy of your information or raise a concern, use the contact
          above. You can also complain to the Data Protection Authority, which in Zimbabwe is
          POTRAZ.
        </p>

        <h2>Children</h2>
        <p>
          Civic263 is meant for adults. If you are under 18, ask a parent or guardian before you
          send a report.
        </p>

        <h2>Changes</h2>
        <p>
          We will update this notice when the service changes and show the date above. See also the{' '}
          <Link to="/terms">terms and data reuse</Link>.
        </p>
      </article>
    </>
  );
}

export function TermsPage() {
  return (
    <>
      <header className="page-header">
        <div>
          <h1>Terms and data reuse</h1>
          <p className="muted">Civic263 pilot · last updated {UPDATED}</p>
        </div>
      </header>
      <article className="panel content-panel">
        <h2>What Civic263 is, and is not</h2>
        <p>
          Civic263 is an independent pilot across {PILOT_AREA}, run by {OPERATOR.name}. It is a
          public register of reported municipal issues. It is not run by a council or service
          provider, it does not pass reports to them automatically, and it does not promise repairs.
        </p>
        <p>
          <strong>It is not an emergency service.</strong> Nobody watches reports around the clock.
          If anyone is in danger, call for help first; see{' '}
          <Link to="/methodology">how evidence works</Link> for emergency numbers.
        </p>

        <h2>Reporting responsibly</h2>
        <ul>
          <li>Report real problems with public infrastructure and services.</li>
          <li>Leave out people's names, faces, number plates, phone numbers and home details.</li>
          <li>No threats, hate, false reports or spam.</li>
        </ul>
        <p>
          Every report is reviewed before anything is published. Reviewers can keep a report
          private, remove published content after complaints, and stop an account from adding more.
          Anyone in the app can report a concern about published content.
        </p>

        <h2>Your reports and photos</h2>
        <p>
          You keep the rights to what you send. By sending a report you allow {OPERATOR.name} to
          store it privately, and to publish a reviewed summary and approved photo copies on
          Civic263's website and app. Withdraw a report in the app to remove what you contributed.
        </p>

        <h2>Reusing the public data</h2>
        <p>
          The published text data (references, titles, summaries, services, areas, approximate
          positions, dates and progress, including the CSV download) is licensed under{' '}
          <a
            className="text-link"
            href={DATA_LICENCE.url}
            rel="noreferrer noopener"
            target="_blank"
          >
            {DATA_LICENCE.name}
          </a>
          . Credit it as “{DATA_LICENCE.attribution}” and link to this site.
        </p>
        <ul>
          <li>
            <strong>Photos are not included.</strong> You may view them here, but they are not
            licensed for reuse, because residents took them.
          </li>
          <li>
            Records change: issues are resolved, corrected, withdrawn or removed. Use a recent
            download and keep its date.
          </li>
          <li>Do not try to identify the residents behind reports.</li>
          <li>
            The data shows what residents reported, not every fault, and it is not a measure of
            council performance. It is provided as is, without any guarantee.
          </li>
        </ul>

        <h2>Questions and complaints</h2>
        <p>
          Contact: <SupportContact /> How we handle personal information is in the{' '}
          <Link to="/privacy">privacy notice</Link>.
        </p>
      </article>
    </>
  );
}
