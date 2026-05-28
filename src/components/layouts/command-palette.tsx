"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { 
  Sparkles, 
  LayoutDashboard, 
  Trophy, 
  Medal, 
  User, 
  Gem, 
  Sun, 
  Moon, 
  LogOut, 
  Search, 
  Terminal,
  Gift
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { playHapticPop, playPremiumUpgradeSound } from "@/lib/utils/sound";

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Setup options
  const options = [
    { id: "log", label: "Log Aura Event", icon: Sparkles, desc: "Describe a daily moment to rate it", path: "/dashboard?action=log" },
    { id: "feed", label: "Cosmic Aura Feed", icon: LayoutDashboard, desc: "Browse recent feed events", path: "/dashboard" },
    { id: "leaderboard", label: "Global Leaderboard", icon: Trophy, desc: "Check dynamic global rankings", path: "/leaderboard" },
    { id: "badges", label: "Achievements & Badges", icon: Medal, desc: "Check unlocked cosmic milestones", path: "/badges" },
    { id: "wrapped", label: "Monthly Aura Wrapped", icon: Gift, desc: "Swipe through your monthly recap & archetype", path: "/wrapped" },
    { id: "profile", label: "Profile Dashboard", icon: User, desc: "View your stats and charts", path: "/profile" },
    { id: "premium", label: "Upgrade to AuraMint+", icon: Gem, desc: "Unlock unlimited cosmic parameters", path: "/premium" },
    { id: "theme", label: `Toggle Theme (${theme === "dark" ? "Light" : "Dark"})`, icon: theme === "dark" ? Sun : Moon, desc: "Switch visual mode theme", path: "action:theme" },
    { id: "logout", label: "Sign Out", icon: LogOut, desc: "Sign out of your session", path: "action:logout" }
  ];

  // Filter options based on search query
  const filtered = options.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase()) ||
    opt.desc.toLowerCase().includes(search.toLowerCase())
  );

  // Listen to keyboard shortcut Meta+K or Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => {
          if (!prev) {
            playHapticPop();
          }
          return !prev;
        });
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Reset indices on search filter change
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      setSearch("");
    }
  }, [isOpen]);

  // Handle overlay interactions and options navigation
  function handleSelect(id: string, path: string) {
    playHapticPop();
    setIsOpen(false);

    if (path.startsWith("action:")) {
      const action = path.replace("action:", "");
      if (action === "theme") {
        setTheme(theme === "dark" ? "light" : "dark");
        toast.success(`Switched to ${theme === "dark" ? "light" : "dark"} mode!`);
      } else if (action === "logout") {
        const supabase = createClient();
        supabase.auth.signOut().then(() => {
          toast.success("See you soon! ✌️");
          router.push("/");
          router.refresh();
        });
      }
    } else {
      if (id === "log") {
        // Dispatch custom log event for immediate trigger on dashboard
        window.dispatchEvent(new CustomEvent("open-aura-log-modal"));
      }
      if (id === "premium") {
        playPremiumUpgradeSound();
      }
      router.push(path);
      router.refresh();
    }
  }

  // Keyboard accessibility controls
  function handleKeyboardNav(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        handleSelect(filtered[selectedIndex].id, filtered[selectedIndex].path);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/65 backdrop-blur-md p-4 pt-[12vh]">
          {/* Backdrop click portal trigger */}
          <div className="absolute inset-0 z-0" onClick={() => setIsOpen(false)} />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.2 }}
            ref={containerRef}
            className="glass-grain glass noise relative z-10 w-full max-w-xl overflow-hidden border border-border/40 p-0 rounded-[2rem] shadow-2xl bg-card/65"
          >
            {/* Search Input block */}
            <div className="flex items-center gap-3.5 border-b border-border/20 px-5 py-4">
              <Search className="h-4.5 w-4.5 text-muted-foreground/60 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyboardNav}
                placeholder="Search commands... (Press Arrow keys to navigate, Esc to close)"
                className="w-full bg-transparent text-xs font-semibold tracking-wide placeholder:text-muted-foreground/45 focus:outline-none"
              />
              <span className="rounded-lg bg-secondary/35 border border-border/20 px-2 py-1.5 text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground/80 shrink-0 select-none">
                Esc
              </span>
            </div>

            {/* Commands Search Result Grid */}
            <div className="max-h-[340px] overflow-y-auto p-2.5 space-y-1">
              {filtered.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center justify-center gap-2">
                  <Terminal className="h-6 w-6 text-muted-foreground/35 animate-pulse" />
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/50">No commands found</p>
                </div>
              ) : (
                filtered.map((opt, i) => {
                  const isSelected = i === selectedIndex;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleSelect(opt.id, opt.path)}
                      onMouseEnter={() => setSelectedIndex(i)}
                      className={cn(
                        "w-full flex items-center gap-4 text-left rounded-2xl p-3.5 transition-all border border-transparent",
                        isSelected
                          ? "bg-primary/10 border-primary/20 text-primary shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <div className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition border",
                        isSelected
                          ? "bg-primary/10 border-primary/20 text-primary"
                          : "bg-secondary/20 border-border/10 text-muted-foreground/80"
                      )}>
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold leading-tight text-foreground">{opt.label}</p>
                        <p className="text-[10px] leading-normal text-muted-foreground/60 mt-0.5">{opt.desc}</p>
                      </div>
                      {isSelected && (
                        <span className="rounded-lg bg-primary/10 px-2 py-1 text-[9px] font-extrabold uppercase tracking-widest text-primary shrink-0 select-none animate-pulse">
                          ↵ Enter
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Quick Helper portal footer info */}
            <div className="border-t border-border/20 bg-secondary/10 px-5 py-3 text-[10px] font-semibold text-muted-foreground/50 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="bg-secondary/40 border border-border/20 px-1 py-0.5 rounded text-[8px] font-black">⌘</span>
                <span className="bg-secondary/40 border border-border/20 px-1.5 py-0.5 rounded text-[8px] font-black">K</span>
                <span>or</span>
                <span className="bg-secondary/40 border border-border/20 px-1 py-0.5 rounded text-[8px] font-black">Ctrl</span>
                <span className="bg-secondary/40 border border-border/20 px-1.5 py-0.5 rounded text-[8px] font-black">K</span>
                <span>anywhere to toggle</span>
              </span>
              <span>Select with Enter</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
