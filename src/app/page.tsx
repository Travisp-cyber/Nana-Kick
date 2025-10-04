"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const router = useRouter();
  
  // Redirect to discover page by default
  useEffect(() => {
    router.push('/discover');
  }, [router]);


  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Redirecting...</p>
    </div>
  );
}
