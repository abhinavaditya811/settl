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
`;

export default function TermsOfServicePage() {
  return (
    <Wrap>
      <Doc>
        <h1>Terms of Service</h1>
        <p className="updated">Last updated: July 21, 2026</p>

        <p>
          These Terms of Service (&quot;Terms&quot;) govern your use of Settl (&quot;the
          Service&quot;). By creating an account or connecting your Google account, you agree to
          these Terms.
        </p>

        <h2>1. The Service</h2>
        <p>
          Settl helps you follow up on overdue invoices: it drafts reminder messages, sends them
          from your own connected email account, and reads replies to detect disputes,
          payment-plan requests, opt-outs, and routine confirmations. Certain actions - notably
          the first message to a new customer - require your explicit one-tap approval before
          anything is sent. Settl never holds or moves money on your behalf; payment always flows
          directly to you through your own connected payment processor.
        </p>

        <h2>2. Accounts</h2>
        <p>
          You must provide accurate information when creating an account and are responsible for
          activity that occurs under it. You&apos;re responsible for keeping your login credentials
          secure.
        </p>

        <h2>3. Acceptable Use</h2>
        <p>You agree not to use the Service to:</p>
        <ul>
          <li>Send messages that are false, misleading, harassing, or unlawful;</li>
          <li>Pursue debts you do not have a good-faith legal right to collect;</li>
          <li>
            Use the Service for consumer debt collection in a manner that violates applicable
            debt-collection law (Settl is designed for first-party and business-to-business use);
          </li>
          <li>Attempt to circumvent the Service&apos;s compliance safeguards; or</li>
          <li>Access another user&apos;s account or data without authorization.</li>
        </ul>

        <h2>4. Your Content and Data</h2>
        <p>
          You retain ownership of the invoice data, templates, and other content you provide.
          You grant Settl a license to use that content solely to operate the Service on your
          behalf (for example, drafting and sending messages, and classifying replies). See our{" "}
          <a href="/privacy">Privacy Policy</a> for details on how data is handled.
        </p>

        <h2>5. Third-Party Services</h2>
        <p>
          The Service relies on third-party providers - including Google (Gmail, sign-in, and AI
          drafting/classification via Gemini) and Stripe (payment links) - each governed by their
          own terms. Settl is not responsible for the availability or conduct of these third-party
          services.
        </p>

        <h2>6. Fees</h2>
        <p>
          Current pricing, if any, will be presented to you before it applies to your account.
          We&apos;ll provide reasonable notice before any change to pricing for an active account.
        </p>

        <h2>7. Disclaimer of Warranties</h2>
        <p>
          The Service is provided &quot;as is&quot; without warranties of any kind, express or
          implied. Settl does not guarantee that any message will be delivered, read, or result in
          payment.
        </p>

        <h2>8. Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by law, Settl will not be liable for indirect,
          incidental, special, or consequential damages, or for lost profits or revenue, arising
          from your use of the Service.
        </p>

        <h2>9. Termination</h2>
        <p>
          You may stop using the Service and disconnect your accounts at any time. We may suspend
          or terminate access if you violate these Terms or use the Service in a way that creates
          risk or legal exposure for Settl or others.
        </p>

        <h2>10. Changes to These Terms</h2>
        <p>
          We may update these Terms as the product changes. We&apos;ll update the &quot;Last
          updated&quot; date above, and for material changes we&apos;ll make reasonable efforts to
          notify active users.
        </p>

        <h2>11. Contact Us</h2>
        <p>
          Questions about these Terms can be sent to{" "}
          <a href="mailto:illgamerguy7@gmail.com">illgamerguy7@gmail.com</a>.
        </p>
      </Doc>
    </Wrap>
  );
}
