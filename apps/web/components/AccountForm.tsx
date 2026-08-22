import { saveAccount } from "@/lib/actions/accounts";
import type { Account, Category } from "@/lib/schemas";

const inputClass =
  "w-full border border-white/10 bg-black/20 px-3 py-2 text-sm text-text-primary outline-none focus:border-primary";
const labelClass = "mb-1 block text-xs font-medium text-text-secondary";

export function AccountForm({ account, categories }: { account?: Account; categories: Category[] }) {
  return (
    <form action={saveAccount} className="flex flex-col gap-3">
      <input type="hidden" name="originalId" value={account?.id ?? ""} />

      <div>
        <label className={labelClass} htmlFor={`${account?.id ?? "new"}-id`}>
          Account id (slug)
        </label>
        <input
          id={`${account?.id ?? "new"}-id`}
          name="id"
          defaultValue={account?.id}
          required
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor={`${account?.id ?? "new"}-igUserId`}>
          Instagram user id
        </label>
        <input id={`${account?.id ?? "new"}-igUserId`} name="igUserId" defaultValue={account?.igUserId} required className={inputClass} />
      </div>

      <div>
        <label className={labelClass} htmlFor={`${account?.id ?? "new"}-fbPageId`}>
          Facebook page id
        </label>
        <input id={`${account?.id ?? "new"}-fbPageId`} name="fbPageId" defaultValue={account?.fbPageId} required className={inputClass} />
      </div>

      <div>
        <label className={labelClass} htmlFor={`${account?.id ?? "new"}-threadsUserId`}>
          Threads user id (optional)
        </label>
        <input id={`${account?.id ?? "new"}-threadsUserId`} name="threadsUserId" defaultValue={account?.threadsUserId ?? ""} className={inputClass} />
      </div>

      <div>
        <label className={labelClass} htmlFor={`${account?.id ?? "new"}-timezone`}>
          Timezone (IANA, e.g. America/New_York)
        </label>
        <input id={`${account?.id ?? "new"}-timezone`} name="timezone" defaultValue={account?.timezone} required className={inputClass} />
      </div>

      <div>
        <label className={labelClass} htmlFor={`${account?.id ?? "new"}-postingHoursLocal`}>
          Posting hours local (comma-separated, 0-23)
        </label>
        <input
          id={`${account?.id ?? "new"}-postingHoursLocal`}
          name="postingHoursLocal"
          defaultValue={account?.postingHoursLocal.join(", ")}
          placeholder="10, 13, 17, 20"
          required
          className={inputClass}
        />
      </div>

      <fieldset>
        <legend className={labelClass}>Category focus</legend>
        <div className="flex flex-wrap gap-3">
          {categories.map((category) => (
            <label key={category.id} className="flex items-center gap-1.5 text-sm text-text-primary">
              <input
                type="checkbox"
                name="categoryFocus"
                value={category.id}
                defaultChecked={account?.categoryFocus.includes(category.id)}
              />
              {category.name}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-1.5 text-sm text-text-primary">
        <input type="checkbox" name="active" defaultChecked={account?.active ?? true} />
        Active
      </label>

      <button
        type="submit"
        className="w-fit rounded-control bg-primary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 ease-brand hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {account ? "Save changes" : "Add account"}
      </button>
    </form>
  );
}
