import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, Download, Trash2, ArrowDownToLine } from "lucide-react";
import { useImages, usePullImage, useRemoveImage } from "@/hooks/useImages";
import { toast } from "sonner";

export function ImagesPage() {
    const { t } = useTranslation();
    const [pullDialog, setPullDialog] = useState(false);
    const [pullName, setPullName] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    const { data: imagesData, isLoading, error, refetch } = useImages();
    const images = imagesData ?? [];
    const pullMut = usePullImage();
    const removeMut = useRemoveImage();

    const handlePull = async () => {
        if (!pullName.trim()) return;
        try {
            const { task_id } = await pullMut.mutateAsync(pullName.trim());
            toast.success(`Pull started (task: ${task_id.slice(0, 8)})`);
            setPullDialog(false);
            setPullName("");
        } catch (e: any) {
            toast.error(e.message || "Pull failed");
        }
    };

    const handleUpdate = async (tag: string) => {
        try {
            const { task_id } = await pullMut.mutateAsync(tag);
            toast.success(`${t("images.updated")} (task: ${task_id.slice(0, 8)})`);
        } catch (e: any) {
            toast.error(e.message || "Update failed");
        }
    };

    const handleRemove = async (id: string) => {
        try {
            await removeMut.mutateAsync({ id, force: true });
            toast.success("Image removed");
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
                    {t("sidebar.images")}
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setPullDialog(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded hover:bg-emerald-500/20 transition-all font-semibold"
                    >
                        <Download size={14} /> {t("images.pull")}
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
                                {t("common.id")}
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-text-muted text-xs uppercase tracking-wider">
                                {t("images.tags")}
                            </th>
                            <th className="px-4 py-3 text-right font-semibold text-text-muted text-xs uppercase tracking-wider">
                                {t("images.size")}
                            </th>
                            <th className="px-4 py-3 text-right font-semibold text-text-muted text-xs uppercase tracking-wider">
                                {t("common.actions")}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {images.map((img) => (
                            <tr
                                key={img.id}
                                className="hover:bg-surface-raised/50 transition-colors"
                            >
                                <td className="px-4 py-3 font-mono text-text-muted">
                                    {img.id.slice(0, 12)}
                                </td>
                                <td className="px-4 py-3 text-text-primary font-semibold font-mono">
                                    {img.tags?.join(", ") || "-"}
                                </td>
                                <td className="px-4 py-3 text-right text-text-secondary font-mono font-medium">
                                    {formatBytes(img.size)}
                                </td>
                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-0.5">
                                        {img.tags && img.tags.length > 0 && img.tags[0] !== "" && (
                                            <button
                                                onClick={() => handleUpdate(img.tags![0])}
                                                disabled={pullMut.isPending}
                                                className="p-1.5 text-text-secondary hover:text-blue-400 transition-colors disabled:opacity-50"
                                                title={t("images.update")}
                                            >
                                                <ArrowDownToLine size={14} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setDeleteTarget(img.id)}
                                            className="p-1.5 text-text-secondary hover:text-red-400 transition-colors"
                                            title={t("common.remove")}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {images.length === 0 && (
                            <tr>
                                <td
                                    colSpan={4}
                                    className="px-4 py-8 text-center text-text-secondary font-medium"
                                >
                                    {t("images.noData")}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pull Image Dialog */}
            {pullDialog && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">
                            {t("images.pullTitle") || "Pull Image"}
                        </h3>
                        <input
                            type="text"
                            placeholder={
                                t("images.pullPlaceholder") ||
                                "image:tag (e.g. nginx:latest)"
                            }
                            value={pullName}
                            onChange={(e) => setPullName(e.target.value)}
                            className="w-full bg-surface-raised border border-border rounded px-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                            autoFocus
                        />
                        <div className="flex justify-end gap-2 text-sm pt-2">
                            <button
                                onClick={() => {
                                    setPullDialog(false);
                                    setPullName("");
                                }}
                                className="px-4 py-2 border border-border rounded hover:bg-surface-raised transition-colors text-text-secondary"
                            >
                                {t("common.cancel")}
                            </button>
                            <button
                                onClick={handlePull}
                                disabled={pullMut.isPending}
                                className="px-4 py-2 bg-accent text-background rounded hover:bg-accent/90 transition-colors font-semibold disabled:opacity-50"
                            >
                                {pullMut.isPending
                                    ? t("common.loading")
                                    : t("images.pull")}
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
                            {t("images.removeConfirm")}
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

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
