"use client";

import { useEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Trash2,
  Copy,
  ClipboardPaste,
  ArrowUp,
  ArrowDown,
  Plus,
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  Quote,
  Info,
  ImageIcon,
  Minus,
  Subtitles,
  MoreHorizontal,
  Settings2,
  Table as TableIcon,
  Code2,
  Square,
  Columns3,
  GitMerge,
  RefreshCw,
  Bookmark,
  BookOpen,
  ListTree,
  FileOutput,
  Languages,
} from "lucide-react";
import {
  Block,
  BlockType,
  BlockWidth,
  FontSize,
  TextBlock,
  convertBlock,
  canMerge,
  newId,
} from "@/lib/doc-types";

interface BlockEditorProps {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  onInsertAfter: (id: string, type: BlockType) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onConvert: (id: string, newType: BlockType) => void;
  onMergeWithNext: (id: string) => void;
  onOpenImagePicker: (id: string) => void;
  onCopyBlock: (id: string) => void;
  onAddFootnoteFor: (id: string) => void;
  searchQuery: string;
}

const TEXT_TYPES: BlockType[] = [
  "title",
  "subtitle",
  "h2",
  "h3",
  "paragraph",
  "quote",
  "callout",
];

// Map block type to default font-size CSS px
const DEFAULT_FONT_PX: Record<string, number> = {
  title: 26,
  subtitle: 17,
  h2: 21,
  h3: 18,
  paragraph: 14.5,
  quote: 15,
  callout: 14,
  bullet: 14.5,
};

const FONT_SIZE_PX: Record<FontSize, number> = {
  sm: 12,
  md: 15,
  lg: 19,
  xl: 24,
};

const WIDTH_PCT: Record<BlockWidth, string> = {
  full: "100%",
  wide: "85%",
  medium: "65%",
  narrow: "45%",
};

