import React, { useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import Dropdown from './Dropdown';

const SeasonSelector = ({
  leagueId,
  availableSeasons = [],
  selectedSeason = null,
  currentSeasonYear = null,
  onSeasonChange,
  loading = false,
  disabled = false,
  fullWidth = false
}) => {
  const latestSeasonYear = useMemo(() => {
    if (!Array.isArray(availableSeasons) || availableSeasons.length === 0) {
      return currentSeasonYear ?? null;
    }
    const flagged = availableSeasons.find(s => s?.isCurrent === true);
    if (flagged) return flagged.year;
    return availableSeasons[0]?.year ?? currentSeasonYear ?? null;
  }, [availableSeasons, currentSeasonYear]);

  const options = useMemo(() => {
    if (!Array.isArray(availableSeasons) || availableSeasons.length === 0) return [];
    return availableSeasons.map(item => ({
      value: item.year,
      label: item.year === latestSeasonYear ? `${item.label} (الحالي)` : item.label
    }));
  }, [availableSeasons, latestSeasonYear]);

  // الدوري المصري يستخدم بيانات تجريبية لموسم واحد فقط ولا يدعم المواسم التاريخية
  if (leagueId === 'egypt.1') {
    return null;
  }

  const hasOptions = options.length > 0;
  const isDisabled = disabled || (!hasOptions && loading) || !hasOptions;
  const activeValue = selectedSeason ?? latestSeasonYear ?? '';
  const placeholder = loading && !hasOptions
    ? 'جارٍ تحميل المواسم...'
    : 'الموسم الحالي';

  const handleChange = (nextYear) => {
    if (typeof onSeasonChange !== 'function') return;
    const numericYear = Number(nextYear);
    if (!Number.isInteger(numericYear)) return;
    if (latestSeasonYear !== null && numericYear === latestSeasonYear) {
      onSeasonChange(null);
    } else {
      onSeasonChange(numericYear);
    }
  };

  return (
    <div className="season-selector-wrap" data-testid="season-selector">
      <Dropdown
        options={options}
        value={activeValue}
        onChange={handleChange}
        placeholder={placeholder}
        icon={<CalendarDays size={14} color="var(--accent)" />}
        ariaLabel="اختيار الموسم"
        size="sm"
        disabled={isDisabled}
        fullWidth={fullWidth}
        useDesktopPortal={true}
        useMobilePortal={true}
      />
    </div>
  );
};

export default SeasonSelector;
