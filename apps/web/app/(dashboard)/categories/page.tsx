import { CategoryForm } from "@/components/CategoryForm";
import { deleteCategory } from "@/lib/actions/categories";
import { getCategories } from "@/lib/db";

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [categories, { error }] = await Promise.all([getCategories(), searchParams]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="font-display text-3xl font-light">Categories</h1>
      {error && <p className="text-sm text-red-400">{error}</p>}

      <section className="shadow-elevated rounded-control border border-white/10 bg-surface p-6">
        <h2 className="mb-4 text-sm font-medium text-text-secondary">Add category</h2>
        <CategoryForm />
      </section>

      {categories.map((category) => (
        <details key={category.id} className="shadow-elevated rounded-control border border-white/10 bg-surface p-6">
          <summary className="cursor-pointer text-sm font-medium text-text-primary">
            {category.name} {category.active ? "" : "(inactive)"}
          </summary>
          <div className="mt-4 flex flex-col gap-4">
            <CategoryForm category={category} />
            <form action={deleteCategory}>
              <input type="hidden" name="id" value={category.id} />
              <button
                type="submit"
                className="rounded-control px-4 py-2 text-sm font-medium text-red-400 transition-colors duration-150 ease-brand hover:text-red-300"
              >
                Delete category
              </button>
            </form>
          </div>
        </details>
      ))}
    </div>
  );
}
