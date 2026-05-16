import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Modal } from "./Modal";

interface Variant {
  key: "light" | "dark" | "light-transparent" | "dark-transparent";
  label: string;
  dark: string;
  light: string;
}

const variants: Variant[] = [
  { key: "light", label: "Light", dark: "#000000", light: "#ffffff" },
  { key: "dark", label: "Dark", dark: "#ffffff", light: "#000000" },
  { key: "light-transparent", label: "Light transparent", dark: "#000000", light: "#00000000" },
  { key: "dark-transparent", label: "Dark transparent", dark: "#ffffff", light: "#00000000" },
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
    <Modal open onClose={onClose}>
      <h2>QR codes for /s/{short}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "1em", alignItems: "center" }}>
        {variants.map((v) => (
          <div key={v.key} style={{ display: "contents" }}>
            <div style={{ background: v.key.includes("transparent") ? "repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 16px 16px" : "transparent", padding: 4 }}>
              <canvas ref={(el) => { refs.current[v.key] = el; }} width={128} height={128} style={{ width: 96, height: 96 }} />
            </div>
            <span>{v.label}</span>
            <button onClick={() => download(v.key)}>Download {short}-{v.key}.png</button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: "1em", textAlign: "right" }}>
        <button onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
