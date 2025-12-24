"use client";

export function PortalFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border-primary bg-background-tertiary mt-auto transition-colors">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-end text-sm text-text-secondary">
          <div>
            © 2009-{currentYear}{" "}
            <a
              href="https://dynamic.as"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text-primary transition-colors underline cursor-pointer"
            >
              Dynamic AS
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}


