import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal-page'

export const metadata: Metadata = {
  title: 'Privacy Policy — YesDrop',
  description: 'How YesDrop collects, uses, and protects your data.',
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="June 2026">
      <p>
        This policy explains what information YesDrop collects when you use the service, how we use it, and the
        choices you have. By using YesDrop you agree to the practices described here.
      </p>

      <h2>Information we collect</h2>
      <p>
        We collect the account details you provide when you sign up (your name and email address), and the
        content of the approval requests you create — including approver email addresses, titles, messages, and
        any files you attach. We also record basic activity such as when a request is sent, viewed, or decided.
      </p>

      <h2>How we use it</h2>
      <p>
        We use your information to deliver approval requests by email, send reminders you schedule, show you the
        status of each request, and keep your account secure. We do not sell your personal information.
      </p>

      <h2>Email to approvers</h2>
      <p>
        When you send a request, we email the approver on your behalf so they can approve or reject it. Approvers
        do not need a YesDrop account and we only use their address to deliver that request and any reminders.
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
