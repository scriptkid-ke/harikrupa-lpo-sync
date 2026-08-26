export function SetupRequired() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper p-6">
      <div className="max-w-lg w-full card p-8">
        <div className="h-10 w-10 rounded bg-kiln-500 flex items-center justify-center font-display font-bold text-white text-sm mb-5">
          H
        </div>
        <h1 className="font-display text-xl font-semibold text-ink mb-2">Supabase isn't configured yet</h1>
        <p className="text-sm text-ink-soft leading-relaxed mb-5">
          This screen renders instead of a blank page because{' '}
          <code className="bg-surface-sunken px-1.5 py-0.5 rounded text-xs font-mono">VITE_SUPABASE_URL</code> and{' '}
          <code className="bg-surface-sunken px-1.5 py-0.5 rounded text-xs font-mono">VITE_SUPABASE_ANON_KEY</code>{' '}
          are missing or invalid. The app needs a running Supabase project to sign in and load any data.
        </p>

        <ol className="space-y-3 text-sm text-ink mb-6">
          <li className="flex gap-3">
            <span className="shrink-0 h-5 w-5 rounded-full bg-ink text-white text-xs flex items-center justify-center font-medium">1</span>
            <span>
              Start Supabase locally (requires Docker + the Supabase CLI):{' '}
              <code className="bg-surface-sunken px-1.5 py-0.5 rounded text-xs font-mono block mt-1">supabase start</code>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 h-5 w-5 rounded-full bg-ink text-white text-xs flex items-center justify-center font-medium">2</span>
            <span>
              Copy the example env file and fill in the URL/anon key it prints:
              <code className="bg-surface-sunken px-1.5 py-0.5 rounded text-xs font-mono block mt-1">cp .env.example .env</code>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 h-5 w-5 rounded-full bg-ink text-white text-xs flex items-center justify-center font-medium">3</span>
            <span>
              Restart the dev server so Vite picks up the new env file:
              <code className="bg-surface-sunken px-1.5 py-0.5 rounded text-xs font-mono block mt-1">npm run dev</code>
            </span>
          </li>
        </ol>

        <p className="text-xs text-ink-muted leading-relaxed">
          Using a hosted Supabase project instead? Grab the URL and anon key from your project's
          Settings → API page and put those in <code className="font-mono">.env</code> instead of the local
          values. Full instructions are in <code className="font-mono">README.md</code> and{' '}
          <code className="font-mono">docs/DEPLOYMENT.md</code>.
        </p>
      </div>
    </div>
  );
}
