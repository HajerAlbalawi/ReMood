import { Link, useLocation } from "wouter";
import { BookOpen, History, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: BookOpen, label: "الرئيسية" },
    { href: "/history", icon: History, label: "السجل" },
    { href: "/stats", icon: BarChart2, label: "الإحصائيات" },
  ];

  return (
    <div className="min-h-[100dvh] w-full relative overflow-hidden bg-background text-foreground" dir="rtl">
      {/* Main Content */}
      <main className="relative z-10 w-full h-full min-h-[100dvh] pb-24">
        {children}
      </main>

      {/* Floating Bottom Nav for immersive feel */}
      <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
        <nav className="glass rounded-full px-2 py-2 flex items-center gap-2 pointer-events-auto">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            
            return (
              <Link key={item.href} href={item.href} className="outline-none">
                <button
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 rounded-full transition-all duration-300",
                    isActive 
                      ? "bg-primary/20 text-primary" 
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {isActive && (
                    <span className="font-medium text-sm animate-in fade-in zoom-in duration-300">
                      {item.label}
                    </span>
                  )}
                </button>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
