import AppProvider from "@/components/AppProvider";
import Shell from "@/components/Shell";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <Shell>{children}</Shell>
    </AppProvider>
  );
}