function SortableBlock({
  block,
  onChange,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onInsertAfter,
  onConvert,
  onMergeWithNext,
  onOpenImagePicker,
  onCopyBlock,
  onAddFootnoteFor,
  searchQuery,
  canUp,
  canDown,
  canMergeNext,
}: {
  block: Block;
  onChange: (b: Block) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onInsertAfter: (type: BlockType) => void;
  onConvert: (newType: BlockType) => void;
  onMergeWithNext: () => void;
  onOpenImagePicker: () => void;
  onCopyBlock: () => void;
  onAddFootnoteFor: () => void;
  searchQuery: string;
  canUp: boolean;
  canDown: boolean;
  canMergeNext: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  const [showInsertMenu, setShowInsertMenu] = useState(false);
  const [showImageOps, setShowImageOps] = useState(false);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  useEffect(() => {
    if (!showInsertMenu && !showStylePanel) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowInsertMenu(false);
        setShowStylePanel(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showInsertMenu, showStylePanel]);

  function patch(partial: Partial<Block>) {
    onChange({ ...block, ...partial } as Block);
  }

  // Compute the inline style wrapper for this block (font-size, width, margin-bottom)
  function blockStyle(): React.CSSProperties {
    const s: React.CSSProperties = {};
    if (block.fontSize) {
      s.fontSize = `${FONT_SIZE_PX[block.fontSize]}px`;
    }
    if (block.blockWidth && block.blockWidth !== "full") {
      s.width = WIDTH_PCT[block.blockWidth];
      s.marginInlineStart = "auto";
      s.marginInlineEnd = "auto";
    }
    if (block.marginBottom !== undefined) {
      s.marginBottom = `${block.marginBottom}px`;
    }
    return s;
  }

  function renderContent() {
    switch (block.type) {
      case "title":
      case "subtitle":
      case "h2":
      case "h3":
      case "paragraph":
      case "quote":
      case "callout": {
        const cls =
          block.type === "title"
            ? "doc-title"
            : block.type === "subtitle"
            ? "doc-subtitle"
            : block.type === "h2"
            ? "doc-h2"
            : block.type === "h3"
            ? "doc-h3"
            : block.type === "quote"
            ? "doc-quote"
            : block.type === "callout"
            ? "doc-callout"
            : "doc-paragraph";
        const placeholder =
          block.type === "title"
            ? "عنوان اصلی سند…"
            : block.type === "subtitle"
            ? "زیرعنوان…"
            : block.type === "h2"
            ? "تیتر بخش…"
            : block.type === "h3"
            ? "تیتر فرعی…"
            : block.type === "quote"
            ? "نقل‌قول…"
            : block.type === "callout"
            ? "متن فراخوانی (callout)…"
            : "متن پاراگراف…";
        return (
          <div style={blockStyle()}>
            <div
              className={cls}
              contentEditable
              suppressContentEditableWarning
              data-placeholder={placeholder}
              onBlur={(e) =>
                patch({ text: e.currentTarget.innerText } as Partial<Block>)
              }
              dangerouslySetInnerHTML={{ __html: (block as TextBlock).text || "" }}
            />
          </div>
        );
      }
      case "bullet": {
        return (
          <div style={blockStyle()}>
            <BulletEditor
              items={block.items}
              onChange={(items) => patch({ items } as Partial<Block>)}
            />
          </div>
        );
      }
      case "image": {
        return (
          <div style={blockStyle()}>
            <ImageBlockEditor
              block={block}
              onPatch={patch}
              onPickImage={onOpenImagePicker}
              showOps={showImageOps}
              setShowOps={setShowImageOps}
            />
          </div>
        );
      }
      case "divider": {
        return <hr className="doc-divider" style={blockStyle()} />;
      }
      case "table": {
        return (
          <div style={blockStyle()}>
            <TableBlockEditor block={block} onPatch={patch} />
          </div>
        );
      }
      case "code": {
        return (
          <div style={blockStyle()}>
            <CodeBlockEditor block={block} onPatch={patch} />
          </div>
        );
      }
      case "spacer": {
        return (
          <div style={blockStyle()}>
            <SpacerBlockEditor block={block} onPatch={patch} />
          </div>
        );
      }
      case "columns": {
        return (
          <div style={blockStyle()}>
            <ColumnsBlockEditor block={block} onPatch={patch} />
          </div>
        );
      }
      case "footnote": {
        return (
          <div style={blockStyle()}>
            <FootnoteBlockEditor block={block} onPatch={patch} />
          </div>
        );
      }
      case "toc": {
        return (
          <div style={blockStyle()}>
            <TocBlockEditor block={block} onPatch={patch} />
          </div>
        );
      }
      case "glossary": {
        return (
          <div style={blockStyle()}>
            <GlossaryBlockEditor block={block} onPatch={patch} />
          </div>
        );
      }
      case "pageBreak": {
        return <PageBreakBlockEditor />;
      }
      default:
        return null;
    }
  }

  // Check if this block matches the current search query
  function blockMatchesSearch(): boolean {
    if (!searchQuery.trim()) return false;
    const q = searchQuery.trim().toLowerCase();
    const haystacks: string[] = [];
    if ("text" in block) haystacks.push((block as TextBlock).text);
    if (block.type === "bullet") haystacks.push(...block.items);
    if (block.type === "code") haystacks.push(block.code);
    if (block.type === "table") block.rows.forEach((r) => haystacks.push(...r));
    if (block.type === "columns")
      block.columns.forEach((col) => col.forEach((b) => haystacks.push(b.text)));
    if (block.type === "footnote") haystacks.push(block.text);
    if (block.type === "glossary")
      block.entries.forEach((e) => haystacks.push(e.word, e.meaning));
    return haystacks.some((h) => h.toLowerCase().includes(q));
  }

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        wrapRef.current = node;
      }}
      style={style}
      data-block-id={block.id}
      className={`block-wrap block-enter ${isDragging ? "is-dragging" : ""} ${
        blockMatchesSearch() ? "is-search-hit" : ""
      } ${(showInsertMenu || showStylePanel) ? "is-menu-open" : ""}`}
    >
      <button
        type="button"
        className="block-grip"
        aria-label="جابجایی بلوک"
        title="برای جابجایی بکشید"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>

      <div className="block-actions">
        <button
          type="button"
          className="block-action-btn"
          title="تنظیمات بلوک (اندازه، فونت، تبدیل، ادغام)"
          onClick={() => {
            setShowStylePanel((v) => !v);
            setShowInsertMenu(false);
          }}
        >
          <Settings2 size={14} />
        </button>
        <button
          type="button"
          className="block-action-btn"
          title="بالا"
          onClick={onMoveUp}
          disabled={!canUp}
          style={{ opacity: canUp ? 1 : 0.3, cursor: canUp ? "pointer" : "not-allowed" }}
        >
          <ArrowUp size={14} />
        </button>
        <button
          type="button"
          className="block-action-btn"
          title="پایین"
          onClick={onMoveDown}
          disabled={!canDown}
          style={{ opacity: canDown ? 1 : 0.3, cursor: canDown ? "pointer" : "not-allowed" }}
        >
          <ArrowDown size={14} />
        </button>
        <button
          type="button"
          className="block-action-btn"
          title="تکرار"
          onClick={onDuplicate}
        >
          <Copy size={14} />
        </button>
        <button
          type="button"
          className="block-action-btn"
          title="کپی بلوک (برای پیست در این سند یا سند دیگر)"
          onClick={onCopyBlock}
        >
          <ClipboardPaste size={14} />
        </button>
        <button
          type="button"
          className="block-action-btn danger"
          title="حذف"
          onClick={onRemove}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {showStylePanel && (
        <BlockStylePanel
          block={block}
          onPatch={patch}
          onConvert={onConvert}
          onMergeWithNext={onMergeWithNext}
          canMergeNext={canMergeNext}
          onAddFootnoteFor={onAddFootnoteFor}
          onClose={() => setShowStylePanel(false)}
        />
      )}

      {renderContent()}

      <div style={{ position: "relative", marginTop: 8 }}>
        <button
          type="button"
          className="insert-handle"
          onClick={() => {
            setShowInsertMenu((v) => !v);
            setShowStylePanel(false);
          }}
          aria-label="افزودن بلوک جدید"
          title="افزودن بلوک جدید"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 8,
            border: "1px dashed rgba(99,102,241,0.4)",
            background: "rgba(238,242,255,0.6)",
            color: "#4338ca",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <Plus size={14} />
          <span>بلوک جدید</span>
        </button>
        {showInsertMenu && (
          <BlockTypeMenu
            onPick={(t) => {
              onInsertAfter(t);
              setShowInsertMenu(false);
            }}
          />
        )}
      </div>
    </div>
  );
}

