"use client";

import { useState } from "react";
import { PlusCircle, Edit, Trash2, ChevronDown } from "lucide-react";
import { FlightForm } from "@/components/admin/FlightForm";

export default function VuelosDashboardPage() {
  const [isCrearOpen, setIsCrearOpen] = useState(false);

  return (
    <div className="max-w-6xl mx-auto p-6 text-white">
      <h1 className="text-3xl font-bold mb-2">Gestión de Vuelos</h1>
      <p className="text-gray-400 mb-8">
        Administra las rutas, horarios y tarifas de la aerolínea.
      </p>

      <div className="space-y-4">
        {/* Accordion: Crear Vuelo */}
        <div className={`bg-neutral-900 border ${isCrearOpen ? 'border-indigo-500 shadow-lg shadow-indigo-500/10' : 'border-neutral-800'} rounded-xl overflow-hidden transition-all duration-300`}>
          <button
            onClick={() => setIsCrearOpen(!isCrearOpen)}
            className="w-full flex items-center justify-between p-6 text-left hover:bg-neutral-800/50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-lg">
                <PlusCircle size={24} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Crear Vuelo</h2>
                <p className="text-gray-400 text-sm mt-1">Da de alta un nuevo vuelo en el sistema.</p>
              </div>
            </div>
            <ChevronDown 
              className={`text-gray-400 transition-transform duration-300 w-6 h-6 ${isCrearOpen ? 'rotate-180 text-indigo-400' : ''}`} 
            />
          </button>
          
          <div 
            className={`transition-all duration-500 ease-in-out overflow-hidden ${
              isCrearOpen ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="p-6 pt-0 border-t border-neutral-800">
              <FlightForm />
            </div>
          </div>
        </div>

        {/* Accordion: Modificar Vuelo (Deshabilitado) */}
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden opacity-60 cursor-not-allowed relative">
          <div className="absolute top-6 right-6 bg-neutral-800 text-gray-300 text-xs font-bold px-3 py-1 rounded-full border border-neutral-700">
            En Desarrollo
          </div>
          <div className="flex items-center gap-4 p-6">
            <div className="p-3 bg-neutral-800 text-gray-500 rounded-lg">
              <Edit size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-300">Modificar Vuelo</h2>
              <p className="text-gray-500 text-sm mt-1">Edita la información y tarifas de los vuelos existentes.</p>
            </div>
          </div>
        </div>

        {/* Accordion: Eliminar Vuelo (Deshabilitado) */}
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden opacity-60 cursor-not-allowed relative">
          <div className="absolute top-6 right-6 bg-neutral-800 text-gray-300 text-xs font-bold px-3 py-1 rounded-full border border-neutral-700">
            En Desarrollo
          </div>
          <div className="flex items-center gap-4 p-6">
            <div className="p-3 bg-neutral-800 text-gray-500 rounded-lg">
              <Trash2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-300">Eliminar Vuelo</h2>
              <p className="text-gray-500 text-sm mt-1">Da de baja vuelos que ya no operan.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
