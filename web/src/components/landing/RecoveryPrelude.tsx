"use client";

import { useCallback, useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import { AnimatePresence, motion, useMotionTemplate, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { LedgerIcon } from "./LedgerIcons";

const ink = "#f6f1e8";
const violet = "#7466f2";
const mint = "#8ce3b7";
const ease = [0.22, 0.7, 0.2, 1] as const;

const drift = keyframes`
  0%,100% { transform:translate3d(-2%,-1%,0) rotate(-2deg); }
  50% { transform:translate3d(3%,2%,0) rotate(3deg); }
`;
const pulse = keyframes`0%,100%{opacity:.45}50%{opacity:1}`;

const Loader = styled(motion.div)`
  position:fixed; inset:0; z-index:9999; display:grid; place-items:center; overflow:hidden;
  background:#171126; color:${ink};
`;
const LoadCore = styled.div`width:min(620px,82vw);`;
const LoadTop = styled.div`
  display:flex; justify-content:space-between; align-items:end; margin-bottom:20px;
  font:500 11px var(--font-mono); letter-spacing:.1em; text-transform:uppercase;
  .percent { font-size:13px; color:${mint}; }
`;
const LoadRoute = styled.div`
  position:relative; height:76px; display:grid; grid-template-columns:repeat(6,1fr); align-items:center;
  &::before { content:""; position:absolute; left:2%; right:2%; top:50%; height:1px; background:rgba(255,255,255,.18); }
`;
const LoadFill = styled(motion.div)`position:absolute; left:2%; top:50%; height:1px; background:linear-gradient(90deg,${violet},${mint}); transform-origin:left;`;
const LoadNode = styled(motion.span)`position:relative; justify-self:center; width:8px; height:8px; border-radius:50%; background:#272038; border:1px solid rgba(255,255,255,.45);`;
const LoadInvoice = styled(motion.div)`
  position:absolute; top:13px; width:38px; height:48px; display:grid; place-items:center;
  border-radius:5px; color:#171126; background:${ink}; box-shadow:0 12px 34px rgba(0,0,0,.35);
  svg { width:20px; }
`;
const LoadWord = styled(motion.div)`
  font:600 clamp(42px,8vw,92px)/.88 var(--font-display); letter-spacing:-.065em; text-transform:uppercase;
`;

const Hero = styled.section`
  min-height:100svh; position:relative; overflow:hidden; color:${ink};
  background:
    radial-gradient(900px 680px at 76% 22%, rgba(151,133,255,.58), transparent 62%),
    radial-gradient(760px 580px at 8% 90%, rgba(61,48,130,.8), transparent 70%),
    #171126;
`;
const Grain = styled.div`
  position:absolute; inset:0; opacity:.18; pointer-events:none;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.18'/%3E%3C/svg%3E");
`;
const Orbit = styled.div`
  position:absolute; width:min(920px,80vw); aspect-ratio:1; right:-19%; top:-33%; border-radius:50%;
  border:1px solid rgba(255,255,255,.12); animation:${drift} 18s ease-in-out infinite;
  &::before,&::after { content:""; position:absolute; border-radius:50%; border:1px solid rgba(255,255,255,.09); }
  &::before { inset:11%; } &::after { inset:26%; border-color:rgba(140,227,183,.14); }
`;
const Nav = styled.nav<{ $compact:boolean }>`
  width:${({$compact})=>$compact?"min(760px,calc(100% - 28px))":"min(1240px,calc(100% - 48px))"}; padding:${({$compact})=>$compact?"7px 9px 7px 12px":"10px 0"}; display:flex; align-items:center; justify-content:space-between;
  position:fixed; z-index:50; top:14px; left:50%; transform:translateX(-50%); border-radius:99px;
  background:${({$compact})=>$compact?"rgba(18,14,30,.82)":"transparent"}; border:1px solid ${({$compact})=>$compact?"rgba(255,255,255,.16)":"transparent"}; backdrop-filter:${({$compact})=>$compact?"blur(18px)":"none"};
  transition:width .4s cubic-bezier(.22,.7,.2,1),padding .4s ease,background .3s ease,border-color .3s ease;
  .brand { display:flex; align-items:center; gap:10px; font:600 20px var(--font-display); }
  .mark { width:34px; height:34px; border-radius:50%; display:grid; place-items:center; border:1px solid rgba(255,255,255,.3); color:${mint}; transition:transform .45s cubic-bezier(.22,.7,.2,1),background .25s ease; }
  .brand:hover .mark{transform:rotate(180deg);background:rgba(118,217,170,.1)}
  .mark svg { width:18px; }
  .links { display:flex; gap:18px; }
  button { position:relative;isolation:isolate;overflow:hidden;border:0;background:none;color:rgba(246,241,232,.68);font:500 13px var(--font-body);cursor:pointer;transition:color .22s ease,transform .22s ease; }
  .links button{padding:9px 14px;border-radius:99px}
  .links button::before{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background:linear-gradient(90deg,rgba(167,156,247,.22),rgba(118,217,170,.16));transform:scaleX(0);transform-origin:left;transition:transform .32s cubic-bezier(.22,.7,.2,1)}
  .links button::after{content:"";position:absolute;left:14px;right:14px;bottom:5px;height:1px;background:${mint};transform:scaleX(0);transform-origin:left;transition:transform .28s ease;opacity:.8}
  .links button:hover{color:${ink};transform:translateY(-2px)}
  .links button:hover::before{transform:scaleX(1)}
  .links button:hover::after{transform:scaleX(1)}
  .cta { padding:10px 17px; border-radius:99px; color:#171126; background:${ink};box-shadow:0 0 0 rgba(118,217,170,0);transition:background .25s ease,box-shadow .25s ease,transform .25s ease,color .25s ease}
  .cta:hover{background:${mint};color:#0f1a15;box-shadow:0 12px 32px rgba(118,217,170,.28);transform:translateY(-2px) scale(1.02)}
  @media(max-width:720px){ width:calc(100% - 28px); .links{display:none;} }
`;
const HeroInner = styled.div`
  width:min(1240px,calc(100% - 48px)); min-height:calc(100svh - 80px); margin:0 auto; display:grid; grid-template-columns:1.05fr .95fr; align-items:center; gap:60px; position:relative; z-index:2; padding:48px 0 80px;
  @media(max-width:900px){ width:calc(100% - 36px); grid-template-columns:1fr; gap:48px; padding-top:64px; }
`;
const Eyebrow = styled(motion.div)`font:500 10px var(--font-mono); letter-spacing:.13em; text-transform:uppercase; color:${mint}; margin-bottom:22px;`;
const H1 = styled.h1`
  margin:0; max-width:9ch; font:600 clamp(64px,8.4vw,122px)/.83 var(--font-display); letter-spacing:-.075em;
  .line { display:block; overflow:hidden; padding-bottom:.16em; margin-bottom:-.08em; }
  .line span { display:block; }
  .accent { color:#a99fff; }
  @media(max-width:520px){ font-size:clamp(52px,15.5vw,68px); }
`;
const Intro = styled(motion.p)`max-width:50ch; margin:28px 0 0; color:rgba(246,241,232,.7); font:400 16px/1.65 var(--font-body);`;
const Actions = styled(motion.div)`
  display:flex; gap:12px; margin-top:30px; flex-wrap:wrap;
  button { position:relative;overflow:hidden;padding:14px 21px; border-radius:99px; border:1px solid rgba(255,255,255,.2); color:${ink}; background:rgba(255,255,255,.06); font:600 14px var(--font-body); cursor:pointer; transition:transform .2s ease,background .2s ease; }
  button span{position:relative;z-index:1}
  button:hover { transform:translateY(-3px); background:rgba(255,255,255,.11); }
  .primary { color:#171126; background:${ink}; border-color:${ink}; }
  .primary::before{content:"";position:absolute;inset:0;background:${mint};transform:translateX(-102%);transition:transform .35s cubic-bezier(.22,.7,.2,1)}
  .primary:hover::before{transform:translateX(0)}
`;
const Stage = styled(motion.div)`position:relative; min-height:520px; display:grid; place-items:center; perspective:1200px; @media(max-width:900px){min-height:420px;}`;
const Depth = styled(motion.div)`position:absolute;inset:0;display:grid;place-items:center;transform-style:preserve-3d;`;
const Route = styled.svg`position:absolute; inset:0; width:100%; height:100%; overflow:visible; transform:translateZ(-35px);`;
const Plane = styled(motion.div)`
  position:absolute;width:min(430px,88vw);height:280px;border-radius:22px;
  border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.025);backdrop-filter:blur(3px);
`;
const Invoice = styled(motion.div)`
  width:min(390px,88vw); padding:24px; border-radius:18px; color:#171126; background:#f4efe3; position:relative;overflow:hidden;transform-style:preserve-3d;
  box-shadow:0 50px 100px rgba(0,0,0,.38); border:1px solid rgba(255,255,255,.7);
  .top { display:flex; justify-content:space-between; font:500 10px var(--font-mono); letter-spacing:.08em; text-transform:uppercase; }
  .due { color:#d95656; }
  .amount { margin:42px 0 5px; font:600 64px/.9 var(--font-display); letter-spacing:-.055em; }
  .client { color:#615d58; font-size:13px; }
  .rule { height:1px; margin:22px 0; background:#d8d0c3; }
  .next { display:flex; justify-content:space-between; align-items:center; font:500 11px var(--font-mono); text-transform:uppercase; }
  .ready { display:flex; gap:7px; align-items:center; color:#4b8f70; }
  .dot { width:7px; height:7px; border-radius:50%; background:${mint}; animation:${pulse} 1.7s ease infinite; }
`;
const Glare=styled(motion.div)`position:absolute;inset:0;border-radius:inherit;pointer-events:none;mix-blend-mode:soft-light;`;
const FloatTag = styled(motion.div)`
  position:absolute; padding:9px 12px; border-radius:99px; color:${ink}; background:rgba(20,15,36,.8); border:1px solid rgba(255,255,255,.16); backdrop-filter:blur(12px);
  font:500 10px var(--font-mono); letter-spacing:.06em; text-transform:uppercase;
`;
const Scroll = styled(motion.div)`position:absolute; left:50%; bottom:22px; z-index:4; transform:translateX(-50%); color:rgba(255,255,255,.55); font:500 9px var(--font-mono); letter-spacing:.12em; text-transform:uppercase;`;

function ScrambleText({text,active}:{text:string;active:boolean}){
  const reduce=useReducedMotion();
  const [value,setValue]=useState(text);
  useEffect(()=>{
    if(!active||reduce){setValue(text);return;}
    let raf=0;
    let delayTimer:ReturnType<typeof setTimeout>;
    const glyphs="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+";
    setValue([...text].map(char=>char===" "?char:glyphs[Math.floor(Math.random()*glyphs.length)]).join(""));
    delayTimer=setTimeout(()=>{
      const started=performance.now();
      const frame=(now:number)=>{
        const progress=Math.min((now-started)/820,1);
        const locked=Math.floor(progress*text.length);
        setValue([...text].map((char,index)=>char===" "||index<locked?char:glyphs[Math.floor(Math.random()*glyphs.length)]).join(""));
        if(progress<1)raf=requestAnimationFrame(frame);else setValue(text);
      };
      raf=requestAnimationFrame(frame);
    },80);
    return()=>{clearTimeout(delayTimer);cancelAnimationFrame(raf);};
  },[active,reduce,text]);
  return <>{value}</>;
}

function RecoveryLoader({onDone}:{onDone:()=>void}) {
  const [show, setShow] = useState(true);
  const [phase,setPhase]=useState(0);
  const [pct,setPct]=useState(0);
  const reduce = useReducedMotion();
  const phases=["ingest · normalize invoice","strategy · choose the next move","draft · write in your voice","gate · arm compliance checks","send · wait for first approval","recover · close the loop"];
  useEffect(() => {
    const inspect=new URLSearchParams(window.location.search).has("inspect");
    if (inspect || reduce || sessionStorage.getItem("settl_recovery_intro_v3")) { setShow(false); onDone(); return; }
    sessionStorage.setItem("settl_recovery_intro_v3", "1");
    const phaseTimers=[700,1400,2100,2800,3500].map((delay,index)=>setTimeout(()=>setPhase(index+1),delay));
    const started=performance.now();
    let raf=0;
    const tick=(now:number)=>{
      setPct(Math.min(100,Math.round(((now-started)/4200)*100)));
      if(now-started<4200)raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);
    const timer = setTimeout(() => {setShow(false);onDone();}, 4500);
    return () => {clearTimeout(timer);cancelAnimationFrame(raf);phaseTimers.forEach((id)=>clearTimeout(id));};
  }, [onDone,reduce]);
  return (
    <AnimatePresence>
      {show && <Loader exit={{ y:"-100%" }} transition={{ duration:.85, ease }}>
        <LoadCore>
          <LoadTop>
            <AnimatePresence mode="wait">
              <motion.span key={phase} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}} transition={{duration:.28}}>
                {phases[phase]}
              </motion.span>
            </AnimatePresence>
            <span className="percent">{pct.toString().padStart(3,"0")}%</span>
          </LoadTop>
          <LoadRoute>
            <LoadFill initial={{ width:0 }} animate={{ width:"96%" }} transition={{ duration:4.1, ease }} />
            {[0,1,2,3,4,5].map((n) => <LoadNode key={n} initial={{ scale:0 }} animate={{ scale:1, background:n<=phase?mint:"#272038", borderColor:n<=phase?mint:"rgba(255,255,255,.45)" }} transition={{ delay:.18+n*.55 }} />)}
            <LoadInvoice initial={{ left:"0%", rotate:-8 }} animate={{ left:"calc(96% - 38px)", rotate:3 }} transition={{ duration:4.1, ease }}><LedgerIcon name="invoice" /></LoadInvoice>
          </LoadRoute>
          <LoadWord initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} transition={{ delay:.9, duration:.8, ease }}>Money in motion.</LoadWord>
        </LoadCore>
      </Loader>}
    </AnimatePresence>
  );
}