// Block style panel: font size, width, margin, convert type, merge with next
function BlockStylePanel({
  block,
  onPatch,
  onConvert,
  onMergeWithNext,
  canMergeNext,
  onAddFootnoteFor,
  onClose,
}: {
  block: Block;
  onPatch: (p: Partial<Block>) => void;
  onConvert: (t: BlockType) => void;
  onMergeWithNext: () => void;
  canMergeNext: boolean;
  onAddFootnoteFor: () => void;
  onClose: () => void;
}) {
  const fontSize = block.fontSize;
  const blockWidth = block.blockWidth;
  const marginBottom = block.marginBottom ?? getDefaultMargin(block.type);
  const canHaveFootnote =
    block.type === "paragraph" ||
    block.type === "title" ||
    block.type === "subtitle" ||
    block.type === "h2" ||
    block.type === "h3" ||
    block.type === "quote" ||
    block.type === "callout" ||
    block.type === "bullet";

  return (
    <div className="block-style-panel" role="dialog" aria-label="تنظیمات بلوک">
      <div className="row">
        <span>اندازه فونت</span>
        <div className="seg">
          {(["sm", "md", "lg", "xl"] as FontSize[]).map((s) => (
            <button
              key={s}
              type="button"
              className={fontSize === s ? "active" : ""}
              onClick={() => onPatch({ fontSize: fontSize === s ? undefined : s })}
              title={s === "sm" ? "کوچک" : s === "md" ? "متوسط" : s === "lg" ? "بزرگ" : "خیلی بزرگ"}
            >
              {s === "sm" ? "کوچک" : s === "md" ? "متوسط" : s === "lg" ? "بزرگ" : "خیلی بزرگ"}
            </button>
          ))}
        </div>
      </div>

      <div className="row">
        <span>عرض بلوک</span>
        <div className="seg">
          {(["full", "wide", "medium", "narrow"] as BlockWidth[]).map((w) => (
            <button
              key={w}
              type="button"
              className={
                (blockWidth ?? "full") === w ? "active" : ""
              }
              onClick={() => onPatch({ blockWidth: w === "full" ? undefined : w })}
              title={w}
            >
              {w === "full" ? "تمام" : w === "wide" ? "پهن" : w === "medium" ? "متوسط" : "باریک"}
            </button>
          ))}
        </div>
      </div>

      <div className="row">
        <span>فاصله پایین (px): {marginBottom}</span>
        <input
          type="range"
          min={0}
          max={80}
          step={4}
          value={marginBottom}
          onChange={(e) =>
            onPatch({ marginBottom: +e.target.value })
          }
          style={{ accentColor: "#6366f1", width: "100%" }}
        />
      </div>

      <div className="convert-row">
        <span>تبدیل نوع بلوک</span>
        <select
          value={block.type}
          onChange={(e) => {
            onConvert(e.target.value as BlockType);
            onClose();
          }}
        >
          <BlockTypeOptions />
        </select>
      </div>

      <button
        type="button"
        className="merge-btn"
        disabled={!canMergeNext}
        onClick={() => {
          onMergeWithNext();
          onClose();
        }}
        title={canMergeNext ? "ادغام با بلوک بعدی" : "نمی‌توان این بلوک را با بعدی ادغام کرد"}
      >
        <GitMerge size={13} style={{ marginLeft: 4, verticalAlign: "middle" }} />
        ادغام با بلوک بعدی
      </button>

      {canHaveFootnote && (
        <button
          type="button"
          className="merge-btn"
          style={{ marginTop: 6, background: "linear-gradient(135deg, #fef3c7, #fde68a)", color: "#92400e", borderColor: "rgba(245,158,11,0.4)" }}
          onClick={() => {
            onAddFootnoteFor();
            onClose();
          }}
          title="اضافه کردن یک پاورقی برای این بلوک — متن پاورقی در زیر کادر اصلی نمایش داده می‌شود"
        >
          <Bookmark size={13} style={{ marginLeft: 4, verticalAlign: "middle" }} />
          افزودن پاورقی به این بلوک
        </button>
      )}
    </div>
  );
}

function BlockTypeOptions() {
  const items: { type: BlockType; label: string }[] = [
    { type: "title", label: "عنوان اصلی" },
    { type: "subtitle", label: "زیرعنوان" },
    { type: "h2", label: "تیتر بخش" },
    { type: "h3", label: "تیتر فرعی" },
    { type: "paragraph", label: "پاراگراف" },
    { type: "bullet", label: "فهرست نقطه‌ای" },
    { type: "quote", label: "نقل‌قول" },
    { type: "callout", label: "فراخوانی (callout)" },
    { type: "image", label: "عکس" },
    { type: "divider", label: "خط جداکننده" },
    { type: "table", label: "جدول" },
    { type: "code", label: "کد" },
    { type: "columns", label: "چندستونه" },
    { type: "footnote", label: "پاورقی" },
    { type: "toc", label: "فهرست مطالب" },
    { type: "glossary", label: "لغت‌نامه" },
    { type: "pageBreak", label: "جدید صفحه" },
  ];
  return (
    <>
      {items.map((it) => (
        <option key={it.type} value={it.type}>
          {it.label}
        </option>
      ))}
    </>
  );
}

function getDefaultMargin(type: BlockType): number {
  switch (type) {
    case "title":
    case "subtitle":
      return 12;
    case "h2":
      return 16;
    case "h3":
      return 12;
    case "paragraph":
    case "bullet":
      return 12;
    case "quote":
    case "callout":
      return 14;
    case "image":
      return 16;
    case "divider":
      return 12;
    case "table":
      return 16;
    case "code":
      return 14;
    case "spacer":
      return 0;
    case "columns":
      return 16;
    case "footnote":
      return 8;
    case "toc":
      return 18;
    case "glossary":
      return 18;
    case "pageBreak":
      return 0;
    default:
      return 12;
  }
}

