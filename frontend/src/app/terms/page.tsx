import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal-page'

export const metadata: Metadata = {
  title: 'Terms of Service — YesDrop',
  description: 'The terms that govern your use of YesDrop.',
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="June 2026">
      <p>
        These terms govern your access to and use of YesDrop. By creating an account or using the service, you
        agree to them.
      </p>

      <h2>Using YesDrop</h2>
      <p>
        YesDrop lets you send approval requests by email, set deadlines, and send automatic reminders. You are
        responsible for the content of the requests you send and for making sure you have permission to contact
        the approvers you add.
      </p>

      <h2>Your account</h2>
      <p>
        Keep your login credentials secure and don&apos;t share your account. You&apos;re responsible for activity
        that happens under your account. New email accounts confirm their address before sending requests.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Don&apos;t use YesDrop to send spam, harass anyone, or break the law. We may suspend accounts that abuse
        the service or put its delivery and reputation at risk.
      </p>

      <h2>Availability</h2>
      <p>
        We work to keep YesDrop reliable, but the service is provided “as is” without warranties. We may change or
        discontinue features over time.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent permitted by law, YesDrop is not liable for indirect or consequential damages arising from
        your use of the service.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms as the product evolves. If we make material changes, we&apos;ll update the date
        above and, where appropriate, notify you in the app.
      </p>
    </LegalPage>
  )
}
