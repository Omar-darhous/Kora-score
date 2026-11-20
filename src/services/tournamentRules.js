// UEFA clubs 2024/25 onward: top 8 -> R16, 9-24 -> play-offs (UCL/UEL: 8 games, UECL: 6 games).
// FIFA 2026: top 2 in 12 groups plus 8 third-place teams -> R32.
// AFCON (2019+) & EURO (2016+): top 2 in 6 groups plus 4 best third-place teams -> R16.
export const isUefaClubTournament = id => ['uefa.champions', 'uefa.europa', 'uefa.europa.conf'].includes(id);
export const isNationalTournament = id => ['fifa.world', 'caf.nations', 'uefa.euro'].includes(id);
export const isTournament = id => isNationalTournament(id) || isUefaClubTournament(id);
export const rounds = [['playoff','ملحق الأدوار الإقصائية'],['r32','دور الـ 32'],['r16','دور الـ 16'],['qf','ربع النهائي'],['sf','نصف النهائي'],['thirdPlace','المركز الثالث'],['final','النهائي']];
export function classifyRound(text = '') {
  const s = text.toLowerCase().replaceAll('-', ' ');
  if (/qualif|preliminary/.test(s)) return null;
  if (/third|3rd|bronze/.test(s)) return 'thirdPlace';
  if (/round of 32|1\/16/.test(s)) return 'r32';
  if (/round of 16|1\/8|octavos/.test(s)) return 'r16';
  if (/quarter|1\/4/.test(s)) return 'qf';
  if (/semi|1\/2/.test(s)) return 'sf';
  if (/knockout.*play|play.*off/.test(s)) return 'playoff';
  if (/^final$|, final$| final$/.test(s.trim())) return 'final';
  return null;
}
const zone = (label, color = '#10b981') => ({ label, color, bg: color + '18', borderRight: '4px solid ' + color });

const qualify24TeamGroups = (team, groups, bracket) => {
  const group = groups.find(g => g.entries.some(t => String(t.teamId) === String(team.teamId)));
  const complete = group?.entries.length === 4 && group.entries.every(t => t.played >= 3);
  if (team.rank <= 2) return zone(complete ? 'تأهل إلى دور الـ16' : 'مركز مؤهل إلى دور الـ16');
  if (team.rank === 3) {
    const participants = new Set((bracket?.r16 || []).flatMap(m => [m.homeTeamId, m.awayTeamId]).filter(Boolean).map(String));
    if (participants.has(String(team.teamId))) return zone('تأهل ضمن أفضل 4 ثوالث', '#3b82f6');
    if (participants.size === 16) return zone('لم يتأهل ضمن أفضل الثوالث', '#ef4444');
    return zone('ينافس على أفضل 4 ثوالث — التأهل غير مؤكد', '#f59e0b');
  }
  return zone(complete ? 'خرج من دور المجموعات' : 'خارج مراكز التأهل حالياً', '#ef4444');
};

const qualify16TeamGroups = (team, groups) => {
  const group = groups.find(g => g.entries.some(t => String(t.teamId) === String(team.teamId)));
  const complete = group?.entries.length === 4 && group.entries.every(t => t.played >= 3);
  if (team.rank <= 2) return zone(complete ? 'تأهل إلى ربع النهائي' : 'مركز مؤهل إلى ربع النهائي');
  return zone(complete ? 'خرج من دور المجموعات' : 'خارج مراكز التأهل حالياً', '#ef4444');
};

export function qualification(id, team, groups, bracket) {
  if (!Number.isInteger(team.rank) || team.rank < 1) return null;
  const year = Number(groups[0]?.season?.year);
  const entries = groups.flatMap(g => g.entries || []);
  if (isUefaClubTournament(id) && year >= 2024 && groups.length === 1 && entries.length === 36) {
    const requiredGames = id === 'uefa.europa.conf' ? 6 : 8;
    const complete = entries.every(t => t.played >= requiredGames);
    const prefix = complete ? 'تأهل إلى ' : 'مركز مؤهل إلى ';
    if (team.rank <= 8) return zone(prefix + 'دور الـ16');
    if (team.rank <= 24) return zone(prefix + 'الملحق الإقصائي', '#f59e0b');
    return zone(complete ? 'خرج من البطولة' : 'خارج مراكز التأهل حالياً', '#ef4444');
  }
  if (id === 'fifa.world' && year === 2026 && groups.length === 12) {
    const group = groups.find(g => g.entries.some(t => t.teamId === team.teamId));
    const complete = group?.entries.length === 4 && group.entries.every(t => t.played === 3);
    if (team.rank <= 2) return zone(complete ? 'تأهل إلى دور الـ32' : 'مركز مؤهل إلى دور الـ32');
    if (team.rank === 3) {
      const participants = new Set((bracket?.r32 || []).flatMap(m => [m.homeTeamId, m.awayTeamId]).filter(Boolean));
      if (participants.has(team.teamId)) return zone('تأهل ضمن أفضل 8 ثوالث', '#3b82f6');
      if (participants.size === 32) return zone('لم يتأهل ضمن أفضل الثوالث', '#ef4444');
      return zone('ينافس على أفضل 8 ثوالث — التأهل غير مؤكد', '#f59e0b');
    }
    return zone(complete ? 'خرج من دور المجموعات' : 'خارج مراكز التأهل حالياً', '#ef4444');
  }
  if (
    ((id === 'caf.nations' && year >= 2019) || (id === 'uefa.euro' && year >= 2016)) &&
    groups.length === 6 &&
    groups.every(g => g.entries.length === 4)
  ) {
    return qualify24TeamGroups(team, groups, bracket);
  }
  if (
    ((id === 'caf.nations' && year < 2019) || (id === 'uefa.euro' && year < 2016)) &&
    groups.length === 4 &&
    groups.every(g => g.entries.length === 4)
  ) {
    return qualify16TeamGroups(team, groups);
  }
  // Historical group formats: do not apply a modern league-phase rule.
  if (id === 'fifa.world' && year >= 1998 && year <= 2022 && groups.length === 8 && team.rank <= 2)
    return zone('مركز مؤهل إلى دور الـ16');
  if (id === 'uefa.europa.conf' && year >= 2021 && year < 2024 && groups.length === 8 && groups.every(g => g.entries.length === 4)) {
    const group = groups.find(g => g.entries.some(t => t.teamId === team.teamId)) || groups[0];
    const complete = group?.entries.every(t => t.played >= 6);
    const prefix = complete ? 'تأهل إلى ' : 'مركز مؤهل إلى ';
    if (team.rank === 1) return zone(prefix + 'دور الـ16');
    if (team.rank === 2) return zone(prefix + 'الملحق الإقصائي', '#f59e0b');
    return zone(complete ? 'خرج من دور المجموعات' : 'خارج مراكز التأهل حالياً', '#ef4444');
  }
  if (isUefaClubTournament(id) && id !== 'uefa.europa.conf' && year < 2024 && groups.every(g => g.entries.length === 4) && team.rank <= 2)
    return zone('مركز مؤهل إلى الدور التالي');
  return null;
}