// Editable bullet list — adds new items on Enter, removes on empty Backspace.
function BulletEditor({
  items,
  onChange,
}: {
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, idx: number) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const next = [...items];
      next.splice(idx + 1, 0, "");
      onChange(next);
      setTimeout(() => {
        const wraps = (e.currentTarget.parentElement?.parentElement?.querySelectorAll(
          ".bullet-item-edit"
        ) || []) as NodeListOf<HTMLDivElement>;
        wraps[idx + 1]?.focus();
      }, 10);
    }
    if (e.key === "Backspace" && items[idx] === "" && items.length > 1) {
      e.preventDefault();
      const next = items.filter((_, i) => i !== idx);
      onChange(next);
    }
  };

  return (
    <ul className="doc-bullet" style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {items.map((item, idx) => (
        <li key={idx} style={{ position: "relative", paddingInlineStart: 20, marginBottom: 4 }}>
          <span
            aria-hidden
            style={{
              position: "absolute",
              insetInlineStart: 4,
              top: "0.7em",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #6366f1, #2563eb)",
              boxShadow: "0 0 0 3px rgba(99,102,241,0.15)",
            }}
          />
          <div
            className="bullet-item-edit"
            contentEditable
            suppressContentEditableWarning
            data-placeholder="مورد لیست…"
            style={{
              fontSize: "1rem",
              lineHeight: 1.85,
              color: "#1e293b",
              outline: "none",
              minHeight: "1.4em",
            }}
            onBlur={(e) => {
              const next = [...items];
              next[idx] = e.currentTarget.innerText;
              onChange(next);
            }}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            dangerouslySetInnerHTML={{ __html: item || "" }}
          />
        </li>
      ))}
    </ul>
  );
}

// Image block: thumbnail, replace button, caption, alignment, width.
function ImageBlockEditor({
  block,
  onPatch,
  onPickImage,
  showOps,
  setShowOps,
}: {
  block: Extract<Block, { type: "image" }>;
  onPatch: (p: Partial<Block>) => void;
  onPickImage: () => void;
  showOps: boolean;
  setShowOps: (v: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {block.src ? (
        <>
          <figure
            className="doc-image"
            style={{
              width: block.width > 0 ? `${block.width}px` : "100%",
              margin:
                block.align === "start"
                  ? "0 0 0 auto"
                  : block.align === "end"
                  ? "0 auto 0 0"
                  : "0 auto",
            }}
          >
            <img src={block.src} alt={block.alt || block.caption || ""} />
            {block.caption && (
              <span className="doc-image-caption">{block.caption}</span>
            )}
          </figure>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              className="tool-pill ghost"
              onClick={() => setShowOps(!showOps)}
              style={{ fontSize: 12, padding: "4px 10px" }}
            >
              <MoreHorizontal size={14} />
              <span>گزینه‌های عکس</span>
            </button>
            <button
              type="button"
              className="tool-pill ghost"
              onClick={onPickImage}
              style={{ fontSize: 12, padding: "4px 10px" }}
            >
              <ImageIcon size={14} />
              <span>جایگزینی عکس</span>
            </button>
          </div>
          {showOps && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                padding: 12,
                borderRadius: 10,
                background: "rgba(238,242,255,0.5)",
                border: "1px solid rgba(99,102,241,0.18)",
              }}
            >
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>
                  زیرنویس (کپشن)
                </span>
                <input
                  type="text"
                  value={block.caption}
                  onChange={(e) => onPatch({ caption: e.target.value })}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid rgba(148,163,184,0.32)",
                    background: "#fff",
                    fontFamily: "inherit",
                    fontSize: 13,
                  }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>
                  متن جایگزین (alt)
                </span>
                <input
                  type="text"
                  value={block.alt}
                  onChange={(e) => onPatch({ alt: e.target.value })}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid rgba(148,163,184,0.32)",
                    background: "#fff",
                    fontFamily: "inherit",
                    fontSize: 13,
                  }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>
                  عرض (px) — ۰ = تمام‌عرض
                </span>
                <input
                  type="number"
                  min={0}
                  value={block.width}
                  onChange={(e) => onPatch({ width: Math.max(0, +e.target.value || 0) })}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid rgba(148,163,184,0.32)",
                    background: "#fff",
                    fontFamily: "inherit",
                    fontSize: 13,
                  }}
                />
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>
                  چینش
                </span>
                <div style={{ display: "flex", gap: 4 }}>
                  {(["start", "center", "end"] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => onPatch({ align: a })}
                      style={{
                        flex: 1,
                        padding: "6px 4px",
                        borderRadius: 7,
                        border:
                          block.align === a
                            ? "1px solid #2563eb"
                            : "1px solid rgba(148,163,184,0.32)",
                        background: block.align === a ? "#dbeafe" : "#fff",
                        color: block.align === a ? "#1d4ed8" : "#475569",
                        fontFamily: "inherit",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {a === "start" ? "راست" : a === "center" ? "وسط" : "چپ"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={onPickImage}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            padding: "28px 16px",
            borderRadius: 12,
            border: "2px dashed rgba(99,102,241,0.4)",
            background: "rgba(238,242,255,0.6)",
            color: "#4338ca",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <ImageIcon size={28} />
          <span>برای افزودن عکس کلیک کنید</span>
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 400 }}>
            PNG / JPG / WEBP — عکس داخل سند جاسازی می‌شود
          </span>
        </button>
      )}
    </div>
  );
}

