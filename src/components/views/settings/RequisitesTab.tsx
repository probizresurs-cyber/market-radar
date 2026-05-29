"use client";

/**
 * Settings → Реквизиты — заполнение юр.данных клиента для счетов и актов.
 *
 * - Селектор типа клиента: физик / ИП / ООО.
 * - Кнопка «Заполнить по ИНН» (DaData).
 * - Кнопка «Заполнить по БИК» — банк и корр.счёт.
 * - Сохранение в users.* через PUT /api/user/requisites.
 *
 * При client_type === "individual" — счета/акты не выставляются.
 */

import React, { useEffect, useState } from "react";
import { Building2, FileText, Loader2, AlertCircle, CheckCircle2, Search } from "lucide-react";
import type { ClientRequisites, ClientType } from "@/lib/requisites";
import { CLIENT_TYPE_LABEL } from "@/lib/requisites";
import { jsonOrThrow } from "@/lib/safe-fetch-json";

const EMPTY: ClientRequisites = {
  client_type: "individual",
  legal_name: "", inn: "", kpp: "", ogrn: "", legal_address: "",
  bank_name: "", bank_bik: "", bank_account: "", bank_corr_account: "",
  director_name: "", director_position: "", contact_email: "",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1.5px solid var(--border)",
  background: "var(--background)",
  color: "var(--foreground)",
  fontSize: 14,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--muted-foreground)",
  marginBottom: 5,
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--muted-foreground)",
  letterSpacing: "0.06em",
  marginTop: 10,
  marginBottom: 4,
};

