import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, Plus, Trash2, Download, Upload, Eraser } from "lucide-react";
import {
    useVolumes,
    useCreateVolume,
    useRemoveVolume,
    usePruneVolumes,
} from "@/hooks/useVolumes";
import { api } from "@/api/client";
import { toast } from "sonner";

function TooltipButton({ onClick, className, title, disabled, children }: {
    onClick?: () => void; className?: string; title: string; disabled?: boolean; children: React.ReactNode
}) {
    return (
        <div className="relative group">
            <button onClick={onClick} className={className} disabled={disabled}>
                {children}
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-surface border border-border rounded text-xs text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {title}
            </div>
        </div>
    );
}

export function VolumesPage() {
    const { t } = useTranslation();
    const [createDialog, setCreateDialog] = useState(false);
    const [newName, setNewName] = useState("");
    const [hostPath, setHostPath] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [importTarget, setImportTarget] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data: volumesData, isLoading, error, refetch } = useVolumes();
    const volumes = volumesData ?? [];
    const createMut = useCreateVolume();
    const removeMut = useRemoveVolume();
    const pruneMut = usePruneVolumes();

    const handleCreate = async () => {
        if (!newName.trim()) return;
        try {
            await createMut.mutateAsync({ name: newName.trim(), device: hostPath.trim() || undefined });
            toast.success("Volume created");
            setCreateDialog(false);
            setNewName("");
            setHostPath("");
        } catch (e: any) {
            toast.error(e.message || "Create failed");
        }
    };

    const handleRemove = async (name: string) => {
        try {
            await removeMut.mutateAsync({ name, force: true });
            toast.success("Volume removed");
            setDeleteTarget(null);
        } catch (e: any) {
            toast.error(e.message || "Remove failed");
        }
    };

    const handleExport = async (name: string) => {
        try {
            const blob = await api.exportVolume(name);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${name}.tar`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success(t("volumes.exportSuccess"));
        } catch (e: any) {
            toast.error(e.message || "Export failed");
        }
    };

    const handleImportFile = async (file: File) => {
        if (!importTarget) return;
        try {
            await api.importVolume(importTarget, file);
            toast.success(t("volumes.importSuccess"));
            setImportTarget(null);
        } catch (e: any) {
            toast.error(e.message || "Import failed");
        }
    };

    const handlePrune = async () => {
        try {
            const result = await pruneMut.mutateAsync();
            toast.success(t("volumes.pruneResult", { count: result.pruned }));
        } catch (e: any) {
            toast.error(e.message || "Prune failed");
        }
    };

    return (
        <div className="space-y-4">
            <input
                ref={fileInputRef}
                type="file"
                accept=".tar,.tar.gz,.tgz"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImportFile(file);
                    e.target.value = "";
                }}
            />

            <div className="flex items-center justify-between">
                <h2 className="text-base font-bold tracking-wider text-text-primary uppercase">
                    {t("sidebar.volumes")}
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handlePrune}
                        disabled={pruneMut.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded hover:bg-amber-500/20 transition-all font-semibold disabled:opacity-50"
                        title={t("volumes.prune")}
                    >
                        <Eraser size={14} /> {t("volumes.prune")}
                    </button>
                    <button
                        onClick={() => setCreateDialog(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded hover:bg-emerald-500/20 transition-all font-semibold"
                    >
                        <Plus size={14} /> {t("common.create")}
                    </button>
                    <button
                        onClick={() => refetch()}
                        title={t('common.refresh')}
                        className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
                    >
                        <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="border border-red-500/30 bg-red-500/5 rounded px-4 py-2.5 text-sm text-red-400">
                    {error.message}
                </div>
            )}

            <div className="border border-border rounded overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-surface-raised text-text-secondary border-b border-border">
                            <th className="px-4 py-3 text-left font-semibold text-text-muted text-xs uppercase tracking-wider w-1/4">
                                {t("volumes.name")}
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-text-muted text-xs uppercase tracking-wider">
                                {t("volumes.mountPoint")}
                            </th>
                            <th className="px-4 py-3 text-right font-semibold text-text-muted text-xs uppercase tracking-wider w-[120px]">
                                {t("common.actions")}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {volumes.map((v) => (
                            <tr key={v.name} className="hover:bg-surface-raised/50 transition-colors">
                                <td className="px-4 py-3 text-text-primary font-semibold font-mono truncate max-w-[200px]">
                                    {v.name}
                                </td>
                                <td className="px-4 py-3 text-text-muted font-mono text-xs truncate max-w-[300px]" title={v.mountPoint}>
                                    {v.mountPoint}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <TooltipButton
                                            onClick={() => handleExport(v.name)}
                                            className="p-1.5 text-text-secondary hover:text-blue-400 transition-colors"
                                            title={t("volumes.export")}
                                        >
                                            <Download size={14} />
                                        </TooltipButton>
                                        <TooltipButton
                                            onClick={() => setImportTarget(v.name)}
                                            className="p-1.5 text-text-secondary hover:text-emerald-400 transition-colors"
                                            title={t("volumes.import")}
                                        >
                                            <Upload size={14} />
                                        </TooltipButton>
                                        <TooltipButton
                                            onClick={() => setDeleteTarget(v.name)}
                                            className="p-1.5 text-text-secondary hover:text-red-400 transition-colors"
                                            title={t("common.remove")}
                                        >
                                            <Trash2 size={14} />
                                        </TooltipButton>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {volumes.length === 0 && (
                            <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-text-secondary font-medium">
                                    {t("volumes.noData")}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {createDialog && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">
                            {t("volumes.createTitle")}
                        </h3>
                        <input
                            type="text"
                            placeholder={t("volumes.namePlaceholder")}
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full bg-surface-raised border border-border rounded px-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                            autoFocus
                        />
                        <input
                            type="text"
                            placeholder={t("volumes.devicePlaceholder")}
                            value={hostPath}
                            onChange={(e) => setHostPath(e.target.value)}
                            className="w-full bg-surface-raised border border-border rounded px-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent font-mono"
                        />
                        <div className="flex justify-end gap-2 text-sm pt-2">
                            <button onClick={() => { setCreateDialog(false); setNewName(""); setHostPath(""); }}
                                className="px-4 py-2 border border-border rounded hover:bg-surface-raised transition-colors text-text-secondary">
                                {t("common.cancel")}
                            </button>
                            <button onClick={handleCreate} disabled={createMut.isPending}
                                className="px-4 py-2 bg-accent text-background rounded hover:bg-accent/90 transition-colors font-semibold disabled:opacity-50">
                                {createMut.isPending ? t("common.loading") : t("common.create")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {importTarget && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">
                            {t("volumes.importTitle")}
                        </h3>
                        <p className="text-sm text-text-secondary">
                            {t("volumes.importDesc", { name: importTarget })}
                        </p>
                        <div onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-accent transition-colors">
                            <Upload size={24} className="mx-auto mb-2 text-text-muted" />
                            <p className="text-sm text-text-secondary">Click to select .tar file</p>
                        </div>
                        <div className="flex justify-end gap-2 text-sm pt-2">
                            <button onClick={() => setImportTarget(null)}
                                className="px-4 py-2 border border-border rounded hover:bg-surface-raised transition-colors text-text-secondary">
                                {t("common.cancel")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {deleteTarget && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">
                            {t("common.remove")}
                        </h3>
                        <p className="text-sm text-text-secondary">
                            {t("volumes.removeConfirm", { name: deleteTarget })}
                        </p>
                        <div className="flex justify-end gap-2 text-sm pt-2">
                            <button onClick={() => setDeleteTarget(null)}
                                className="px-4 py-2 border border-border rounded hover:bg-surface-raised transition-colors text-text-secondary">
                                {t("common.cancel")}
                            </button>
                            <button onClick={() => handleRemove(deleteTarget)}
                                className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 transition-colors font-semibold">
                                {t("common.remove")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
