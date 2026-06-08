import { useRef, useState } from "react";
import { Upload, X, RefreshCw, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { uploadImage, deleteFromStorage, validateImageFile, pathFromSignedUrl, ALLOWED_IMAGE_TYPES } from "@/lib/storage";
import { Link } from "@tanstack/react-router";

interface Props {
  value?: string | null;
  onChange: (url: string | null) => void;
  bucket?: "avatars" | "user-uploads";
  aspect?: "square" | "video" | "portrait";
  className?: string;
  label?: string;
}

export function ImageUploader({ value, onChange, bucket = "user-uploads", aspect = "square", className, label }: Props) {
  const { user } = useAuth();
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const aspectClass = aspect === "video" ? "aspect-video" : aspect === "portrait" ? "aspect-[4/5]" : "aspect-square";

  const handleFile = async (file: File) => {
    if (!user) { toast.error(t("btn.sign_in")); return; }
    const err = validateImageFile(file);
    if (err) { toast.error(t("toast.upload_invalid")); return; }
    setBusy(true);
    try {
      const { url } = await uploadImage({ bucket, userId: user.id, file });
      onChange(url);
      toast.success(t("toast.saved"));
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  const handleRemove = async () => {
    if (value && user) {
      const path = pathFromSignedUrl(value, bucket);
      if (path) await deleteFromStorage(bucket, path);
    }
    onChange(null);
  };

  if (!user) {
    return (
      <div className={`${aspectClass} ${className ?? ""} border border-dashed border-border rounded-lg flex items-center justify-center text-sm text-muted-foreground p-4 text-center`}>
        <Link to="/auth" className="text-gold hover:underline">{t("btn.sign_in")}</Link>
      </div>
    );
  }

  return (
    <div className={className}>
      {label && <label className="text-xs text-muted-foreground mb-2 block">{label}</label>}
      <div
        className={`${aspectClass} relative border border-dashed border-border rounded-lg overflow-hidden bg-secondary/40 group`}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
        onDragOver={(e) => e.preventDefault()}
      >
        {value ? (
          <img src={value} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2 p-4">
            <ImageIcon className="h-8 w-8 opacity-40" />
            <p className="text-xs text-center">{t("image.upload_hint")}</p>
          </div>
        )}
        <div className="absolute inset-0 bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button type="button" size="sm" variant="hero" disabled={busy} onClick={() => input.current?.click()}>
            {value ? <RefreshCw /> : <Upload />} {value ? t("btn.replace") : t("btn.upload")}
          </Button>
          {value && (
            <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={handleRemove}>
              <X /> {t("btn.remove")}
            </Button>
          )}
        </div>
      </div>
      <input
        ref={input} type="file" accept={ALLOWED_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }}
      />
    </div>
  );
}
