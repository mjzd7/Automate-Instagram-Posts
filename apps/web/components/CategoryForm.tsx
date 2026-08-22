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
        <label className={labelClass}>Category id (slug)</label>
        <input name="id" defaultValue={category?.id} required className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>Name</label>
        <input name="name" defaultValue={category?.name} required className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>Description (optional)</label>
        <input name="description" defaultValue={category?.description ?? ""} className={inputClass} />
      </div>

      <label className="flex items-center gap-1.5 text-sm text-platinum">
        <input type="checkbox" name="active" defaultChecked={category?.active ?? true} />
        Active
      </label>

      <button
        type="submit"
        className="w-fit rounded-control bg-primary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 ease-brand hover:bg-primary/90"
      >
        {category ? "Save changes" : "Add category"}
      </button>
    </form>
  );
}
