/**
 * SlideCanvas — ЕДИНСТВЕННЫЙ React-рендерер слайда презентации.
 *
 * Раньше эта разметка жила прямо в PresentationView.renderSlide, и когда
 * появилась публичная страница /pres/[slug], для неё был написан отдельный
 * упрощённый рендер. Результат: по ссылке клиент видел плоские слайды без
 * градиентов, декора и логотипа — совсем не то, что автор видел в кабинете.
 * Аудит предупреждал ровно об этом («публичный вьюер станет четвёртым
 * рендерером»), поэтому разметка вынесена сюда, а оба места её импортируют.
 *
 * Компонент чистый: никакого доступа к brandBook/myCompany/localStorage —
 * всё приходит пропсами, поэтому он одинаково работает и в кабинете, и на
 * публичной странице без авторизации.
 */
import React from "react";

export interface SlideCanvasSlide {
  title: string;
  subtitle?: string;
  type: string;
  content?: string;
  bullets?: string[];
  stats?: Array<{ value: string; label: string }>;
  quote?: string;
  items?: Array<{ title: string; description?: string; icon?: string }>;
  leftContent?: string;
  rightContent?: string;
  imageUrl?: string;
}

export interface SlideCanvasProps {
  slide: SlideCanvasSlide;
  idx: number;
  total: number;
  /** colors[0] брендбука/стиля */
  primary: string;
  /** colors[1] — акцент */
  secondary: string;
  fontHeader: string;
  fontBody: string;
  /** data:-URL или короткий /api/image/... — марка на слайдах */
  logoUrl?: string;
  /** Подпись рядом с лого на обложке */
  brandName?: string;
}

