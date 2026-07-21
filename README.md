# Pord — ویرایشگر سند فارسی

ویرایشگر سند فارسی با خروجی PDF / Word، صفحه‌بندی A4، و منوی عمودی فهرست تیترها (Notion-style).

## نصب و اجرا

```bash
bun install
bun run dev
```

سپس http://localhost:3000 را در مرورگر باز کنید.

## امکانات

- ویرایشگر block-based با قابلیت drag & drop
- پشتیبانی از title، subtitle، h2، h3، paragraph، bullet، quote، callout،
  divider، image، table، code، spacer، columns، footnote، toc، glossary
- ذخیره‌ی خودکار در IndexedDB (با fallback به localStorage)
- منوی عمودی فهرست تیترها در سمت راست (قابل جمع‌شدن)
- خروجی PDF و Word با حفظ استایل
- تم روشن و تاریک
- ایمپورت/اکسپورت JSON و TXT
- سندهای ذخیره‌شده (snapshots)

## تکنولوژی‌ها

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 4
- @dnd-kit (drag & drop)
- lucide-react (icons)
- Vazirmatn (Persian font)
