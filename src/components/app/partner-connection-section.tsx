import { Check, Clock, Copy, Heart, Link2, Loader2, Unlink, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/app/section-card";
import {
  useAcceptPartnerInvite,
  useActiveConnection,
  useCancelPartnerInvite,
  useCreatePartnerInvite,
  useDisconnectPartner,
  usePartnerInvite,
} from "@/hooks/use-partner-pairing";
import { formatDateLabel } from "@/lib/sleep";
import type { AppRole } from "@/types/db";

interface PartnerConnectionSectionProps {
  role: AppRole;
}

function formatRemainingTime(expiresAtStr: string): string {
  const expiresAt = new Date(expiresAtStr).getTime();
  const now = Date.now();
  const diffMs = expiresAt - now;
  if (diffMs <= 0) return "Expired";
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `Expires in ${hours}h ${minutes}m`;
  return `Expires in ${minutes}m`;
}

export function PartnerConnectionSection({ role }: PartnerConnectionSectionProps) {
  const { data: connection, isLoading: connectionLoading } = useActiveConnection();
  const { data: activeInvite, isLoading: inviteLoading } = usePartnerInvite();

  const createInvite = useCreatePartnerInvite();
  const cancelInvite = useCancelPartnerInvite();
  const acceptInvite = useAcceptPartnerInvite();
  const disconnectPartner = useDisconnectPartner();

  const [inputCode, setInputCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Auto-clear copied indicator after 2 seconds
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  async function handleCopyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Invite code copied to clipboard");
    } catch {
      toast.error("Could not copy code to clipboard");
    }
  }

  async function handleAcceptCode(e: React.FormEvent) {
    e.preventDefault();
    setConnectError(null);
    const cleaned = inputCode.trim();
    if (!cleaned) {
      setConnectError("Please enter an invite code.");
      return;
    }
    try {
      await acceptInvite.mutateAsync(cleaned);
      setInputCode("");
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Failed to connect. Please check the code.");
    }
  }

  const isConnected = Boolean(connection?.relationshipId);
  const partnerName = connection?.connectedProfile?.nickname || connection?.connectedProfile?.display_name || (role === "user" ? "Partner" : "Her");

  if (connectionLoading || (role === "user" && inviteLoading)) {
    return (
      <SectionCard title="Partner connection" icon={Heart} hint="Checking connection status…">
        <div className="flex items-center justify-center p-6 text-muted-foreground">
          <Loader2 className="size-5 animate-spin mr-2" />
          <span className="text-sm">Loading partner details…</span>
        </div>
      </SectionCard>
    );
  }

  // --- CONNECTED STATE (Both User and Partner) ---
  if (isConnected) {
    return (
      <SectionCard
        title="Partner connection"
        icon={Heart}
        hint={role === "user" ? "Connected with your partner." : "Connected with her account."}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3.5">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
                <span className="text-xs font-semibold tracking-wide uppercase text-emerald-600 dark:text-emerald-400">
                  Connected
                </span>
              </div>
              <p className="font-medium text-foreground text-base mt-1">
                {partnerName}
              </p>
              {connection?.connectedAt ? (
                <p className="text-xs text-muted-foreground">
                  Paired since {formatDateLabel(connection.connectedAt, "UTC")}
                </p>
              ) : null}
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                  <Unlink className="size-4 mr-1.5" aria-hidden="true" />
                  Disconnect
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect partner?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {role === "user"
                      ? "Your partner will immediately lose access to your shared reset plan and recovery status. You can reconnect at any time by generating a new invite code."
                      : "You will be disconnected from her account and will no longer be able to see her shared schedule. She can invite you again at any time."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => disconnectPartner.mutate()}
                    disabled={disconnectPartner.isPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {disconnectPartner.isPending ? "Disconnecting…" : "Yes, disconnect"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </SectionCard>
    );
  }

  // --- DISCONNECTED STATE FOR PRIMARY USER ("HER") ---
  if (role === "user") {
    return (
      <SectionCard
        title="Partner connection"
        icon={Heart}
        hint="Invite your partner to connect. You stay in control of what is shared."
      >
        {activeInvite ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-card p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Active Invite Code
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <Clock className="size-3.5" aria-hidden="true" />
                  {formatRemainingTime(activeInvite.expires_at)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 rounded-xl bg-primary/10 border border-primary/20 px-4 py-3.5">
                <span className="font-mono text-xl sm:text-2xl font-bold tracking-widest text-primary select-all">
                  {activeInvite.invite_code}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyCode(activeInvite.invite_code)}
                  className="shrink-0 gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5 text-emerald-600" aria-hidden="true" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" aria-hidden="true" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">
                Send this code to your partner. When they enter it in their Nightly app, you will be connected. This code expires in 24 hours.
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => cancelInvite.mutate()}
                disabled={cancelInvite.isPending}
                className="text-muted-foreground hover:text-destructive text-xs"
              >
                {cancelInvite.isPending ? "Cancelling…" : "Cancel invite code"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/70 p-5 text-center space-y-3">
            <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserPlus className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium">No active partner connection</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground max-w-sm mx-auto">
                Generate an invite code so your partner can link their account. Your sleep data remains completely private until you explicitly choose to share it.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => createInvite.mutate()}
              disabled={createInvite.isPending}
              size="sm"
              className="gap-2"
            >
              {createInvite.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Generating code…
                </>
              ) : (
                <>
                  <UserPlus className="size-4" aria-hidden="true" />
                  Create invite code
                </>
              )}
            </Button>
          </div>
        )}
      </SectionCard>
    );
  }

  // --- DISCONNECTED STATE FOR PARTNER ("ME") ---
  return (
    <SectionCard
      title="Partner connection"
      icon={Link2}
      hint="Connect with your partner using the invite code she gave you."
    >
      <form onSubmit={handleAcceptCode} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="partner-code-input">Invite code</Label>
          <div className="flex gap-2">
            <Input
              id="partner-code-input"
              value={inputCode}
              onChange={(e) => {
                setConnectError(null);
                setInputCode(e.target.value.toUpperCase());
              }}
              placeholder="WHSP-XXXX-XXXX"
              maxLength={14}
              className="font-mono uppercase tracking-wider text-base sm:text-lg"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />
            <Button
              type="submit"
              disabled={acceptInvite.isPending || !inputCode.trim()}
              className="shrink-0"
            >
              {acceptInvite.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                  Connecting…
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </div>
        </div>

        {connectError ? (
          <p className="text-xs text-destructive rounded-lg bg-destructive/10 p-2.5">
            {connectError}
          </p>
        ) : null}

        <p className="text-xs leading-relaxed text-muted-foreground">
          Ask your partner for her invite code from her Profile page. Once connected, any details she chooses to share will appear on your dashboard.
        </p>
      </form>
    </SectionCard>
  );
}
