"use client";

import { useRef, useState } from "react";
import styled from "styled-components";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { LedgerIcon, type LedgerIconName } from "./LedgerIcons";

const ease = [0.22, 0.7, 0.2, 1] as const;
const paper = "#f3eee2";
const dark = "#111214";
const violet = "#7466f2";
const mint = "#76d9aa";
const amber = "#e8ad5f";
const red = "#ec7272";

type Stage = {
  n:string; key:string; label:string; verb:string; title:string; body:string;
  reason:string; icon:LedgerIconName; tone:string; fg:string;
};
const STAGES:Stage[] = [
  { n:"01",key:"ingest",label:"Ingest",verb:"READS",title:"Messy data becomes one clean invoice.",body:"CSV rows and Stripe records converge at the edge. The agent only receives the canonical invoice, never the raw source.",reason:"source normalized · amount and due date verified",icon:"invoice",tone:"#ddd3ff",fg:violet },
  { n:"02",key:"strategy",label:"Strategy",verb:"DECIDES",title:"The next move is a decision, not a schedule.",body:"Settl weighs days overdue, prior contact, tone bounds and channel. This invoice calls for a firm email today.",reason:"21 days overdue + no reply → firm email",icon:"strategy",tone:"#c5dcff",fg:"#6aa7ff" },
  { n:"03",key:"draft",label:"Draft",verb:"WRITES",title:"Your voice, fitted to this moment.",body:"The reminder is composed from the tenant voice profile with the verified amount, due date and payment-link placeholder.",reason:"voice: direct · respectful · no legal language",icon:"draft",tone:"#ffe2c1",fg:"#e7a45b" },
  { n:"04",key:"gate",label:"Compliance",verb:"CHECKS",title:"Every word meets the hard line.",body:"A deterministic gate inspects the draft. Unsafe claims stop here; disputes and consumer debt route to a human.",reason:"5 deterministic checks passed · first touch held",icon:"gate",tone:"#ffd1d1",fg:red },
  { n:"05",key:"send",label:"Reach",verb:"FOLLOWS UP",title:"Approved once. Delivered from your mailbox.",body:"The real payment link resolves only after the gate. The message sends, delivery is logged, and the next move is scheduled.",reason:"gmail delivered · execution event written",icon:"send",tone:"#d7d2ff",fg:violet },
  { n:"06",key:"paid",label:"Recovered",verb:"RECONCILES",title:"Payment closes the loop.",body:"The vendor’s processor confirms payment. Settl marks the invoice paid and ends every future follow-up automatically.",reason:"payment verified · no funds touched by Settl",icon:"reconcile",tone:"#c8f2dd",fg:mint },
];

