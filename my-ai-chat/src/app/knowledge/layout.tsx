export default function KnowledgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {children}
      </div>
    </div>
  );
}

export const metadata = {
  title: "Knowledge Base",
  description: "Browse our knowledge base for helpful information",
};