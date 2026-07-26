"use client";

import { useEffect, useRef, useState } from "react";

const CLIPS = ["/agent-voice.wav", "/agent-voice.mp3"];
const SAMPLE = "Hi, this is an AI assistant calling on behalf of Brightline Studio. This is a friendly reminder that invoice for twelve hundred dollars is fifteen days past due. Please settle it at your earliest convenience. I'll text you a secure link to pay right after this call.";
const FALLBACK_SECONDS = 18;

export type VoiceState = {
  playing:boolean;
  progress:number;
  elapsed:number;
  complete:boolean;
};

const idle:VoiceState = { playing:false,progress:0,elapsed:0,complete:false };

export function useVoiceSample(){
  const [state,setState]=useState<VoiceState>(idle);
  const audio=useRef<HTMLAudioElement|null>(null);
  const timer=useRef<ReturnType<typeof setInterval>|null>(null);
  const clear=()=>{ if(timer.current)clearInterval(timer.current); timer.current=null; };
  const finish=()=>{ clear(); setState({playing:false,progress:1,elapsed:FALLBACK_SECONDS,complete:true}); };

  useEffect(()=>()=>{ clear(); audio.current?.pause(); window.speechSynthesis?.cancel(); },[]);

  const fallback=()=>{
    if(!window.speechSynthesis){setState(idle);return;}
    const started=performance.now();
    const utterance=new SpeechSynthesisUtterance(SAMPLE);
    timer.current=setInterval(()=>{
      const elapsed=Math.min((performance.now()-started)/1000,FALLBACK_SECONDS);
      setState({playing:true,elapsed,progress:elapsed/FALLBACK_SECONDS,complete:false});
    },100);
    utterance.onend=finish;
    utterance.onerror=()=>{clear();setState(idle);};
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const playClip=(index:number)=>{
    if(index>=CLIPS.length){fallback();return;}
    const clip=new Audio(CLIPS[index]);
    clip.ontimeupdate=()=>{
      const duration=Number.isFinite(clip.duration)?clip.duration:FALLBACK_SECONDS;
      setState({playing:true,elapsed:clip.currentTime,progress:Math.min(clip.currentTime/duration,1),complete:false});
    };
    clip.onended=finish;
    clip.play().then(()=>{audio.current=clip;}).catch(()=>playClip(index+1));
  };

  const stop=()=>{
    clear();
    audio.current?.pause();
    if(audio.current)audio.current.currentTime=0;
    window.speechSynthesis?.cancel();
    setState(idle);
  };
  const toggle=()=>{
    if(state.playing){stop();return;}
    setState({...idle,playing:true});
    playClip(0);
  };
  return {state,toggle};
}
