"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

/** Phone navigation: toggles the sidebar as a slide-in drawer on small screens. */
export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    const shell = document.querySelector(".app-shell");
    shell?.classList.toggle("nav-open", open);
    return () => { shell?.classList.remove("nav-open"); };
  }, [open]);

  return <>
    <button type="button" className="icon-button mobile-menu" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      {open ? <X size={18} /> : <Menu size={18} />}
    </button>
    {open && <button type="button" className="nav-overlay" aria-label="Close menu" onClick={() => setOpen(false)} />}
  </>;
}
