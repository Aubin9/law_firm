export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md rounded-lg border border-border bg-surface p-8 shadow-sm">
        <h1 className="font-serif text-2xl font-semibold text-primary">
          Cabinet d'Avocats
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Plateforme interne de gestion de cabinet juridique
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <a
            href="/fr/login"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Connexion
          </a>
        </div>
      </div>
    </main>
  );
}

