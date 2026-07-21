"use client";

import styled from "styled-components";

const Wrap = styled.main`
  min-height: 100vh;
  display: flex;
  justify-content: center;
  padding: 48px 24px 80px;
  background: ${({ theme }) => theme.bg};
  color: ${({ theme }) => theme.text};
`;

const Doc = styled.article`
  width: 100%;
  max-width: 720px;
  line-height: 1.65;
  font-size: 14.5px;

  h1 {
    font-size: 26px;
    font-weight: 700;
    margin: 0 0 6px;
  }
  .updated {
    font-size: 13px;
    color: ${({ theme }) => theme.textMuted};
    margin: 0 0 32px;
  }
  h2 {
    font-size: 17px;
    font-weight: 700;
    margin: 32px 0 10px;
  }
  p {
    margin: 0 0 14px;
    color: ${({ theme }) => theme.text};
  }
  ul {
    margin: 0 0 14px;
    padding-left: 22px;
  }
  li {
    margin-bottom: 6px;
  }
  a {
    color: ${({ theme }) => theme.accent};
  }
  strong {
    font-weight: 700;
  }
  .callout {
    padding: 14px 16px;
    border-radius: 10px;
    border: 1px solid ${({ theme }) => theme.border};
    background: ${({ theme }) => theme.surfaceAlt};
    margin: 0 0 14px;
  }
`;

export default function PrivacyPolicyPage() {
  return (
    <Wrap>
      <Doc>
        <h1>Privacy Policy</h1>
        <p className="updated">Last updated: July 21, 2026</p>

        <p>
          Settl (&quot;Settl,&quot; &quot;we,&quot; &quot;us&quot;) provides software that helps
          businesses follow up on overdue invoices: drafting reminder messages, sending them
          through the vendor&apos;s own email account, and reading replies from customers so a
          human can review disputes, payment-plan requests, or opt-outs before anything further
          is sent. This policy explains what information we collect, why, and how it&apos;s
          handled.
        </p>

        <h2>1. Information We Collect</h2>
        <p>We collect the following categories of information:</p>
        <ul>
          <li>
            <strong>Account information.</strong> When you sign in with Google, we receive your
            name, email address, and profile identifier.
          </li>
          <li>
            <strong>Gmail data.</strong> If you connect your Gmail account, we access email
            messages related to invoices you&apos;ve sent through Settl - both the reminders we
            send on your behalf and the replies your customers send back - so the product can
            detect and classify those replies (for example: a dispute, a payment-plan request, an
            opt-out, or a routine confirmation).
          </li>
          <li>
            <strong>Invoice and business data.</strong> Invoice details you upload or connect
            (amounts, due dates, customer contact information, payment status) and any templates
            or preferences you configure.
          </li>
          <li>
            <strong>Usage data.</strong> Standard technical logs (timestamps, error reports,
            feature usage) used to operate and improve the product.
          </li>
        </ul>

        <h2>2. How We Use Gmail Data</h2>
        <p>
          We use Gmail data only to operate the features you&apos;ve enabled: sending invoice
          reminders through your connected account, detecting replies to those specific threads,
          and classifying a reply&apos;s intent so it can be routed to you for review or, in
          narrow and clearly-disclosed cases, handled automatically. We do not use Gmail data for
          advertising, and we do not sell it.
        </p>
        <div className="callout">
          <strong>Google API Services User Data Policy.</strong> Settl&apos;s use and transfer of
          information received from Google APIs to any other app will adhere to the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </div>

        <h2>3. How We Share Information</h2>
        <p>We share information only as needed to provide the service:</p>
        <ul>
          <li>
            <strong>AI processing.</strong> Message drafting and reply classification are
            performed using Google&apos;s Gemini models. Relevant message text is sent to Gemini
            for this purpose and is not used by Google to train models on our behalf beyond
            what&apos;s necessary to provide the API response.
          </li>
          <li>
            <strong>Payments.</strong> Payment links are created directly on the vendor&apos;s own
            Stripe account. Settl never holds, routes, or has custody of funds - money always
            settles directly to the vendor via their own payment processor.
          </li>
          <li>
            <strong>Service providers.</strong> Infrastructure providers (hosting, database, and
            similar operational vendors) that process data solely to help us run the service.
          </li>
        </ul>
        <p>We do not sell personal information, and we do not share it for third-party advertising.</p>

        <h2>4. Data Storage and Security</h2>
        <p>
          OAuth credentials (including Gmail refresh tokens) are encrypted at rest. Invoice and
          contact data is stored in a tenant-isolated database, scoped so that one customer&apos;s
          account can never read another&apos;s data. Access to production systems is limited to
          the operators who need it to run the service.
        </p>

        <h2>5. Data Retention</h2>
        <p>
          We retain account, invoice, and message data for as long as your account is active, or
          as needed to provide the service. You can request deletion of your data at any time
          (see &quot;Your Rights&quot; below); we&apos;ll delete it except where retention is
          required for legal, security, or fraud-prevention purposes.
        </p>

        <h2>6. Your Rights and Choices</h2>
        <ul>
          <li>You can disconnect your Gmail account at any time from your Settl account settings.</li>
          <li>
            You can also revoke Settl&apos;s access directly from your{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Account permissions page
            </a>
            .
          </li>
          <li>You can request a copy of, or deletion of, your data by contacting us (below).</li>
        </ul>

        <h2>7. Children&apos;s Privacy</h2>
        <p>
          Settl is a business tool and is not directed at, or knowingly used by, children under
          16. We do not knowingly collect personal information from children.
        </p>

        <h2>8. Changes to This Policy</h2>
        <p>
          We may update this policy as the product changes. We&apos;ll update the &quot;Last
          updated&quot; date above, and for material changes we&apos;ll make reasonable efforts to
          notify active users.
        </p>

        <h2>9. Contact Us</h2>
        <p>
          Questions about this policy or your data can be sent to{" "}
          <a href="mailto:illgamerguy7@gmail.com">illgamerguy7@gmail.com</a>.
        </p>
      </Doc>
    </Wrap>
  );
}
