import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Check, ChevronDown, ChevronRight, Package } from "lucide-react";
import type { Product } from "../types/domain";

interface ProductHierarchySelectProps {
  products: Product[];
  value: string;
  disabledIds?: Set<string>;
  ariaLabel: string;
  onChange: (productId: string) => void;
}

export function ProductHierarchySelect({
  products,
  value,
  disabledIds = new Set<string>(),
  ariaLabel,
  onChange,
}: ProductHierarchySelectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const productById = new Map(products.map((product) => [product.id, product]));
  const parentById = new Map<string, string | null>();

  products.forEach((product) => {
    const parentId = product.parentId && productById.has(product.parentId)
      ? product.parentId
      : product.originProductIds.find((id) => productById.has(id)) || null;
    parentById.set(product.id, parentId);
  });

  const childrenById = new Map<string, Product[]>();
  products.forEach((product) => {
    const parentId = parentById.get(product.id);
    if (!parentId) return;
    childrenById.set(parentId, [...(childrenById.get(parentId) || []), product]);
  });
  childrenById.forEach((children) =>
    children.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  );
  const roots = products
    .filter((product) => !parentById.get(product.id))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const selected = productById.get(value);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  const openSelector = () => {
    if (!open && value) {
      const ancestors = new Set<string>();
      let parentId = parentById.get(value);
      while (parentId) {
        ancestors.add(parentId);
        parentId = parentById.get(parentId);
      }
      setExpandedIds((current) => new Set([...current, ...ancestors]));
    }
    setOpen((current) => !current);
  };

  const toggleExpanded = (productId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const selectProduct = (productId: string) => {
    if (disabledIds.has(productId)) return;
    onChange(productId);
    setOpen(false);
  };

  const renderNode = (product: Product, depth: number) => {
    const children = childrenById.get(product.id) || [];
    const expanded = expandedIds.has(product.id);
    const disabled = disabledIds.has(product.id);
    const active = product.id === value;

    return (
      <div className={`product-tree-node ${depth === 0 ? "group" : "branch"}`} key={product.id}>
        <div
          className={`product-tree-row ${active ? "selected" : ""} ${disabled ? "disabled" : ""}`}
          style={{ "--tree-depth": depth } as CSSProperties}
        >
          {children.length ? (
            <button
              type="button"
              className="product-tree-expand"
              aria-label={`${expanded ? "Recolher" : "Expandir"} ${product.name}`}
              aria-expanded={expanded}
              onClick={() => toggleExpanded(product.id)}
            >
              {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
          ) : (
            <span className="product-tree-spacer" />
          )}
          <button
            type="button"
            className="product-tree-option"
            aria-label={product.name}
            disabled={disabled}
            onClick={() => selectProduct(product.id)}
          >
            <span className="product-tree-icon"><Package size={14} /></span>
            <span><strong>{product.name}</strong><small>{depth === 0 ? "Grupo de produto" : `Ramificação · nível ${product.level}`}</small></span>
            {active && <Check size={16} />}
          </button>
        </div>
        {children.length > 0 && expanded && (
          <div className="product-tree-children">
            {children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="product-hierarchy-select" ref={containerRef}>
      <button
        type="button"
        className={`product-hierarchy-trigger ${open ? "open" : ""}`}
        aria-label={ariaLabel}
        aria-haspopup="tree"
        aria-expanded={open}
        onClick={openSelector}
      >
        <span><strong>{selected?.name || "Selecione um produto"}</strong><small>{selected ? `Nível ${selected.level}` : "Abra um grupo para ver as ramificações"}</small></span>
        <ChevronDown size={17} />
      </button>
      {open && (
        <div className="product-hierarchy-panel" role="tree" aria-label="Grupos de produtos">
          <div className="product-hierarchy-panel__header">
            <strong>Grupos de produtos</strong>
            <span>Selecione o grupo para iniciar ramificado ou expanda para escolher um produto</span>
          </div>
          <div className="product-hierarchy-groups">
            {roots.map((root) => renderNode(root, 0))}
          </div>
        </div>
      )}
    </div>
  );
}