// Table block editor — editable cells with add/remove row/column controls
function TableBlockEditor({
  block,
  onPatch,
}: {
  block: Extract<Block, { type: "table" }>;
  onPatch: (p: Partial<Block>) => void;
}) {
  const rows = block.rows;

  const setCell = (r: number, c: number, value: string) => {
    const next = rows.map((row) => [...row]);
    next[r][c] = value;
    onPatch({ rows: next });
  };
  const addRow = () => {
    const next = [...rows];
    next.push(Array(rows[0]?.length || 2).fill(""));
    onPatch({ rows: next });
  };
  const addCol = () => {
    const next = rows.map((row) => [...row, ""]);
    onPatch({ rows: next });
  };
  const removeRow = (idx: number) => {
    if (rows.length <= 1) return;
    onPatch({ rows: rows.filter((_, i) => i !== idx) });
  };
  const removeCol = (idx: number) => {
    if ((rows[0]?.length || 0) <= 1) return;
    onPatch({ rows: rows.map((row) => row.filter((_, i) => i !== idx)) });
  };

  return (
    <div>
      <table className="doc-table">
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} style={{ padding: 0 }}>
                  {r === 0 && c === 0 && block.hasHeader && (
                    <span aria-hidden style={{ position: "absolute" }} />
                  )}
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    className="doc-table-cell-edit"
                    data-placeholder="…"
                    style={{
                      padding: "9px 12px",
                      minHeight: "1.4em",
                      fontWeight:
                        block.hasHeader && r === 0 ? 700 : 400,
                      color: block.hasHeader && r === 0 ? "#1d4ed8" : "#1e293b",
                      background:
                        block.hasHeader && r === 0
                          ? "linear-gradient(135deg, rgba(238,242,255,0.95), rgba(232,245,255,0.95))"
                          : r % 2 === 0
                          ? "rgba(248,250,255,0.7)"
                          : "transparent",
                    }}
                    onBlur={(e) => setCell(r, c, e.currentTarget.innerText)}
                    dangerouslySetInnerHTML={{ __html: cell || "" }}
                  />
                </td>
              ))}
              <td style={{ padding: "4px 6px", border: "none", verticalAlign: "middle" }}>
                <button
                  type="button"
                  onClick={() => removeRow(r)}
                  title="حذف این ردیف"
                  style={{
                    width: 22,
                    height: 22,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 5,
                    border: "1px solid rgba(220,38,38,0.3)",
                    background: "#fff",
                    color: "#dc2626",
                    cursor: rows.length > 1 ? "pointer" : "not-allowed",
                    opacity: rows.length > 1 ? 1 : 0.3,
                  }}
                >
                  <Minus size={12} />
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={rows[0]?.length || 1} style={{ border: "none", padding: "4px 6px" }}>
              <div className="doc-table-toolbar">
                <button type="button" onClick={addRow}>
                  <Plus size={11} style={{ verticalAlign: "middle", marginLeft: 3 }} />
                  ردیف جدید
                </button>
                <button type="button" onClick={addCol}>
                  <Plus size={11} style={{ verticalAlign: "middle", marginLeft: 3 }} />
                  ستون جدید
                </button>
                <button
                  type="button"
                  onClick={() => onPatch({ hasHeader: !block.hasHeader })}
                >
                  {block.hasHeader ? "حذف هدر" : "هدر بگذار"}
                </button>
                {(rows[0]?.length || 0) > 1 && (
                  <button
                    type="button"
                    className="danger"
                    onClick={() => removeCol((rows[0]?.length || 1) - 1)}
                  >
                    حذف آخرین ستون
                  </button>
                )}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Code block editor — contentEditable pre + language picker
function CodeBlockEditor({
  block,
  onPatch,
}: {
  block: Extract<Block, { type: "code" }>;
  onPatch: (p: Partial<Block>) => void;
}) {
  return (
    <div className="doc-code-wrap">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: -1 }}>
        <span className="doc-code-language">
          <Code2 size={11} />
          {block.language || "plain"}
        </span>
        <select
          value={block.language}
          onChange={(e) => onPatch({ language: e.target.value })}
          style={{
            padding: "3px 8px",
            borderRadius: 6,
            border: "1px solid rgba(148,163,184,0.32)",
            background: "#fff",
            fontFamily: "inherit",
            fontSize: 11,
            color: "#475569",
            cursor: "pointer",
          }}
        >
          {[
            "plain",
            "javascript",
            "typescript",
            "python",
            "bash",
            "html",
            "css",
            "json",
            "sql",
            "go",
            "rust",
            "java",
            "php",
          ].map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
      </div>
      <div
        className="doc-code-editor"
        contentEditable
        suppressContentEditableWarning
        data-placeholder="// کد خود را اینجا بنویسید…"
        onBlur={(e) => onPatch({ code: e.currentTarget.innerText })}
        dangerouslySetInnerHTML={{ __html: block.code || "" }}
      />
    </div>
  );
}

// Spacer block — visual placeholder + height slider
function SpacerBlockEditor({
  block,
  onPatch,
}: {
  block: Extract<Block, { type: "spacer" }>;
  onPatch: (p: Partial<Block>) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        className="doc-spacer"
        style={{ height: Math.max(16, block.height) }}
      >
        <span>فاصله: {block.height}px</span>
      </div>
      <input
        type="range"
        min={8}
        max={160}
        step={4}
        value={block.height}
        onChange={(e) => onPatch({ height: +e.target.value })}
        style={{ accentColor: "#6366f1", width: "100%" }}
      />
    </div>
  );
}

