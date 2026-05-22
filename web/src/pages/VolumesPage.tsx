import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, Plus, Trash2 } from "lucide-react";
import {
    useVolumes,
    useCreateVolume,
    useRemoveVolume,
} from "@/hooks/useVolumes";
import { toast } from "sonner";

export function VolumesPage() {
    const { t } = useTranslation();
    const [createDialog, setCreateDialog] = useState(false);
    const [newName, setNewName] = useState("");
    const [hostPath, setHostPath] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    const { data: volumesData, isLoading, error, refetch } = useVolumes();
    const volumes = volumesData ?? [];
    const createMut = useCreateVolume();
    const removeMut = useRemoveVolume();

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

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-base font-bold tracking-wider text-text-primary uppercase">
                    {t("sidebar.volumes")}
                </h2>
                <div className="flex items-center gap-2">
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
                        <RefreshCw
                            size={16}
                            className={isLoading ? "animate-spin" : ""}
                        />
                    </button>
                </div>
            </div>

            {error && (
                <div className="border border-red-500/30 bg-red-500/5 rounded px-4 py-2.5 text-sm text-red-400">
                    {error.message}
                </div>
            )}

            {/* Main List Table */}
            <div className="border border-border rounded overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-surface-raised text-text-secondary border-b border-border">
                            <th className="px-4 py-3 text-left font-semibold text-text-muted text-xs uppercase tracking-wider">
                                {t("common.name")}
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-text-muted text-xs uppercase tracking-wider">
                                {t("volumes.mountPoint")}
                            </th>
                            <th className="px-4 py-3 text-right font-semibold text-text-muted text-xs uppercase tracking-wider">
                                {t("common.actions")}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {volumes.map((v) => (
                            <tr
                                key={v.name}
                                className="hover:bg-surface-raised/50 transition-colors"
                            >
                                <td className="px-4 py-3 text-text-primary font-semibold font-mono">
                                    {v.name}
                                </td>
                                <td className="px-4 py-3 text-text-muted font-mono text-xs">
                                    {v.mountPoint}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <button
                                        onClick={() => setDeleteTarget(v.name)}
                                        className="p-1.5 text-text-secondary hover:text-red-400 transition-colors"
                                        title={t("common.remove") || "Remove"}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {volumes.length === 0 && (
                            <tr>
                                <td
                                    colSpan={3}
                                    className="px-4 py-8 text-center text-text-secondary font-medium"
                                >
                                    {t("volumes.noData")}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create Volume Dialog */}
            {createDialog && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">
                            {t("volumes.createTitle") || "Create Volume"}
                        </h3>
                        <input
                            type="text"
                            placeholder={
                                t("volumes.namePlaceholder") || "Volume name"
                            }
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full bg-surface-raised border border-border rounded px-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                            autoFocus
                        />
                        <input
                            type="text"
                            placeholder={t("volumes.devicePlaceholder") || "Host path (optional, e.g. /data/nginx)"}
                            value={hostPath}
                            onChange={(e) => setHostPath(e.target.value)}
                            className="w-full bg-surface-raised border border-border rounded px-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent font-mono"
                        />
                        <div className="flex justify-end gap-2 text-sm pt-2">
                            <button
                                onClick={() => {
                                    setCreateDialog(false);
                                    setNewName("");
                                }}
                                className="px-4 py-2 border border-border rounded hover:bg-surface-raised transition-colors text-text-secondary"
                            >
                                {t("common.cancel")}
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={createMut.isPending}
                                className="px-4 py-2 bg-accent text-background rounded hover:bg-accent/90 transition-colors font-semibold disabled:opacity-50"
                            >
                                {createMut.isPending
                                    ? t("common.loading")
                                    : t("common.create")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            {deleteTarget && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">
                            {t("common.remove") || "Remove"}
                        </h3>
                        <p className="text-sm text-text-secondary">
                            {t("volumes.removeConfirm", { name: deleteTarget })}
                        </p>
                        <div className="flex justify-end gap-2 text-sm pt-2">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="px-4 py-2 border border-border rounded hover:bg-surface-raised transition-colors text-text-secondary"
                            >
                                {t("common.cancel")}
                            </button>
                            <button
                                onClick={() => handleRemove(deleteTarget)}
                                className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 transition-colors font-semibold"
                            >
                                {t("common.remove")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
