type Tab = "today" | "search" | "text" | "settings";

export function Nav({
  tab,
  onChange,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
}) {
  const items: { id: Tab; label: string }[] = [
    { id: "today", label: "Сегодня" },
    { id: "search", label: "Поиск" },
    { id: "text", label: "Текст" },
    { id: "settings", label: "Цели" },
  ];
  return (
    <nav className="nav">
      {items.map((i) => (
        <button
          key={i.id}
          className={tab === i.id ? "active" : ""}
          type="button"
          onClick={() => onChange(i.id)}
        >
          {i.label}
        </button>
      ))}
    </nav>
  );
}
