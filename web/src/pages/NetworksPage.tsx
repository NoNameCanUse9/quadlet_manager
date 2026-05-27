import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, Plus, Trash2, Link, Unlink, Eraser } from "lucide-react";
import {
    useNetworks,
    useCreateNetwork,
    useRemoveNetwork,
    useConnectNetwork,
    useDisconnectNetwork,
    usePruneNetworks,
} from "@/hooks/useNetworks";
import { useContainers } from "@/hooks/useContainers";
import { toast } from "sonner";

export function NetworksPage() {
    const { t } = useTranslation();
    const [createDialog, setCreateDialog] = useState(false);
    const [newName, setNewName] = useState("");
    const [newDriver, setNewDriver] = useState("");
    const [newSubnet, setNewSubnet] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [connectTarget, setConnectTarget] = useState<string | null>(null);
    const [disconnectTarget, setDisconnectTarget] = useState<{ name: string; containerId: string } | null>(null);
    const [selectedContainer, setSelectedContainer] = useState("");

    const { data: networksData, isLoading, error, refetch } = useNetworks();
    const networks = networksData ?? [];
    const { data: containersData } = useContainers();
    const containers = containersData ?? [];
    const createMut = useCreateNetwork();
    const removeMut = useRemoveNetwork();
    const connectMut = useConnectNetwork();
    const disconnectMut = useDisconnectNetwork();
    const pruneMut = usePruneNetworks();

    const handleCreate = async () => {
        if (!newName.trim()) return;
        try {
            await createMut.mutateAsync({
                name: newName.trim(),
                driver: newDriver.trim() || undefined,
                subnet: newSubnet.trim() || undefined,
            });
            toast.success("Network created");
            setCreateDialog(false);
            setNewName("");
            setNewDriver("");
            setNewSubnet("");
        } catch (e: any) {
            toast.error(e.message || "Create failed");
        }
    };

    const handleRemove = async (name: string) => {
        try {
            await removeMut.mutateAsync(name);
            toast.success("Network removed");
            setDeleteTarget(null);
        } catch (e: any) {
            toast.error(e.message || "Remove failed");
        }
    };

    const handleConnect = async () => {
        if (!connectTarget || !selectedContainer) return;
        try {
            await connectMut.mutateAsync({ name: connectTarget, containerId: selectedContainer });
            toast.success(t("networks.connected"));
            setConnectTarget(null);
            setSelectedContainer("");
        } catch (e: any) {
            toast.error(e.message || "Connect failed");
        }
    };

    const handleDisconnect = async () => {
        if (!disconnectTarget) return;
        try {
            await disconnectMut.mutateAsync({ name: disconnectTarget.name, containerId: disconnectTarget.containerId });
            toast.success(t("networks.disconnected"));
            setDisconnectTarget(null);
        } catch (e: any) {
            toast.error(e.message || "Disconnect failed");
        }
    };

    const handlePrune = async () => {
        try {
            const result = await pruneMut.mutateAsync();
            toast.success(t("networks.pruneResult", { count: result.pruned }));
        } catch (e: any) {
            toast.error(e.message || "Prune failed");
        }
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-base font-bold tracking-wider text-text-primary uppercase">
                    {t("sidebar.networks")}
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handlePrune}
                        disabled={pruneMut.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded hover:bg-amber-500/20 transition-all font-semibold disabled:opacity-50"
                        title={t("networks.prune")}
                    >
                        <Eraser size={14} /> {t("networks.prune")}
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
                                {t("networks.name")}
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-text-muted text-xs uppercase tracking-wider">
                                {t("networks.id")}
                            </th>
                            <th className="px-4 py-3 text-right font-semibold text-text-muted text-xs uppercase tracking-wider">
                                {t("common.actions")}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {networks.map((n) => (
                            <tr
                                key={n.id}
                                className="hover:bg-surface-raised/50 transition-colors"
                            >
                                <td className="px-4 py-3 text-text-primary font-semibold font-mono">
                                    {n.name}
                                </td>
                                <td className="px-4 py-3 text-text-muted font-mono text-xs">
                                    {n.id.slice(0, 12)}
                                </td>
                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-0.5">
                                        <button
                                            onClick={() => setConnectTarget(n.name)}
                                            className="p-1.5 text-text-secondary hover:text-blue-400 transition-colors"
                                            title={t("networks.connect")}
                                        >
                                            <Link size={14} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                const containerId = prompt(t("networks.selectContainer") + " (ID):");
                                                if (containerId) {
                                                    setDisconnectTarget({ name: n.name, containerId });
                                                }
                                            }}
                                            className="p-1.5 text-text-secondary hover:text-amber-400 transition-colors"
                                            title={t("networks.disconnect")}
                                        >
                                            <Unlink size={14} />
                                        </button>
                                        <button
                                            onClick={() => setDeleteTarget(n.name)}
                                            className="p-1.5 text-text-secondary hover:text-red-400 transition-colors"
                                            title={t("common.remove")}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {networks.length === 0 && (
                            <tr>
                                <td
                                    colSpan={3}
                                    className="px-4 py-8 text-center text-text-secondary font-medium"
                                >
                                    {t("networks.noData")}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create Network Dialog */}
            {createDialog && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">
                            {t("networks.createTitle") || "Create Network"}
                        </h3>
                        <div className="space-y-3 mb-4">
                            <input
                                type="text"
                                placeholder={
                                    t("networks.namePlaceholder") ||
                                    "Network name *"
                                }
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="w-full bg-surface-raised border border-border rounded px-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                                autoFocus
                            />
                            <input
                                type="text"
                                placeholder={
                                    t("networks.driverPlaceholder") ||
                                    "Driver (default: bridge)"
                                }
                                value={newDriver}
                                onChange={(e) => setNewDriver(e.target.value)}
                                className="w-full bg-surface-raised border border-border rounded px-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                            />
                            <input
                                type="text"
                                placeholder={
                                    t("networks.subnetPlaceholder") ||
                                    "Subnet (e.g. 10.89.0.0/24)"
                                }
                                value={newSubnet}
                                onChange={(e) => setNewSubnet(e.target.value)}
                                className="w-full bg-surface-raised border border-border rounded px-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                            />
                        </div>
                        <div className="flex justify-end gap-2 text-sm pt-2">
                            <button
                                onClick={() => {
                                    setCreateDialog(false);
                                    setNewName("");
                                    setNewDriver("");
                                    setNewSubnet("");
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

            {/* Connect Container Dialog */}
            {connectTarget && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">
                            {t("networks.connectTitle")} — {connectTarget}
                        </h3>
                        <select
                            value={selectedContainer}
                            onChange={(e) => setSelectedContainer(e.target.value)}
                            className="w-full bg-surface-raised border border-border rounded px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                        >
                            <option value="">{t("networks.selectContainer")}</option>
                            {containers.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.names?.[0] || c.id.slice(0, 12)} ({c.state})
                                </option>
                            ))}
                        </select>
                        <div className="flex justify-end gap-2 text-sm pt-2">
                            <button
                                onClick={() => {
                                    setConnectTarget(null);
                                    setSelectedContainer("");
                                }}
                                className="px-4 py-2 border border-border rounded hover:bg-surface-raised transition-colors text-text-secondary"
                            >
                                {t("common.cancel")}
                            </button>
                            <button
                                onClick={handleConnect}
                                disabled={!selectedContainer || connectMut.isPending}
                                className="px-4 py-2 bg-accent text-background rounded hover:bg-accent/90 transition-colors font-semibold disabled:opacity-50"
                            >
                                {connectMut.isPending
                                    ? t("common.loading")
                                    : t("networks.connect")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Disconnect Confirmation Dialog */}
            {disconnectTarget && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">
                            {t("networks.disconnect")}
                        </h3>
                        <p className="text-sm text-text-secondary">
                            {t("networks.disconnect")} {disconnectTarget.containerId.slice(0, 12)} from {disconnectTarget.name}?
                        </p>
                        <div className="flex justify-end gap-2 text-sm pt-2">
                            <button
                                onClick={() => setDisconnectTarget(null)}
                                className="px-4 py-2 border border-border rounded hover:bg-surface-raised transition-colors text-text-secondary"
                            >
                                {t("common.cancel")}
                            </button>
                            <button
                                onClick={handleDisconnect}
                                className="px-4 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded hover:bg-amber-500/20 transition-colors font-semibold"
                            >
                                {t("networks.disconnect")}
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
                            {t("networks.removeConfirm", {
                                name: deleteTarget,
                            })}
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
