import { AccountForm } from "@/components/AccountForm";
import { deleteAccount } from "@/lib/actions/accounts";
import { getAccounts, getCategories } from "@/lib/db";
import { Banner, Button, PageHeader, TitaniumCard } from "@/components/ui";

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [accounts, categories, { error }] = await Promise.all([getAccounts(), getCategories(), searchParams]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title="Accounts" subtitle="CRUD on data/accounts.json — every save is a commit" />
      {error && <Banner variant="error">{error}</Banner>}

      <TitaniumCard className="p-6">
        <p className="mb-4 font-mono text-xs uppercase tracking-wider text-slate-muted">Add account</p>
        <AccountForm categories={categories} />
      </TitaniumCard>

      {accounts.map((account) => (
        <details key={account.id} className="rounded-2xl border border-white/10 bg-[rgba(18,18,22,0.85)] p-6 shadow-titanium backdrop-blur-[20px]">
          <summary className="cursor-pointer font-mono text-sm font-bold uppercase tracking-wider text-white outline-none focus-visible:ring-2 focus-visible:ring-white/60">
            {account.id} {account.active ? "" : "(inactive)"}
          </summary>
          <div className="mt-4 flex flex-col gap-4">
            <AccountForm account={account} categories={categories} />
            <form action={deleteAccount}>
              <input type="hidden" name="id" value={account.id} />
              <Button type="submit" variant="danger">
                Delete account
              </Button>
            </form>
          </div>
        </details>
      ))}
    </div>
  );
}