const StoryRoot = styled.section`position:relative;background:${dark};color:#f6f1e8;`;
const Story = styled.div`position:relative;height:${STAGES.length * 100}vh;@media(max-width:980px){display:none;}`;
const Pin = styled.div<{ $tone:string }>`
  position:sticky; top:0; height:100svh; overflow:hidden; display:grid; align-items:center;
  background:
    radial-gradient(900px 620px at 50% 52%, ${({$tone})=>$tone}20, transparent 65%),
    ${dark};
  transition:background .7s ease;
`;
const Noise = styled.div`
  position:absolute; inset:0; pointer-events:none; opacity:.16;
  background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);
  background-size:64px 64px;
`;
const StageNo = styled(motion.div)`position:absolute; right:-2vw; top:50%; transform:translateY(-50%); font:600 min(42vw,540px)/.8 var(--font-display); letter-spacing:-.09em; color:rgba(255,255,255,.025);`;
const Kicker = styled.div`position:absolute; top:26px; left:50%; transform:translateX(-50%); z-index:4; font:500 10px var(--font-mono); letter-spacing:.14em; text-transform:uppercase; color:rgba(255,255,255,.5); white-space:nowrap;`;
const Layout = styled.div`
  width:min(1320px,calc(100% - 56px)); margin:auto; position:relative; z-index:2;
  display:grid; grid-template-columns:180px minmax(360px,1fr) minmax(280px,360px); gap:46px; align-items:center;
  @media(max-width:980px){ width:calc(100% - 34px); grid-template-columns:1fr; gap:18px; padding:74px 0 30px; align-content:center; }
  @media(max-width:980px) and (max-height:720px){ gap:8px; padding:54px 0 12px; }
`;
const Rail = styled.div`
  position:relative; display:flex; flex-direction:column;
  &::before{content:"";position:absolute;left:7px;top:18px;bottom:18px;width:1px;background:rgba(255,255,255,.14);}
  @media(max-width:980px){ order:1; flex-direction:row; justify-content:space-between; &::before{left:3%;right:3%;top:7px;bottom:auto;width:auto;height:1px;} }
`;
const RailItem = styled.button<{ $on:boolean;$past:boolean }>`
  position:relative; display:grid; grid-template-columns:16px 28px 1fr; gap:9px; align-items:center; padding:10px 0; color:${({$on,$past})=>$on?"#fff":$past?"rgba(255,255,255,.55)":"rgba(255,255,255,.28)"}; border:0;background:none;text-align:left;cursor:pointer;
  .dot{width:${({$on})=>$on?"15px":"9px"};height:${({$on})=>$on?"15px":"9px"};margin-left:${({$on})=>$on?"0":"3px"};border-radius:50%;background:${({$on,$past})=>$on?"#f6f1e8":$past?mint:"#313238"};box-shadow:${({$on})=>$on?"0 0 0 5px rgba(255,255,255,.08)":"none"};transition:all .3s ease;}
  .n{font:500 9px var(--font-mono);}.label{font:600 13px var(--font-display);}
  @media(max-width:980px){ display:block;padding:0;text-align:center;.n,.label{display:none}.dot{display:block;margin:0!important;} }
`;
const Art = styled.div`position:relative; min-height:590px; display:grid; place-items:center; @media(max-width:980px){order:2;min-height:390px;} @media(max-width:980px) and (max-height:720px){min-height:285px;}`;
const Halo = styled(motion.div)<{ $color:string }>`position:absolute;width:min(470px,78vw);aspect-ratio:1;border-radius:50%;border:1px solid ${({$color})=>$color}55;box-shadow:inset 0 0 80px ${({$color})=>$color}14,0 0 90px ${({$color})=>$color}12;`;
const Artifact = styled(motion.div)`
  width:min(410px,88vw); min-height:310px; border-radius:20px; padding:24px; position:relative; overflow:hidden;
  color:${dark}; background:${paper}; box-shadow:0 45px 110px rgba(0,0,0,.42);
  @media(max-width:980px) and (max-height:720px){min-height:235px;padding:17px;transform:scale(.88);}
`;
const ArtTop = styled.div`display:flex;justify-content:space-between;align-items:center;font:500 9.5px var(--font-mono);letter-spacing:.08em;text-transform:uppercase;color:#69645e;.state{padding:5px 8px;border-radius:99px;background:#e7e0d4;}`;
const BaseAmount = styled.div`font:600 54px/.95 var(--font-display);letter-spacing:-.055em;margin:24px 0 4px;`;
const BaseMeta = styled.div`font:400 12px var(--font-body);color:#777069;`;
const Fragment = styled(motion.div)`position:absolute;padding:8px 10px;border:1px solid #d5cdc0;background:#fffaf0;border-radius:8px;font:500 9px var(--font-mono);color:#756d65;box-shadow:0 10px 25px rgba(0,0,0,.08);`;
const Branches = styled.div`
  margin-top:24px;display:grid;gap:8px;
  .route{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #d8d0c4;border-radius:9px;color:#777;font:500 10px var(--font-mono);}
  .route.on{border-color:#7aaeff;background:#eaf3ff;color:#285a9a;transform:translateX(8px);}
  .line{height:1px;flex:1;background:currentColor;opacity:.3;}
`;
const Message = styled.div`
  margin-top:20px;padding:16px;border-radius:10px;background:#fffaf2;border:1px solid #d9d0c3;font:400 12.5px/1.6 var(--font-body);color:#4e4944;
  .to{font:500 9px var(--font-mono);text-transform:uppercase;color:#8b837a;margin-bottom:10px;}
  .link{display:inline-block;margin-top:9px;padding:4px 7px;border-radius:5px;background:#e9e5ff;color:#5648b7;font:500 9px var(--font-mono);}
`;
const Scanner = styled(motion.div)`position:absolute;left:0;right:0;height:2px;background:${red};box-shadow:0 0 22px ${red};z-index:4;`;
const Checks = styled.div`margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:6px;.check{padding:8px;border-radius:8px;background:#f7e6e2;color:#8d3f3f;font:500 8px var(--font-mono);}.ok{background:#e1f1e8;color:#37775a;}`;
const SendScene = styled.div`
  margin-top:20px;display:grid;place-items:center;position:relative;height:140px;
  .mail{width:72px;height:54px;border-radius:8px;background:#ded8ff;color:${violet};display:grid;place-items:center;box-shadow:0 16px 36px rgba(116,102,242,.25)} svg{width:28px}
  .trail{position:absolute;width:70%;height:1px;background:linear-gradient(90deg,transparent,${violet},transparent);}
  .delivered{position:absolute;right:0;bottom:0;padding:6px 9px;border-radius:99px;background:#dcf1e6;color:#36795a;font:500 9px var(--font-mono);}
  .approval{position:absolute;left:0;top:0;display:grid;gap:5px;font:500 8px var(--font-mono);color:#5f596e}.approval span{padding:5px 7px;border-radius:99px;background:#ebe7ff}
`;
const Paid = styled.div`margin-top:26px;padding:22px;border-radius:12px;background:#dff4e8;text-align:center;color:#2d7153;.tick{width:45px;height:45px;margin:0 auto 12px;border-radius:50%;display:grid;place-items:center;background:${mint};color:#153e2d}.tick svg{width:23px}.paid{font:600 26px var(--font-display);}.sub{font:500 9px var(--font-mono);margin-top:5px;text-transform:uppercase;}`;
const Copy = styled.div`@media(max-width:980px){order:3;text-align:center;}`;
const Verb = styled(motion.div)<{ $color:string }>`font:600 clamp(44px,5vw,76px)/.86 var(--font-display);letter-spacing:-.065em;color:${({$color})=>$color};margin-bottom:20px;@media(max-width:980px) and (max-height:720px){font-size:34px;margin-bottom:8px}`;
const Title = styled.h2`font:600 clamp(28px,3.2vw,42px)/1 var(--font-display);letter-spacing:-.045em;margin:0;@media(max-width:980px) and (max-height:720px){font-size:23px}`;
const Body = styled.p`font:400 14.5px/1.65 var(--font-body);color:rgba(255,255,255,.58);margin:16px 0 0;@media(max-width:980px) and (max-height:720px){font-size:11.5px;line-height:1.45;margin-top:8px}`;
const Reason = styled.div`margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,.12);font:500 10px/1.5 var(--font-mono);letter-spacing:.04em;color:rgba(255,255,255,.45);span{color:${mint};}@media(max-width:980px) and (max-height:720px){margin-top:8px;padding-top:7px;font-size:8px}`;
const Progress = styled(motion.div)`position:absolute;left:0;bottom:0;height:3px;background:linear-gradient(90deg,${violet},${amber},${red},${mint});transform-origin:left;z-index:5;`;
const MobileFlow = styled.div`
  display:none;
  @media(max-width:980px){display:block;background:${dark};}
`;
const MobileChapter = styled.article<{ $tone:string }>`
  min-height:92svh;padding:94px 18px 70px;border-bottom:1px solid rgba(255,255,255,.1);
  background:radial-gradient(520px 420px at 50% 46%,${({$tone})=>$tone}1c,transparent 68%);
  .stage-label{position:sticky;top:66px;z-index:4;display:flex;justify-content:space-between;padding:9px 12px;border:1px solid rgba(255,255,255,.12);border-radius:99px;background:rgba(17,18,20,.82);backdrop-filter:blur(12px);font:500 9px var(--font-mono);letter-spacing:.09em;text-transform:uppercase;color:rgba(255,255,255,.55)}
  .mobile-copy{text-align:center;max-width:520px;margin:0 auto 24px}
  .mobile-copy h2{font:600 clamp(30px,9vw,46px)/.95 var(--font-display);letter-spacing:-.05em;margin:12px 0}
  .mobile-copy p{font:400 13px/1.55 var(--font-body);color:rgba(255,255,255,.55);margin:0}
  ${Art}{min-height:390px;}
`;

