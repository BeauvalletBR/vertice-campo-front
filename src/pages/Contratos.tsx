import { FileSignature } from "lucide-react";

export default function Contratos() {
  return (
    <section className="min-h-full bg-[#F5F8FB] p-4 sm:p-6 lg:p-8">
      <div className="rounded-2xl border border-[#D6E1EB] bg-white p-6 shadow-[0_8px_24px_rgba(23,61,110,0.07)]">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#173D6E] text-white">
            <FileSignature className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#173D6E]">
            Contratos
          </h1>
        </div>
      </div>
    </section>
  );
}
