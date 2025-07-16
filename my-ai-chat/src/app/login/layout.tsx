export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white ">
      {children}
    </main>
  );
}

export const metadata = {
  title: "Login",
  description: "Login page",
};

export const dynamic = "force-dynamic"; // Force dynamic rendering to prevent stale state
