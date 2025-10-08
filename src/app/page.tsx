import { redirect } from "next/navigation";

export default function Home() {
  // Server redirect avoids any client-side race with older gates or cached bundles
  redirect("/discover");
}
