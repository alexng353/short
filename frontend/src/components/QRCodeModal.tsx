import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { DownloadIcon } from "lucide-react";

interface Variant {
  key: "light" | "dark" | "light-transparent" | "dark-transparent";
  label: string;
  dark: string;
  light: string;
  bg: "checker" | "white" | "black";
}

const variants: Variant[] = [
  { key: "light", label: "Light", dark: "#000000", light: "#ffffff", bg: "white" },
  { key: "dark", label: "Dark", dark: "#ffffff", light: "#000000", bg: "black" },
  { key: "light-transparent", label: "Light · transparent", dark: "#000000", light: "#00000000", bg: "checker" },
  { key: "dark-transparent", label: "Dark · transparent", dark: "#ffffff", light: "#00000000", bg: "checker" },
];

export function QRCodeModal({
  short,
  origin,
  onClose,
}: {
  short: string;
  origin: string;
  onClose: () => void;
}) {
  const url = `${origin}/s/${short}`;
  const refs = useRef<Record<string, HTMLCanvasElement | null>>({});

  useEffect(() => {
    for (const v of variants) {
      const canvas = refs.current[v.key];
      if (!canvas) continue;
      QRCode.toCanvas(canvas, url, {
        width: 256,
        margin: 1,
        color: { dark: v.dark, light: v.light },
      });
    }
  }, [url]);

  const download = (key: Variant["key"]) => {
    const canvas = refs.current[key];
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${short}-${key}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>QR codes</DialogTitle>
          <DialogDescription>
            <span className="font-mono text-foreground">/s/{short}</span> · pick a variant to download.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          {variants.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => download(v.key)}
              className="group flex flex-col items-center gap-3 rounded-lg border border-border/60 bg-card/50 p-3 text-left transition-colors hover:border-border hover:bg-card"
            >
              <div
                className="flex size-32 items-center justify-center rounded-md"
                style={
                  v.bg === "checker"
                    ? { background: "repeating-conic-gradient(oklch(0.5 0 0) 0% 25%, oklch(0.7 0 0) 0% 50%) 50% / 12px 12px" }
                    : { background: v.bg === "white" ? "#ffffff" : "#000000" }
                }
              >
                <canvas
                  ref={(el) => {
                    refs.current[v.key] = el;
                  }}
                  width={128}
                  height={128}
                  className="size-28"
                />
              </div>
              <div className="flex w-full items-center justify-between text-xs">
                <span className="text-muted-foreground">{v.label}</span>
                <DownloadIcon className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
              </div>
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
