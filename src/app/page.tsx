import { api } from "@/trpc/server";
import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/server/auth";
import { Button } from "@/components/ui/button";
import Temp from "./temp";
export default async function Home() {
  const session = await getServerAuthSession();

  const shouldSetup = await api.setup.getRequiresSetup();
  if (shouldSetup) {
    redirect("/setup");
  }

  if (!session) {
    redirect("/api/auth/signin");
  }

  function jobsTest() {}

  return (
    <main className="flex min-h-screen flex-col bg-slate-900 text-white">
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
          Hi,{" "}
          <span className="text-fuchsia-600">
            {session.user.name!.split(" ")[0]}.
          </span>
        </h1>
        <Temp />
      </div>
    </main>
  );
}
