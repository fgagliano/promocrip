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

type Aporte = {
  id: number;
  data_aporte: string;
  saldo_anterior: number;
  valor_aporte: number;
  saldo_atual: number;
  ganho_periodo: number;
  pct_periodo: number;
  observacao: string | null;
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
const [aportes, setAportes] = useState<Aporte[]>([]);

  
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

    const { data: aportesData, error: aportesErr } = await supabase
  .schema("cripto")
  .from("aportes")
  .select("id, data_aporte, saldo_anterior, valor_aporte, saldo_atual, ganho_periodo, pct_periodo, observacao")
  .order("data_aporte", { ascending: false })
  .order("id", { ascending: false });

if (aportesErr) {
  setErro(`Erro ao ler aportes: ${aportesErr.message}`);
  setLoading(false);
  return;
}

setAportes((aportesData ?? []) as Aporte[]);

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
  preencherComCarteiraAtual();
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
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">PromoCrip</h1>
            <p className="mt-1 text-sm text-slate-300">
              Atualize saldos, acompanhe lucro ajustado (tipo sua E45) e execute saque automático.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={carregarTudo}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-white/10"
            >
              Recarregar
            </button>

            <button
              onClick={verVencedora}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-white/10"
            >
              Ver vencedora
            </button>
          </div>
        </div>

        {/* Alerts */}
        <div className="mt-5">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
              Carregando…
            </div>
          ) : (
            (erro || msg) && (
              <div
                className={[
                  "rounded-2xl border p-4 text-sm",
                  erro
                    ? "border-red-500/30 bg-red-500/10 text-red-100"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-50",
                ].join(" ")}
              >
                <span className="font-semibold">{erro ? erro : msg}</span>
              </div>
            )
          )}
        </div>

        {!loading && (
          <>
            {/* KPI Row */}
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-slate-300">Total cripto atual</div>
                <div className="mt-1 text-lg font-semibold">
                  {fmtBRL(resumo?.total_cripto_atual ?? 0)}
                </div>
                <div className="mt-1 text-xs text-slate-400">Inclui Meli Dólar</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-slate-300">Lucro ajustado (período)</div>
                <div className="mt-1 text-lg font-semibold">
                  {fmtBRL(resumo?.lucro_ajustado_periodo ?? 0)}
                </div>
                <div className="mt-1 text-xs text-slate-400">Tipo célula E45</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-slate-300">Total sacado</div>
                <div className="mt-1 text-lg font-semibold">
                  {fmtBRL(resumo?.total_sacado_desde_corte ?? 0)}
                </div>
                <div className="mt-1 text-xs text-slate-400">Desde o corte</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-slate-300">Saques permitidos agora</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-lg font-semibold">
                    {resumo?.saques_permitidos_agora ?? 0}
                  </span>
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      (resumo?.saques_permitidos_agora ?? 0) > 0
                        ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30"
                        : "bg-white/10 text-slate-200 ring-1 ring-white/10",
                    ].join(" ")}
                  >
                    {(resumo?.saques_permitidos_agora ?? 0) > 0 ? "Liberado" : "Aguardando"}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Corte:{" "}
                  {resumo?.cutoff_criado_em
                    ? new Date(resumo.cutoff_criado_em).toLocaleDateString("pt-BR")
                    : "—"}
                </div>
              </div>
            </div>

            {/* Grid principal */}
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {/* Carteira */}
              <section className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                  <div>
                    <h2 className="text-base font-semibold">Carteira (estado atual)</h2>
                    <p className="mt-1 text-xs text-slate-300">
                      Atual (C), Investido (D), lucro e %.
                    </p>
                  </div>
                </div>

                {carteira.length === 0 ? (
                  <div className="px-5 py-6 text-sm text-slate-300">
                    Nenhuma linha em <span className="font-medium">carteira_cripto</span> ainda.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-[820px] w-full text-sm">
                      <thead className="text-xs text-slate-300">
                        <tr className="border-b border-white/10">
                          <th className="px-5 py-3 text-left font-medium">Ativo</th>
                          <th className="px-5 py-3 text-right font-medium">Atual (C)</th>
                          <th className="px-5 py-3 text-right font-medium">Investido (D)</th>
                          <th className="px-5 py-3 text-right font-medium">Lucro (R$)</th>
                          <th className="px-5 py-3 text-right font-medium">Lucro (%)</th>
                          <th className="px-5 py-3 text-right font-medium">Lucro (%)</th>

                        </tr>
                      </thead>

                      <tbody className="divide-y divide-white/5">
                        {carteira.map((c) => {
                          const atual = c.valor_atual ?? 0;
                          const inv = c.valor_investido ?? 0;

                          const temInvestido = c.cripto !== "MELI_DOLAR" && inv > 0;
                          const lucro = c.cripto === "MELI_DOLAR" ? null : atual - inv;
                          const pct = temInvestido ? ((atual - inv) / inv) * 100 : null;

                          const lucroNeg = (lucro ?? 0) < 0;
                          const pctNeg = pct !== null && pct !== undefined && pct < 0;


                          return (
                            <tr key={c.cripto} className="hover:bg-white/5">
                              <td className="px-5 py-3">
                                <div className="font-semibold">{LABEL[c.cripto]}</div>
                                {c.cripto === "MELI_DOLAR" && (
                                  <div className="mt-0.5 text-xs text-slate-400">
                                    Só “Atual”; não compra.
                                  </div>
                                )}
                              </td>

                              <td className="px-5 py-3 text-right">{fmtBRL(atual)}</td>

                              <td className="px-5 py-3 text-right text-slate-200">
                                {c.cripto === "MELI_DOLAR" ? "—" : fmtBRL(inv)}
                              </td>

                              <td
                                className={[
  "px-5 py-3 text-right font-semibold",
  c.cripto === "MELI_DOLAR"
    ? "text-slate-400 font-normal"
    : pct === null
    ? "text-slate-400 font-normal"
    : pctNeg
    ? "text-red-300"
    : "text-emerald-200",
].join(" ")}

                              >
                                {c.cripto === "MELI_DOLAR" ? "—" : fmtBRL(lucro ?? 0)}
                              </td>

                              <td
                                className={[
                                  "px-5 py-3 text-right font-semibold",
                                  c.cripto === "MELI_DOLAR"
                                    ? "text-slate-400 font-normal"
                                    : pctNeg
                                    ? "text-red-300"
                                    : "text-emerald-200",
                                ].join(" ")}
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

              {/* Coluna direita */}
              <div className="grid gap-4">
                {/* Renda fixa */}
                <section className="rounded-2xl border border-white/10 bg-white/5">
                  <div className="border-b border-white/10 px-5 py-4">
                    <h2 className="text-base font-semibold">Renda Fixa</h2>
                    <p className="mt-1 text-xs text-slate-300">Editável (ganho diário).</p>
                  </div>

                  <div className="px-5 py-4">
                    {rendaFixa.length === 0 ? (
                      <p className="text-sm text-slate-300">Nenhuma renda fixa cadastrada.</p>
                    ) : (
                      <div className="grid gap-3">
                        {rendaFixa.map((rf) => (
                          <div key={rf.id} className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:items-center">
                            <div className="text-sm font-medium text-slate-200">{rf.nome}</div>

                            <input
                              defaultValue={rf.saldo.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                              inputMode="decimal"
                              onBlur={(e) => atualizarRendaFixa(rf.id, e.target.value)}
                              className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-right text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/20"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                {/* Resumo + ação */}
                <section className="rounded-2xl border border-white/10 bg-white/5">
                  <div className="border-b border-white/10 px-5 py-4">
                    <h2 className="text-base font-semibold">Resumo do período</h2>
                    <p className="mt-1 text-xs text-slate-300">Cutoff, lucro ajustado e saques.</p>
                  </div>

                  <div className="px-5 py-4">
                    {!resumo ? (
                      <div className="text-sm text-slate-300">
                        <b className="text-slate-100">Sem resumo.</b>
                        <div className="mt-2 text-xs text-slate-400">
                          Você provavelmente ainda não criou um <b>cutoff</b> em{" "}
                          <code className="rounded bg-black/30 px-1 py-0.5">cripto.cutoffs</code>.
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-2 text-sm text-slate-200">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-300">Data do corte</span>
                          <span className="font-medium">
                            {new Date(resumo.cutoff_criado_em).toLocaleDateString("pt-BR")}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-300">Saldo no corte</span>
                          <span className="font-medium">{fmtBRL(resumo.saldo_cripto_no_corte)}</span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-300">Total sacado</span>
                          <span className="font-medium">{fmtBRL(resumo.total_sacado_desde_corte)}</span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-300">Lucro ajustado</span>
                          <span className="font-semibold">{fmtBRL(resumo.lucro_ajustado_periodo)}</span>
                        </div>

                        <div className="mt-3 flex flex-col gap-2">
                          <button
                            onClick={sacarAutomatico}
                            disabled={(resumo.saques_permitidos_agora ?? 0) <= 0}
                            className={[
                              "w-full rounded-xl px-4 py-2 text-sm font-semibold transition",
                              (resumo.saques_permitidos_agora ?? 0) > 0
                                ? "bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                                : "bg-white/10 text-slate-400 cursor-not-allowed",
                            ].join(" ")}
                          >
                            Sacar R$ 50 automaticamente
                          </button>

                          <div className="text-xs text-slate-400">
                            Saques permitidos agora:{" "}
                            <b className="text-slate-200">{resumo.saques_permitidos_agora}</b>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>

            {/* Registrar snapshot */}
            <section className="mt-6 rounded-2xl border border-white/10 bg-white/5">
              <div className="border-b border-white/10 px-5 py-4">
                <h2 className="text-base font-semibold">Registrar atualização (snapshot)</h2>
                <p className="mt-1 text-xs text-slate-300">
                  Os campos já vêm carregados com o valor atual — altere só o que precisar.
                </p>
              </div>

              <div className="px-5 py-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  {ORDEM.map((k) => (
                    <label key={k} className="grid gap-1.5">
                      <span className="text-xs text-slate-300">{LABEL[k]}</span>
                      <input
                        value={form[k]}
                        onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                        placeholder="ex.: 424,21"
                        inputMode="decimal"
                        className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-500/40 focus:ring-2 focus:ring-sky-500/20"
                      />
                    </label>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={registrarAtualizacao}
                    className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-sky-950 hover:bg-sky-400"
                  >
                    Registrar atualização
                  </button>

                  <button
                    onClick={verVencedora}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-white/10"
                  >
                    Ver vencedora (≥ 3 dias)
                  </button>

                  <button
                    onClick={carregarTudo}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-white/10"
                  >
                    Recarregar
                  </button>
                </div>
              </div>
            </section>

            {/* Histórico de aportes */}
            <section className="mt-6 rounded-2xl border border-white/10 bg-white/5">
              <div className="border-b border-white/10 px-5 py-4">
                <h2 className="text-base font-semibold">Histórico de aportes</h2>
                <p className="mt-1 text-xs text-slate-300">
                  Mais recente em cima (último aporte primeiro).
                </p>
              </div>

              <div className="px-5 py-4">
                {aportes.length === 0 ? (
                  <p className="text-sm text-slate-300">Nenhum aporte cadastrado ainda.</p>
                ) : (
                  <div className="grid gap-3">
                    {aportes.map((a) => (
                      <div
                        key={a.id}
                        className="rounded-2xl border border-white/10 bg-slate-950/30 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold">
                            {new Date(a.data_aporte).toLocaleDateString("pt-BR")}
                          </div>
                          <div className="text-xs text-slate-400">#{a.id}</div>
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <div>
                            <div className="text-xs text-slate-400">Aporte</div>
                            <div className="text-sm font-semibold text-sky-200">
                              {fmtBRL(a.valor_aporte)}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-slate-400">
                              Saldo base após o aporte
                            </div>
                            <div className="text-sm font-semibold">
                              {a.saldo_base === null ? "—" : fmtBRL(a.saldo_base)}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-slate-400">Obs</div>
                            <div className="text-sm font-semibold text-slate-200">
                              {a.observacao ?? "—"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            
            <div className="mt-8 text-xs text-slate-500">
              Dica: você pode digitar valores com ponto ou vírgula (ex.: <b>60.88</b> ou <b>60,88</b>).
            </div>
          </>
        )}
      </div>
    </main>
  );

}
