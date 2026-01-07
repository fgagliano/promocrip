"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Cripto = "BTC" | "ETH" | "LINK" | "LTC" | "UNI" | "MELI_DOLAR";

type ResumoPeriodo = {
  cutoff_id: number;
  cutoff_criado_em: string;
  saldo_cripto_no_corte: number;
  total_cripto_atual: number;
  total_sacado_desde_corte: number;
  lucro_ajustado_periodo: number;
  blocos_200: number;
  saques_ja_feitos: number;
  saques_permitidos_agora: number;
};

type RendaFixa = {
  id: number;
  nome: string;
  saldo: number;
};


type CarteiraCripto = {
  cripto: Cripto;
  valor_atual: number;
  valor_investido: number;
};

const ORDEM: Cripto[] = ["BTC", "ETH", "LINK", "LTC", "UNI", "MELI_DOLAR"];

const LABEL: Record<Cripto, string> = {
  BTC: "BTC",
  ETH: "ETH",
  LINK: "LINK",
  LTC: "LTC",
  UNI: "UNI",
  MELI_DOLAR: "Meli Dólar",
};

function fmtBRL(v: number | null | undefined) {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtPct(v: number | null | undefined) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function parseMoneySmart(input: string) {
  // Aceita: "60.88", "60,88", "6.088,00", "6,088.00", "6088", "6 088,00"
  let s = (input ?? "").trim();

  // remove espaços e "R$"
  s = s.replace(/\s/g, "").replace(/^R\$\s?/, "");

  // mantém só dígitos, ponto, vírgula e sinal
  s = s.replace(/[^\d.,-]/g, "");

  if (!s) return 0;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");

  // Caso 1: tem ponto E vírgula -> o último que aparecer é o separador decimal
  if (lastDot !== -1 && lastComma !== -1) {
    const decimalSep = lastDot > lastComma ? "." : ",";
    const thousandSep = decimalSep === "." ? "," : ".";

    s = s.replaceAll(thousandSep, "");
    s = decimalSep === "," ? s.replaceAll(",", ".") : s;
    return Number(s);
  }

  // Caso 2: só vírgula -> vírgula é decimal
  if (lastComma !== -1) {
    s = s.replaceAll(".", "");   // pontos são milhar
    s = s.replaceAll(",", ".");  // vírgula vira decimal
    return Number(s);
  }

  // Caso 3: só ponto -> pode ser decimal (60.88) OU milhar (6.088)
  if (lastDot !== -1) {
    const parts = s.split(".");
    // Heurística: se só tem 1 ponto e exatamente 2 dígitos após ele -> é decimal
    if (parts.length === 2 && parts[1].length === 2) {
      return Number(s);
    }
    // senão, considera ponto como separador de milhar
    s = s.replaceAll(".", "");
    return Number(s);
  }

  // Caso 4: só dígitos
  return Number(s);
}

function parseMoney(input: string) {
  return parseMoneySmart(input);
}


export default function Page() {
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
  }, []);

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string>("");
  const [erro, setErro] = useState<string>("");

  const [carteira, setCarteira] = useState<CarteiraCripto[]>([]);
  const [resumo, setResumo] = useState<ResumoPeriodo | null>(null);

  const [form, setForm] = useState<Record<Cripto, string>>({
    BTC: "",
    ETH: "",
    LINK: "",
    LTC: "",
    UNI: "",
    MELI_DOLAR: "",
  });

