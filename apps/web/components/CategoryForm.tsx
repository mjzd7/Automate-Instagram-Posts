import { saveCategory } from "@/lib/actions/categories";
import type { Category } from "@/lib/schemas";

const inputClass =
  "w-full rounded-lg border border-white/15 bg-black px-3.5 py-2.5 font-mono text-sm text-white outline-none transition-colors duration-200 ease-brand focus:border-white focus-visible:ring-2 focus-visible:ring-white/60";
const labelClass = "mb-1 block font-mono text-[11px] uppercase tracking-wider text-slate-muted";

export function CategoryForm({ category }: { category?: Category }) {
  return (
    <form action={saveCategory} className="flex flex-col gap-3">
      <input type="hidden" name="originalId" value={category?.id ?? ""} />

      <div>
        <label htmlFor={`${category?.id ?? "new"}-id`} className={labelClass}>Category id (slug)</label>
        <input id={`${category?.id ?? "new"}-id`} name="id" defaultValue={category?.id} required className={inputClass} />
      </div>

      <div>
        <label htmlFor={`${category?.id ?? "new"}-name`} className={labelClass}>Name</label>
        <input id={`${category?.id ?? "new"}-name`} name="name" defaultValue={category?.name} required className={inputClass} />
      </div>

      <div>
        <label htmlFor={`${category?.id ?? "new"}-description`} className={labelClass}>Description (optional)</label>
        <input id={`${category?.id ?? "new"}-description`} name="description" defaultValue={category?.description ?? ""} className={inputClass} />
      </div>

      <label className="flex items-center gap-1.5 text-sm text-platinum">
        <input type="checkbox" name="active" defaultChecked={category?.active ?? true} />
        Active
      </label>

      <button
        type="submit"
        className="w-fit rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-colors duration-200 ease-brand outline-none hover:bg-platinum focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50"
      >
        {category ? "Save changes" : "Add category"}
      </button>
    </form>
  );
}
