import { CategoryForm } from "@/components/CategoryForm";
import { deleteCategory } from "@/lib/actions/categories";
import { getCategories } from "@/lib/db";
import { Banner, Button, PageHeader, TitaniumCard } from "@/components/ui";

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [categories, { error }] = await Promise.all([getCategories(), searchParams]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title="Categories" subtitle="CRUD on data/categories.json" />
      {error && <Banner variant="error">{error}</Banner>}

      <TitaniumCard className="p-6">
        <p className="mb-4 font-mono text-xs uppercase tracking-wider text-slate-muted">Add category</p>
        <CategoryForm />
      </TitaniumCard>

      {categories.map((category) => (
        <details key={category.id} className="rounded-2xl border border-white/10 bg-[rgba(18,18,22,0.85)] p-6 shadow-titanium backdrop-blur-[20px]">
          <summary className="cursor-pointer font-mono text-sm font-bold uppercase tracking-wider text-white outline-none focus-visible:ring-2 focus-visible:ring-white/60">
            {category.name} {category.active ? "" : "(inactive)"}
          </summary>
          <div className="mt-4 flex flex-col gap-4">
            <CategoryForm category={category} />
            <form action={deleteCategory}>
              <input type="hidden" name="id" value={category.id} />
              <Button type="submit" variant="danger">
                Delete category
              </Button>
            </form>
          </div>
        </details>
      ))}
    </div>
  );
}