export function SlideCanvas({
  slide, idx, total, primary, secondary, fontHeader, fontBody, logoUrl, brandName,
}: SlideCanvasProps): React.ReactElement {

    const type = slide.type;

    const fontH = fontHeader;
    const fontB = fontBody;

    // ── Color helpers ───────────────────────────────────────
    const hexToRgb = (hex: string) => {
      const h = (hex || "#6366f1").replace("#", "").padEnd(6, "0");
      return { r: parseInt(h.slice(0,2),16)||0, g: parseInt(h.slice(2,4),16)||0, b: parseInt(h.slice(4,6),16)||0 };
    };
    const rgba = (hex: string, a: number) => { const { r, g, b } = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
    const darken = (hex: string, amt: number) => {
      const { r, g, b } = hexToRgb(hex);
      return `#${[r,g,b].map(v => Math.max(0,Math.round(v*(1-amt))).toString(16).padStart(2,"0")).join("")}`;
    };
    const lighten = (hex: string, amt: number) => {
      const { r, g, b } = hexToRgb(hex);
      return `#${[r,g,b].map(v => Math.min(255,Math.round(v+(255-v)*amt)).toString(16).padStart(2,"0")).join("")}`;
    };

    const dp = darken(primary, 0.32);
    const lp = lighten(primary, 0.93);
    const accents = [primary, secondary, "#f59e0b", "#10b981", "#e11d48", "#0ea5e9"];

    const base: React.CSSProperties = {
      width: "100%", aspectRatio: "16/9", borderRadius: 16, overflow: "hidden",
      position: "relative",
      boxShadow: "0 24px 64px rgba(0,0,0,0.28), 0 4px 16px rgba(0,0,0,0.12)",
      fontFamily: `'${fontB}', system-ui, sans-serif`,
    };

    // Dot grid pattern (subtle texture)
    const dotGrid = (opacity = 0.05, size = 24) =>
      `radial-gradient(circle, rgba(255,255,255,${opacity}) 1px, transparent 1px)`;
    const dotGridStyle = (opacity?: number, size?: number): React.CSSProperties => ({
      position: "absolute", inset: 0, pointerEvents: "none",
      backgroundImage: dotGrid(opacity, size),
      backgroundSize: `${size ?? 24}px ${size ?? 24}px`,
    });

    // Фоновая AI-иллюстрация слайда: картинка + плотный фирменный градиент
    // поверх, чтобы текст оставался читабельным на любом изображении.
    const bgImg = (overlay: string) => slide.imageUrl ? (
      <div style={{ position:"absolute", inset:0, pointerEvents:"none" }}>
        <img src={slide.imageUrl} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
        <div style={{ position:"absolute", inset:0, background: overlay }} />
      </div>
    ) : null;

    // Slide counter + фирменная марка. Лого рисуем на каждом слайде кроме
    // обложки (там оно уже крупно в шапке) — маленькая марка в верхнем углу,
    // на тёмных слайдах с подложкой, чтобы тёмное лого не растворялось.
    const pg = (light: boolean) => (
      <>
        {logoUrl && type !== "cover" && (
          <img src={logoUrl} alt="" style={{ position: "absolute", top: 14, right: 18,
            width: 26, height: 26, objectFit: "contain", borderRadius: 6, zIndex: 3, opacity: 0.9,
            background: light ? "rgba(255,255,255,0.14)" : "transparent", padding: light ? 3 : 0 }} />
        )}
        <div style={{ position: "absolute", bottom: 16, right: 20, fontSize: 10,
          fontWeight: 700, letterSpacing: 2, color: light ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.14)" }}>
          {String(idx+1).padStart(2,"0")} / {String(total).padStart(2,"0")}
        </div>
      </>
    );

    // ── COVER ─────────────────────────────────────────────────────────────
    if (type === "cover") {
      return (
        <div key={idx} style={{ ...base,
          background: `linear-gradient(135deg, ${dp} 0%, ${primary} 58%, ${lighten(primary,0.14)} 100%)`,
          display: "flex" }}>
          {bgImg(`linear-gradient(135deg, ${rgba(dp,0.93)} 0%, ${rgba(primary,0.86)} 58%, ${rgba(lighten(primary,0.14),0.82)} 100%)`)}
          {/* Ambient orbs */}
          <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none" }}>
            <div style={{ position:"absolute", top:"-35%", right:"-8%", width:"58%", paddingBottom:"58%",
              borderRadius:"50%", background: rgba(secondary, 0.18), filter:"blur(70px)" }} />
            <div style={{ position:"absolute", bottom:"-25%", left:"15%", width:"40%", paddingBottom:"40%",
              borderRadius:"50%", background: rgba(secondary, 0.09), filter:"blur(50px)" }} />
            <div style={dotGridStyle(0.045, 26)} />
            {/* Decorative rings */}
            <div style={{ position:"absolute", right:"-10%", top:"-20%", width:"55%", paddingBottom:"55%",
              borderRadius:"50%", border:"1px solid rgba(255,255,255,0.06)" }} />
            <div style={{ position:"absolute", right:"-2%", top:"-8%", width:"36%", paddingBottom:"36%",
              borderRadius:"50%", border:"1px solid rgba(255,255,255,0.04)" }} />
          </div>

          {/* Left accent stripe */}
          <div style={{ width:7, flexShrink:0,
            background:`linear-gradient(180deg,${secondary},${rgba(secondary,0.25)})` }} />

          {/* Content */}
          <div style={{ flex:1, display:"flex", flexDirection:"column",
            justifyContent:"space-between", padding:"34px 48px 28px 34px", position:"relative", zIndex:2 }}>
            {/* Logo + brand name */}
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              {logoUrl
                ? <img src={logoUrl} alt="logo" style={{ width:38, height:38, objectFit:"contain",
                    borderRadius:9, background:"rgba(255,255,255,0.12)", padding:4 }} />
                : <div style={{ width:38, height:38, borderRadius:9, background:"rgba(255,255,255,0.12)",
                    display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <div style={{ width:18, height:18, borderRadius:5, background:secondary }} />
                  </div>
              }
              <span style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.45)",
                letterSpacing:2.5, textTransform:"uppercase" }}>
                {brandName || "Brand"}
              </span>
            </div>

            {/* Main title block */}
            <div>
              {slide.subtitle && (
                <div style={{ display:"inline-flex", alignItems:"center", gap:9, marginBottom:16 }}>
                  <div style={{ width:24, height:2.5, background:secondary, borderRadius:2 }} />
                  <span style={{ fontSize:11, fontWeight:700, color:secondary,
                    letterSpacing:2.5, textTransform:"uppercase" }}>{slide.subtitle}</span>
                </div>
              )}
              <h1 style={{ fontSize:42, fontWeight:900, color:"#ffffff", margin:"0 0 16px",
                lineHeight:1.08, fontFamily:`'${fontH}', Georgia, serif`,
                letterSpacing:"-0.5px", textShadow:"0 2px 24px rgba(0,0,0,0.25)", maxWidth:520 }}>
                {slide.title}
              </h1>
              {slide.content && (
                <p style={{ fontSize:13.5, color:"rgba(255,255,255,0.62)",
                  margin:"0 0 22px", lineHeight:1.72, maxWidth:430 }}>{slide.content}</p>
              )}
              {(slide.bullets||[]).length > 0 && (
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {(slide.bullets||[]).slice(0,5).map((b,bi) => (
                    <span key={bi} style={{ padding:"5px 14px", borderRadius:20,
                      background:"rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.9)",
                      fontSize:11, fontWeight:600, border:"1px solid rgba(255,255,255,0.2)" }}>{b}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Year */}
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.22)", letterSpacing:1.5 }}>
              {new Date().getFullYear()}
            </div>
          </div>
          {pg(true)}
        </div>
      );
    }

    // ── CTA ───────────────────────────────────────────────────────────────
    if (type === "cta") {
      return (
        <div key={idx} style={{ ...base,
          background:`linear-gradient(140deg,${dp} 0%,${primary} 55%,${lighten(primary,0.1)} 100%)`,
          display:"flex", alignItems:"center", justifyContent:"center", textAlign:"center" }}>
          {bgImg(`linear-gradient(140deg,${rgba(dp,0.93)} 0%,${rgba(primary,0.87)} 55%,${rgba(lighten(primary,0.1),0.84)} 100%)`)}
          <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none" }}>
            <div style={{ position:"absolute", top:"-30%", left:"-10%", width:"60%", paddingBottom:"60%",
              borderRadius:"50%", background:rgba(secondary,0.12), filter:"blur(70px)" }} />
            <div style={{ position:"absolute", bottom:"-20%", right:"10%", width:"45%", paddingBottom:"45%",
              borderRadius:"50%", background:rgba(secondary,0.08), filter:"blur(50px)" }} />
            <div style={dotGridStyle(0.04, 26)} />
          </div>
          <div style={{ position:"relative", zIndex:2, maxWidth:"72%",
            display:"flex", flexDirection:"column", alignItems:"center", gap:16 }}>
            <div style={{ width:44, height:3.5, borderRadius:2, background:secondary }} />
            <h2 style={{ fontSize:40, fontWeight:900, color:"#fff", margin:0, lineHeight:1.08,
              fontFamily:`'${fontH}', Georgia, serif`, letterSpacing:"-0.5px",
              textShadow:"0 2px 24px rgba(0,0,0,0.25)" }}>{slide.title}</h2>
            {slide.subtitle && (
              <p style={{ fontSize:15, color:"rgba(255,255,255,0.7)", margin:0,
                lineHeight:1.55, fontWeight:500 }}>{slide.subtitle}</p>
            )}
            {slide.content && (
              <p style={{ fontSize:12, color:"rgba(255,255,255,0.48)", margin:0,
                lineHeight:1.7, maxWidth:400 }}>{slide.content}</p>
            )}
            {(slide.bullets||[]).length > 0 && (
              <div style={{ display:"flex", gap:10, flexWrap:"wrap", justifyContent:"center", marginTop:4 }}>
                {(slide.bullets||[]).map((b,bi) => (
                  <span key={bi} style={{ padding:"9px 22px", borderRadius:26,
                    background: bi===0 ? secondary : "rgba(255,255,255,0.12)",
                    color:"#fff", fontSize:12, fontWeight:700,
                    border: bi===0 ? "none" : "1px solid rgba(255,255,255,0.22)" }}>{b}</span>
                ))}
              </div>
            )}
          </div>
          {pg(true)}
        </div>
      );
    }

    // ── STATS ─────────────────────────────────────────────────────────────
    if (type === "stats") {
      const stats = slide.stats || [];
      const nums = stats.map(s => ({ ...s, n: parseFloat(s.value.replace(/[^0-9.]/g,""))||0 }));
      const maxN = Math.max(...nums.map(s => s.n), 1);
      return (
        <div key={idx} style={{ ...base, display:"flex", flexDirection:"column", background:"#ffffff" }}>
          {/* Top gradient accent */}
          <div style={{ height:5, background:`linear-gradient(90deg,${primary},${secondary})`, flexShrink:0 }} />
          {/* Header */}
          <div style={{ padding:"18px 36px 12px", display:"flex", alignItems:"center",
            gap:14, flexShrink:0, borderBottom:`1px solid ${rgba(primary,0.08)}` }}>
            <div style={{ width:3.5, height:34, borderRadius:2, background:primary, flexShrink:0 }} />
            <div>
              <h3 style={{ fontSize:22, fontWeight:800, color:"#0f172a", margin:0,
                fontFamily:`'${fontH}', Georgia, serif` }}>{slide.title}</h3>
              {slide.subtitle && (
                <p style={{ fontSize:11, color:"#94a3b8", margin:"3px 0 0", letterSpacing:0.3 }}>{slide.subtitle}</p>
              )}
            </div>
          </div>
          {/* Cards */}
          <div style={{ flex:1, display:"grid",
            gridTemplateColumns:`repeat(${Math.min(stats.length||1,4)},1fr)`,
            gap:12, padding:"14px 26px 18px" }}>
            {stats.map((s,si) => {
              const col = accents[si % accents.length];
              return (
                <div key={si} style={{ background:rgba(col,0.04), borderRadius:14,
                  border:`1px solid ${rgba(col,0.14)}`, padding:"18px 14px 14px",
                  display:"flex", flexDirection:"column",
                  alignItems:"center", justifyContent:"center", gap:7,
                  position:"relative", overflow:"hidden" }}>
                  <div style={{ position:"absolute", top:0, left:0, right:0, height:4,
                    background:`linear-gradient(90deg,${col},${lighten(col,0.35)})` }} />
                  {/* Big number */}
                  <div style={{ fontSize:54, fontWeight:900, color:col, lineHeight:1,
                    fontFamily:`'${fontH}', Georgia, serif`, letterSpacing:"-2px" }}>{s.value}</div>
                  {/* Mini progress bar */}
                  <div style={{ width:"64%", height:3.5, borderRadius:2, background:rgba(col,0.14) }}>
                    <div style={{ height:"100%", borderRadius:2, background:col, minWidth:6,
                      width:`${nums[si].n > 0 ? (nums[si].n/maxN)*100 : 100}%` }} />
                  </div>
                  <div style={{ fontSize:11, color:"#64748b", textAlign:"center",
                    lineHeight:1.4, maxWidth:120 }}>{s.label}</div>
                </div>
              );
            })}
          </div>
          {slide.content && (
            <div style={{ padding:"0 26px 14px", fontSize:11, color:"#94a3b8", lineHeight:1.6 }}>{slide.content}</div>
          )}
          {pg(false)}
        </div>
      );
    }

    // ── QUOTE ─────────────────────────────────────────────────────────────
    if (type === "quote") {
      return (
        <div key={idx} style={{ ...base,
          background:`linear-gradient(148deg,${dp} 0%,${darken(primary,0.14)} 100%)`,
          display:"flex", alignItems:"center" }}>
          {bgImg(`linear-gradient(148deg,${rgba(dp,0.94)} 0%,${rgba(darken(primary,0.14),0.9)} 100%)`)}
          <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none" }}>
            <div style={{ position:"absolute", top:"-20%", right:"-5%", width:"45%", paddingBottom:"45%",
              borderRadius:"50%", background:rgba(secondary,0.12), filter:"blur(55px)" }} />
            <div style={dotGridStyle(0.035, 24)} />
          </div>
          {/* Giant decorative quote */}
          <div style={{ position:"absolute", top:"6%", left:"4%", fontSize:200, lineHeight:1,
            fontFamily:"Georgia,serif", fontWeight:900, color:"rgba(255,255,255,0.05)",
            userSelect:"none", pointerEvents:"none" }}>&ldquo;</div>
          {/* Content */}
          <div style={{ position:"relative", zIndex:2, flex:1,
            padding:"40px 68px 40px 56px", display:"flex", flexDirection:"column",
            justifyContent:"center", gap:20 }}>
            <div style={{ width:44, height:3.5, background:secondary, borderRadius:2 }} />
            {slide.quote && (
              <p style={{ fontSize:20, fontStyle:"italic", color:"rgba(255,255,255,0.92)",
                lineHeight:1.68, margin:0, fontFamily:`'${fontH}', Georgia, serif`, fontWeight:400 }}>
                &ldquo;{slide.quote}&rdquo;
              </p>
            )}
            {slide.content && (
              <p style={{ fontSize:12, color:"rgba(255,255,255,0.42)", margin:0, lineHeight:1.65 }}>{slide.content}</p>
            )}
            <div style={{ display:"inline-flex", alignItems:"center", gap:10 }}>
              <div style={{ width:28, height:1.5, background:secondary, opacity:0.55 }} />
              <span style={{ fontSize:11, fontWeight:700, color:secondary,
                letterSpacing:2.5, textTransform:"uppercase" }}>{slide.title}</span>
            </div>
          </div>
          {pg(true)}
        </div>
      );
    }

    // ── GRID ──────────────────────────────────────────────────────────────
    if (type === "grid") {
      const items = slide.items || (slide.bullets||[]).map(b => {
        const ci = b.indexOf(": ");
        return ci > 0 ? { title: b.slice(0,ci), description: b.slice(ci+2) } : { title: b, description: "" };
      });
      return (
        <div key={idx} style={{ ...base, display:"flex", flexDirection:"column", background:lp }}>
          <div style={{ height:5, background:`linear-gradient(90deg,${primary},${secondary})`, flexShrink:0 }} />
          {/* Header */}
          <div style={{ padding:"14px 28px 10px", flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:11 }}>
              <div style={{ width:3.5, height:28, borderRadius:2, background:primary, flexShrink:0 }} />
              <div>
                <h3 style={{ fontSize:20, fontWeight:800, color:"#0f172a", margin:0,
                  fontFamily:`'${fontH}', Georgia, serif` }}>{slide.title}</h3>
                {slide.subtitle && <p style={{ fontSize:11, color:"#64748b", margin:"2px 0 0" }}>{slide.subtitle}</p>}
              </div>
            </div>
            {slide.content && (
              <p style={{ fontSize:12, color:"#64748b", margin:"8px 0 0 14px", lineHeight:1.55 }}>{slide.content}</p>
            )}
          </div>
          {/* Cards */}
          <div style={{ flex:1, display:"grid",
            gridTemplateColumns:`repeat(${Math.min(Math.max(items.length,1),3)},1fr)`,
            gap:10, padding:"8px 20px 18px" }}>
            {items.slice(0,6).map((item,ii) => {
              const col = accents[ii % accents.length];
              return (
                <div key={ii} style={{ background:"#fff", borderRadius:13,
                  border:"1px solid rgba(0,0,0,0.055)",
                  boxShadow:"0 2px 14px rgba(0,0,0,0.055)",
                  padding:"14px 14px 12px",
                  display:"flex", flexDirection:"column", gap:8,
                  position:"relative", overflow:"hidden" }}>
                  <div style={{ position:"absolute", top:0, left:0, right:0, height:3.5, background:col }} />
                  {/* Icon */}
                  <div style={{ width:34, height:34, borderRadius:10,
                    background:rgba(col,0.12), display:"flex",
                    alignItems:"center", justifyContent:"center" }}>
                    <div style={{ width:13, height:13, borderRadius:4, background:col }} />
                  </div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#1e293b", lineHeight:1.3,
                    fontFamily:`'${fontH}', serif` }}>{item.title}</div>
                  {item.description && (
                    <div style={{ fontSize:10.5, color:"#64748b", lineHeight:1.55 }}>{item.description}</div>
                  )}
                </div>
              );
            })}
          </div>
          {pg(false)}
        </div>
      );
    }

    // ── TWO-COLUMN ────────────────────────────────────────────────────────
    if (type === "two-column") {
      const half = Math.ceil((slide.bullets||[]).length / 2);
      const leftB = (slide.bullets||[]).slice(0, half);
      const rightB = (slide.bullets||[]).slice(half);
      const leftTxt = slide.leftContent || null;
      const rightTxt = slide.rightContent || null;
      return (
        <div key={idx} style={{ ...base, display:"flex", background:"#fff" }}>
          {/* Left — gradient */}
          <div style={{ width:"47%", flexShrink:0,
            background:`linear-gradient(162deg,${primary} 0%,${dp} 100%)`,
            display:"flex", flexDirection:"column", justifyContent:"space-between",
            padding:"30px 28px 24px", position:"relative", overflow:"hidden" }}>
            {bgImg(`linear-gradient(162deg,${rgba(primary,0.88)} 0%,${rgba(dp,0.94)} 100%)`)}
            <div style={{ position:"absolute", bottom:"-25%", right:"-20%", width:"80%",
              paddingBottom:"80%", borderRadius:"50%", background:"rgba(255,255,255,0.04)" }} />
            <div style={dotGridStyle(0.04, 20)} />
            <div style={{ position:"relative", zIndex:2 }}>
              <div style={{ width:30, height:3, background:secondary, borderRadius:2, marginBottom:16 }} />
              <h3 style={{ fontSize:20, fontWeight:800, color:"#fff", margin:"0 0 8px",
                lineHeight:1.2, fontFamily:`'${fontH}', Georgia, serif` }}>{slide.title}</h3>
              {slide.subtitle && (
                <p style={{ fontSize:11, color:"rgba(255,255,255,0.48)", margin:0, lineHeight:1.55 }}>{slide.subtitle}</p>
              )}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8, position:"relative", zIndex:2 }}>
              {(leftTxt ? [leftTxt] : leftB).map((b,bi) => (
                <div key={bi} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                  <div style={{ width:20, height:20, borderRadius:6, flexShrink:0, marginTop:1,
                    background:"rgba(255,255,255,0.14)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:9, fontWeight:800, color:secondary }}>
                    {leftTxt ? "→" : bi+1}
                  </div>
                  <span style={{ fontSize:12, color:"rgba(255,255,255,0.86)", lineHeight:1.55 }}>{b}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize:52, fontWeight:900, color:"rgba(255,255,255,0.05)",
              lineHeight:1, fontFamily:`'${fontH}', serif`, position:"relative", zIndex:2 }}>
              {String(idx+1).padStart(2,"0")}
            </div>
          </div>
          {/* Right — light */}
          <div style={{ flex:1, background:lp,
            display:"flex", flexDirection:"column", justifyContent:"center", padding:"26px 24px" }}>
            {rightTxt && (
              <p style={{ fontSize:13, color:"#374151", lineHeight:1.72, marginBottom:14 }}>{rightTxt}</p>
            )}
            {rightB.length > 0 && (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {rightB.map((b,bi) => (
                  <div key={bi} style={{ display:"flex", alignItems:"center", gap:12,
                    padding:"9px 14px", borderRadius:11, background:"#fff",
                    boxShadow:"0 1px 6px rgba(0,0,0,0.06)",
                    border:"1px solid rgba(0,0,0,0.04)" }}>
                    <div style={{ width:26, height:26, borderRadius:8, background:primary, flexShrink:0,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:10, fontWeight:800, color:"#fff" }}>{bi+1}</div>
                    <span style={{ fontSize:12, color:"#1e293b", lineHeight:1.45, fontWeight:500 }}>{b}</span>
                  </div>
                ))}
              </div>
            )}
            {!rightTxt && rightB.length===0 && slide.content && (
              <p style={{ fontSize:13, color:"#374151", lineHeight:1.72 }}>{slide.content}</p>
            )}
          </div>
          {pg(false)}
        </div>
      );
    }

    // ── BULLETS (default) ─────────────────────────────────────────────────
    return (
      <div key={idx} style={{ ...base, display:"flex", background:"#ffffff" }}>
        {/* Left sidebar */}
        <div style={{ width:"27%", flexShrink:0,
          background:`linear-gradient(175deg,${primary} 0%,${darken(primary,0.26)} 100%)`,
          display:"flex", flexDirection:"column", justifyContent:"space-between",
          padding:"28px 22px 20px", position:"relative", overflow:"hidden" }}>
          {bgImg(`linear-gradient(175deg,${rgba(primary,0.88)} 0%,${rgba(darken(primary,0.26),0.94)} 100%)`)}
          <div style={dotGridStyle(0.04, 20)} />
          <div style={{ position:"absolute", bottom:"-22%", left:"-22%", width:"90%",
            paddingBottom:"90%", borderRadius:"50%", background:"rgba(255,255,255,0.03)" }} />
          <div style={{ position:"relative", zIndex:2 }}>
            <div style={{ width:26, height:3, background:secondary, borderRadius:2, marginBottom:14 }} />
            <h3 style={{ fontSize:17, fontWeight:800, color:"#fff", margin:0, lineHeight:1.3,
              fontFamily:`'${fontH}', Georgia, serif` }}>{slide.title}</h3>
            {slide.subtitle && (
              <p style={{ fontSize:10, color:"rgba(255,255,255,0.48)", margin:"8px 0 0", lineHeight:1.55 }}>{slide.subtitle}</p>
            )}
          </div>
          {(slide.stats||[]).length > 0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:6, position:"relative", zIndex:2 }}>
              {(slide.stats||[]).slice(0,3).map((s,si) => (
                <div key={si} style={{ background:"rgba(255,255,255,0.1)", borderRadius:8,
                  padding:"7px 10px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:9, color:"rgba(255,255,255,0.58)" }}>{s.label}</span>
                  <span style={{ fontSize:15, fontWeight:900, color:"#fff",
                    fontFamily:`'${fontH}', serif` }}>{s.value}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize:50, fontWeight:900, color:"rgba(255,255,255,0.055)",
            lineHeight:1, fontFamily:`'${fontH}', serif`, position:"relative", zIndex:2 }}>
            {String(idx+1).padStart(2,"0")}
          </div>
        </div>
        {/* Right content */}
        <div style={{ flex:1, padding:"24px 28px 20px", display:"flex", flexDirection:"column" }}>
          <div style={{ height:3.5, background:`linear-gradient(90deg,${primary},${rgba(primary,0)})`,
            borderRadius:2, marginBottom:14 }} />
          {slide.content && (
            <p style={{ fontSize:12.5, color:"#475569", margin:"0 0 14px", lineHeight:1.72 }}>{slide.content}</p>
          )}
          {(slide.bullets||[]).length > 0 && (
            <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8 }}>
              {(slide.bullets||[]).map((b,bi) => (
                <div key={bi} style={{ display:"flex", alignItems:"flex-start", gap:12,
                  padding:"8px 12px", borderRadius:10,
                  background: bi%2===0 ? rgba(primary,0.042) : "transparent",
                  border:`1px solid ${bi%2===0 ? rgba(primary,0.08) : "transparent"}` }}>
                  <div style={{ width:26, height:26, borderRadius:9, flexShrink:0,
                    background:accents[bi % accents.length],
                    boxShadow:`0 3px 8px ${rgba(accents[bi % accents.length],0.38)}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:10, fontWeight:800, color:"#fff" }}>
                    {bi+1}
                  </div>
                  <span style={{ fontSize:13, color:"#1e293b", lineHeight:1.55, fontWeight:500 }}>{b}</span>
                </div>
              ))}
            </div>
          )}
          {pg(false)}
        </div>
      </div>
    );
  // Фолбэк — тот же лейаут, что у bullets-слайда по умолчанию выше.
  return <div />;
}
