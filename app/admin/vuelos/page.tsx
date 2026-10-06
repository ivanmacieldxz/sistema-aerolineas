"use client";

import { useState } from "react";
import { PlusCircle, Edit, Trash2, ChevronDown } from "lucide-react";
import { FlightForm } from "@/components/admin/FlightForm";

export default function VuelosDashboardPage() {
  const [isCrearOpen, setIsCrearOpen] = useState(false);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <p className="text-xs font-semibold tracking-[0.12em] text-muted">
        ADMINISTRACIÓN
      </p>
      <h1 className="mt-1 text-3xl font-semibold">Gestión de Vuelos</h1>
      <p className="mt-2 mb-8 text-muted">
        Administra las rutas, horarios y tarifas de la aerolínea.
      </p>

      <div className="space-y-4">
        {/* Accordion: Crear Vuelo */}
        <div
          className={`overflow-hidden rounded-lg border bg-surface transition-all duration-300 ${
            isCrearOpen
              ? "border-accent shadow-[0_16px_45px_-28px_rgba(16,46,39,0.42)]"
              : "border-line"
          }`}
        >
          <button
            onClick={() => setIsCrearOpen(!isCrearOpen)}
            className="flex w-full items-center justify-between p-6 text-left transition-colors hover:bg-soft/60"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-soft p-3 text-accent">
                <PlusCircle size={24} />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Crear Vuelo</h2>
                <p className="mt-1 text-sm text-muted">
                  Da de alta un nuevo vuelo en el sistema.
                </p>
              </div>
            </div>
            <ChevronDown
              className={`h-6 w-6 transition-transform duration-300 ${
                isCrearOpen ? "rotate-180 text-accent" : "text-muted"
              }`}
            />
          </button>

          <div
            className={`overflow-hidden transition-all duration-500 ease-in-out ${
              isCrearOpen ? "max-h-[3000px] opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="border-t border-line p-6 pt-6">
              <FlightForm />
            </div>
          </div>
        </div>

        {/* Accordion: Modificar Vuelo (Deshabilitado) */}
        <div className="relative cursor-not-allowed overflow-hidden rounded-lg border border-line bg-surface/60 p-6 opacity-60">
          <div className="absolute right-6 top-6 rounded-full border border-line-strong bg-soft px-3 py-1 text-xs font-bold text-muted">
            En Desarrollo
          </div>
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-soft p-3 text-muted">
              <Edit size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Modificar Vuelo</h2>
              <p className="mt-1 text-sm text-muted">
                Edita la información y tarifas de los vuelos existentes.
              </p>
            </div>
          </div>
        </div>

        {/* Accordion: Eliminar Vuelo (Deshabilitado) */}
        <div className="relative cursor-not-allowed overflow-hidden rounded-lg border border-line bg-surface/60 p-6 opacity-60">
          <div className="absolute right-6 top-6 rounded-full border border-line-strong bg-soft px-3 py-1 text-xs font-bold text-muted">
            En Desarrollo
          </div>
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-soft p-3 text-muted">
              <Trash2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Eliminar Vuelo</h2>
              <p className="mt-1 text-sm text-muted">
                Da de baja vuelos que ya no operan.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
