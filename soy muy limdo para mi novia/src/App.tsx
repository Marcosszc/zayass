import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Maximize2,
  Navigation,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { DeployGuideView } from './components/DeployGuideView.tsx';
import { OsmMap } from './components/OsmMap.tsx';
import { PointEditorPanel } from './components/PointEditorPanel.tsx';
import type { ServiceFilter, ServicePoint, ServicePointInput } from './types/point.ts';
import {
  SERVICE_LABELS,
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsMultiPointRouteUrl,
  buildGoogleMapsViewUrl,
  buildGoogleMyMapsKml,
  matchesServiceFilter,
} from './types/point.ts';

type ActiveTab = 'workspace' | 'deploy';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('workspace');
  const [points, setPoints] = useState<ServicePoint[]>([]);
  const [storageMode, setStorageMode] = useState<'supabase' | 'local'>('local');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<ServicePoint | null>(null);
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{ latitud: number; longitud: number } | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedCoordsId, setCopiedCoordsId] = useState<string | null>(null);
  const [fitAllTrigger, setFitAllTrigger] = useState(0);

  const loadPoints = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/points');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudieron cargar los puntos.');
      }
      const list = Array.isArray(data.points) ? (data.points as ServicePoint[]) : [];
      setPoints(list);
      if (data.storage === 'supabase' || data.storage === 'local') {
        setStorageMode(data.storage);
      }
      setSelectedPointId((prev) => {
        if (prev && list.some((p) => p.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPoints();
  }, [loadPoints]);

  const filteredPoints = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return points.filter((p) => {
      if (!matchesServiceFilter(p.servicio, serviceFilter)) return false;
      if (!q) return true;
      return (
        p.nombre_punto.toLowerCase().includes(q) ||
        p.referencia_puesto.toLowerCase().includes(q) ||
        p.horario.toLowerCase().includes(q)
      );
    });
  }, [points, serviceFilter, searchQuery]);

  const selectedPoint = useMemo(
    () => points.find((p) => p.id === selectedPointId) ?? null,
    [points, selectedPointId]
  );

  const counts = useMemo(
    () => ({
      todos: points.length,
      inflado: points.filter((p) => matchesServiceFilter(p.servicio, 'inflado')).length,
      herramientas: points.filter((p) => matchesServiceFilter(p.servicio, 'herramientas')).length,
    }),
    [points]
  );

  function openCreateForm() {
    setActiveTab('workspace');
    setEditingPoint(null);
    setPickedCoords(null);
    setIsPickingLocation(false);
    setEditorOpen(true);
  }

  function openEditForm(point: ServicePoint) {
    setEditingPoint(point);
    setPickedCoords({ latitud: point.latitud, longitud: point.longitud });
    setIsPickingLocation(false);
    setEditorOpen(true);
    setSelectedPointId(point.id);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingPoint(null);
    setIsPickingLocation(false);
    setPickedCoords(null);
  }

  async function handleSavePoint(input: ServicePointInput, existingId?: string) {
    const endpoint = existingId ? `/api/points/${encodeURIComponent(existingId)}` : '/api/points';
    const method = existingId ? 'PUT' : 'POST';
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'No se pudo guardar el punto.');
    }
    const saved = data.point as ServicePoint;
    setPoints((prev) => {
      if (existingId) {
        return prev.map((p) => (p.id === existingId ? saved : p));
      }
      return [saved, ...prev];
    });
    setSelectedPointId(saved.id);
    closeEditor();
  }

  async function handleDeletePoint(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/points/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo eliminar el punto.');
      }
      setPoints((prev) => {
        const next = prev.filter((p) => p.id !== id);
        if (selectedPointId === id) {
          setSelectedPointId(next[0]?.id ?? null);
        }
        return next;
      });
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar el punto.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSeedExamples() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/points/seed', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudieron cargar los ejemplos.');
      }
      const list = Array.isArray(data.points) ? (data.points as ServicePoint[]) : [];
      setPoints(list);
      setSelectedPointId(list[0]?.id ?? null);
      setFitAllTrigger((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar ejemplos.');
    } finally {
      setLoading(false);
    }
  }

  function handleExportKml() {
    const source = filteredPoints.length > 0 ? filteredPoints : points;
    if (source.length === 0) return;
    const kml = buildGoogleMyMapsKml(source);
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'biciposta-google-maps.kml';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleCopyCoordinates(point: ServicePoint) {
    const text = `${point.latitud.toFixed(6)}, ${point.longitud.toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCoordsId(point.id);
      setTimeout(() => setCopiedCoordsId(null), 1800);
    } catch {
      // Ignorar si el navegador restringe portapapeles
    }
  }

  const multiRouteUrl = buildGoogleMapsMultiPointRouteUrl(filteredPoints);

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zonas separadas por gap-8 */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-8 shrink-0">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('workspace');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          BiciPosta
        </a>

        <nav className="flex items-center gap-6 text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('workspace')}
            className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors border-b-2 ${
              activeTab === 'workspace'
                ? 'text-slate-900 border-teal-700'
                : 'text-slate-500 border-transparent hover:text-slate-900'
            }`}
          >
            Mapa y Puntos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('deploy')}
            className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors border-b-2 ${
              activeTab === 'deploy'
                ? 'text-slate-900 border-teal-700'
                : 'text-slate-500 border-transparent hover:text-slate-900'
            }`}
          >
            Render, Supabase y GitHub
          </button>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo punto
          </button>
        </div>
      </header>

      {activeTab === 'deploy' ? (
        <DeployGuideView points={points} storageMode={storageMode} />
      ) : (
        <main className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* Columna izquierda: Listado CRUD o Formulario */}
          <aside className="w-full lg:w-[440px] shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col min-h-[420px] lg:min-h-0">
            {editorOpen ? (
              <PointEditorPanel
                editingPoint={editingPoint}
                pickedCoords={pickedCoords}
                isPickingLocation={isPickingLocation}
                onTogglePickLocation={() => setIsPickingLocation((v) => !v)}
                onSave={handleSavePoint}
                onCancel={closeEditor}
              />
            ) : (
              <>
                <div className="p-4 border-b border-slate-200 space-y-3 shrink-0">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar por nombre, horario o referencia..."
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                    />
                  </div>

                  {/* Filtro segmentado por servicio: Todos / Inflado / Herramientas */}
                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
                    {(
                      [
                        { id: 'todos', label: `Todos (${counts.todos})` },
                        { id: 'inflado', label: `Inflado (${counts.inflado})` },
                        { id: 'herramientas', label: `Herramientas (${counts.herramientas})` },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setServiceFilter(tab.id)}
                        className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap truncate ${
                          serviceFilter === tab.id
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="mx-4 mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center justify-between gap-2">
                    <span>{error}</span>
                    <button
                      type="button"
                      onClick={loadPoints}
                      className="font-semibold underline shrink-0"
                    >
                      Reintentar
                    </button>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
                  {loading ? (
                    <div className="p-4 space-y-4">
                      {[1, 2, 3].map((row) => (
                        <div key={row} className="space-y-2 animate-pulse">
                          <div className="h-4 bg-slate-200 rounded w-3/4" />
                          <div className="h-3 bg-slate-100 rounded w-1/2" />
                          <div className="h-3 bg-slate-100 rounded w-2/3" />
                        </div>
                      ))}
                    </div>
                  ) : filteredPoints.length === 0 ? (
                    <div className="p-8 text-center space-y-3">
                      <p className="text-sm font-medium text-slate-800">
                        {points.length === 0
                          ? 'Todavía no hay puntos registrados.'
                          : 'Ningún punto coincide con el filtro actual.'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {points.length === 0
                          ? 'Podés cargar los 3 puntos de ejemplo o agregar uno nuevo manualmente.'
                          : 'Probá cambiar el servicio seleccionado o limpiar la búsqueda.'}
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                        {points.length === 0 ? (
                          <button
                            type="button"
                            onClick={handleSeedExamples}
                            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                          >
                            Cargar 3 ejemplos
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setServiceFilter('todos');
                              setSearchQuery('');
                            }}
                            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                          >
                            Limpiar filtros
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={openCreateForm}
                          className="px-3.5 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
                        >
                          Agregar punto
                        </button>
                      </div>
                    </div>
                  ) : (
                    filteredPoints.map((point) => {
                      const isSelected = point.id === selectedPointId;
                      const isConfirmingDelete = confirmDeleteId === point.id;

                      return (
                        <div
                          key={point.id}
                          className={`p-4 transition-colors ${
                            isSelected ? 'bg-teal-50/70' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedPointId(point.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedPointId(point.id);
                              }
                            }}
                            className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 rounded"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                                {point.nombre_punto}
                              </h3>
                              <span
                                className={`text-[11px] font-semibold shrink-0 ${
                                  point.servicio === 'inflado'
                                    ? 'text-teal-800'
                                    : point.servicio === 'herramientas'
                                    ? 'text-amber-800'
                                    : 'text-slate-800'
                                }`}
                              >
                                {SERVICE_LABELS[point.servicio]}
                              </span>
                            </div>

                            <div className="mt-1 text-xs text-slate-600 flex flex-wrap items-center gap-1.5">
                              <span>Horario: {point.horario}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono text-[11px] text-slate-500">
                                {point.latitud.toFixed(6)}, {point.longitud.toFixed(6)}
                              </span>
                            </div>

                            <p className="mt-1.5 text-xs text-slate-700 leading-relaxed">
                              {point.referencia_puesto}
                            </p>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                            <a
                              href={buildGoogleMapsViewUrl(point.latitud, point.longitud)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900 whitespace-nowrap"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Ver en Google Maps
                            </a>

                            <div className="flex items-center gap-1.5">
                              {isConfirmingDelete ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={deletingId === point.id}
                                    onClick={() => handleDeletePoint(point.id)}
                                    className="px-2.5 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors whitespace-nowrap"
                                  >
                                    {deletingId === point.id ? 'Borrando...' : 'Confirmar'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-md whitespace-nowrap"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEditForm(point)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap"
                                  >
                                    <Pencil className="w-3 h-3" />
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(point.id)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 hover:text-red-900 hover:bg-red-50 rounded-md transition-colors whitespace-nowrap"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    Eliminar
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </aside>

          {/* Columna derecha: Mapa OpenStreetMap + Opciones de Google Maps */}
          <section className="flex-1 flex flex-col min-w-0 min-h-[500px] lg:min-h-0 bg-slate-100">
            <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-600 flex items-center gap-2 min-w-0">
                <span className="font-semibold text-slate-900 whitespace-nowrap">
                  OpenStreetMap
                </span>
                <span aria-hidden="true">·</span>
                <span className="truncate">
                  {isPickingLocation
                    ? 'Modo captura activo: hacé clic en el mapa para completar latitud y longitud'
                    : selectedPoint
                    ? `${selectedPoint.nombre_punto} (${selectedPoint.latitud.toFixed(6)}, ${selectedPoint.longitud.toFixed(6)})`
                    : 'Seleccioná un registro de la lista o un marcador en el mapa'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {selectedPoint && (
                  <a
                    href={buildGoogleMapsViewUrl(selectedPoint.latitud, selectedPoint.longitud)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Abrir en Google Maps
                  </a>
                )}

                {multiRouteUrl && (
                  <a
                    href={multiRouteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Ruta en Google Maps
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleExportKml}
                  disabled={filteredPoints.length === 0 && points.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exportar KML
                </button>

                <button
                  type="button"
                  onClick={() => setFitAllTrigger((v) => v + 1)}
                  disabled={filteredPoints.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  Ajustar vista
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-[420px] relative">
              <OsmMap
                points={filteredPoints}
                selectedPointId={selectedPointId}
                onSelectPoint={(point) => setSelectedPointId(point.id)}
                isPickingLocation={editorOpen && isPickingLocation}
                pickedCoords={pickedCoords}
                onPickLocation={(lat, lng) => setPickedCoords({ latitud: lat, longitud: lng })}
                fitAllTrigger={fitAllTrigger}
              />
            </div>

            {selectedPoint && !editorOpen && (
              <div className="bg-white border-t border-slate-200 px-5 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shrink-0">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-sm text-slate-900">
                      {selectedPoint.nombre_punto}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{SERVICE_LABELS[selectedPoint.servicio]}</span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedPoint.horario}</span>
                  </div>
                  <p className="text-xs text-slate-600 truncate">
                    {selectedPoint.referencia_puesto}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyCoordinates(selectedPoint)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                  >
                    {copiedCoordsId === selectedPoint.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-teal-700" />
                        Coordenadas copiadas
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        {selectedPoint.latitud.toFixed(6)}, {selectedPoint.longitud.toFixed(6)}
                      </>
                    )}
                  </button>
                  <a
                    href={buildGoogleMapsDirectionsUrl(selectedPoint.latitud, selectedPoint.longitud)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Cómo llegar en Google Maps
                  </a>
                </div>
              </div>
            )}
          </section>
        </main>
      )}
    </div>
  );
}
