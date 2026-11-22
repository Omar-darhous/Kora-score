import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { computeMobilePortalPosition } from '../utils/dropdownPosition';

const DESKTOP_PORTAL_MIN_WIDTH = 768;

const Dropdown = ({
  options = [],
  value,
  onChange,
  placeholder = 'اختر...',
  icon = null,
  ariaLabel = 'قائمة الاختيارات',
  id,
  className = '',
  size = 'md',
  disabled = false,
  fullWidth = false,
  align = 'auto',
  useDesktopPortal = false,
  useMobilePortal = false,
  categoryTabs = null,
  activeCategory: propActiveCategory = null,
  onCategoryChange = null,
  searchable = false,
  searchPlaceholder = 'ابحث عن بطولة...',
  filterOption = null
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState('bottom');
  const [horizAlign, setHorizAlign] = useState('right');
  const [portalStyle, setPortalStyle] = useState(null);
  const [scrollAreaStyle, setScrollAreaStyle] = useState(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [internalCategory, setInternalCategory] = useState(() => {
    if (propActiveCategory) return propActiveCategory;
    if (Array.isArray(categoryTabs) && categoryTabs.length > 0) {
      return categoryTabs[0].id;
    }
    return null;
  });
  const [searchQuery, setSearchQuery] = useState('');

  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const selectedItemRef = useRef(null);
  const searchInputRef = useRef(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const hasCategories = Array.isArray(categoryTabs) && categoryTabs.length > 0;
  const activeCategory = propActiveCategory !== null ? propActiveCategory : internalCategory;

  const setActiveCategory = useCallback((nextCat) => {
    if (onCategoryChange) {
      onCategoryChange(nextCat);
    } else {
      setInternalCategory(nextCat);
    }
    setFocusedIndex(0);
  }, [onCategoryChange]);

  const visibleOptions = useMemo(() => {
    const trimmedQuery = searchQuery.trim();
    const matchesSearch = (opt) => {
      if (!trimmedQuery) return true;
      if (typeof filterOption === 'function') {
        return filterOption(opt, trimmedQuery);
      }
      return String(opt.label || '').toLowerCase().includes(trimmedQuery.toLowerCase());
    };

    const inCategory = options.filter((opt) => {
      if (hasCategories && activeCategory && activeCategory !== 'all') {
        if (opt.category && opt.category !== activeCategory) {
          return false;
        }
        if (opt.value === 'all') {
          return false;
        }
      }
      return matchesSearch(opt);
    });

    if (inCategory.length > 0 || !trimmedQuery) {
      return inCategory;
    }

    // Fallback when searching by name across categories
    return options.filter((opt) => opt.value !== 'all' && matchesSearch(opt));
  }, [options, hasCategories, activeCategory, searchQuery, filterOption]);

  // تحديث تموضع القائمة الذكي بناءً على حدود الشاشة (Collision Detection)
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // تموضع رأسي (أعلى / أسفل)
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const menuEstimatedHeight = Math.min(280, options.length * 40 + 16);
    const nextPlacement = spaceBelow < menuEstimatedHeight && spaceAbove > spaceBelow ? 'top' : 'bottom';
    setPlacement(nextPlacement);

    const shouldDesktopPortal = useDesktopPortal && viewportWidth >= DESKTOP_PORTAL_MIN_WIDTH;
    if (shouldDesktopPortal) {
      const menuWidth = Math.min(Math.max(rect.width, 195), viewportWidth - 24);
      let left = rect.right - menuWidth;
      if (align === 'left') {
        left = rect.left;
      }
      left = Math.max(12, Math.min(left, viewportWidth - menuWidth - 12));

      const style = {
        position: 'fixed',
        left: `${Math.round(left)}px`,
        right: 'auto',
        minWidth: `${Math.round(menuWidth)}px`,
        maxWidth: `${Math.min(280, viewportWidth - 24)}px`,
        zIndex: 1300
      };
      if (nextPlacement === 'top') {
        style.bottom = `${Math.round(viewportHeight - rect.top + 6)}px`;
        style.top = 'auto';
      } else {
        style.top = `${Math.round(rect.bottom + 6)}px`;
        style.bottom = 'auto';
      }
      setPortalStyle(style);
      setScrollAreaStyle(null);
      return;
    }

    const shouldMobilePortal = useMobilePortal && viewportWidth < DESKTOP_PORTAL_MIN_WIDTH;
    if (shouldMobilePortal) {
      const vv = window.visualViewport;
      const mobileViewportWidth = vv?.width || viewportWidth;
      const mobileViewportHeight = vv?.height || viewportHeight;
      const viewportOffsetTop = vv?.offsetTop || 0;
      const viewportOffsetLeft = vv?.offsetLeft || 0;

      let bottomNavHeight = 0;
      if (typeof document !== 'undefined') {
        const bottomNav = document.querySelector('.mobile-bottom-nav');
        if (bottomNav) {
          const navRect = bottomNav.getBoundingClientRect();
          if (navRect.height > 0 && navRect.top < viewportHeight) {
            bottomNavHeight = navRect.height;
          }
        }
      }

      const mobilePos = computeMobilePortalPosition({
        triggerRect: rect,
        viewportWidth: mobileViewportWidth,
        viewportHeight: mobileViewportHeight,
        layoutViewportHeight: viewportHeight,
        viewportOffsetTop,
        viewportOffsetLeft,
        optionsCount: options.length,
        align,
        topSafeInset: 12,
        bottomSafeInset: Math.max(12, bottomNavHeight + 10)
      });

      setPlacement(mobilePos.placement);
      setPortalStyle(mobilePos.style);
      setScrollAreaStyle(mobilePos.scrollAreaStyle);
      return;
    }

    setPortalStyle(null);
    setScrollAreaStyle(null);

    // تموضع أفقي (يمين / يسار في بيئة RTL)
    if (align !== 'auto') {
      setHorizAlign(align);
      return;
    }

    const estimatedWidth = Math.min(260, viewportWidth - 24);
    // في RTL يبدأ التدفق من اليمين؛ إذا كان تمدد القائمة لليسار سيتجاوز الشاشة، نعكسها لليسار
    if (rect.right - estimatedWidth < 12) {
      setHorizAlign('left');
    } else if (rect.left + estimatedWidth > viewportWidth - 12) {
      setHorizAlign('right');
    } else {
      setHorizAlign('right');
    }
  }, [options.length, align, useDesktopPortal, useMobilePortal]);

  // فتح/إغلاق القائمة مع إعادة حساب الموقع
  const toggleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      setSearchQuery('');
      if (hasCategories && propActiveCategory === null) {
        const selectedCat = selectedOption?.category;
        if (selectedCat && categoryTabs.some(t => t.id === selectedCat)) {
          setInternalCategory(selectedCat);
        } else if (categoryTabs.some(t => t.id === 'all')) {
          setInternalCategory('all');
        }
      }
      updatePosition();
      const currentIndex = visibleOptions.findIndex((opt) => opt.value === value);
      setFocusedIndex(currentIndex >= 0 ? currentIndex : 0);
    }
    setIsOpen((prev) => !prev);
  };

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setFocusedIndex(-1);
    setSearchQuery('');
  }, []);

  // تمرير الخيار المختار إلى مجال الرؤية فور فتح القائمة
  useEffect(() => {
    if (isOpen && selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen]);

  // إغلاق عند النقر أو اللمس خارج القائمة (Touch & Click outside)
  useEffect(() => {
    const handleOutsideInteraction = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target) &&
        (!menuRef.current || !menuRef.current.contains(event.target))
      ) {
        handleClose();
      }
    };

    const visualViewport = typeof window !== 'undefined' ? window.visualViewport : null;

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideInteraction);
      document.addEventListener('touchstart', handleOutsideInteraction, { passive: true });
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      visualViewport?.addEventListener('resize', updatePosition);
      visualViewport?.addEventListener('scroll', updatePosition);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideInteraction);
      document.removeEventListener('touchstart', handleOutsideInteraction);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      visualViewport?.removeEventListener('resize', updatePosition);
      visualViewport?.removeEventListener('scroll', updatePosition);
    };
  }, [isOpen, handleClose, updatePosition]);

  // إدارة لوحة المفاتيح لدعم إمكانية الوصول الكاملة (A11y)
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        toggleOpen();
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        handleClose();
        if (triggerRef.current) triggerRef.current.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => (visibleOptions.length > 0 && prev < visibleOptions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => (visibleOptions.length > 0 && prev > 0 ? prev - 1 : Math.max(0, visibleOptions.length - 1)));
        break;
      case 'Enter':
      case ' ':
        if (e.key === ' ' && searchable && document.activeElement === searchInputRef.current) {
          return;
        }
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < visibleOptions.length) {
          const opt = visibleOptions[focusedIndex];
          if (!opt.disabled) {
            onChange(opt.value);
            handleClose();
            if (triggerRef.current) triggerRef.current.focus();
          }
        }
        break;
      case 'Home':
        if (searchable && document.activeElement === searchInputRef.current) return;
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        if (searchable && document.activeElement === searchInputRef.current) return;
        e.preventDefault();
        setFocusedIndex(Math.max(0, visibleOptions.length - 1));
        break;
      default:
        break;
    }
  };

  const handleSelect = (optValue, optDisabled) => {
    if (optDisabled) return;
    onChange(optValue);
    handleClose();
    if (triggerRef.current) triggerRef.current.focus();
  };

  const dropdownMenu = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          className={`custom-dropdown-menu ${(hasCategories || searchable) ? 'categorized-dropdown-menu' : ''} ${portalStyle ? 'portal-menu' : `placement-${placement} align-${horizAlign}`}`}
          style={portalStyle || undefined}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          initial={{ opacity: 0, scale: 0.96, y: placement === 'bottom' ? -6 : 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: placement === 'bottom' ? -6 : 6 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          {(hasCategories || searchable) && (
            <div className="dropdown-controls-header" onClick={(e) => e.stopPropagation()}>
              {hasCategories && (
                <div className="dropdown-category-tabs" role="tablist" aria-label="تصنيف البطولات">
                  {categoryTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={activeCategory === tab.id}
                      className={`dropdown-category-tab ${activeCategory === tab.id ? 'active' : ''}`}
                      onClick={() => setActiveCategory(tab.id)}
                    >
                      <span>{tab.label}</span>
                      {typeof tab.count === 'number' && (
                        <span className="dropdown-category-count">{tab.count}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {searchable && (
                <div className="dropdown-search-box">
                  <Search size={13} className="dropdown-search-icon" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="dropdown-search-input"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setFocusedIndex(0);
                    }}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                    dir="rtl"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="dropdown-search-clear"
                      onClick={() => {
                        setSearchQuery('');
                        setFocusedIndex(0);
                        searchInputRef.current?.focus();
                      }}
                      aria-label="مسح البحث"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="custom-dropdown-scroll-area" style={scrollAreaStyle || undefined}>
            {visibleOptions.length === 0 ? (
              <div className="custom-dropdown-empty">لا توجد بطولات مطابقة</div>
            ) : (
              visibleOptions.map((opt, index) => {
                const isSelected = opt.value === value;
                const isFocused = index === focusedIndex;
                const prevGroupLabel = index > 0 ? visibleOptions[index - 1]?.groupLabel : null;
                const showGroupHeader = Boolean(opt.groupLabel && opt.groupLabel !== prevGroupLabel);

                return (
                  <React.Fragment key={opt.value}>
                    {showGroupHeader && (
                      <div className="dropdown-group-heading" role="presentation">
                        {opt.groupLabel}
                      </div>
                    )}
                    <div
                      ref={isSelected ? selectedItemRef : null}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={opt.disabled}
                      className={`custom-dropdown-option ${isSelected ? 'selected' : ''} ${isFocused ? 'focused' : ''} ${opt.disabled ? 'disabled' : ''}`}
                      onClick={() => handleSelect(opt.value, opt.disabled)}
                      onMouseEnter={() => setFocusedIndex(index)}
                    >
                      <div className="dropdown-option-left">
                        {opt.icon && (
                          <img
                            src={opt.icon}
                            alt=""
                            className="dropdown-option-img"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        )}
                        <span className="dropdown-option-label">{opt.label}</span>
                      </div>

                      {isSelected && (
                        <Check size={15} className="dropdown-check-icon" aria-hidden="true" />
                      )}
                    </div>
                  </React.Fragment>
                );
              })
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div
      ref={containerRef}
      className={`custom-dropdown-container ${className} ${fullWidth ? 'full-width' : ''}`}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={`custom-dropdown-trigger size-${size} ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={toggleOpen}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
      >
        <span className="dropdown-trigger-content">
          {icon && <span className="dropdown-trigger-icon">{icon}</span>}
          {selectedOption?.icon && (
            <img
              src={selectedOption.icon}
              alt=""
              className="dropdown-option-img"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          )}
          <span className="dropdown-trigger-label">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <ChevronDown
          size={15}
          className={`dropdown-chevron ${isOpen ? 'rotated' : ''}`}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown Menu Popover (Portal on desktop when enabled to avoid ancestor overflow clipping) */}
      {portalStyle && typeof document !== 'undefined'
        ? createPortal(dropdownMenu, document.body)
        : dropdownMenu}
    </div>
  );
};

export default Dropdown;

