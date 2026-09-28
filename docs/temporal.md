<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FICHAJE — Panel de administración · Mockup</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
/* ============ BASE ============ */
:root{
  --ink:#0b0b0b; --paper:#fff; --mute:#6d6d6d; --line:#e9e9e9;
  --ok:#16a34a; --warn:#d97706; --bad:#dc2626;
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{
  font:400 15px/1.55 "IBM Plex Sans",sans-serif; color:var(--ink);
  background:#fdfdfd; border-top:8px solid var(--ink);
  position:relative; min-height:100vh;
}
/* fondo: cuadrícula de libreta + marca de agua vertical */
body::before{
  content:""; position:fixed; inset:0; pointer-events:none; z-index:0;
  background-image:linear-gradient(var(--line) 1px,transparent 1px),
                   linear-gradient(90deg,var(--line) 1px,transparent 1px);
  background-size:30px 30px; opacity:.55;
}
body::after{
  content:"ASISTENCIA"; position:fixed; right:-1.2rem; top:50%;
  transform:translateY(-50%); writing-mode:vertical-rl;
  font-family:"Archivo Black"; font-size:13vw; letter-spacing:.02em;
  color:transparent; -webkit-text-stroke:1.5px #ececec;
  pointer-events:none; z-index:0;
}
::selection{background:var(--ink);color:#fff}
:focus-visible{outline:3px solid var(--ink);outline-offset:2px}
.mono, .clock, .time, .id, .kick, .chip, .lbl, th, .dh, .cnt, .stamp, .ticker, .date, .user, .tfoot, .mnav, .bc-n{font-family:"IBM Plex Mono",monospace}
.app{position:relative;z-index:1}
.wrap{max-width:1140px;margin:0 auto;padding:0 22px}

/* ============ TICKER ============ */
.ticker{background:var(--ink);color:#fff;overflow:hidden;font-size:10px;font-weight:600;letter-spacing:.22em}
.ticker span{display:inline-block;white-space:nowrap;padding:.42em 0;animation:tick 30s linear infinite}
@keyframes tick{to{transform:translateX(-50%)}}

/* ============ HEADER ============ */
.top{display:flex;justify-content:space-between;align-items:flex-end;gap:2rem;flex-wrap:wrap;padding:1.6rem 0 1.2rem;border-bottom:2px solid var(--ink)}
.brand{display:flex;align-items:center;gap:1rem}
.logo{width:58px;height:58px;background:var(--ink);color:#fff;display:grid;place-items:center;font-family:"Archivo Black";font-size:24px;box-shadow:4px 4px 0 #dcdcdc}
.brand h1{font-family:"Archivo Black";font-size:clamp(26px,3.4vw,38px);letter-spacing:.01em;line-height:1;text-transform:uppercase}
.tag{font-size:10px;letter-spacing:.26em;color:var(--mute);text-transform:uppercase;margin-top:4px;font-family:"IBM Plex Mono",monospace}
.clockbox{text-align:right}
.clock{font-size:clamp(30px,4vw,44px);font-weight:600;line-height:1;letter-spacing:.02em}
.clock i{font-style:normal;animation:blink 1s steps(1) infinite}
@keyframes blink{50%{opacity:0}}
.date{font-size:10.5px;letter-spacing:.18em;color:var(--mute);margin-top:6px;display:flex;justify-content:flex-end;align-items:center;gap:.55em;text-transform:uppercase}
.dot{width:8px;height:8px;border-radius:50%;background:var(--ok);animation:pulse 1.8s ease-out infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(22,163,74,.45)}70%{box-shadow:0 0 0 9px rgba(22,163,74,0)}100%{box-shadow:0 0 0 0 rgba(22,163,74,0)}}

/* ============ TOGGLE DE VISTAS (solo CSS) ============ */
.vr{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.nav{display:flex;justify-content:space-between;align-items:center;gap:1.2rem;flex-wrap:wrap;padding:1.1rem 0 0}
.seg{position:relative;display:grid;grid-template-columns:repeat(3,1fr);border:2px solid var(--ink);background:#fff;min-width:min(560px,100%)}
.seg::before{content:"";position:absolute;top:2px;bottom:2px;left:2px;width:calc((100% - 4px)/3);background:var(--ink);transition:transform .38s cubic-bezier(.75,0,.2,1);z-index:0}
#r-apr:checked  ~ .app .seg::before{transform:translateX(0)}
#r-man:checked  ~ .app .seg::before{transform:translateX(100%)}
#r-his:checked  ~ .app .seg::before{transform:translateX(200%)}
.seg label{position:relative;z-index:1;padding:.72em 1em;text-align:center;cursor:pointer;font-weight:600;font-size:12.5px;letter-spacing:.04em;transition:color .3s,background .2s;display:flex;gap:.55em;justify-content:center;align-items:center;white-space:nowrap}
.seg label:hover{background:#f1f1f1}
.seg label b{font-family:"IBM Plex Mono",monospace;font-size:10px;opacity:.55}
.seg .badge{background:var(--ink);color:#fff;font:600 10px "IBM Plex Mono";min-width:18px;height:18px;border-radius:50%;display:inline-grid;place-items:center;padding:0 4px}
#r-apr:checked ~ .app label[for=r-apr],
#r-man:checked ~ .app label[for=r-man],
#r-his:checked ~ .app label[for=r-his]{color:#fff}
#r-apr:checked ~ .app label[for=r-apr]:hover,
#r-man:checked ~ .app label[for=r-man]:hover,
#r-his:checked ~ .app label[for=r-his]:hover{background:transparent}
#r-apr:checked ~ .app label[for=r-apr] .badge{background:#fff;color:var(--ink)}
.user{font-size:10.5px;letter-spacing:.16em;border:2px solid var(--ink);padding:.55em .9em;background:#fff;text-transform:uppercase}

/* visibilidad de vistas + animación de entrada */
.view{display:none}
#r-apr:checked ~ .app .v1{display:block}
#r-man:checked ~ .app .v2{display:block}
#r-his:checked ~ .app .v3{display:block}
.view{animation:rise .5s cubic-bezier(.2,.8,.25,1) both}
@keyframes rise{from{opacity:0;transform:translateY(16px)}}

main{padding:2.4rem 0 3.6rem}

/* ============ ELEMENTOS COMUNES ============ */
.kick{font-size:10.5px;font-weight:600;letter-spacing:.3em;text-transform:uppercase;display:flex;align-items:center;gap:.65em;color:var(--mute)}
.kick::before{content:"";width:10px;height:10px;background:var(--ink);flex:none}
.view h2{font-family:"Archivo Black";font-size:clamp(30px,4.4vw,48px);text-transform:uppercase;line-height:.98;margin:.35em 0 .3em;letter-spacing:-.01em}
.view h2 em{font-style:normal;color:transparent;-webkit-text-stroke:1.6px var(--ink)}
.sub{color:var(--mute);font-size:14px;max-width:58ch}
.view-head{display:flex;justify-content:space-between;align-items:flex-end;gap:1.6rem;flex-wrap:wrap;margin-bottom:1.7rem}

.btn{border:2px solid var(--ink);background:#fff;color:var(--ink);padding:.6em 1.05em;font:700 11.5px "IBM Plex Sans";letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:transform .16s,box-shadow .16s,background .16s,color .16s;display:inline-flex;align-items:center;gap:.5em}
.btn:hover{transform:translate(-2px,-2px);box-shadow:4px 4px 0 var(--ink)}
.btn:active{transform:none;box-shadow:none}
.btn.primary{background:var(--ink);color:#fff}
.btn.primary:hover{box-shadow:4px 4px 0 #c9c9c9}
.btn.ok{background:var(--ok);border-color:var(--ok);color:#fff;justify-content:center}
.btn.ok:hover{box-shadow:4px 4px 0 var(--ink)}
.btn.no{color:var(--bad);border-color:var(--bad);justify-content:center}
.btn.no:hover{background:var(--bad);color:#fff;box-shadow:4px 4px 0 var(--ink)}
.btn.ghost{border-color:#bdbdbd;color:var(--mute)}
.btn.ghost:hover{border-color:var(--ink);color:var(--ink);box-shadow:4px 4px 0 #e2e2e2}

.panel{background:#fff;border:2px solid var(--ink);box-shadow:9px 9px 0 #ececec}
.panel-h{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:.75rem 1.1rem;border-bottom:2px solid var(--ink);background:#fafafa;font:600 10.5px "IBM Plex Mono";letter-spacing:.2em;text-transform:uppercase}

/* ============ VISTA 1 · APROBACIONES ============ */
.v1 .inner{max-width:880px}
.counter{border:2px solid var(--ink);background:#fff;padding:.85rem 1.5rem;text-align:center;box-shadow:6px 6px 0 #ececec}
.counter .big{font-family:"Archivo Black";font-size:42px;line-height:1;display:block}
.counter .lbl{font-size:9px;letter-spacing:.24em;color:var(--mute);display:block;margin-top:4px}
.counter .live{font-size:9px;letter-spacing:.18em;color:var(--bad);display:flex;justify-content:center;align-items:center;gap:.5em;margin-top:7px}
.counter .live::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--bad);animation:blink 1.1s steps(1) infinite}
.queue-head{display:flex;justify-content:space-between;align-items:center;margin:0 0 .9rem;gap:1rem;flex-wrap:wrap}
.queue-head p{font:500 11px "IBM Plex Mono";letter-spacing:.14em;color:var(--mute);text-transform:uppercase}
.queue{list-style:none;display:flex;flex-direction:column;gap:14px}
.req{background:#fff;border:2px solid var(--ink);border-left:8px solid var(--ink);padding:1rem 1.15rem;display:grid;grid-template-columns:auto auto 1fr auto;grid-template-areas:"idx ava who acts" "idx ava when acts";column-gap:16px;row-gap:8px;align-items:center;transition:transform .2s,border-left-width .2s,background .2s;animation:rise .5s both}
.req:nth-child(2){animation-delay:.07s}.req:nth-child(3){animation-delay:.14s}.req:nth-child(4){animation-delay:.21s}
.req:hover{background:#fbfbfb;border-left-width:15px;transform:translateX(3px)}
.req .idx{grid-area:idx;font-size:11px;color:#b5b5b5;font-weight:600}
.ava{grid-area:ava;width:46px;height:46px;background:var(--ink);color:#fff;display:grid;place-items:center;font-family:"Archivo Black";font-size:14px}
.who{grid-area:who}
.who h3{font-size:15.5px;font-weight:700}
.who .id{font-size:11px;color:var(--mute);margin-left:.4em}
.who .role{font-size:12px;color:var(--mute)}
.who .note{font-size:12.5px;color:#444;margin-top:2px}
.when{grid-area:when;text-align:right}
.time{font-size:21px;font-weight:600;display:block;line-height:1.1}
.ago{font-size:9.5px;letter-spacing:.14em;color:var(--mute);text-transform:uppercase}
.chip{display:inline-block;border:1.5px solid var(--ink);font-size:9px;font-weight:600;letter-spacing:.16em;padding:.28em .6em;margin-top:6px}
.acts{grid-area:acts;display:flex;flex-direction:column;gap:8px;min-width:138px}
.req.done{border-left-color:#c9c9c9;opacity:.6}
.req.done:hover{border-left-width:8px;transform:none}
.stamp-ok{font:600 10.5px "IBM Plex Mono";letter-spacing:.18em;color:var(--ok);border:2px solid var(--ok);padding:.45em .8em;text-transform:uppercase}
.q-note{margin-top:1.3rem;font:500 10.5px "IBM Plex Mono";letter-spacing:.12em;color:#a5a5a5;text-transform:uppercase}

/* ============ VISTA 2 · REGISTRO MANUAL ============ */
.v2-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:24px;align-items:start}
.form{padding:1.5rem 1.5rem 1.6rem}
.field{margin-bottom:1.15rem}
.field label{display:block;font:600 10px "IBM Plex Mono";letter-spacing:.22em;text-transform:uppercase;margin-bottom:.45rem;color:var(--ink)}
.field input[type=date],.field input[type=time],.field select,.field textarea{
  width:100%;border:2px solid var(--ink);background:#fff;padding:.62em .8em;font-size:14px;color:var(--ink);transition:transform .15s,box-shadow .15s;border-radius:0;-webkit-appearance:none;appearance:none}
.field input[type=date],.field input[type=time],.field select{font-family:"IBM Plex Mono",monospace}
.field select{background:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8"><path d="M1 1l5 5 5-5" stroke="%230b0b0b" stroke-width="2" fill="none"/></svg>') no-repeat right .9em center}
.field textarea{resize:vertical;min-height:70px}
.field input:focus,.field select:focus,.field textarea:focus{outline:none;transform:translate(-2px,-2px);box-shadow:4px 4px 0 var(--ink)}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.pills{display:flex;flex-wrap:wrap;gap:8px}
.pills input{position:absolute;opacity:0;pointer-events:none}
.pills label{border:2px solid var(--ink);padding:.55em 1em;font-size:12.5px;font-weight:600;cursor:pointer;transition:background .18s,color .18s,transform .15s;display:inline-flex;align-items:center;gap:.5em;margin:0}
.pills label::before{content:"";width:9px;height:9px;border-radius:50%;background:#d6d6d6;transition:background .18s}
.pills label:hover{transform:translateY(-2px)}
.pills input:checked + label{background:var(--ink);color:#fff}
#e-p:checked + label::before{background:var(--ok)}
#e-t:checked + label::before{background:var(--warn)}
#e-f:checked + label::before{background:var(--bad)}
#t-in:checked + label::before,#t-out:checked + label::before{background:#fff}
.form-acts{display:flex;gap:10px;margin-top:1.4rem;flex-wrap:wrap}
.v2-side{display:flex;flex-direction:column;gap:22px}
/* ticket */
.ticket{position:relative;padding:1.3rem 1.4rem 1.5rem;font-family:"IBM Plex Mono",monospace;animation:bob 5s ease-in-out infinite alternate}
@keyframes bob{to{transform:translateY(-6px)}}
.ticket::before,.ticket::after{content:"";position:absolute;width:20px;height:20px;background:#fdfdfd;border:2px solid var(--ink);border-radius:50%;top:52%}
.ticket::before{left:-12px}.ticket::after{right:-12px}
.tk-top{display:flex;justify-content:space-between;font-size:10px;letter-spacing:.14em;color:var(--mute)}
.tk-name{font-family:"Archivo Black";font-size:21px;margin:.5rem 0 .1rem;text-transform:uppercase}
.tk-line{font-size:12px;color:#444}
hr.dash{border:none;border-top:2px dashed #cfcfcf;margin:.85rem 0}
.stamp{display:inline-block;border:2.5px solid var(--warn);color:var(--warn);font-weight:600;font-size:13px;letter-spacing:.24em;padding:.28em .7em;transform:rotate(-5deg);text-transform:uppercase}
.bc{height:34px;margin-top:.9rem;background:repeating-linear-gradient(90deg,var(--ink) 0 2px,#fff 2px 4px,var(--ink) 4px 7px,#fff 7px 9px,var(--ink) 9px 10px,#fff 10px 14px)}
.bc-n{font-size:10px;letter-spacing:.5em;text-align:center;margin-top:6px;color:var(--mute)}
/* roster */
.roster ul{list-style:none}
.roster li{display:grid;grid-template-columns:auto 1fr auto;gap:.85rem;align-items:center;padding:.68rem 1.1rem;border-bottom:1px solid #ececec;transition:background .15s,padding-left .2s}
.roster li:last-child{border-bottom:none}
.roster li:hover{background:#f6f6f6;padding-left:1.35rem}
.roster .mini{width:28px;height:28px;background:var(--ink);color:#fff;font:700 10px "IBM Plex Mono";display:grid;place-items:center}
.roster .n{font-size:13px;font-weight:600}
.roster .st{font:600 10px "IBM Plex Mono";letter-spacing:.1em;display:flex;align-items:center;gap:.45em;text-transform:uppercase}
.st i{width:8px;height:8px;border-radius:50%;font-style:normal}
.st.p i{background:var(--ok)}.st.t i{background:var(--warn)}.st.n i{background:#cfcfcf;border-radius:0}

/* ============ VISTA 3 · HISTÓRICO ============ */
.h-tools{display:flex;justify-content:space-between;align-items:center;gap:1.2rem;flex-wrap:wrap;margin-bottom:1.2rem}
.mnav{display:flex;border:2px solid var(--ink);background:#fff}
.mnav button{border:none;background:#fff;font:600 12px "IBM Plex Mono";padding:.55em .9em;cursor:pointer;transition:background .15s}
.mnav button:hover{background:#eee}
.mnav .cur{background:var(--ink);color:#fff;padding:.55em 1.1em;font-weight:600;letter-spacing:.18em;font-size:11px}
.legend{display:flex;gap:1.2rem;flex-wrap:wrap}
.legend span{display:flex;align-items:center;gap:.5em;font:600 10px "IBM Plex Mono";letter-spacing:.14em;color:var(--mute);text-transform:uppercase}
.sw{width:12px;height:12px;flex:none}
.sw.p{background:var(--ink)}.sw.t{background:var(--warn)}.sw.f{background:var(--bad)}.sw.x{background:#e0e0e0}.sw.n{border:1.5px solid #d4d4d4;background:#fff}
.stats{display:grid;grid-template-columns:1fr 1.35fr 1fr 1fr;border:2px solid var(--ink);background:#fff;margin-bottom:1.5rem;box-shadow:9px 9px 0 #ececec}
.stat{padding:1.05rem 1.25rem;border-left:2px solid var(--ink)}
.stat:first-child{border-left:none}
.stat .n{font-family:"Archivo Black";font-size:36px;line-height:1}
.stat .l{font-size:9px;letter-spacing:.24em;color:var(--mute);display:block;margin-top:5px;text-transform:uppercase}
.stat .mini-bar{height:8px;border:2px solid var(--ink);margin-top:9px}
.stat .mini-bar i{display:block;height:100%;width:93.8%;background:var(--ink);animation:grow 1s cubic-bezier(.2,.8,.2,1) both}
@keyframes grow{from{width:0}}
.stat.t .n{color:var(--warn)} .stat.f .n{color:var(--bad)}
.table-wrap{overflow-x:auto}
table{border-collapse:collapse;width:100%;min-width:900px}
thead th{background:#fafafa;border-bottom:2px solid var(--ink);padding:.75rem .7rem;font-size:9.5px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;text-align:left}
.days-h{white-space:nowrap}
.dh{display:inline-block;width:12px;margin-right:3.5px;text-align:center;font-size:8.5px;color:#9a9a9a}
.dh.wk{color:#d3d3d3}
td{padding:.7rem;border-bottom:1px solid #ededed;vertical-align:middle}
tbody tr{transition:background .15s}
tbody tr:hover{background:#f6f6f6}
tbody tr:hover td:first-child{box-shadow:inset 4px 0 0 var(--ink)}
td.name{font-weight:700;font-size:13.5px;min-width:170px}
td.name .id{display:block;font-size:10px;color:var(--mute);font-weight:500;margin-top:2px}
.flag{display:inline-block;width:8px;height:8px;background:var(--bad);margin-left:.5em;vertical-align:middle;animation:blink 1.4s steps(1) infinite}
.perf{font:600 8.5px "IBM Plex Mono";letter-spacing:.12em;border:1.5px solid var(--ink);padding:.2em .45em;margin-left:.5em;vertical-align:middle}
td.days{white-space:nowrap}
.d{display:inline-block;width:12px;height:12px;margin-right:3.5px;transition:transform .15s}
.d:hover{transform:scale(1.45);outline:1.5px solid var(--ink)}
.d.p{background:var(--ink)} .d.t{background:var(--warn)} .d.f{background:var(--bad)}
.d.x{background:#e0e0e0} .d.n{border:1.5px solid #dcdcdc;background:#fff}
td.cnt,th.cnt{text-align:center;width:42px;font-size:13px;font-weight:600}
td.cnt.t{color:var(--warn)} td.cnt.f{color:var(--bad)}
td.pct{min-width:110px}
td.pct b{font:600 12px "IBM Plex Mono";display:block;margin-bottom:4px}
.bar{height:9px;border:2px solid var(--ink);background:#fff}
.bar i{display:block;height:100%;background:var(--ink)}
.tfoot{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;padding:1rem 1.1rem;border-top:2px solid var(--ink);font-size:10px;letter-spacing:.14em;color:var(--mute);text-transform:uppercase}

/* ============ FOOTER ============ */
footer{border-top:2px solid var(--ink);padding:1.1rem 0 1.6rem;text-align:center;font:500 9.5px "IBM Plex Mono";letter-spacing:.26em;color:#9a9a9a;text-transform:uppercase}

/* ============ RESPONSIVE ============ */
@media(max-width:960px){
  .v2-grid{grid-template-columns:1fr}
  .stats{grid-template-columns:1fr 1fr}
  .stat:nth-child(3){border-left:none;border-top:2px solid var(--ink)}
  .stat:nth-child(4){border-top:2px solid var(--ink)}
}
@media(max-width:760px){
  .req{grid-template-columns:auto auto 1fr;grid-template-areas:"idx ava who" "when when when" "acts acts acts"}
  .when{text-align:left;display:flex;align-items:center;gap:14px}
  .when .chip{margin-top:0}
  .acts{flex-direction:row}
  body::after{display:none}
  .seg{width:100%}
}
@media(prefers-reduced-motion:reduce){
  *,*::before,*::after{animation:none!important;transition:none!important}
}
</style>
</head>
<body>

<!-- Radios que controlan el toggle de vistas -->
<input class="vr" type="radio" name="view" id="r-apr" checked>
<input class="vr" type="radio" name="view" id="r-man">
<input class="vr" type="radio" name="view" id="r-his">

<div class="app">

  <!-- Cinta de estado -->
  <div class="ticker"><span>SISTEMA DE FICHAJE · TERMINAL ADMINISTRADOR&nbsp;&nbsp;■&nbsp;&nbsp;TURNO MAÑANA 06:00 – 14:00&nbsp;&nbsp;■&nbsp;&nbsp;3 SOLICITUDES PENDIENTES DE APROBACIÓN&nbsp;&nbsp;■&nbsp;&nbsp;CORTE DE TARDANZA 08:30&nbsp;&nbsp;■&nbsp;&nbsp;JUNIO 2025 · DÍA LABORAL 08&nbsp;&nbsp;■&nbsp;&nbsp;SISTEMA DE FICHAJE · TERMINAL ADMINISTRADOR&nbsp;&nbsp;■&nbsp;&nbsp;TURNO MAÑANA 06:00 – 14:00&nbsp;&nbsp;■&nbsp;&nbsp;3 SOLICITUDES PENDIENTES DE APROBACIÓN&nbsp;&nbsp;■&nbsp;&nbsp;CORTE DE TARDANZA 08:30&nbsp;&nbsp;■&nbsp;&nbsp;JUNIO 2025 · DÍA LABORAL 08&nbsp;&nbsp;■&nbsp;&nbsp;</span></div>

  <div class="wrap">

    <!-- Cabecera -->
    <header class="top">
      <div class="brand">
        <div class="logo">F·</div>
        <div>
          <h1>Fichaje</h1>
          <p class="tag">Control de asistencia — Terminal admin</p>
        </div>
      </div>
      <div class="clockbox">
        <div class="clock">08<i>:</i>42<i>:</i>37</div>
        <p class="date">Mié 11 Jun 2025 <span class="dot"></span> En línea</p>
      </div>
    </header>

    <!-- Toggle -->
    <nav class="nav" aria-label="Cambio de vista">
      <div class="seg">
        <label for="r-apr"><b>01</b> Aprobaciones <span class="badge">3</span></label>
        <label for="r-man"><b>02</b> Registro manual</label>
        <label for="r-his"><b>03</b> Histórico</label>
      </div>
      <div class="user">■ Admin: R. Salazar · T-01</div>
    </nav>

    <main>

      <!-- ══════════ VISTA 1 · APROBACIONES ══════════ -->
      <section class="view v1">
        <div class="inner">
          <div class="view-head">
            <div>
              <p class="kick">Módulo 01 · Cola en tiempo real</p>
              <h2>Solicitudes de <em>entrada</em></h2>
              <p class="sub">Los trabajadores piden fichar desde sus terminales. Revisa cada petición y confirma o rechaza el registro.</p>
            </div>
            <div class="counter">
              <span class="big">03</span>
              <span class="lbl">Pendientes</span>
              <span class="live">En espera</span>
            </div>
          </div>

          <div class="queue-head">
            <p>Orden: más recientes primero</p>
            <button class="btn ghost">Aprobar todas ✓</button>
          </div>

          <ol class="queue">
            <li class="req">
              <span class="idx">01</span>
              <span class="ava">LM</span>
              <div class="who">
                <h3>Lucía Márquez <span class="id">#0412</span></h3>
                <p class="role">Operaria · Almacén B</p>
                <p class="note">“La terminal B está sin conexión; valido mi entrada por este medio.”</p>
              </div>
              <div class="when">
                <span class="time">08:37</span>
                <span class="ago">hace 5 min</span>
                <span class="chip">Entrada</span>
              </div>
              <div class="acts">
                <button class="btn ok">✓ Aprobar</button>
                <button class="btn no">✕ Rechazar</button>
              </div>
            </li>

            <li class="req">
              <span class="idx">02</span>
              <span class="ava">DF</span>
              <div class="who">
                <h3>Diego Fuentes <span class="id">#0417</span></h3>
                <p class="role">Técnico · Mantenimiento</p>
                <p class="note">“Ingreso por portería trasera, lector principal fuera de servicio.”</p>
              </div>
              <div class="when">
                <span class="time">08:41</span>
                <span class="ago">hace 1 min</span>
                <span class="chip">Entrada</span>
              </div>
              <div class="acts">
                <button class="btn ok">✓ Aprobar</button>
                <button class="btn no">✕ Rechazar</button>
              </div>
            </li>

            <li class="req">
              <span class="idx">03</span>
              <span class="ava">CI</span>
              <div class="who">
                <h3>Carla Ibáñez <span class="id">#0423</span></h3>
                <p class="role">Administrativa · Oficina central</p>
                <p class="note">“Diligencia personal, retorno en 30 minutos.”</p>
              </div>
              <div class="when">
                <span class="time">08:29</span>
                <span class="ago">hace 13 min</span>
                <span class="chip">Salida temporal</span>
              </div>
              <div class="acts">
                <button class="btn ok">✓ Aprobar</button>
                <button class="btn no">✕ Rechazar</button>
              </div>
            </li>

            <li class="req done">
              <span class="idx">04</span>
              <span class="ava">AS</span>
              <div class="who">
                <h3>Andrés Soto <span class="id">#0402</span></h3>
                <p class="role">Supervisor · Planta</p>
                <p class="note">Aprobada por R. Salazar · 08:12</p>
              </div>
              <div class="when">
                <span class="time">08:09</span>
                <span class="ago">procesada</span>
              </div>
              <div class="acts"><span class="stamp-ok">✓ Aprobada</span></div>
            </li>
          </ol>

          <p class="q-note">■ Las solicitudes se archivan automáticamente tras 24 h · Política de fichajes ↗</p>
        </div>
      </section>

      <!-- ══════════ VISTA 2 · REGISTRO MANUAL ══════════ -->
      <section class="view v2">
        <div class="view-head">
          <div>
            <p class="kick">Módulo 02 · Operación</p>
            <h2>Fichaje <em>manual</em></h2>
            <p class="sub">Registra la entrada o salida de un trabajador cuando el lector no esté disponible o el fichaje requiera validación del administrador.</p>
          </div>
        </div>

        <div class="v2-grid">
          <form class="panel form">
            <div class="panel-h"><span>Nuevo fichaje manual</span><span>FOLIO Nº 04413</span></div>
            <div style="padding:1.3rem 1.4rem 1.4rem">
              <div class="field">
                <label for="f-trab">Trabajador</label>
                <select id="f-trab">
                  <option>0389 — Marta Vidal</option>
                  <option>0402 — Andrés Soto</option>
                  <option>0412 — Lucía Márquez</option>
                  <option>0417 — Diego Fuentes</option>
                  <option>0423 — Carla Ibáñez</option>
                  <option>0431 — Rodrigo Peña</option>
                </select>
              </div>
              <div class="row2">
                <div class="field">
                  <label for="f-fecha">Fecha</label>
                  <input type="date" id="f-fecha" value="2025-06-11">
                </div>
                <div class="field">
                  <label for="f-hora">Hora</label>
                  <input type="time" id="f-hora" value="08:47">
                </div>
              </div>
              <div class="field">
                <label>Tipo de fichaje</label>
                <div class="pills">
                  <input type="radio" name="tipo" id="t-in" checked><label for="t-in">Entrada</label>
                  <input type="radio" name="tipo" id="t-out"><label for="t-out">Salida</label>
                </div>
              </div>
              <div class="field">
                <label>Estado</label>
                <div class="pills">
                  <input type="radio" name="est" id="e-p" checked><label for="e-p">Presente</label>
                  <input type="radio" name="est" id="e-t"><label for="e-t">Tardanza</label>
                  <input type="radio" name="est" id="e-f"><label for="e-f">Falta</label>
                </div>
              </div>
              <div class="field">
                <label for="f-obs">Observaciones</label>
                <textarea id="f-obs" placeholder="Motivo del registro manual, incidencias, etc."></textarea>
              </div>
              <div class="form-acts">
                <button type="button" class="btn primary">Registrar fichaje →</button>
                <button type="reset" class="btn ghost">Limpiar</button>
              </div>
            </div>
          </form>

          <aside class="v2-side">
            <div class="panel ticket">
              <div class="tk-top"><span>Último registro</span><span>T-01</span></div>
              <div class="tk-name">Diego Fuentes</div>
              <p class="tk-line">ID #0417 · Mantenimiento</p>
              <hr class="dash">
              <p class="tk-line">MIÉ 11 JUN 2025 · 08:47</p>
              <p class="tk-line">Tipo: ENTRADA</p>
              <hr class="dash">
              <span class="stamp">Tardanza</span>
              <div class="bc"></div>
              <p class="bc-n">04412</p>
            </div>

            <div class="panel roster">
              <div class="panel-h"><span>Equipo en turno</span><span>6</span></div>
              <ul>
                <li><span class="mini">MV</span><span class="n">Marta Vidal</span><span class="st p"><i></i>08:02</span></li>
                <li><span class="mini">LM</span><span class="n">Lucía Márquez</span><span class="st p"><i></i>07:58</span></li>
                <li><span class="mini">RP</span><span class="n">Rodrigo Peña</span><span class="st p"><i></i>08:00</span></li>
                <li><span class="mini">AS</span><span class="n">Andrés Soto</span><span class="st t"><i></i>08:15</span></li>
                <li><span class="mini">DF</span><span class="n">Diego Fuentes</span><span class="st t"><i></i>08:47</span></li>
                <li><span class="mini">CI</span><span class="n">Carla Ibáñez</span><span class="st n"><i></i>sin fichar</span></li>
              </ul>
            </div>
          </aside>
        </div>
      </section>

      <!-- ══════════ VISTA 3 · HISTÓRICO ══════════ -->
      <section class="view v3">
        <div class="view-head">
          <div>
            <p class="kick">Módulo 03 · Reportes</p>
            <h2>Histórico del <em>mes</em></h2>
            <p class="sub">Registro diario por trabajador durante el mes en curso: presente, tardanza o falta.</p>
          </div>
          <div class="mnav">
            <button title="Mes anterior">◀ MAY</button>
            <span class="cur">JUNIO 2025</span>
            <button title="Mes siguiente">JUL ▶</button>
          </div>
        </div>

        <div class="h-tools">
          <div class="legend">
            <span><i class="sw p"></i>Presente</span>
            <span><i class="sw t"></i>Tardanza</span>
            <span><i class="sw f"></i>Falta</span>
            <span><i class="sw x"></i>Fin de semana</span>
            <span><i class="sw n"></i>Próximo</span>
          </div>
          <select style="border:2px solid var(--ink);padding:.5em .8em;font:600 11px 'IBM Plex Mono';letter-spacing:.1em;background:#fff">
            <option>TODAS LAS ÁREAS</option><option>PLANTA</option><option>OFICINA</option>
          </select>
        </div>

        <div class="stats">
          <div class="stat"><span class="n">48</span><span class="l">Fichajes del mes</span></div>
          <div class="stat"><span class="n">93,8%</span><span class="l">Asistencia global</span><div class="mini-bar"><i></i></div></div>
          <div class="stat t"><span class="n">06</span><span class="l">Tardanzas</span></div>
          <div class="stat f"><span class="n">03</span><span class="l">Faltas</span></div>
        </div>

        <div class="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Trabajador</th>
                <th class="days-h">
                  <span class="dh wk">01</span><span class="dh">02</span><span class="dh">03</span><span class="dh">04</span><span class="dh">05</span><span class="dh">06</span><span class="dh wk">07</span><span class="dh wk">08</span><span class="dh">09</span><span class="dh">10</span><span class="dh">11</span><span class="dh">12</span><span class="dh">13</span><span class="dh wk">14</span><span class="dh wk">15</span><span class="dh">16</span><span class="dh">17</span><span class="dh">18</span><span class="dh">19</span><span class="dh">20</span><span class="dh wk">21</span><span class="dh wk">22</span><span class="dh">23</span><span class="dh">24</span><span class="dh">25</span><span class="dh">26</span><span class="dh">27</span><span class="dh wk">28</span><span class="dh wk">29</span><span class="dh">30</span>
                </th>
                <th class="cnt">P</th><th class="cnt">T</th><th class="cnt">F</th><th>% Asist.</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="name">Marta Vidal<span class="id">#0389 · Planta</span></td>
                <td class="days"><span class="d x"></span><span class="d p"></span><span class="d p"></span><span class="d t" title="Día 04 · Tardanza"></span><span class="d p"></span><span class="d p"></span><span class="d x"></span><span class="d x"></span><span class="d p"></span><span class="d p"></span><span class="d p"></span><span class="d n"></span><span class="d n"></span><span class="d x"></span><span class="d x"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d x"></span><span class="d x"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d x"></span><span class="d x"></span><span class="d n"></span></td>
                <td class="cnt">7</td><td class="cnt t">1</td><td class="cnt f">0</td>
                <td class="pct"><b>100%</b><div class="bar"><i style="width:100%"></i></div></td>
              </tr>
              <tr>
                <td class="name">Andrés Soto<span class="id">#0402 · Planta</span></td>
                <td class="days"><span class="d x"></span><span class="d p"></span><span class="d p"></span><span class="d t" title="Día 03 · Tardanza"></span><span class="d p"></span><span class="d p"></span><span class="d x"></span><span class="d x"></span><span class="d p"></span><span class="d t" title="Día 10 · Tardanza"></span><span class="d p"></span><span class="d n"></span><span class="d n"></span><span class="d x"></span><span class="d x"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d x"></span><span class="d x"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d x"></span><span class="d x"></span><span class="d n"></span></td>
                <td class="cnt">6</td><td class="cnt t">2</td><td class="cnt f">0</td>
                <td class="pct"><b>100%</b><div class="bar"><i style="width:100%"></i></div></td>
              </tr>
              <tr>
                <td class="name">Lucía Márquez<span class="perf">◆ Perfecto</span><span class="id">#0412 · Almacén</span></td>
                <td class="days"><span class="d x"></span><span class="d p"></span><span class="d p"></span><span class="d p"></span><span class="d p"></span><span class="d p"></span><span class="d x"></span><span class="d x"></span><span class="d p"></span><span class="d p"></span><span class="d p"></span><span class="d n"></span><span class="d n"></span><span class="d x"></span><span class="d x"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d x"></span><span class="d x"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d x"></span><span class="d x"></span><span class="d n"></span></td>
                <td class="cnt">8</td><td class="cnt t">0</td><td class="cnt f">0</td>
                <td class="pct"><b>100%</b><div class="bar"><i style="width:100%"></i></div></td>
              </tr>
              <tr>
                <td class="name">Diego Fuentes<span class="id">#0417 · Mantenimiento</span></td>
                <td class="days"><span class="d x"></span><span class="d p"></span><span class="d p"></span><span class="d p"></span><span class="d t" title="Día 05 · Tardanza"></span><span class="d p"></span><span class="d x"></span><span class="d x"></span><span class="d f" title="Día 09 · Falta"></span><span class="d p"></span><span class="d p"></span><span class="d n"></span><span class="d n"></span><span class="d x"></span><span class="d x"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d x"></span><span class="d x"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d x"></span><span class="d x"></span><span class="d n"></span></td>
                <td class="cnt">6</td><td class="cnt t">1</td><td class="cnt f">1</td>
                <td class="pct"><b>88%</b><div class="bar"><i style="width:88%"></i></div></td>
              </tr>
              <tr>
                <td class="name">Carla Ibáñez<span class="flag" title="3 faltas este mes"></span><span class="id">#0423 · Oficina</span></td>
                <td class="days"><span class="d x"></span><span class="d t" title="Día 02 · Tardanza"></span><span class="d p"></span><span class="d p"></span><span class="d p"></span><span class="d f" title="Día 06 · Falta"></span><span class="d x"></span><span class="d x"></span><span class="d p"></span><span class="d t" title="Día 10 · Tardanza"></span><span class="d p"></span><span class="d n"></span><span class="d n"></span><span class="d x"></span><span class="d x"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d x"></span><span class="d x"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d x"></span><span class="d x"></span><span class="d n"></span></td>
                <td class="cnt">5</td><td class="cnt t">2</td><td class="cnt f">1</td>
                <td class="pct"><b>88%</b><div class="bar"><i style="width:88%"></i></div></td>
              </tr>
              <tr>
                <td class="name">Rodrigo Peña<span class="id">#0431 · Planta</span></td>
                <td class="days"><span class="d x"></span><span class="d p"></span><span class="d p"></span><span class="d p"></span><span class="d p"></span><span class="d p"></span><span class="d x"></span><span class="d x"></span><span class="d p"></span><span class="d p"></span><span class="d f" title="Día 11 · Falta"></span><span class="d n"></span><span class="d n"></span><span class="d x"></span><span class="d x"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d x"></span><span class="d x"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d n"></span><span class="d x"></span><span class="d x"></span><span class="d n"></span></td>
                <td class="cnt">7</td><td class="cnt t">0</td><td class="cnt f">1</td>
                <td class="pct"><b>88%</b><div class="bar"><i style="width:88%"></i></div></td>
              </tr>
            </tbody>
          </table>
          <div class="tfoot">
            <span>■ 6 trabajadores · 8 días laborales transcurridos</span>
            <span style="display:flex;gap:10px">
              <button class="btn ghost">Exportar CSV</button>
              <button class="btn primary">Ver detalle</button>
            </span>
          </div>
        </div>
      </section>

    </main>

    <footer>■ Fichaje v2.4 · Mockup de interfaz — solo HTML + CSS · Sin backend · 11 jun 2025 ■</footer>
  </div>
</div>

</body>
</html>