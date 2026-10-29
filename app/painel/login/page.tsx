import { loginAction } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const next = sp.next ?? "/painel";

  return (
    <div className="mx-auto mt-6 max-w-sm">
      <div className="ig-border relative overflow-hidden rounded-2xl p-7">
        <div className="ig-glow pointer-events-none absolute inset-0" />
        <div className="relative">
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#262626]">
            Sign in to InstaChat
          </h1>
          <p className="mt-1 text-sm text-[#737373]">
            Enter your dashboard password to continue.
          </p>

          {sp.error ? (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
              Incorrect password. Please try again.
            </p>
          ) : null}

          <form action={loginAction} className="mt-5 space-y-3">
            <input type="hidden" name="next" value={next} />
            <input
              type="password"
              name="password"
              placeholder="Password"
              autoFocus
              className="w-full rounded-lg border border-[#dbdbdb] bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-ig-blue focus:ring-2 focus:ring-ig-blue/20"
            />
            <button
              type="submit"
              className="btn-ig w-full rounded-lg px-4 py-2.5 text-sm font-semibold"
            >
              Sign in
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
