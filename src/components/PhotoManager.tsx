import { useCallback, useRef, useState } from "react";
import { Upload, X, GripVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export type ExistingPhoto = { id: string; url: string };

type Props = {
  existing: ExistingPhoto[];
  onExistingChange: (next: ExistingPhoto[]) => void;
  onRemoveExisting: (photo: ExistingPhoto) => void | Promise<void>;
  newFiles: File[];
  onNewFilesChange: (next: File[]) => void;
};

type Item =
  | { kind: "existing"; key: string; photo: ExistingPhoto }
  | { kind: "new"; key: string; file: File; index: number };

export function PhotoManager({
  existing,
  onExistingChange,
  onRemoveExisting,
  newFiles,
  onNewFilesChange,
}: Props) {
  const { t } = useTranslation();
  const [dragOver, setDragOver] = useState(false);
  const dragIndex = useRef<number | null>(null);

  const items: Item[] = [
    ...existing.map((photo) => ({ kind: "existing" as const, key: `e-${photo.id}`, photo })),
    ...newFiles.map((file, index) => ({
      kind: "new" as const,
      key: `n-${index}-${file.name}`,
      file,
      index,
    })),
  ];

  const acceptFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (arr.length) onNewFilesChange([...newFiles, ...arr]);
    },
    [newFiles, onNewFilesChange],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) acceptFiles(e.dataTransfer.files);
  };

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const newExisting = [...existing];
    const newNew = [...newFiles];
    const flat: Item[] = [
      ...newExisting.map((photo) => ({ kind: "existing" as const, key: `e-${photo.id}`, photo })),
      ...newNew.map((file, index) => ({
        kind: "new" as const,
        key: `n-${index}`,
        file,
        index,
      })),
    ];
    const [moved] = flat.splice(from, 1);
    flat.splice(to, 0, moved);
    const nextExisting: ExistingPhoto[] = [];
    const nextNew: File[] = [];
    for (const it of flat) {
      if (it.kind === "existing") nextExisting.push(it.photo);
      else nextNew.push(it.file);
    }
    onExistingChange(nextExisting);
    onNewFilesChange(nextNew);
  };

  return (
    <div>
      <p className="-mt-2 mb-3 text-sm text-muted-foreground">
        {t("listing.uploadPhotos")} · {t("listing.dragToReorder")}
      </p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "rounded-lg border-2 border-dashed p-3 transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border",
        )}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map((it, idx) => (
            <div
              key={it.key}
              draggable
              onDragStart={() => {
                dragIndex.current = idx;
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const from = dragIndex.current;
                dragIndex.current = null;
                if (from !== null) reorder(from, idx);
              }}
              className="group relative aspect-square cursor-move overflow-hidden rounded-lg border bg-muted"
            >
              <img
                src={it.kind === "existing" ? it.photo.url : URL.createObjectURL(it.file)}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                draggable={false}
              />
              {idx === 0 && (
                <span className="absolute bottom-1 left-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                  {t("listing.coverPhoto")}
                </span>
              )}
              <span className="absolute left-1 top-1 rounded-full bg-background/95 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                <GripVertical className="h-3.5 w-3.5" />
              </span>
              <button
                type="button"
                onClick={() => {
                  if (it.kind === "existing") onRemoveExisting(it.photo);
                  else onNewFilesChange(newFiles.filter((_, i) => i !== it.index));
                }}
                className="absolute right-1 top-1 rounded-full bg-background/95 p-1 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            <Upload className="h-5 w-5" />
            <span>+ {t("listing.photo")}</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) acceptFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
