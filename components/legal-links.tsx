import Link from "next/link"

const legalLinks = [
  { href: "/integritetspolicy", label: "Integritetspolicy" },
  { href: "/cookies", label: "Cookies" },
  { href: "/anvandarvillkor", label: "Användarvillkor" },
]

export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav
      aria-label="Juridiska länkar"
      className={`flex flex-wrap gap-x-4 gap-y-2 ${className}`}
    >
      {legalLinks.map((link) => (
        <Link
          className="font-semibold text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline"
          href={link.href}
          key={link.href}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
