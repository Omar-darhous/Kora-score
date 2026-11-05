import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

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
  align = 'auto'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState('bottom');
  const [horizAlign, setHorizAlign] = useState('right');
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const selectedItemRef = useRef(null);

  const selectedOption = options.find((opt) => opt.value === value);

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

    if (spaceBelow < menuEstimatedHeight && spaceAbove > spaceBelow) {
      setPlacement('top');
    } else {
      setPlacement('bottom');
    }

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
  }, [options.length, align]);

  // فتح/إغلاق القائمة مع إعادة حساب الموقع
  const toggleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
      const currentIndex = options.findIndex((opt) => opt.value === value);
      setFocusedIndex(currentIndex >= 0 ? currentIndex : 0);
    }
    setIsOpen((prev) => !prev);
  };

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setFocusedIndex(-1);
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

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideInteraction);
      document.addEventListener('touchstart', handleOutsideInteraction, { passive: true });
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideInteraction);
      document.removeEventListener('touchstart', handleOutsideInteraction);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
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
        setFocusedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < options.length) {
          const opt = options[focusedIndex];
          if (!opt.disabled) {
            onChange(opt.value);
            handleClose();
            if (triggerRef.current) triggerRef.current.focus();
          }
        }
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(options.length - 1);
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

      {/* Dropdown Menu Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            className={`custom-dropdown-menu placement-${placement} align-${horizAlign}`}
            role="listbox"
            aria-label={ariaLabel}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: placement === 'bottom' ? -6 : 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: placement === 'bottom' ? -6 : 6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <div className="custom-dropdown-scroll-area">
              {options.length === 0 ? (
                <div className="custom-dropdown-empty">لا توجد خيارات متاحة</div>
              ) : (
                options.map((opt, index) => {
                  const isSelected = opt.value === value;
                  const isFocused = index === focusedIndex;

                  return (
                    <div
                      key={opt.value}
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
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dropdown;

