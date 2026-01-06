export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen login-page-container flex items-center justify-center relative overflow-hidden px-4">
      {/* Animated background layers */}
      <div className="login-background">
        <div className="login-background-layer login-background-layer-1" />
        <div className="login-background-layer login-background-layer-2" />
        <div className="login-background-layer login-background-layer-3" />
      </div>
      {/* Content */}
      <div className="login-content w-full">
        {children}
      </div>
    </div>
  );
}