// Columns block editor — 2 or 3 columns, each holding text-type blocks
function ColumnsBlockEditor({
  block,
  onPatch,
}: {
  block: Extract<Block, { type: "columns" }>;
  onPatch: (p: Partial<Block>) => void;
}) {
  function setColumnText(colIdx: number, blockIdx: number, text: string) {
    const next = block.columns.map((col) => col.map((b) => ({ ...b })));
    next[colIdx][blockIdx].text = text;
    onPatch({ columns: next });
  }
  function addColumnItem(colIdx: number, type: BlockType) {
    if (!TEXT_TYPES.includes(type)) return;
    const next = block.columns.map((col) => [...col]);
    next[colIdx].push({ id: newId(), type: type as any, text: "" });
    onPatch({ columns: next });
  }
  function removeColumnItem(colIdx: number, blockIdx: number) {
    const next = block.columns.map((col) => [...col]);
    next[colIdx].splice(blockIdx, 1);
    onPatch({ columns: next });
  }
  function setColumnCount(n: 2 | 3) {
    if (n === block.columnCount) return;
    if (n === 3) {
      onPatch({
        columnCount: 3,
        columns: [...block.columns, [{ id: newId(), type: "paragraph", text: "ستون سوم" }]],
      });
    } else {
      onPatch({
        columnCount: 2,
        columns: block.columns.slice(0, 2),
      });
    }
  }

  return (
    <div>
      <div className={`doc-columns cols-${block.columnCount}`}>
        {block.columns.map((col, ci) => (
          <div key={ci} className="doc-column">
            {col.map((item, bi) => (
              <div key={item.id} style={{ position: "relative" }}>
                <div
                  className="doc-column-item"
                  contentEditable
                  suppressContentEditableWarning
                  data-placeholder="متن این مورد…"
                  style={{
                    fontWeight:
                      item.type === "title" || item.type === "h2" || item.type === "h3"
                        ? 700
                        : 400,
                    fontSize:
                      item.type === "title"
                        ? "1.25rem"
                        : item.type === "h2"
                        ? "1.1rem"
                        : item.type === "h3"
                        ? "1rem"
                        : "0.95rem",
                    color:
                      item.type === "title" || item.type === "h2" || item.type === "h3"
                        ? "#0c1a3b"
                        : item.type === "quote"
                        ? "#312e81"
                        : item.type === "callout"
                        ? "#1e3a8a"
                        : "#1e293b",
                    background:
                      item.type === "quote"
                        ? "rgba(238,242,255,0.7)"
                        : item.type === "callout"
                        ? "rgba(219,234,254,0.7)"
                        : "transparent",
                    borderInlineStart:
                      item.type === "quote" ? "3px solid #6366f1" : "none",
                    borderRadius: item.type === "quote" || item.type === "callout" ? 6 : 0,
                    padding: item.type === "quote" || item.type === "callout" ? "4px 8px" : "2px 4px",
                  }}
                  onBlur={(e) => setColumnText(ci, bi, e.currentTarget.innerText)}
                  dangerouslySetInnerHTML={{ __html: item.text || "" }}
                />
                <button
                  type="button"
                  onClick={() => removeColumnItem(ci, bi)}
                  title="حذف این مورد"
                  style={{
                    position: "absolute",
                    insetInlineStart: -2,
                    top: -2,
                    width: 16,
                    height: 16,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 4,
                    border: "1px solid rgba(220,38,38,0.3)",
                    background: "#fff",
                    color: "#dc2626",
                    cursor: "pointer",
                    opacity: 0,
                    transition: "opacity 140ms ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                >
                  <Minus size={10} />
                </button>
              </div>
            ))}
            <select
              onChange={(e) => {
                if (e.target.value) {
                  addColumnItem(ci, e.target.value as BlockType);
                  e.target.value = "";
                }
              }}
              defaultValue=""
              style={{
                padding: "4px 6px",
                borderRadius: 6,
                border: "1px dashed rgba(99,102,241,0.4)",
                background: "rgba(238,242,255,0.4)",
                fontFamily: "inherit",
                fontSize: 11.5,
                color: "#4338ca",
                cursor: "pointer",
              }}
            >
              <option value="">+ افزودن مورد</option>
              <option value="paragraph">پاراگراف</option>
              <option value="h2">تیتر بخش</option>
              <option value="h3">تیتر فرعی</option>
              <option value="quote">نقل‌قول</option>
              <option value="callout">فراخوانی</option>
            </select>
          </div>
        ))}
      </div>
      <div className="doc-columns-toolbar">
        <button
          type="button"
          onClick={() => setColumnCount(2)}
          style={block.columnCount === 2 ? { borderColor: "#2563eb", color: "#1d4ed8" } : {}}
        >
          ۲ ستون
        </button>
        <button
          type="button"
          onClick={() => setColumnCount(3)}
          style={block.columnCount === 3 ? { borderColor: "#2563eb", color: "#1d4ed8" } : {}}
        >
          ۳ ستون
        </button>
      </div>
    </div>
  );
}

// Footnote block editor — single-line contentEditable for the footnote text.
// The footnote number is computed at render time based on document order.
function FootnoteBlockEditor({
  block,
  onPatch,
}: {
  block: Extract<Block, { type: "footnote" }>;
  onPatch: (p: Partial<Block>) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
        padding: "8px 12px",
        borderRadius: 8,
        background: "linear-gradient(135deg, rgba(254,243,199,0.6), rgba(254,240,138,0.4))",
        border: "1px dashed rgba(245,158,11,0.4)",
      }}
    >
      <Bookmark size={14} style={{ color: "#92400e", marginTop: 4, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "#92400e", fontWeight: 700, marginBottom: 4 }}>
          پاورقی — در زیر کادر اصلی نمایش داده می‌شود
        </div>
        <div
          contentEditable
          suppressContentEditableWarning
          data-placeholder="متن پاورقی را اینجا بنویسید…"
          style={{
            fontSize: 13,
            lineHeight: 1.7,
            color: "#1e293b",
            outline: "none",
            minHeight: "1.4em",
          }}
          onBlur={(e) => onPatch({ text: e.currentTarget.innerText })}
          dangerouslySetInnerHTML={{ __html: block.text || "" }}
        />
      </div>
    </div>
  );
}

