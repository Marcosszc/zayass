import { useEffect, useState, type FormEvent } from 'react';
import { Crosshair, X } from 'lucide-react';
import type { ServicePoint, ServicePointInput, ServiceType } from '../types/point.ts';
import { validateDecimalCoordinate } from '../types/point.ts';

interface PointEditorPanelProps {
  editingPoint: ServicePoint | null;
  pickedCoords: { latitud: number; longitud: number } | null;
  isPickingLocation: boolean;
  onTogglePickLocation: () => void;
  onSave: (data: ServicePointInput, existingId?: string) => Promise<void>;
  onCancel: () => void;
}

export function PointEditorPanel({
  editingPoint,
  pickedCoords,
  isPickingLocation,
  onTogglePickLocation,
  onSave,
  onCancel,
}: PointEditorPanelProps) {
  const [nombre, setNombre] = useState(editingPoint?.nombre_punto ?? '');
  const [servicio, setServicio] = useState<ServiceType>(editingPoint?.servicio ?? 'inflado');
  const [horario, setHorario] = useState(editingPoint?.horario ?? '');
  const [referencia, setReferencia] = useState(editingPoint?.referencia_puesto ?? '');
  const [latStr, setLatStr] = useState(
    editingPoint ? editingPoint.latitud.toFixed(6) : ''
  );
  const [lngStr, setLngStr] = useState(
    editingPoint ? editingPoint.longitud.toFixed(6) : ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (editingPoint) {
      setNombre(editingPoint.nombre_punto);
      setServicio(editingPoint.servicio);
      setHorario(editingPoint.horario);
      setReferencia(editingPoint.referencia_puesto);
      setLatStr(editingPoint.latitud.toFixed(6));
      setLngStr(editingPoint.longitud.toFixed(6));
    } else {
      setNombre('');
      setServicio('inflado');
      setHorario('');
      setReferencia('');
      setLatStr('');
      setLngStr('');
    }
    setSubmitError(null);
  }, [editingPoint]);

  useEffect(() => {
    if (pickedCoords) {
      setLatStr(pickedCoords.latitud.toFixed(6));
      setLngStr(pickedCoords.longitud.toFixed(6));
    }
  }, [pickedCoords]);

  const latValidation =
    latStr.trim() === ''
      ? null
      : validateDecimalCoordinate(latStr, -90, 90, 'latitud');
  const lngValidation =
    lngStr.trim() === ''
      ? null
      : validateDecimalCoordinate(lngStr, -180, 180, 'longitud');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const trimmedName = nombre.trim();
    const trimmedHorario = horario.trim();
    const trimmedRef = referencia.trim();

    if (!trimmedName) {
      setSubmitError('Ingresá el nombre del punto.');
      return;
    }

    const latCheck = validateDecimalCoordinate(latStr, -90, 90, 'latitud');
    if (!latCheck.valid) {
      setSubmitError(latCheck.error || 'Latitud inválida.');
      return;
    }

    const lngCheck = validateDecimalCoordinate(lngStr, -180, 180, 'longitud');
    if (!lngCheck.valid) {
      setSubmitError(lngCheck.error || 'Longitud inválida.');
      return;
    }

    if (!trimmedHorario) {
      setSubmitError('Ingresá el horario de atención.');
      return;
    }

    if (!trimmedRef) {
      setSubmitError('Ingresá la referencia del puesto.');
      return;
    }

    setSubmitting(true);
    try {
      await onSave(
        {
          nombre_punto: trimmedName,
          latitud: latCheck.numberValue,
          longitud: lngCheck.numberValue,
          servicio,
          horario: trimmedHorario,
          referencia_puesto: trimmedRef,
        },
        editingPoint?.id
      );
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'No se pudo guardar el punto.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {editingPoint ? 'Editar punto de servicio' : 'Agregar nuevo punto'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Coordenadas en grados decimales (-90 a 90 / -180 a 180)
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cerrar formulario"
          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
        {submitError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
            {submitError}
          </div>
        )}

        <div>
          <label htmlFor="nombre_punto" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Nombre del punto
          </label>
          <input
            id="nombre_punto"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Estación Plaza Italia — Inflado Rápido"
            maxLength={140}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
          />
        </div>

        <div>
          <span className="block text-xs font-semibold text-slate-700 mb-1.5">
            Servicio disponible
          </span>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { value: 'inflado', label: 'Inflado' },
                { value: 'herramientas', label: 'Herramientas' },
                { value: 'inflado y herramientas', label: 'Ambos' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setServicio(option.value)}
                className={`px-2.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  servicio === option.value
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Ubicación decimal</span>
            <button
              type="button"
              onClick={onTogglePickLocation}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                isPickingLocation
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              {isPickingLocation ? 'Selección activa en mapa' : 'Elegir en el mapa'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="latitud" className="block text-xs text-slate-600 mb-1">
                Latitud (-90 a 90)
              </label>
              <input
                id="latitud"
                type="text"
                inputMode="decimal"
                value={latStr}
                onChange={(e) => setLatStr(e.target.value)}
                placeholder="-34.581120"
                className={`w-full px-3 py-2 text-sm font-mono bg-white border rounded-lg focus:outline-none focus:ring-2 ${
                  latValidation && !latValidation.valid
                    ? 'border-red-400 focus:ring-red-500/20 focus:border-red-600'
                    : 'border-slate-300 focus:ring-teal-700/20 focus:border-teal-700'
                }`}
              />
              {latValidation && !latValidation.valid && (
                <p className="mt-1 text-[11px] text-red-700">{latValidation.error}</p>
              )}
            </div>

            <div>
              <label htmlFor="longitud" className="block text-xs text-slate-600 mb-1">
                Longitud (-180 a 180)
              </label>
              <input
                id="longitud"
                type="text"
                inputMode="decimal"
                value={lngStr}
                onChange={(e) => setLngStr(e.target.value)}
                placeholder="-58.420950"
                className={`w-full px-3 py-2 text-sm font-mono bg-white border rounded-lg focus:outline-none focus:ring-2 ${
                  lngValidation && !lngValidation.valid
                    ? 'border-red-400 focus:ring-red-500/20 focus:border-red-600'
                    : 'border-slate-300 focus:ring-teal-700/20 focus:border-teal-700'
                }`}
              />
              {lngValidation && !lngValidation.valid && (
                <p className="mt-1 text-[11px] text-red-700">{lngValidation.error}</p>
              )}
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="horario" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Horario
          </label>
          <input
            id="horario"
            type="text"
            value={horario}
            onChange={(e) => setHorario(e.target.value)}
            placeholder="Ej. 07:00 a 22:00 / 24 horas"
            maxLength={140}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
          />
        </div>

        <div>
          <label htmlFor="referencia_puesto" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Referencia del puesto
          </label>
          <textarea
            id="referencia_puesto"
            rows={3}
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Ej. Tótem verde junto al acceso principal de la bicisenda"
            maxLength={260}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 resize-none"
          />
        </div>

        <div className="pt-2 flex items-center gap-2.5">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
          >
            {submitting
              ? 'Guardando...'
              : editingPoint
              ? 'Guardar cambios'
              : 'Agregar punto'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
