var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// app/src/dominio/tempo.ts
function paraISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function deISO(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d, 12, 0, 0, 0);
}
function somaDias(iso, n) {
  const d = deISO(iso);
  d.setDate(d.getDate() + n);
  return paraISO(d);
}
function diaDaSemana(iso) {
  return deISO(iso).getDay();
}
function hora(min) {
  const m = (Math.round(min) % 1440 + 1440) % 1440;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}h` : `${h}h${pad(r)}`;
}
var pad;
var init_tempo = __esm({
  "app/src/dominio/tempo.ts"() {
    pad = (n) => String(n).padStart(2, "0");
  }
});

// app/src/dados/normalizar.ts
function normalizar(dados) {
  const d = obj(dados);
  const pessoas = obj(d.pessoas);
  return {
    versao: 1,
    criadoEm: typeof d.criadoEm === "number" ? d.criadoEm : 0,
    pessoas: {
      ele: { nome: pessoas.ele?.nome || "Ele" },
      ela: { nome: pessoas.ela?.nome || "Ela" }
    },
    periodo: {
      inicio: d.periodo?.inicio || "2026-10-07",
      fim: d.periodo?.fim || "2026-10-19"
    },
    modelos: obj(d.modelos),
    calendario: obj(d.calendario),
    dias: obj(d.dias),
    feitos: obj(d.feitos),
    premios: obj(d.premios),
    vales: obj(d.vales),
    meta: typeof d.meta === "number" && d.meta > 0 && d.meta <= 1 ? d.meta : 0.7,
    avisos: obj(d.avisos),
    reacoes: obj(d.reacoes)
  };
}
var obj;
var init_normalizar = __esm({
  "app/src/dados/normalizar.ts"() {
    obj = (v) => v && typeof v === "object" ? v : {};
  }
});

// app/src/dominio/agenda.ts
function modeloDoDia(casal, data) {
  const id = casal.calendario?.[data];
  return id ? casal.modelos?.[id] : void 0;
}
function ordenar(a, b) {
  return a.inicio - b.inicio || ORDEM_QUEM[a.quem] - ORDEM_QUEM[b.quem] || a.titulo.localeCompare(b.titulo, "pt-BR");
}
function tarefasDoDia(casal, data) {
  let porDia = cacheTarefas.get(casal);
  if (!porDia) {
    porDia = /* @__PURE__ */ new Map();
    cacheTarefas.set(casal, porDia);
  }
  const pronto = porDia.get(data);
  if (pronto) return pronto;
  const calculado = calcularTarefasDoDia(casal, data);
  porDia.set(data, calculado);
  return calculado;
}
function calcularTarefasDoDia(casal, data) {
  const modelo = modeloDoDia(casal, data);
  const dow = diaDaSemana(data);
  const dia = casal.dias?.[data] ?? {};
  const out = [];
  if (modelo) {
    for (const base of Object.values(modelo.tarefas ?? {})) {
      if (base.diasSemana && base.diasSemana.length > 0 && !base.diasSemana.includes(dow)) continue;
      const aj = dia.ajustes?.[base.id];
      if (aj?.removida) continue;
      const { removida: _r, ...campos } = aj ?? {};
      void _r;
      const ajustada = !!aj && Object.keys(campos).some((k) => k !== "nota");
      out.push({ ...base, ...campos, id: base.id, origem: "modelo", modeloId: modelo.id, ajustada });
    }
  }
  for (const extra of Object.values(dia.extras ?? {})) {
    out.push({ ...extra, origem: "extra", ajustada: false });
  }
  return out.sort(ordenar);
}
function ehDe(t, p) {
  return t.quem === p || t.quem === "juntos";
}
var ORDEM_QUEM, cacheTarefas;
var init_agenda = __esm({
  "app/src/dominio/agenda.ts"() {
    init_tempo();
    ORDEM_QUEM = { juntos: 0, ele: 1, ela: 2 };
    cacheTarefas = /* @__PURE__ */ new WeakMap();
  }
});

// avisos/regras.ts
function agoraSP(agora = /* @__PURE__ */ new Date()) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(agora).map((p) => [p.type, p.value])
  );
  return { data: `${partes.year}-${partes.month}-${partes.day}`, min: Number(partes.hour) * 60 + Number(partes.minute) };
}
function lembretesDevidos(casal, data, min) {
  const out = [];
  const inscricoes = casal.avisos?.inscricoes ?? {};
  if (Object.keys(inscricoes).length === 0) return out;
  const tarefas = tarefasDoDia(casal, data).filter((t) => t.pontos > 0);
  for (const [celular, insc] of Object.entries(inscricoes)) {
    for (const t of tarefas) {
      if (!ehDe(t, insc.pessoa)) continue;
      const falta = t.inicio - min;
      if (falta > ANTES || falta < -DEPOIS) continue;
      if (casal.feitos?.[data]?.[t.id]?.[insc.pessoa]) continue;
      if (casal.avisos?.enviados?.[data]?.[t.id]?.[celular]) continue;
      const nome = casal.pessoas[insc.pessoa].nome;
      const outro = casal.pessoas[insc.pessoa === "ele" ? "ela" : "ele"].nome;
      const emoji = EMOJI[t.figura] ?? "\u{1F996}";
      const titulo = `${emoji} ${t.titulo} \xE0s ${hora(t.inicio)}`;
      const quando = falta > 1 ? `Daqui a ${falta} min.` : falta >= -1 ? "\xC9 agora!" : "J\xE1 come\xE7ou.";
      const junto = t.quem === "juntos" ? ` Chama ${outro === "Ela" || outro === "Ele" ? "o amor" : outro}!` : "";
      const corpo = `${quando}${junto} Bora, ${nome}? Vale ${t.pontos} folhas \u{1F343}`;
      out.push({ celular, tarefa: t, titulo, corpo });
    }
  }
  return out;
}
function minutosAteProximo(casal, data, min) {
  const inscricoes = casal.avisos?.inscricoes ?? {};
  let menor = Infinity;
  for (const [dia, desloca] of [
    [data, 0],
    [somaDias(data, 1), 1440]
  ]) {
    const tarefas = tarefasDoDia(casal, dia).filter((t) => t.pontos > 0);
    for (const [celular, insc] of Object.entries(inscricoes)) {
      for (const t of tarefas) {
        if (!ehDe(t, insc.pessoa)) continue;
        if (casal.feitos?.[dia]?.[t.id]?.[insc.pessoa]) continue;
        if (casal.avisos?.enviados?.[dia]?.[t.id]?.[celular]) continue;
        const falta = t.inicio + desloca - min;
        if (falta < -DEPOIS) continue;
        menor = Math.min(menor, Math.max(0, falta - ANTES));
      }
    }
  }
  return menor;
}
function escolherEspera(proxima, temInscricoes) {
  if (!temInscricoes) return 25;
  for (const e of ESPERAS) if (e + 3 <= proxima) return e;
  return 3;
}
var ANTES, DEPOIS, EMOJI, ESPERAS;
var init_regras = __esm({
  "avisos/regras.ts"() {
    init_agenda();
    init_tempo();
    ANTES = 12;
    DEPOIS = 30;
    EMOJI = {
      biblia: "\u{1F4D6}",
      corrida: "\u{1F45F}",
      mar: "\u{1F30A}",
      academia: "\u{1F3CB}\uFE0F",
      teatro: "\u{1F3AD}",
      ensaio: "\u{1F3AC}",
      estrela: "\u2B50",
      canto: "\u{1F3A4}",
      aulacanto: "\u{1F3BC}",
      violao: "\u{1F3B8}",
      livro: "\u{1F4D8}",
      livrocasal: "\u{1F4DA}",
      ia: "\u{1F916}",
      carreira: "\u{1F680}",
      desenvolvimento: "\u{1F331}",
      cuidar: "\u{1F9F4}",
      cochilo: "\u{1F634}",
      serie: "\u{1F4FA}",
      celula: "\u{1F3E0}",
      ebd: "\u26EA",
      aventura: "\u{1F392}",
      coracao: "\u2764\uFE0F"
    };
    ESPERAS = [60, 25, 10, 3];
  }
});

// avisos/enviar.ts
import { appendFileSync } from "node:fs";
import webpush from "web-push";
var require_enviar = __commonJS({
  "avisos/enviar.ts"() {
    init_tempo();
    init_normalizar();
    init_regras();
    var PROJETO = "bobossauro-27c72";
    var API_KEY = "AIzaSyB4xnyHs6ko8a_5Ck0hf7p4h5gHCHsIKcY";
    var VAPID_PUBLICO = "BN1ekIQCkpC-6-b3dTJNrR809PdwAqieLfLvOFrm-kK4CVK1A9yTVpyoFe0CRsaD9Na-qJg_eKXl_yDLyuz-vYc";
    var BASE = `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default)/documents`;
    function valor(v) {
      if ("stringValue" in v) return v.stringValue;
      if ("integerValue" in v) return Number(v.integerValue);
      if ("doubleValue" in v) return Number(v.doubleValue);
      if ("booleanValue" in v) return v.booleanValue;
      if ("nullValue" in v) return null;
      if ("timestampValue" in v) return Date.parse(String(v.timestampValue));
      if ("mapValue" in v) return campos(v.mapValue.fields ?? {});
      if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(valor);
      return void 0;
    }
    function campos(f) {
      const o = {};
      for (const [k, v] of Object.entries(f)) o[k] = valor(v);
      return o;
    }
    function codificar(x) {
      if (x === null || x === void 0) return { nullValue: null };
      if (typeof x === "number") return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
      if (typeof x === "string") return { stringValue: x };
      if (typeof x === "boolean") return { booleanValue: x };
      if (Array.isArray(x)) return { arrayValue: { values: x.map(codificar) } };
      const fields = {};
      for (const [k, v] of Object.entries(x)) fields[k] = codificar(v);
      return { mapValue: { fields } };
    }
    var segmento = (s) => /^[A-Za-z_][A-Za-z_0-9]*$/.test(s) ? s : "`" + s.replace(/\\/g, "\\\\").replace(/`/g, "\\`") + "`";
    async function token() {
      const refresh = process.env.FIREBASE_REFRESH;
      if (refresh) {
        const r2 = await fetch(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refresh)}`
        });
        const d2 = await r2.json();
        if (d2.id_token) return String(d2.id_token);
      }
      const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnSecureToken: true })
      });
      const d = await r.json();
      if (!d.idToken) throw new Error("Login no Firebase falhou: " + JSON.stringify(d).slice(0, 200));
      return String(d.idToken);
    }
    function responder(saida) {
      const linhas = Object.entries(saida).map(([k, v]) => `${k}=${v}`);
      console.log("pr\xF3xima passada:", linhas.join(" "));
      if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, linhas.join("\n") + "\n");
    }
    async function rodar() {
      const privado = process.env.VAPID_PRIVADO;
      const casais = (process.env.CASAIS ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
      if (!privado || casais.length === 0) throw new Error("Faltam VAPID_PRIVADO ou CASAIS");
      webpush.setVapidDetails("https://goncalves-tf.github.io/bobossauro/", VAPID_PUBLICO, privado);
      const agoraTeste = process.env.AGORA ? new Date(process.env.AGORA) : /* @__PURE__ */ new Date();
      const { data, min } = agoraSP(agoraTeste);
      const tk = await token();
      const lidos = [];
      for (const codigo of casais) {
        const r = await fetch(`${BASE}/casais/${codigo}`, { headers: { Authorization: `Bearer ${tk}` } });
        if (!r.ok) {
          console.log(codigo, "sem acesso", r.status);
          continue;
        }
        const doc = await r.json();
        const casal = normalizar(campos(doc.fields ?? {}));
        const envios = lembretesDevidos(casal, data, min);
        const marcar = [];
        const apagar = [];
        for (const e of envios) {
          const insc = casal.avisos.inscricoes[e.celular];
          try {
            await webpush.sendNotification(
              { endpoint: insc.endpoint, keys: { p256dh: insc.p256dh, auth: insc.auth } },
              JSON.stringify({ title: e.titulo, body: e.corpo, tag: `${data}-${e.tarefa.id}` }),
              { TTL: 1800, urgency: "high" }
            );
            marcar.push([["avisos", "enviados", data, e.tarefa.id, e.celular], Date.now()]);
            const enviados = (casal.avisos.enviados ??= {})[data] ??= {};
            (enviados[e.tarefa.id] ??= {})[e.celular] = Date.now();
            console.log(codigo, "enviado", e.tarefa.id, "para", insc.pessoa);
          } catch (err) {
            const status = err.statusCode;
            console.log(codigo, "falhou", e.tarefa.id, status);
            if (status === 404 || status === 410) {
              apagar.push(["avisos", "inscricoes", e.celular]);
              delete casal.avisos.inscricoes[e.celular];
            }
          }
        }
        lidos.push({ codigo, casal, marcar, apagar, enviou: envios.length > 0 });
      }
      let proxima = Infinity;
      let temInscricoes = false;
      let ultimoDia = "";
      for (const { casal } of lidos) {
        proxima = Math.min(proxima, minutosAteProximo(casal, data, min));
        if (Object.keys(casal.avisos?.inscricoes ?? {}).length > 0) temInscricoes = true;
        if (casal.periodo?.fim && casal.periodo.fim > ultimoDia) ultimoDia = casal.periodo.fim;
      }
      const espera = escolherEspera(proxima, temInscricoes);
      const parar = ultimoDia !== "" && data > somaDias(ultimoDia, 1);
      for (const { codigo, casal, marcar, apagar, enviou } of lidos) {
        const ultima = casal.avisos?.ultimaRodada ?? 0;
        if (marcar.length > 0 || espera >= 10 || Date.now() - ultima > 15 * 60 * 1e3) {
          marcar.push([["avisos", "ultimaRodada"], Date.now()]);
          marcar.push([["avisos", "proximaRodada"], Date.now() + (espera + 2) * 60 * 1e3]);
        }
        if (marcar.length === 0 && apagar.length === 0) {
          console.log(codigo, "nada a avisar", data, hora(min));
          continue;
        }
        if (!enviou && apagar.length === 0) console.log(codigo, "nada a avisar", data, hora(min), "(sinal de vida)");
        const corpo = {};
        for (const [caminho, v] of marcar) {
          let atual = corpo;
          caminho.forEach((k, i) => {
            if (i === caminho.length - 1) atual[k] = v;
            else atual = atual[k] ??= {};
          });
        }
        const mascara = [...marcar.map(([c]) => c), ...apagar].map((c) => "updateMask.fieldPaths=" + encodeURIComponent(c.map(segmento).join("."))).join("&");
        const fields = codificar(corpo).mapValue.fields;
        const w = await fetch(`${BASE}/casais/${codigo}?${mascara}&currentDocument.exists=true`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
          body: JSON.stringify({ fields })
        });
        console.log(codigo, "registro", w.status);
      }
      responder({ espera, parar: parar ? 1 : 0, proxima: Number.isFinite(proxima) ? proxima : "nenhuma" });
    }
    if (process.argv[1] && /enviar\.(m?js|ts)$/.test(process.argv[1])) {
      rodar().catch((e) => {
        console.error(e);
        process.exit(1);
      });
    }
  }
});
export default require_enviar();