// TOC block editor — title + level toggles + live preview of entries
function TocBlockEditor({
  block,
  onPatch,
}: {
  block: Extract<Block, { type: "toc" }>;
  onPatch: (p: Partial<Block>) => void;
}) {
  return (
    <div
      className="doc-toc"
      style={{ breakAfter: "auto" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <ListTree size={18} style={{ color: "#1d4ed8" }} />
        <input
          type="text"
          value={block.title}
          onChange={(e) => onPatch({ title: e.target.value })}
          placeholder="عنوان فهرست"
          style={{
            flex: 1,
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid rgba(148,163,184,0.32)",
            background: "#fff",
            fontFamily: "inherit",
            fontSize: 16,
            fontWeight: 800,
            color: "#0c1a3b",
            textAlign: "right",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          marginBottom: 12,
          fontSize: 12,
        }}
      >
        <span style={{ color: "#475569", fontWeight: 600, alignSelf: "center" }}>سطوح:</span>
        {[
          { key: "includeSubtitle", label: "زیرعنوان" },
          { key: "includeH2", label: "تیتر بخش (h2)" },
          { key: "includeH3", label: "تیتر فرعی (h3)" },
        ].map((opt) => {
          const checked = block[opt.key as "includeH2" | "includeH3" | "includeSubtitle"];
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onPatch({ [opt.key]: !checked } as Partial<Block>)}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                border: checked
                  ? "1px solid #2563eb"
                  : "1px solid rgba(148,163,184,0.32)",
                background: checked ? "#dbeafe" : "#fff",
                color: checked ? "#1d4ed8" : "#475569",
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {checked ? "✓ " : ""}
              {opt.label}
            </button>
          );
        })}
      </div>

      <div
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          background: "rgba(255,255,255,0.6)",
          border: "1px dashed rgba(99,102,241,0.32)",
          fontSize: 12,
          color: "#475569",
          lineHeight: 1.7,
        }}
      >
        <strong style={{ color: "#1d4ed8" }}>پیش‌نمایش:</strong> فهرست مطالب به‌صورت خودکار از
        تیترهای سند ساخته می‌شود. شماره صفحه‌ها به‌طور خودکار هنگام خروجی PDF محاسبه و درج
        می‌شوند. این بلوک در زمان چاپ، یک صفحه کامل را اشغال می‌کند.
      </div>
    </div>
  );
}

// Glossary block editor — list of detected English words with meaning input
function GlossaryBlockEditor({
  block,
  onPatch,
}: {
  block: Extract<Block, { type: "glossary" }>;
  onPatch: (p: Partial<Block>) => void;
}) {
  function setMeaning(idx: number, meaning: string) {
    const next = block.entries.map((e) => ({ ...e }));
    next[idx].meaning = meaning;
    onPatch({ entries: next });
  }
  function removeEntry(idx: number) {
    onPatch({ entries: block.entries.filter((_, i) => i !== idx) });
  }
  function addManual() {
    const newEntry = { id: newId(), word: "", meaning: "" };
    onPatch({ entries: [...block.entries, newEntry] });
  }
  function setWord(idx: number, word: string) {
    const next = block.entries.map((e) => ({ ...e }));
    next[idx].word = word;
    onPatch({ entries: next });
  }

  return (
    <div className="doc-glossary" style={{ breakBefore: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <BookOpen size={18} style={{ color: "#1d4ed8" }} />
        <input
          type="text"
          value={block.title}
          onChange={(e) => onPatch({ title: e.target.value })}
          placeholder="عنوان لغت‌نامه"
          style={{
            flex: 1,
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid rgba(148,163,184,0.32)",
            background: "#fff",
            fontFamily: "inherit",
            fontSize: 16,
            fontWeight: 800,
            color: "#0c1a3b",
            textAlign: "right",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          marginBottom: 12,
          fontSize: 12,
        }}
      >
        <button
          type="button"
          onClick={() => onPatch({ autoDetect: !block.autoDetect })}
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            border: block.autoDetect
              ? "1px solid #16a34a"
              : "1px solid rgba(148,163,184,0.32)",
            background: block.autoDetect ? "#dcfce7" : "#fff",
            color: block.autoDetect ? "#166534" : "#475569",
            fontFamily: "inherit",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
          title="وقتی فعال باشد، کلمات انگلیسی متن به‌طور خودکار به لغت‌نامه اضافه می‌شوند"
        >
          <Languages size={11} style={{ verticalAlign: "middle", marginLeft: 3 }} />
          {block.autoDetect ? "تشخیص خودکار: روشن" : "تشخیص خودکار: خاموش"}
        </button>
        <button
          type="button"
          onClick={() => onPatch({ twoColumn: !block.twoColumn })}
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            border: block.twoColumn
              ? "1px solid #2563eb"
              : "1px solid rgba(148,163,184,0.32)",
            background: block.twoColumn ? "#dbeafe" : "#fff",
            color: block.twoColumn ? "#1d4ed8" : "#475569",
            fontFamily: "inherit",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {block.twoColumn ? "۲ ستونه" : "۱ ستونه"}
        </button>
        <button
          type="button"
          onClick={addManual}
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            border: "1px solid rgba(99,102,241,0.32)",
            background: "#fff",
            color: "#4338ca",
            fontFamily: "inherit",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Plus size={11} style={{ verticalAlign: "middle", marginLeft: 3 }} />
          افزودن کلمه دستی
        </button>
      </div>

      {block.entries.length === 0 ? (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.6)",
            border: "1px dashed rgba(148,163,184,0.32)",
            fontSize: 12.5,
            color: "#64748b",
            fontStyle: "italic",
            lineHeight: 1.7,
          }}
        >
          هنوز کلمه‌ای ثبت نشده است. اگر «تشخیص خودکار» روشن باشد، با افزودن متن انگلیسی به
          سند، کلمات به‌صورت خودکار اینجا ظاهر می‌شوند. معنی هر کلمه را در کادر روبروی آن
          بنویسید.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: block.twoColumn ? "1fr 1fr" : "1fr",
            gap: 8,
          }}
        >
          {block.entries.map((entry, idx) => (
            <div
              key={entry.id}
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr 28px",
                gap: 6,
                alignItems: "center",
                padding: "6px 8px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.8)",
                border: "1px solid rgba(148,163,184,0.22)",
              }}
            >
              <input
                type="text"
                value={entry.word}
                onChange={(e) => setWord(idx, e.target.value)}
                placeholder="word"
                style={{
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid rgba(148,163,184,0.22)",
                  background: "#fff",
                  fontFamily: "Consolas, Menlo, monospace",
                  fontSize: 12.5,
                  color: "#1d4ed8",
                  direction: "ltr",
                  textAlign: "left",
                  fontWeight: 700,
                }}
              />
              <input
                type="text"
                value={entry.meaning}
                onChange={(e) => setMeaning(idx, e.target.value)}
                placeholder="معنی / توضیح…"
                style={{
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid rgba(148,163,184,0.22)",
                  background: "#fff",
                  fontFamily: "inherit",
                  fontSize: 12.5,
                  color: "#1e293b",
                  textAlign: "right",
                }}
              />
              <button
                type="button"
                onClick={() => removeEntry(idx)}
                title="حذف این کلمه"
                style={{
                  width: 24,
                  height: 24,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 5,
                  border: "1px solid rgba(220,38,38,0.3)",
                  background: "#fff",
                  color: "#dc2626",
                  cursor: "pointer",
                }}
              >
                <Minus size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          marginTop: 10,
          fontSize: 11.5,
          color: "#64748b",
          lineHeight: 1.6,
          textAlign: "right",
        }}
      >
        تعداد کلمات: {block.entries.length} — این بلوک هنگام خروجی PDF در یک صفحه جداگانه
        (یا چند صفحه اگر کلمات زیاد باشند) نمایش داده می‌شود.
      </div>
    </div>
  );
}