export default function RecoveryPrelude() {
  const [compact,setCompact]=useState(false);
  const [introDone,setIntroDone]=useState(false);
  const finishIntro=useCallback(()=>setIntroDone(true),[]);
  const pointerX=useMotionValue(0),pointerY=useMotionValue(0);
  const rotateX=useSpring(useTransform(pointerY,[-.5,.5],[7,-7]),{stiffness:150,damping:20});
  const rotateY=useSpring(useTransform(pointerX,[-.5,.5],[-10,10]),{stiffness:150,damping:20});
  const glareX=useTransform(pointerX,[-.5,.5],["15%","85%"]);
  const glareY=useTransform(pointerY,[-.5,.5],["10%","90%"]);
  const glare=useMotionTemplate`radial-gradient(300px circle at ${glareX} ${glareY}, rgba(255,255,255,.75), transparent 55%)`;
  const {scrollY}=useScroll();
  useMotionValueEvent(scrollY,"change",(value)=>setCompact(value>90));
  const go = (id:string) => document.getElementById(id)?.scrollIntoView({ behavior:"smooth" });
  return <>
    <RecoveryLoader onDone={finishIntro} />
    <Hero>
      <Grain /><Orbit />
      <Nav $compact={compact}>
        <div className="brand"><span className="mark"><LedgerIcon name="reconcile" /></span>Settl.</div>
        <div className="links"><button onClick={()=>go("recovery-story")}>How it works</button><button onClick={()=>go("voice")}>Voice</button><button onClick={()=>go("console")}>Product</button></div>
        <button className="cta" onClick={()=>location.assign("/signin")}>Open dashboard</button>
      </Nav>
      <HeroInner>
        <div>
          <Eyebrow initial={{ opacity:0 }} animate={{ opacity:introDone?1:0 }} transition={{ delay:.05 }}>one invoice · one recovery path</Eyebrow>
          <H1>
            {["Get your","overdue","invoices paid,"].map((line,i)=><span className="line" key={line}><motion.span initial={{ y:"110%" }} animate={{ y:introDone?0:"110%" }} transition={{ delay:.05+i*.1,duration:.75,ease }}>{line}</motion.span></span>)}
            <span className="line accent"><motion.span initial={{ y:"110%" }} animate={{ y:introDone?0:"110%" }} transition={{ delay:.35,duration:.75,ease }}><ScrambleText text="automatically." active={introDone}/></motion.span></span>
          </H1>
          <Intro initial={{ opacity:0,y:18 }} animate={{ opacity:introDone?1:0,y:introDone?0:18 }} transition={{ delay:.55,duration:.6 }}>Settl follows the money from overdue to paid. It decides the next move, writes in your voice, clears a hard compliance gate, and records every decision.</Intro>
          <Actions initial={{ opacity:0,y:16 }} animate={{ opacity:introDone?1:0,y:introDone?0:16 }} transition={{ delay:.68 }}><button className="primary" onClick={()=>location.assign("/signin")}><span>Open your dashboard</span></button><button onClick={()=>go("recovery-story")}><span>Follow one invoice ↓</span></button></Actions>
        </div>
        <Stage initial={{ opacity:0,scale:.94 }} animate={{ opacity:introDone?1:0,scale:introDone?1:.94 }} transition={{ delay:.3,duration:.9,ease }}
          onMouseMove={(event)=>{const box=event.currentTarget.getBoundingClientRect();pointerX.set((event.clientX-box.left)/box.width-.5);pointerY.set((event.clientY-box.top)/box.height-.5);}}
          onMouseLeave={()=>{pointerX.set(0);pointerY.set(0);}}>
          <Depth style={{rotateX,rotateY}}>
            <Plane style={{z:-100}} animate={{rotateZ:-8,x:-22,y:20}}/><Plane style={{z:-65}} animate={{rotateZ:5,x:24,y:-10}}/>
            <Route viewBox="0 0 600 520" fill="none" aria-hidden="true"><motion.path d="M35 390C155 510 195 40 343 126C456 192 405 430 575 265" stroke="rgba(255,255,255,.22)" strokeWidth="1.5" initial={{ pathLength:0 }} animate={{ pathLength:introDone?1:0 }} transition={{ duration:1.4,delay:.35,ease }} /><motion.path d="M35 390C155 510 195 40 343 126" stroke={mint} strokeWidth="2" initial={{ pathLength:0 }} animate={{ pathLength:introDone?1:0 }} transition={{ duration:1.1,delay:.5,ease }} /></Route>
            <Invoice style={{z:70}} animate={{ y:[0,-8,0],rotateZ:[-4,-2,-4] }} transition={{ duration:5,repeat:Infinity,ease:"easeInOut" }}>
              <Glare style={{background:glare}}/>
              <div className="top"><span>Invoice · INV-012</span><span className="due">21 days overdue</span></div>
              <div className="amount">$6,800</div><div className="client">Atlas Mechanical · due June 18</div><div className="rule" />
              <div className="next"><span>next action</span><span className="ready"><span className="dot" />ready to decide</span></div>
            </Invoice>
            <FloatTag style={{ left:"2%",bottom:"15%",z:95 }} initial={{ opacity:0,x:-20 }} animate={{ opacity:introDone?1:0,x:introDone?0:-20 }} transition={{ delay:.75 }}>payment verified</FloatTag>
            <FloatTag style={{ right:"0%",top:"18%",z:95 }} initial={{ opacity:0,x:20 }} animate={{ opacity:introDone?1:0,x:introDone?0:20 }} transition={{ delay:.9 }}>contact found</FloatTag>
          </Depth>
        </Stage>
      </HeroInner>
      <Scroll initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:1.2 }}>scroll to move the invoice</Scroll>
    </Hero>
  </>;
}
