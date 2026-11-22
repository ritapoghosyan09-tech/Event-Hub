/** Remounts on every navigation, so each new page eases in (pure CSS: no JS needed, honours reduced motion). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
