const fs=require('fs');eval(fs.readFileSync('data.js','utf8').replace(/^const DATA=/,'global.DATA='));
const FLOOR={QQQ:20040101,NDX:19850102,TQQQ:0};
function backtest(cfg){
  const CAPFRAC=0.98,QFRAC=0.25;
  const isTQQQ=cfg.asset==='TQQQ';
  const COST=isTQQQ?(0.0014/2+0.0003):(0.0004/2+0.0003);
  const FUND=isTQQQ?0:0.00005;
  const LEV=isTQQQ?1.0:cfg.lev,LIQ=isTQQQ?null:({1:null,2:-0.5,3:-1/3,4:-0.25}[cfg.lev]);
  const GROW=1+cfg.grow/100,DROPT=1-cfg.drop/100,INJ=cfg.inj/100,STORE=cfg.store/100,safety=STORE>0;
  const tpScale=isTQQQ?3:1;
  const data=DATA[cfg.asset];
  let d0=cfg.d0;const fl=FLOOR[cfg.asset];if(fl>d0)d0=fl;
  let sIdx=data.findIndex(r=>r[0]>=d0);if(sIdx<0)sIdx=0;
  let eIdx=data.length-1;for(let i=data.length-1;i>=0;i--){if(data[i][0]<=cfg.d1){eIdx=i;break;}}
  const rows=data.slice(sIdx,eIdx+1);if(rows.length<2)return null;
  let cash=cfg.seed,vault=0,pos=[],grow_base=cfg.seed,peak=cfg.seed,drop_base=null;
  const SEED=cfg.seed;
  const msum=()=>pos.reduce((a,p)=>a+p.m,0);
  const eqop=px=>cash+msum()+pos.reduce((a,p)=>a+p.n*(px/p.ep-1),0);
  let totQc=0,nTP=0,nLiq=0,nStore=0,nInj=0;
  function qc(px){if(!pos.length)return;totQc++;const tgt=msum()*QFRAC;let freed=0;pos.sort((a,b)=>b.tpp-a.tpp);
    while(pos.length&&freed<tgt){const p=pos.shift();cash+=p.m+p.n*(px/p.ep-1)-p.n*(px/p.ep)*COST;freed+=p.m;}}
  let pk=-1,mdd=0;
  for(let i=0;i<rows.length;i++){
    const hi=rows[i][1],lo=rows[i][2],px=rows[i][3];
    if(pos.length&&FUND>0)cash-=pos.reduce((a,p)=>a+p.n*(px/p.ep)*FUND,0);
    const keep=[];
    for(const p of pos){if(p.ei===i){keep.push(p);continue;}
      if(LIQ!==null&&lo<=p.ep*(1+LIQ)){cash-=p.n*(1+LIQ)*COST;cash+=p.m+p.n*LIQ;nLiq++;}
      else if(hi>=p.tpp){cash+=p.m+p.n*p.tp-p.n*(1+p.tp)*COST;nTP++;}else keep.push(p);}
    pos=keep;
    if(i>=1){const up=px>=rows[i-1][3];const opv=Math.max(eqop(px),0),cap=opv*CAPFRAC;
      const rate=(up?cfg.entry.up:cfg.entry.dn)/100;let margin=opv*rate;
      if(margin>0){let g=0;while((msum()+margin>cap||cash<margin)&&pos.length&&g<200){qc(px);g++;}
        if(cash>=margin&&msum()+margin<=cap+1e-6){const n=margin*LEV;cash-=margin+n*COST;
          const tpv=(up?cfg.tp.utp:cfg.tp.dtp)/100*tpScale;pos.push({ei:i,m:margin,n:n,ep:px,tp:tpv,tpp:px*(1+tpv)});}}}
    const opv=Math.max(eqop(px),0),total=opv+vault;
    if(safety){if(opv>=grow_base*GROW&&opv>0){const st=Math.min(total*STORE,cash);if(st>0){cash-=st;vault+=st;nStore++;}grow_base=opv;}
      if(total>peak){peak=total;drop_base=null;}const ref=drop_base!==null?drop_base:peak;
      if(total<=ref*DROPT&&vault>0){const inj=vault*INJ;vault-=inj;cash+=inj;drop_base=total;nInj++;}}else{if(total>peak)peak=total;}
    if(total>pk)pk=total;if(pk>0&&total/pk-1<mdd)mdd=total/pk-1;
  }
  const total=Math.max(eqop(rows[rows.length-1][3]),0)+vault;
  const years=rows.length/252,cagr=total>0?Math.pow(total/SEED,1/years)-1:-1;
  return {ret:(total/SEED-1)*100,total,mdd:mdd*100,cagr:cagr*100,nTP,nLiq,nStore,nInj,totQc,days:rows.length,start:rows[0][0],end:rows[rows.length-1][0]};
}
const base={seed:10000,entry:{up:1,dn:3},tp:{utp:10,dtp:10},store:50,grow:50,drop:50,inj:50,lev:3};
for(const [asset,d0,d1] of [['QQQ',20040101,20260618],['QQQ',20180102,20260618],['NDX',19850102,20260618],['TQQQ',20100101,20260618]]){
  const r=backtest({...base,asset,d0,d1});
  console.log(`${asset} ${r.start}-${r.end}: ret=${r.ret.toFixed(0)}% CAGR=${r.cagr.toFixed(1)}% MDD=${r.mdd.toFixed(0)}% | TP=${r.nTP} Liq=${r.nLiq} Store=${r.nStore} Inj=${r.nInj} QC=${r.totQc} days=${r.days}`);
}
