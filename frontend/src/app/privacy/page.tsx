import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal-page'

export const metadata: Metadata = {
  title: 'Privacy Policy | YesDrop',
  description: 'How YesDrop collects, uses, and protects your data.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="September 2026">
      <p>
        This policy explains what information YesDrop collects when you use the service, how we use it, and the
        choices you have. By using YesDrop you agree to the practices described here.
      </p>

      <h2>Information we collect</h2>
      <p>
        We collect the account details you provide when you sign up (your name and email address), and the
        content of the approval requests you create, including approver email addresses, titles, messages, and
        any files you attach. We also record basic activity such as when a request is sent, viewed, or decided.
      </p>

      <h2>How we use it</h2>
      <p>
        We use your information to deliver approval requests by email, send reminders you schedule, show you the
        status of each request, and keep your account secure. We do not sell your personal information.
      </p>

      <h2>AI features</h2>
      <p>
        YesDrop has one optional AI feature: composing a draft approval request from a short prompt you write. It
        only works if you connect your own account with an AI provider. You choose one of{' '}
        <strong>Google Gemini</strong>, <strong>Anthropic Claude</strong>, or <strong>OpenAI</strong> and paste your own
        API key in Settings. YesDrop does not supply an AI account, and usage is billed to you by that provider under
        the plan you hold with them.
      </p>
      <p>
        Your API key is encrypted before it is stored and is decrypted only on our servers at the moment you run
        compose. It is never shown back to you or sent to your browser, and you can remove it at any time in Settings,
        which deletes it.
      </p>
      <p>
        Only the text you type into the compose box is sent to the provider you chose. Before it is sent, our servers
        remove every email address, web link, and phone number from that text and replace each with a placeholder, then
        put the originals back into the draft after the provider replies. We cannot automatically detect names, so do
        not type sensitive or confidential information into the compose box. We never send an AI provider your Google
        account name, email address, profile picture, Gmail token, Gmail messages, approver lists, or any other Google
        user data. Google user data is never used to train or improve any AI or machine learning model.
      </p>
      <p>
        The provider you choose handles that text under its own terms and your own plan, and some plans allow the
        provider to use submitted text to improve its products. Check your provider&apos;s terms before connecting a
        key. This feature is optional; you can write and schedule an approval request entirely by hand without it.
      </p>

      <h2>Email to approvers</h2>
      <p>
        When you send a request, we email the approver on your behalf so they can approve or reject it. Approvers
        do not need a YesDrop account and we only use their address to deliver that request and any reminders.
      </p>

      <h2>Google user data</h2>
      <p>
        YesDrop lets you sign in with Google and send approval requests from your own Gmail account. This section
        explains what Google user data we access, how we use and store it, and with whom we share, transfer, or
        disclose it.
      </p>
      <p>
        <strong>What we access.</strong> When you sign in with Google or connect Gmail, Google shares your name,
        email address, and profile picture with us. With your permission, we also receive an authorization token for
        the Gmail send scope (gmail.send), which lets YesDrop send email from your Gmail account. This scope only
        allows sending. YesDrop cannot read, search, change, or delete the messages in your mailbox.
      </p>
      <p>
        <strong>How we use it.</strong> We use your name and email address to create and secure your account, to
        show them to you in the app, and to identify you as the sender of your approval requests. We use the Gmail
        token only to send the approval requests and reminders that you create or schedule, from your Gmail address,
        to the approvers you choose. We keep the Gmail message and thread IDs of those emails so that reminders stay
        in the same conversation.
      </p>
      <p>
        <strong>How we store and protect it.</strong> Your account details are stored in our database. The Gmail
        token is encrypted before it is stored and is decrypted only on our servers at the moment an email is sent.
        Data is encrypted in transit between your browser, our servers, and our providers.
      </p>
      <p>
        <strong>With whom we share, transfer, or disclose it.</strong> We share Google user data only as needed to
        run YesDrop, and only with the following parties:
      </p>
      <ul className="list-disc space-y-2 pl-6">
        <li>
          <strong>Google</strong>, which delivers the emails you send through YesDrop using the Gmail API.
        </li>
        <li>
          <strong>Your approvers</strong>, who see your name and email address as the sender of each request you send
          them, along with the request content you write. Their replies go to your own inbox.
        </li>
        <li>
          <strong>Supabase</strong>, which hosts our database and sign-in service, and stores your account details and
          the encrypted Gmail token.
        </li>
        <li>
          <strong>Render</strong>, which hosts the YesDrop servers that process your data to send email.
        </li>
        <li>
          <strong>Vercel</strong>, which hosts the YesDrop website and app interface.
        </li>
        <li>
          <strong>Brevo</strong>, our email delivery provider, which receives your name and email address to send you
          account and status notification emails, and to deliver approval requests that are not sent through Gmail.
        </li>
      </ul>
      <p>
        These providers receive Google user data only so they can provide their service to YesDrop. We may also
        disclose Google user data when the law requires it, when it is necessary to protect the security of YesDrop
        and its users (for example, to investigate abuse), or as part of a merger, acquisition, or sale of assets, and
        in that last case only after obtaining your explicit consent first. We do not share Google user data with
        anyone else.
      </p>
      <p>
        <strong>What we never do.</strong> We do not sell Google user data. We do not use or transfer it for
        advertising, and we do not give it to data brokers or information resellers. We do not use Google user data,
        including data obtained through Google Workspace APIs, to develop, improve, or train generalized or
        non-personalized AI or machine learning models. The AI features in YesDrop receive only the text you type
        into them, never your Google user data. No person at YesDrop reads your Google user data unless you give us
        permission, it is necessary for security purposes, or the law requires it.
      </p>
      <p>
        <strong>Retention and deletion.</strong> We keep your Google account details for as long as your YesDrop
        account exists. You can disconnect Gmail at any time in Settings, which deletes the stored Gmail token. You
        can also remove YesDrop&apos;s access from your{' '}
        <a href="https://myaccount.google.com/permissions">Google Account permissions page</a>. When your YesDrop
        account is deleted, your Google account details and the Gmail token are deleted with it.
      </p>
      <p>
        <strong>Limited Use.</strong> YesDrop&apos;s use and transfer to any other app of information received from
        Google APIs will adhere to the{' '}
        <a href="https://developers.google.com/terms/api-services-user-data-policy">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>

      <h2>Data storage and security</h2>
      <p>
        Your data is stored with our infrastructure providers and protected with industry-standard safeguards,
        including encryption in transit. Access is limited to what is needed to run the service.
      </p>

      <h2>Your choices</h2>
      <p>
        You can update or delete your requests at any time, and you can request deletion of your account from your
        account settings. Some records may be retained where required for security or legal reasons.
      </p>
    </LegalPage>
  )
}