function Scene({ stage }: { stage:number }) {
  const s=STAGES[stage];
  return <Art>
    <Halo $color={s.fg} animate={{scale:[1,1.04,1],rotate:stage*12}} transition={{scale:{duration:4,repeat:Infinity},rotate:{duration:.7,ease}}} />
    <Artifact layoutId="recovery-invoice" transition={{duration:.55,ease}} animate={{rotate:stage===0?-4:stage===5?0:(stage%2?2:-1)}}>
      <ArtTop><span>INV-012 · Atlas Mechanical</span><span className="state">{s.label}</span></ArtTop>
      <BaseAmount>$6,800</BaseAmount><BaseMeta>B2B · 21 days overdue · payment verified</BaseMeta>
      <AnimatePresence mode="wait">
        <motion.div key={s.key} initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}} transition={{duration:.38,ease}}>
          {stage===0&&<>
            <Fragment initial={{x:-120,y:60,rotate:-8}} animate={{x:15,y:48,rotate:-2}}>stripe · pi_3M82</Fragment>
            <Fragment initial={{x:210,y:130,rotate:7}} animate={{x:190,y:86,rotate:2}}>due · 2026-06-18</Fragment>
            <Fragment initial={{x:-80,y:170,rotate:4}} animate={{x:85,y:142,rotate:0}}>contact · verified</Fragment>
          </>}
          {stage===1&&<Branches><div className="route">wait 3 days<div className="line"/></div><div className="route on">firm email<div className="line"/>selected</div><div className="route">voice call<div className="line"/></div></Branches>}
          {stage===2&&<Message><div className="to">to · accounts@atlasmechanical.com</div>Hi Atlas team, invoice INV-012 for $6,800 is now 21 days past due. Could you confirm when we should expect payment?<div className="link">{"{{payment_link}}"}</div></Message>}
          {stage===3&&<><Scanner initial={{top:"34%"}} animate={{top:"91%"}} transition={{duration:1.5,repeat:Infinity,repeatDelay:.6,ease:"easeInOut"}}/><Checks><div className="check ok">✓ B2B verified</div><div className="check ok">✓ no dispute</div><div className="check ok">✓ frequency clear</div><div className="check ok">✓ tone in bounds</div><div className="check ok">✓ URL placeholder</div><div className="check">● first touch approval</div></Checks></>}
          {stage===4&&<SendScene><div className="approval"><span>✓ APPROVAL RECORDED</span><span>✓ GATE RE-RUN · PASSED</span></div><div className="trail"/><motion.div className="mail" animate={{x:[-70,0,70],opacity:[0,1,0]}} transition={{duration:2,repeat:Infinity,ease}}><LedgerIcon name="send"/></motion.div><span className="delivered">DELIVERED · 10:42</span></SendScene>}
          {stage===5&&<Paid><motion.div className="tick" initial={{scale:0}} animate={{scale:1}} transition={{type:"spring",stiffness:260}}><LedgerIcon name="reconcile"/></motion.div><div className="paid">Payment verified</div><div className="sub">recovery loop closed · 0 future sends</div></Paid>}
        </motion.div>
      </AnimatePresence>
    </Artifact>
  </Art>;
}