// Page break — visual divider that forces a new A4 page in print
function PageBreakBlockEditor() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 8,
        background:
          "repeating-linear-gradient(135deg, rgba(99,102,241,0.06) 0px, rgba(99,102,241,0.06) 8px, transparent 8px, transparent 16px)",
        border: "1px dashed rgba(99,102,241,0.32)",
        color: "#4338ca",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      <FileOutput size={14} />
      <span>شکست صفحه — محتوای بعد از این بلوک در یک صفحه جدید A4 شروع می‌شود</span>
    </div>
  );
}

function BlockTypeMenu({ onPick }: { onPick: (t: BlockType) => void }) {
  const items: { type: BlockType; label: string; icon: React.ReactNode }[] = [
    { type: "title", label: "عنوان اصلی", icon: <Heading1 size={16} /> },
    { type: "subtitle", label: "زیرعنوان", icon: <Subtitles size={16} /> },
    { type: "h2", label: "تیتر بخش", icon: <Heading2 size={16} /> },
    { type: "h3", label: "تیتر فرعی", icon: <Heading3 size={16} /> },
    { type: "paragraph", label: "پاراگراف", icon: <Type size={16} /> },
    { type: "bullet", label: "فهرست نقطه‌ای", icon: <List size={16} /> },
    { type: "quote", label: "نقل‌قول", icon: <Quote size={16} /> },
    { type: "callout", label: "فراخوانی (callout)", icon: <Info size={16} /> },
    { type: "image", label: "عکس", icon: <ImageIcon size={16} /> },
    { type: "table", label: "جدول", icon: <TableIcon size={16} /> },
    { type: "code", label: "کد", icon: <Code2 size={16} /> },
    { type: "columns", label: "چندستونه", icon: <Columns3 size={16} /> },
    { type: "spacer", label: "فاصله (spacer)", icon: <Square size={16} /> },
    { type: "divider", label: "خط جداکننده", icon: <Minus size={16} /> },
    { type: "footnote", label: "پاورقی", icon: <Bookmark size={16} /> },
    { type: "toc", label: "فهرست مطالب", icon: <ListTree size={16} /> },
    { type: "glossary", label: "لغت‌نامه", icon: <BookOpen size={16} /> },
    { type: "pageBreak", label: "جدید صفحه", icon: <FileOutput size={16} /> },
  ];
  return (
    <div className="type-menu" role="menu">
      {items.map((it) => (
        <button
          key={it.type}
          type="button"
          className="type-menu-item"
          onClick={() => onPick(it.type)}
          role="menuitem"
        >
          <span className="icon-wrap">{it.icon}</span>
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function BlockEditor({
  blocks,
  onChange,
  onInsertAfter,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onConvert,
  onMergeWithNext,
  onOpenImagePicker,
  onCopyBlock,
  onAddFootnoteFor,
  searchQuery,
}: BlockEditorProps) {
  const { setNodeRef } = useDroppable({ id: "blocks-canvas" });

  return (
    <div ref={setNodeRef} style={{ position: "relative", paddingInlineStart: 12 }}>
      <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        {blocks.map((b, idx) => {
          const next = blocks[idx + 1];
          const canMergeNext = next ? canMerge(b, next) : false;
          return (
            <SortableBlock
              key={b.id}
              block={b}
              canUp={idx > 0}
              canDown={idx < blocks.length - 1}
              canMergeNext={canMergeNext}
              onChange={(nb) =>
                onChange(blocks.map((x) => (x.id === nb.id ? nb : x)))
              }
              onRemove={() => onRemove(b.id)}
              onDuplicate={() => onDuplicate(b.id)}
              onMoveUp={() => onMoveUp(b.id)}
              onMoveDown={() => onMoveDown(b.id)}
              onInsertAfter={(t) => onInsertAfter(b.id, t)}
              onConvert={(t) => onConvert(b.id, t)}
              onMergeWithNext={() => onMergeWithNext(b.id)}
              onOpenImagePicker={() => onOpenImagePicker(b.id)}
              onCopyBlock={() => onCopyBlock(b.id)}
              onAddFootnoteFor={() => onAddFootnoteFor(b.id)}
              searchQuery={searchQuery}
            />
          );
        })}
      </SortableContext>
    </div>
  );
}
