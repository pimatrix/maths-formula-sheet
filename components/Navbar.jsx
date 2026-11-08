"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BP, fetchMe, getSession, logout } from "../lib/client";

export default function Navbar() {
  const [me, setMe] = useState(undefined); // undefined = loading, null = logged out

  useEffect(() => {
    let alive = true;
    async function load() {
      const s = getSession();
      if (!s) {
        if (alive) setMe(null);
        return;
      }
      const m = await fetchMe();
      if (alive) setMe(m);
    }
    load();
    window.addEventListener("fs-auth", load);
    return () => {
      alive = false;
      window.removeEventListener("fs-auth", load);
    };
  }, []);

  async function onLogout() {
    await logout();
    setMe(null);
    window.location.href = BP + "/";
  }

  return (
    <nav className="fs-navbar">
      <div className="fs-navbar-inner">
        <Link className="fs-brand" href="/">
          Maths <span>Formula Sheet</span>
        </Link>
        <div className="fs-navlinks">
          <Link className="fs-navlink" href="/">Formulas</Link>
          <Link className="fs-navlink cta" href="/add">+ Add Formula</Link>
          {me && me.role === "admin" && (
            <Link className="fs-navlink admin" href="/dashboard">Dashboard</Link>
          )}
          {me === undefined ? null : me ? (
            <>
              <Link className="fs-navlink" href="/profile">My Profile</Link>
              <span className="fs-user-chip">{me.user.name || me.user.email}</span>
              <button className="fs-navbtn" onClick={onLogout}>Logout</button>
            </>
          ) : (
            <Link className="fs-navlink" href="/login">Login / Sign up</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
