import { BrandLogo } from './brand-logo'

export function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <BrandLogo href="/" />
          <div className="flex gap-8 text-sm text-foreground/60">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Contact</a>
          </div>
          <p className="text-sm text-foreground/50">© 2026 YesDrop. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