const [rendaFixa, setRendaFixa] = useState<RendaFixa[]>([]);

  
  async function carregarTudo() {
    if (!supabase) {
      setErro("Env do Supabase não carregou (URL/ANON_KEY).");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErro("");
    setMsg("");

    const { data: carteiraData, error: carteiraErr } = await supabase
      .schema("cripto")
      .from("carteira_cripto")
      .select("cripto, valor_atual, valor_investido");

    if (carteiraErr) {
      setErro(`Erro ao ler carteira_cripto: ${carteiraErr.message}`);
      setLoading(false);
      return;
    }

    const lista = (carteiraData ?? []) as CarteiraCripto[];
    // ordena na ordem desejada
    lista.sort((a, b) => ORDEM.indexOf(a.cripto) - ORDEM.indexOf(b.cripto));
    setCarteira(lista);

const { data: rfData, error: rfErr } = await supabase
  .schema("cripto")
  .from("carteira_renda_fixa")
  .select("id, nome, saldo")
  .order("id");

if (rfErr) {
  setErro(`Erro ao ler carteira_renda_fixa: ${rfErr.message}`);
  setLoading(false);
  return;
}

setRendaFixa((rfData ?? []) as RendaFixa[]);

    
    const { data: resumoData, error: resumoErr } = await supabase
      .schema("cripto")
      .from("vw_resumo_periodo")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (resumoErr) {
      setErro(
        `Erro ao ler vw_resumo_periodo: ${resumoErr.message} (você já criou um cutoff?)`
      );
      setResumo(null);
      setLoading(false);
      return;
    }

    setResumo((resumoData ?? null) as ResumoPeriodo | null);
    setLoading(false);
  }

  useEffect(() => {
    carregarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

useEffect(() => {
  if (carteira.length === 0) return;
  preencherFormComCarteiraAtual();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [carteira]);

  
  function preencherComCarteiraAtual() {
    const map = new Map(carteira.map((c) => [c.cripto, c.valor_atual]));
    setForm({
      BTC: map.get("BTC")?.toString() ?? "",
      ETH: map.get("ETH")?.toString() ?? "",
      LINK: map.get("LINK")?.toString() ?? "",
      LTC: map.get("LTC")?.toString() ?? "",
      UNI: map.get("UNI")?.toString() ?? "",
      MELI_DOLAR: map.get("MELI_DOLAR")?.toString() ?? "",
    });
  }

  async function registrarAtualizacao() {
    if (!supabase) return;
    setErro("");
    setMsg("");

    const valores = {
      BTC: parseMoney(form.BTC),
      ETH: parseMoney(form.ETH),
      LINK: parseMoney(form.LINK),
      LTC: parseMoney(form.LTC),
      UNI: parseMoney(form.UNI),
      MELI_DOLAR: parseMoney(form.MELI_DOLAR),
    };

    const soma = Object.values(valores).reduce((a, b) => a + b, 0);
    if (soma <= 0) {
      setErro("Preencha ao menos um valor (maior que zero).");
      return;
    }

    const { data, error } = await supabase
      .schema("cripto")
      .rpc("fn_registrar_snapshot", {
        valores,
        obs: "Atualização manual via web",
      });

    if (error) {
      setErro(`Erro ao registrar snapshot: ${error.message}`);
      return;
    }

    setMsg(`Atualização registrada (snapshot id: ${data}).`);
    await carregarTudo();
  }

  async function sacarAutomatico() {
    if (!supabase) return;
    setErro("");
    setMsg("");

    const { data, error } = await supabase
      .schema("cripto")
      .rpc("fn_executar_saque_automatico", {
        valor_saque: 50,
        dias_min: 3,
        obs: "Coloquei no CDI do Mercado Livre",
      });

    if (error) {
      setErro(`Erro no saque: ${error.message}`);
      return;
    }

    setMsg(`Saque executado (id: ${data}).`);
    await carregarTudo();
  }

  async function verVencedora() {
    if (!supabase) return;
    setErro("");
    setMsg("");

    const { data, error } = await supabase
      .schema("cripto")
      .rpc("fn_escolher_cripto_vencedora", { dias_min: 3 });

    if (error) {
      setErro(`Erro ao calcular vencedora: ${error.message}`);
      return;
    }

    setMsg(`Cripto vencedora (baseline ≥ 3 dias): ${data}`);
  }
async function atualizarRendaFixa(id: number, novoValor: string) {
  if (!supabase) return;

const valor = parseMoney(novoValor);

  
  if (!Number.isFinite(valor)) return;

  const { error } = await supabase
    .schema("cripto")
    .from("carteira_renda_fixa")
    .update({
      saldo: valor,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    setErro(`Erro ao atualizar renda fixa: ${error.message}`);
    return;
  }

  await carregarTudo();
}

  return (
    <main style={{ padding: 20, fontFamily: "system-ui, Arial" }}>
      <h1 style={{ margin: 0 }}>PromoCrip</h1>
      <p style={{ marginTop: 6, color: "#555" }}>
        Atualize saldos, acompanhe lucro ajustado (tipo sua E45) e execute saque automático.
      </p>

      {loading ? (
        <p>Carregando…</p>
      ) : (
        <>
          {(erro || msg) && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 10,
                border: `1px solid ${erro ? "#ff4d4f" : "#52c41a"}`,
                background: erro ? "#fff1f0" : "#f6ffed",
              }}
            >
              {erro ? <b style={{ color: "#a8071a" }}>{erro}</b> : <b>{msg}</b>}
            </div>
          )}

          {/* Carteira */}
          <section style={{ marginTop: 18 }}>
            <h2 style={{ marginBottom: 8 }}>Carteira (estado atual)</h2>

            {carteira.length === 0 ? (
              <p>Nenhuma linha em carteira_cripto ainda.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: 720,
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>
                        Ativo
                      </th>
                      <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #ddd" }}>
                        Atual (C)
                      </th>
                      <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #ddd" }}>
                        Investido (D)
                      </th>
                      <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #ddd" }}>
                        Lucro (R$)
                      </th>
                      <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #ddd" }}>
                        Lucro (%)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {carteira.map((c) => {
                      const atual = c.valor_atual ?? 0;
                      const inv = c.valor_investido ?? 0;

                      const temInvestido = c.cripto !== "MELI_DOLAR" && inv > 0;
                      const lucro = c.cripto === "MELI_DOLAR" ? null : atual - inv;
                      const pct = temInvestido ? ((atual - inv) / inv) * 100 : null;

                      const negativo = (lucro ?? 0) < 0 || (pct ?? 0) < 0;

                      return (
                        <tr key={c.cripto}>
                          <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                            <b>{LABEL[c.cripto]}</b>
                          </td>

                          <td style={{ padding: 8, textAlign: "right", borderBottom: "1px solid #eee" }}>
                            {fmtBRL(atual)}
                          </td>

                          <td style={{ padding: 8, textAlign: "right", borderBottom: "1px solid #eee" }}>
                            {c.cripto === "MELI_DOLAR" ? "—" : fmtBRL(inv)}
                          </td>

                          <td
                            style={{
                              padding: 8,
                              textAlign: "right",
                              borderBottom: "1px solid #eee",
                              color: negativo ? "#b42318" : undefined,
                              fontWeight: negativo ? 700 : undefined,
                            }}
                          >
                            {c.cripto === "MELI_DOLAR" ? "—" : fmtBRL(lucro ?? 0)}
                          </td>

                          <td
                            style={{
                              padding: 8,
                              textAlign: "right",
                              borderBottom: "1px solid #eee",
                              color: (pct ?? 0) < 0 ? "#b42318" : undefined,
                              fontWeight: (pct ?? 0) < 0 ? 700 : undefined,
                            }}
                          >
                            {c.cripto === "MELI_DOLAR" ? "—" : fmtPct(pct)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

<section style={{ marginTop: 22 }}>
  <h2 style={{ marginBottom: 8 }}>Renda Fixa</h2>

  {rendaFixa.length === 0 ? (
    <p>Nenhuma renda fixa cadastrada.</p>
  ) : (
    <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
      {rendaFixa.map((rf) => (
        <div
          key={rf.id}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 160px",
            gap: 10,
            alignItems: "center",
          }}
        >
          <span>
            <b>{rf.nome}</b>
          </span>

          <input
            defaultValue={fmtBRL(rf.saldo).replace("R$", "").trim()}
            inputMode="decimal"
            onBlur={(e) => atualizarRendaFixa(rf.id, e.target.value)}
            style={{
              padding: 8,
              borderRadius: 8,
              border: "1px solid #ccc",
              textAlign: "right",
            }}
          />
        </div>
      ))}
    </div>
  )}
</section>

          
          {/* Atualização */}
          <section style={{ marginTop: 22 }}>
            <h2 style={{ marginBottom: 8 }}>Registrar atualização (snapshot)</h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 10,
                alignItems: "end",
              }}
            >
              {ORDEM.map((k) => (
                <label key={k} style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 13, color: "#555" }}>{LABEL[k]} (valor atual)</span>
                  <input
                    value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    placeholder="ex.: 424,21"
                    inputMode="decimal"
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      border: "1px solid #ccc",
                      outline: "none",
                    }}
                  />
                </label>
              ))}
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={registrarAtualizacao}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #333",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Registrar atualização
              </button>

              

              <button
                onClick={verVencedora}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "#fafafa",
                  cursor: "pointer",
                }}
              >
                Ver vencedora (baseline ≥ 3 dias)
              </button>

              <button
                onClick={carregarTudo}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "#fafafa",
                  cursor: "pointer",
                }}
              >
                Recarregar
              </button>
            </div>
          </section>

          {/* Resumo do período */}
          <section style={{ marginTop: 22 }}>
            <h2 style={{ marginBottom: 8 }}>Resumo do período (tipo E45)</h2>

            {!resumo ? (
              <div style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}>
                <b>Sem resumo.</b>
                <div style={{ marginTop: 6, color: "#555" }}>
                  Você provavelmente ainda não criou um <b>cutoff</b> em <code>cripto.cutoffs</code>.
                  <br />
                  Crie um cutoff após o aporte (ponto de corte do período).
                </div>
              </div>
            ) : (
              <div style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}>
                <div style={{ display: "grid", gap: 8 }}>
                  <div>
    <b>Data do corte:</b>{" "}
    {new Date(resumo.cutoff_criado_em).toLocaleString("pt-BR")}
  </div>
                  <div>
                    <b>Saldo no corte:</b> {fmtBRL(resumo.saldo_cripto_no_corte)}
                  </div>
                  <div>
                    <b>Total cripto atual (inclui Meli Dólar):</b> {fmtBRL(resumo.total_cripto_atual)}
                  </div>
                  <div>
                    <b>Total sacado desde o corte:</b> {fmtBRL(resumo.total_sacado_desde_corte)}
                  </div>
                  <div>
                    <b>Lucro ajustado do período:</b> {fmtBRL(resumo.lucro_ajustado_periodo)}
                  </div>
                  <div>
                    <b>Saques permitidos agora:</b> {resumo.saques_permitidos_agora}
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <button
                    onClick={sacarAutomatico}
                    disabled={(resumo.saques_permitidos_agora ?? 0) <= 0}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid #333",
                      background: (resumo.saques_permitidos_agora ?? 0) > 0 ? "#fff" : "#f2f2f2",
                      cursor: (resumo.saques_permitidos_agora ?? 0) > 0 ? "pointer" : "not-allowed",
                    }}
                  >
                    Sacar R$50 automaticamente
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
