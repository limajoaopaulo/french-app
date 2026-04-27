import { signOut } from "@/app/actions/auth"
import { t } from "@/lib/i18n"

interface Props {
  displayName: string
  languageCode: string
}

export function SignedInHeader({ displayName, languageCode }: Props) {
  return (
    <header className="flex items-center justify-end gap-3 border-b border-white/5 bg-zinc-950/80 px-4 py-2 text-xs text-zinc-400 backdrop-blur">
      <span>
        {t.header.hi(displayName)}{" "}
        <span className="font-mono uppercase">· {languageCode}</span>
      </span>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-md border border-white/10 px-2.5 py-1 text-zinc-300 transition hover:bg-white/5"
        >
          {t.header.switchUser}
        </button>
      </form>
    </header>
  )
}
