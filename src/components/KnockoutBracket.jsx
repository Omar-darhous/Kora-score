import React, { useId, useMemo, useRef, useState } from 'react';
import { Trophy, ZoomIn, ZoomOut, Maximize2, ArrowLeft } from 'lucide-react';
import { buildBracket } from '../services/bracketLayout';

const hasTeam = (match, id) => id && [match.homeTeamId, match.awayTeamId].some(value => String(value) === String(id));
const winnerName = m => m.homeWinner ? m.homeTeam : m.awayWinner ? m.awayTeam : null;
function MatchCard({ match, next, onMatchClick, onHighlight, highlighted, final = false }) {
  const special = ['extra-time','penalties'].includes(match.finishType);
  const extra = match.finishType === 'extra-time' || !!match.extraTimeScore;
  const penalties = match.finishType === 'penalties';
  const status = match.status === 'FT' ? penalties ? 'حُسمت بالترجيح' : extra ? 'بعد وقت إضافي' : 'انتهت' : match.status === 'LIVE' ? 'مباشر' : match.time;
  const winner = winnerName(match);
  const focusTeam = match.homeWinner ? match.homeTeamId : match.awayWinner ? match.awayTeamId : match.homeTeamId;
  return <button type="button" className={['kb-card', highlighted ? 'kb-highlight' : '', final ? 'kb-final' : ''].join(' ')}
    onClick={() => onMatchClick?.(match)} onMouseEnter={() => onHighlight?.(focusTeam)} onMouseLeave={() => onHighlight?.(null)} onFocus={() => onHighlight?.(focusTeam)} onBlur={() => onHighlight?.(null)}
    aria-label={match.homeTeam + ' ضد ' + match.awayTeam + ' — ' + status + ' — عرض التفاصيل'}>
    <span className="kb-card-top"><span>{final ? <><Trophy size={13} /> المباراة النهائية</> : 'مواجهة ' + match.id}</span><strong className={penalties ? 'kb-pen-tag' : ''}>{status}</strong></span>
    <table className="kb-score-table"><thead><tr><th>الفريق</th><th title="النتيجة عند نهاية الوقت الأصلي">{match.status === 'LIVE' ? 'الآن' : '90′'}</th>{extra && <th title="النتيجة الإجمالية عند نهاية الوقت الإضافي">120′</th>}{penalties && <th>ترجيح</th>}</tr></thead>
    <tbody>{['home','away'].map((side,i) => {
      const won = match.status === 'FT' && match[side+'Winner'];
      const regular = match.regulationScore?.[i] ?? (!special && ['FT','LIVE'].includes(match.status) ? match[side+'Score'] : null);
      const afterExtra = match.extraTimeScore?.[i] ?? (match.finishType === 'extra-time' ? match[side+'Score'] : null);
      return <tr key={side} className={won ? 'kb-winner' : ''}><td><span className="kb-team">{match[side+'Logo'] && <img src={match[side+'Logo']} alt="" onError={e=>{e.currentTarget.style.visibility='hidden';}} />}<span>{match[side+'Team']}</span>{won && <span className="kb-win-dot" aria-label="الفائز" />}</span></td><td>{regular ?? '—'}</td>{extra && <td>{afterExtra ?? '—'}</td>}{penalties && <td className="kb-pen-score">{match[side+'Penalties'] ?? '—'}</td>}</tr>;
    })}</tbody></table>
    <span className="kb-progress"><ArrowLeft size={13} /><span>{final && winner ? 'البطل: ' + winner : next ? (winner ? winner + ' إلى مواجهة ' : 'الفائز إلى مواجهة ') + next.homeTeam + ' × ' + next.awayTeam : winner ? 'الفائز: ' + winner : 'اضغط لعرض تفاصيل المباراة'}</span></span>
    {special && !match.regulationScore && <span className="kb-missing">نتيجة الـ90 دقيقة غير متاحة من المصدر</span>}
  </button>;
}
export default function KnockoutBracket({ bracketData, onMatchClick }) {
  const [start, setStart] = useState(null);
  const [zoom, setZoom] = useState(.85);
  const [highlight, setHighlight] = useState(null);
  const viewport = useRef(null);
  const marker = 'arrow' + useId().replaceAll(':','');
  const full = useMemo(()=>buildBracket(bracketData),[bracketData]);
  const layout = useMemo(()=>buildBracket(bracketData,start),[bracketData,start]);
  const byId = new Map(layout.nodes.map(n=>[n.id,n]));
  if (!full.nodes.length) return <div className="glass-card empty-state">لم ينشر المصدر مواجهات إقصائية لهذا الموسم بعد.</div>;
  const canvasHeight = layout.height + 64;
  return <section className="kb-shell" aria-label="شجرة الأدوار الإقصائية">
    <div className="kb-toolbar"><div><h3><Trophy size={20} /> الطريق إلى اللقب</h3><p>اتبع الخطوط لمعرفة المواجهة التالية • اضغط على أي مباراة للتفاصيل</p></div><div className="kb-controls">
      <select aria-label="بدء المخطط من دور" value={layout.rounds[0]?.[0] || ''} onChange={e=>setStart(e.target.value)}>{full.rounds.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>
      <button type="button" aria-label="تصغير المخطط" onClick={()=>setZoom(z=>Math.max(.35, +(z-.1).toFixed(2)))}><ZoomOut size={17}/></button><output>{Math.round(zoom*100)}%</output><button type="button" aria-label="تكبير المخطط" onClick={()=>setZoom(z=>Math.min(1.2, +(z+.1).toFixed(2)))}><ZoomIn size={17}/></button>
      <button type="button" aria-label="عرض المخطط بالكامل" title="عرض كامل" onClick={()=>setZoom(Math.max(.25, Math.min(1, (viewport.current.clientWidth-32)/layout.width)))}><Maximize2 size={17}/></button>
    </div></div>
    <div className="kb-help"><span><i className="kb-win-dot"/> الفريق الفائز</span><span>90′: نهاية الوقت الأصلي</span><span>120′: النتيجة بعد الإضافي</span><span>الترجيح منفصل عن أهداف المباراة</span></div>
    <div ref={viewport} className="kb-viewport" tabIndex={0} aria-label="مخطط قابل للتمرير أفقياً ورأسياً">
      <div style={{width:layout.width*zoom,height:canvasHeight*zoom,position:'relative',marginInline:'auto'}}>
        <div className="kb-canvas" style={{width:layout.width,height:canvasHeight,transform:'scale('+zoom+')'}}>
          <svg className="kb-lines" width={layout.width} height={canvasHeight} aria-hidden="true"><defs><marker id={marker} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="currentColor"/></marker></defs>{layout.nodes.filter(n=>n.next).map(n=>{
            const next=byId.get(n.next);const x=layout.width-(n.column*352+300);const end=layout.width-next.column*352;const mid=(x+end)/2;const y=n.y+164;const ey=next.y+164;
            const active=hasTeam(n.match,highlight)&&hasTeam(next.match,highlight);
            return <path key={n.id} d={'M'+x+','+y+' H'+mid+' V'+ey+' H'+end} className={active?'kb-edge active':'kb-edge'} markerEnd={'url(#'+marker+')'} />;
          })}</svg>
          {layout.rounds.map(([key,label],i)=><h4 className="kb-round-title" key={key} style={{right:i*352}}><span>{label}</span><small>{bracketData[key].length} مباريات</small></h4>)}
          {layout.nodes.map(node=><div key={node.id} className="kb-node" style={{right:node.column*352,top:node.y+64}}><MatchCard match={node.match} next={byId.get(node.next)?.match} onMatchClick={onMatchClick} highlighted={hasTeam(node.match,highlight)} onHighlight={setHighlight} final={node.round==='final'}/></div>)}
        </div>
      </div>
    </div>
    <p className="kb-footnote">الخطوط تربط المواجهات المؤكدة من المشاركين المنشورين في الدور التالي؛ أي مسار لم يُحسم يظل بدون ربط افتراضي.</p>
    {!!bracketData?.thirdPlace?.length && <aside className="kb-third"><h4>مباراة المركز الثالث <small>بين الخاسرين في نصف النهائي</small></h4>{bracketData.thirdPlace.map(m=><MatchCard key={m.id} match={m} onMatchClick={onMatchClick}/>)}</aside>}
  </section>;
}