export function RequisitesTab() {
  const [data, setData] = useState<ClientRequisites>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // DaData lookup state
  const [innLookup, setInnLookup] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  const [bikLookup, setBikLookup] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });

  // Load on mount
  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/requisites", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (!cancelled && d.ok && d.data) setData({ ...EMPTY, ...d.data }); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const set = <K extends keyof ClientRequisites>(k: K, v: ClientRequisites[K]) => {
    setData(d => ({ ...d, [k]: v }));
    if (errors[k as string]) setErrors(e => { const x = { ...e }; delete x[k as string]; return x; });
  };

  const fillByInn = async () => {
    const inn = data.inn.trim();
    if (!/^\d{10}$|^\d{12}$/.test(inn)) {
      setInnLookup({ loading: false, error: "ИНН должен содержать 10 или 12 цифр" });
      return;
    }
    setInnLookup({ loading: true, error: null });
    try {
      const r = await fetch(`/api/dadata/party?inn=${encodeURIComponent(inn)}`);
      const j = await jsonOrThrow(r);
      if (!j.ok) {
        setInnLookup({ loading: false, error: j.error || "Не найдено" });
        return;
      }
      setData(d => ({
        ...d,
        client_type: j.data.client_type,
        legal_name: j.data.legal_name || d.legal_name,
        inn: j.data.inn || d.inn,
        kpp: j.data.kpp || d.kpp,
        ogrn: j.data.ogrn || d.ogrn,
        legal_address: j.data.legal_address || d.legal_address,
        director_name: j.data.director_name || d.director_name,
        director_position: j.data.director_position || d.director_position,
      }));
      setInnLookup({ loading: false, error: null });
    } catch {
      setInnLookup({ loading: false, error: "Ошибка обращения к DaData" });
    }
  };

  const fillByBik = async () => {
    const bik = data.bank_bik.trim();
    if (!/^\d{9}$/.test(bik)) {
      setBikLookup({ loading: false, error: "БИК должен содержать 9 цифр" });
      return;
    }
    setBikLookup({ loading: true, error: null });
    try {
      const r = await fetch(`/api/dadata/bank?bik=${encodeURIComponent(bik)}`);
      const j = await jsonOrThrow(r);
      if (!j.ok) {
        setBikLookup({ loading: false, error: j.error || "Банк не найден" });
        return;
      }
      setData(d => ({
        ...d,
        bank_name: j.data.bank_name || d.bank_name,
        bank_corr_account: j.data.bank_corr_account || d.bank_corr_account,
      }));
      setBikLookup({ loading: false, error: null });
    } catch {
      setBikLookup({ loading: false, error: "Ошибка обращения к DaData" });
    }
  };

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const r = await fetch("/api/user/requisites", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const j = await jsonOrThrow(r);
      if (!j.ok) {
        if (j.errors) setErrors(j.errors);
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ background: "var(--card)", borderRadius: 16, border: "1px solid var(--border)", padding: 32, textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
        <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  const isLLC = data.client_type === "llc";
  const isIP = data.client_type === "ip";
  const isLegal = isLLC || isIP;

  return (
    <div style={{ background: "var(--card)", borderRadius: 16, border: "1px solid var(--border)", padding: 24, boxShadow: "var(--shadow)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "color-mix(in srgb, var(--primary) 12%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <FileText size={18} style={{ color: "var(--primary)" }} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>Юридические реквизиты</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2, lineHeight: 1.5 }}>
            Используются для генерации <strong>счетов на оплату</strong> и <strong>актов выполненных работ</strong>.
            Если планируете оплачивать по расчётному счёту, заполните все поля юрлица или ИП.
          </div>
        </div>
      </div>

      {/* Тип клиента */}
      <div style={sectionLabelStyle}>ТИП КЛИЕНТА</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        {(["individual", "ip", "llc"] as ClientType[]).map(t => {
          const active = data.client_type === t;
          return (
            <div key={t} onClick={() => set("client_type", t)}
              style={{
                padding: "10px 12px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                border: `2px solid ${active ? "var(--primary)" : "var(--border)"}`,
                background: active ? "color-mix(in srgb, var(--primary) 8%, transparent)" : "transparent",
                fontSize: 12, fontWeight: 600,
                color: active ? "var(--primary)" : "var(--foreground)",
                transition: "all 0.15s",
              }}>
              {CLIENT_TYPE_LABEL[t]}
            </div>
          );
        })}
      </div>

      {!isLegal && (
        <div style={{ padding: 14, background: "color-mix(in srgb, var(--primary) 6%, transparent)", border: "1px solid color-mix(in srgb, var(--primary) 25%, var(--border))", borderRadius: 10, fontSize: 12, color: "var(--foreground)", lineHeight: 1.5, marginTop: 6 }}>
          <Building2 size={14} style={{ verticalAlign: "middle", marginRight: 6, color: "var(--primary)" }} />
          Для физических лиц оплата только картой / СБП через ЮКассу. Чтобы получить
          <strong> счёт на оплату с р/счёта </strong> и <strong>акт выполненных работ</strong>,
          выберите «ИП» или «Юр.лицо».
        </div>
      )}

      {isLegal && (
        <>
          {/* ИНН + DaData */}
          <div style={sectionLabelStyle}>ОСНОВНЫЕ ДАННЫЕ</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "flex-end", marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>ИНН {isLLC ? "(10 цифр)" : "(12 цифр)"}</label>
              <input type="text" value={data.inn} onChange={e => set("inn", e.target.value.replace(/\D/g, "").slice(0, 12))}
                placeholder={isLLC ? "7707083893" : "770708389300"}
                style={{ ...inputStyle, borderColor: errors.inn ? "var(--destructive)" : "var(--border)" }} />
              {errors.inn && <div style={{ fontSize: 11, color: "var(--destructive)", marginTop: 4 }}>{errors.inn}</div>}
            </div>
            <button onClick={fillByInn} disabled={innLookup.loading}
              style={{ padding: "10px 16px", height: 40, borderRadius: 10, border: "1px solid var(--primary)", background: "var(--primary)", color: "#fff", fontWeight: 600, fontSize: 12, cursor: innLookup.loading ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              {innLookup.loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={14} />}
              Заполнить по ИНН
            </button>
          </div>
          {innLookup.error && (
            <div style={{ fontSize: 12, color: "var(--destructive)", marginTop: -8, marginBottom: 12, display: "flex", alignItems: "center", gap: 4 }}>
              <AlertCircle size={12} /> {innLookup.error}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: isLLC ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 12 }}>
            {isLLC && (
              <div>
                <label style={labelStyle}>КПП (9 цифр)</label>
                <input type="text" value={data.kpp} onChange={e => set("kpp", e.target.value.replace(/\D/g, "").slice(0, 9))}
                  placeholder="770701001"
                  style={{ ...inputStyle, borderColor: errors.kpp ? "var(--destructive)" : "var(--border)" }} />
                {errors.kpp && <div style={{ fontSize: 11, color: "var(--destructive)", marginTop: 4 }}>{errors.kpp}</div>}
              </div>
            )}
            <div>
              <label style={labelStyle}>{isLLC ? "ОГРН (13 цифр)" : "ОГРНИП (15 цифр)"}</label>
              <input type="text" value={data.ogrn} onChange={e => set("ogrn", e.target.value.replace(/\D/g, "").slice(0, 15))}
                placeholder={isLLC ? "1027700132195" : "304770000123456"}
                style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>{isIP ? "Полное наименование (ИП Иванов Иван Иванович)" : "Полное наименование организации"}</label>
            <input type="text" value={data.legal_name} onChange={e => set("legal_name", e.target.value)}
              placeholder={isIP ? "ИП Иванов Иван Иванович" : 'ООО "Ромашка"'}
              style={inputStyle} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Юридический адрес</label>
            <input type="text" value={data.legal_address} onChange={e => set("legal_address", e.target.value)}
              placeholder="123456, г. Москва, ул. Примерная, д. 1"
              style={inputStyle} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>{isIP ? "ФИО индивидуального предпринимателя" : "ФИО директора"}</label>
              <input type="text" value={data.director_name} onChange={e => set("director_name", e.target.value)}
                placeholder="Иванов Иван Иванович"
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Должность</label>
              <input type="text" value={data.director_position} onChange={e => set("director_position", e.target.value)}
                placeholder={isIP ? "ИП" : "Генеральный директор"}
                style={inputStyle} />
            </div>
          </div>

          {/* Банк + DaData */}
          <div style={sectionLabelStyle}>БАНКОВСКИЕ РЕКВИЗИТЫ</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "flex-end", marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>БИК банка (9 цифр)</label>
              <input type="text" value={data.bank_bik} onChange={e => set("bank_bik", e.target.value.replace(/\D/g, "").slice(0, 9))}
                placeholder="044525225"
                style={{ ...inputStyle, borderColor: errors.bank_bik ? "var(--destructive)" : "var(--border)" }} />
              {errors.bank_bik && <div style={{ fontSize: 11, color: "var(--destructive)", marginTop: 4 }}>{errors.bank_bik}</div>}
            </div>
            <button onClick={fillByBik} disabled={bikLookup.loading}
              style={{ padding: "10px 16px", height: 40, borderRadius: 10, border: "1px solid var(--primary)", background: "var(--primary)", color: "#fff", fontWeight: 600, fontSize: 12, cursor: bikLookup.loading ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              {bikLookup.loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={14} />}
              Заполнить по БИК
            </button>
          </div>
          {bikLookup.error && (
            <div style={{ fontSize: 12, color: "var(--destructive)", marginTop: -8, marginBottom: 12, display: "flex", alignItems: "center", gap: 4 }}>
              <AlertCircle size={12} /> {bikLookup.error}
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Название банка</label>
            <input type="text" value={data.bank_name} onChange={e => set("bank_name", e.target.value)}
              placeholder='ПАО "Сбербанк"'
              style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Расчётный счёт (20 цифр)</label>
              <input type="text" value={data.bank_account} onChange={e => set("bank_account", e.target.value.replace(/\D/g, "").slice(0, 20))}
                placeholder="40702810400000000000"
                style={{ ...inputStyle, borderColor: errors.bank_account ? "var(--destructive)" : "var(--border)" }} />
              {errors.bank_account && <div style={{ fontSize: 11, color: "var(--destructive)", marginTop: 4 }}>{errors.bank_account}</div>}
            </div>
            <div>
              <label style={labelStyle}>Корр.счёт (20 цифр)</label>
              <input type="text" value={data.bank_corr_account} onChange={e => set("bank_corr_account", e.target.value.replace(/\D/g, "").slice(0, 20))}
                placeholder="30101810400000000225"
                style={{ ...inputStyle, borderColor: errors.bank_corr_account ? "var(--destructive)" : "var(--border)" }} />
              {errors.bank_corr_account && <div style={{ fontSize: 11, color: "var(--destructive)", marginTop: 4 }}>{errors.bank_corr_account}</div>}
            </div>
          </div>

          <div style={sectionLabelStyle}>КОНТАКТЫ ДЛЯ БУХГАЛТЕРИИ</div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>E-mail для документов (если отличается от основного)</label>
            <input type="email" value={data.contact_email} onChange={e => set("contact_email", e.target.value)}
              placeholder="accounting@company.ru"
              style={{ ...inputStyle, borderColor: errors.contact_email ? "var(--destructive)" : "var(--border)" }} />
            {errors.contact_email && <div style={{ fontSize: 11, color: "var(--destructive)", marginTop: 4 }}>{errors.contact_email}</div>}
          </div>
        </>
      )}

      <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={save} disabled={saving}
          style={{ background: "var(--primary)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: saving ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          {saving && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
          Сохранить
        </button>
        {saved && (
          <span style={{ fontSize: 13, color: "var(--success, #16a34a)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <CheckCircle2 size={14} /> Сохранено
          </span>
        )}
      </div>
    </div>
  );
}
