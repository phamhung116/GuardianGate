"use client";

import { useEffect } from "react";

export default function AuthRedirectPage() {
  useEffect(() => {
    window.location.replace("/");
  }, []);

  return <p>Đang hoàn tất phiên đăng nhập…</p>;
}