export default function RecoveryStory(){
  const ref=useRef<HTMLElement>(null);
  const [stage,setStage]=useState(0);
  const reduce=useReducedMotion();
  const {scrollYProgress}=useScroll({target:ref,offset:["start start","end end"]});
  const progress=useTransform(scrollYProgress,[0,1],[0,1]);
  useMotionValueEvent(scrollYProgress,"change",(v)=>setStage(Math.min(5,Math.floor(v*6))));
  const go=(i:number)=>{
    if(!ref.current)return;
    const top=window.scrollY+ref.current.getBoundingClientRect().top;
    const distance=ref.current.offsetHeight-window.innerHeight;
    window.scrollTo({top:top+distance*(i/5),behavior:reduce?"auto":"smooth"});
  };
  const s=STAGES[stage];
  return <StoryRoot id="recovery-story">
    <Story ref={ref}>
      <Pin $tone={s.tone}>
      <Noise/><Kicker>watch one invoice move · overdue to paid</Kicker>
      <AnimatePresence mode="wait"><StageNo key={s.n} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>{s.n}</StageNo></AnimatePresence>
      <Layout>
        <Rail>{STAGES.map((item,i)=><RailItem key={item.key} $on={i===stage} $past={i<stage} onClick={()=>go(i)} aria-label={`Go to ${item.label}`}><span className="dot"/><span className="n">{item.n}</span><span className="label">{item.label}</span></RailItem>)}</Rail>
        <Scene stage={stage}/>
        <Copy>
          <AnimatePresence mode="wait"><motion.div key={s.key} initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-18}} transition={{duration:.42,ease}}>
            <Verb $color={s.fg}>{s.verb}</Verb><Title>{s.title}</Title><Body>{s.body}</Body><Reason><span>WHY THIS MOVE</span><br/>{s.reason}</Reason>
          </motion.div></AnimatePresence>
        </Copy>
      </Layout>
      <Progress style={{scaleX:progress}}/>
      </Pin>
    </Story>
    <MobileFlow>
      {STAGES.map((item,index)=><MobileChapter key={item.key} $tone={item.tone}>
        <div className="stage-label"><span>{item.n} · {item.label}</span><span>{index+1} / {STAGES.length}</span></div>
        <div className="mobile-copy"><Verb $color={item.fg}>{item.verb}</Verb><h2>{item.title}</h2><p>{item.body}</p></div>
        <Scene stage={index}/>
      </MobileChapter>)}
    </MobileFlow>
  </StoryRoot>;
}
