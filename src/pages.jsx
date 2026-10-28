import {useCallback,useEffect,useMemo,useState} from 'react';
import {api,fmt,d,today,csv} from './api';
function useAll(){
  const [s,set]=useState({expenses:[],categories:[],budgets:[],loading:true,error:''});
  const load=useCallback(async()=>{try{const [expenses,categories,budgets]=await Promise.all([api('/expenses'),api('/categories'),api('/budgets')]);set({expenses:expenses||[],categories:categories||[],budgets:budgets||[],loading:false,error:''})}catch(e){set(x=>({...x,loading:false,error:e.message}))}},[]);
  useEffect(()=>{load()},[load]);
  const cn=id=>s.categories.find(c=>c.id===id)?.name||'Other';
  return {...s,load,cn};
}
const Bar=({v,max,over})=><div className="bar"><div style={{width:Math.min(100,max?v/max*100:0)+'%',background:over?'#D2502F':'#2A63D6'}}/></div>;
const spent=(x,b)=>x.expenses.filter(e=>e.categoryId===b.categoryId&&d(e.date)>=d(b.startDate)&&d(e.date)<=d(b.endDate)).reduce((a,e)=>a+e.amount,0);
const Wrap=({x,title,children,action})=><main><div className="head"><h1>{title}</h1>{action}</div>{x.error&&<p className="err" role="alert">{x.error}</p>}{x.loading?<p className="muted">Loading…</p>:children}</main>;

export function Overview(){
  const x=useAll(),m=today().slice(0,7),mon=x.expenses.filter(e=>d(e.date).startsWith(m)),total=mon.reduce((a,e)=>a+e.amount,0);
  const act=x.budgets.filter(b=>d(b.startDate)<=today()&&d(b.endDate)>=today()),plan=act.reduce((a,b)=>a+b.amount,0),over=act.filter(b=>spent(x,b)>b.amount);
  const days=[...Array(7)].map((_,i)=>{const t=new Date(Date.now()-(6-i)*864e5),k=t.toISOString().slice(0,10);return{l:t.toLocaleDateString('en',{weekday:'narrow'}),v:x.expenses.filter(e=>d(e.date)===k).reduce((a,e)=>a+e.amount,0)}});
  const mx=Math.max(1,...days.map(q=>q.v));
  return <Wrap x={x} title="Overview">
    {over.length>0&&<p className="alert">Over budget: {over.map(b=>x.cn(b.categoryId)).join(', ')}</p>}
    <div className="grid"><section className="card hero"><span className="muted">This month · total spent</span><div className="big">{fmt(total)}</div>{plan>0&&<><Bar v={total} max={plan} over={total>plan}/><span className="muted">{Math.round(total/plan*100)}% of {fmt(plan)} planned</span></>}</section>
    <section className="card"><span className="muted">Last 7 days</span><div className="chart">{days.map((q,i)=><div key={i} title={fmt(q.v)}><i style={{height:q.v/mx*120+4}}/><small>{q.l}</small></div>)}</div></section></div>
    <div className="grid"><section className="card"><h2>Budgets</h2>{act.length?act.map(b=>{const s=spent(x,b);return <div key={b.id} className="bi"><div><b>{x.cn(b.categoryId)}</b><span className={s>b.amount?'bad':'muted'}>{fmt(s)} / {fmt(b.amount)}</span></div><Bar v={s} max={b.amount} over={s>b.amount}/></div>}):<p className="muted">No active budgets.</p>}</section>
    <section className="card"><h2>Recent</h2>{[...x.expenses].sort((a,b)=>d(b.date).localeCompare(d(a.date))).slice(0,6).map(e=><div className="row" key={e.id}><span className="muted">{d(e.date).slice(5)}</span><b>{e.description}</b><span className="tag">{x.cn(e.categoryId)}</span><b>{fmt(e.amount)}</b></div>)}</section></div>
  </Wrap>;
}
export function Expenses(){
  const x=useAll(),[q,setQ]=useState(''),[cat,setCat]=useState(''),[mo,setMo]=useState(today().slice(0,7)),[f,setF]=useState(null),[err,setErr]=useState('');
  const rows=useMemo(()=>x.expenses.filter(e=>(!mo||d(e.date).startsWith(mo))&&(!cat||String(e.categoryId)===cat)&&e.description?.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>d(b.date).localeCompare(d(a.date))),[x.expenses,q,cat,mo]);
  const blank=()=>({amount:'',description:'',date:today(),categoryId:x.categories[0]?.id||''});
  async function save(e){e.preventDefault();setErr('');const body={amount:+f.amount,description:f.description,date:f.date,categoryId:+f.categoryId};
    try{f.id?await api('/expenses/'+f.id,{method:'PUT',body}):await api('/expenses',{method:'POST',body});setF(null);x.load()}catch(z){setErr(z.message)}}
  const del=async e=>{if(confirm('Delete this expense?')){try{await api('/expenses/'+e.id,{method:'DELETE'});x.load()}catch(z){setErr(z.message)}}};
  const S=k=>e=>setF({...f,[k]:e.target.value});
  return <Wrap x={x} title="Expenses" action={<button className="btn" onClick={()=>setF(blank())}>Add expense</button>}>
    {err&&<p className="err">{err}</p>}
    {f&&<form className="card form" onSubmit={save}><label>Amount<input type="number" min="1" step="any" required value={f.amount} onChange={S('amount')}/></label><label>Description<input required value={f.description} onChange={S('description')}/></label><label>Date<input type="date" required value={d(f.date)} onChange={S('date')}/></label><label>Category<select value={f.categoryId} onChange={S('categoryId')}>{x.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="acts"><button className="btn">{f.id?'Update':'Save'}</button><button type="button" className="btn ghost" onClick={()=>setF(null)}>Cancel</button></div></form>}
    <div className="filters"><input placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)}/><input type="month" value={mo} onChange={e=>setMo(e.target.value)}/><select value={cat} onChange={e=>setCat(e.target.value)}><option value="">All categories</option>{x.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="btn ghost" onClick={()=>csv('expenses.csv',[['Date','Description','Category','Amount'],...rows.map(e=>[d(e.date),e.description,x.cn(e.categoryId),e.amount])])}>Export CSV</button></div>
    <section className="card list">{rows.length?rows.map(e=><div className="row" key={e.id}><span className="muted">{d(e.date)}</span><b>{e.description}</b><span className="tag">{x.cn(e.categoryId)}</span><b>{fmt(e.amount)}</b><span className="acts"><button className="link" onClick={()=>setF({...e,date:d(e.date)})}>Edit</button><button className="link bad" onClick={()=>del(e)}>Delete</button></span></div>):<p className="muted pad">Nothing here yet.</p>}<div className="foot">Total {fmt(rows.reduce((a,e)=>a+e.amount,0))}</div></section>
  </Wrap>;
}
export function Budgets(){
  const x=useAll(),[f,setF]=useState(null),[nc,setNc]=useState(''),[err,setErr]=useState('');
  const run=async fn=>{setErr('');try{await fn();x.load()}catch(z){setErr(z.message)}};
  const save=e=>{e.preventDefault();const body={amount:+f.amount,categoryId:+f.categoryId,startDate:f.startDate,endDate:f.endDate};run(async()=>{f.id?await api('/budgets/'+f.id,{method:'PUT',body}):await api('/budgets',{method:'POST',body});setF(null)})};
  const S=k=>e=>setF({...f,[k]:e.target.value}),m=today().slice(0,7);
  return <Wrap x={x} title="Budgets" action={<button className="btn" onClick={()=>setF({amount:'',categoryId:x.categories[0]?.id||'',startDate:m+'-01',endDate:new Date(+m.slice(0,4),+m.slice(5),0).toISOString().slice(0,10).replace(/-\d\d$/,'-'+new Date(+m.slice(0,4),+m.slice(5),0).getDate())})}>New budget</button>}>
    {err&&<p className="err">{err}</p>}
    {f&&<form className="card form" onSubmit={save}><label>Limit<input type="number" min="1" required value={f.amount} onChange={S('amount')}/></label><label>Category<select value={f.categoryId} onChange={S('categoryId')}>{x.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>From<input type="date" required value={d(f.startDate)} onChange={S('startDate')}/></label><label>To<input type="date" required value={d(f.endDate)} onChange={S('endDate')}/></label><div className="acts"><button className="btn">Save</button><button type="button" className="btn ghost" onClick={()=>setF(null)}>Cancel</button></div></form>}
    <div className="grid">{x.budgets.map(b=>{const s=spent(x,b);return <section className="card" key={b.id}><div className="bi"><div><b>{x.cn(b.categoryId)}</b><span className={s>b.amount?'bad':'muted'}>{s>b.amount?fmt(s-b.amount)+' over':fmt(b.amount-s)+' left'}</span></div><Bar v={s} max={b.amount} over={s>b.amount}/><small className="muted">{d(b.startDate)} → {d(b.endDate)} · {fmt(s)} of {fmt(b.amount)}</small></div><div className="acts"><button className="link" onClick={()=>setF({...b,startDate:d(b.startDate),endDate:d(b.endDate)})}>Edit</button><button className="link bad" onClick={()=>confirm('Delete budget?')&&run(()=>api('/budgets/'+b.id,{method:'DELETE'}))}>Delete</button></div></section>})}</div>
    <section className="card"><h2>Categories</h2><div className="chips">{x.categories.map(c=><span className="tag" key={c.id}>{c.name}{c.userId!=null&&<button className="link bad" aria-label={'Delete '+c.name} onClick={()=>run(()=>api('/categories/'+c.id,{method:'DELETE'}))}> ×</button>}</span>)}</div><form className="filters" onSubmit={e=>{e.preventDefault();nc.trim()&&run(async()=>{await api('/categories',{method:'POST',body:{name:nc.trim()}});setNc('')})}}><input placeholder="New category" value={nc} onChange={e=>setNc(e.target.value)}/><button className="btn ghost">Add</button></form></section>
  </Wrap>;
}
export function Reports(){
  const x=useAll(),[a,setA]=useState(today().slice(0,8)+'01'),[b,setB]=useState(today());
  const rows=x.expenses.filter(e=>d(e.date)>=a&&d(e.date)<=b),tot=rows.reduce((s,e)=>s+e.amount,0);
  const by=Object.entries(rows.reduce((o,e)=>{const k=x.cn(e.categoryId);o[k]=(o[k]||0)+e.amount;return o},{})).sort((p,q)=>q[1]-p[1]);
  const n=Math.max(1,Math.round((new Date(b)-new Date(a))/864e5)+1);
  return <Wrap x={x} title="Reports" action={<button className="btn ghost" onClick={()=>csv('report.csv',[['Category','Total'],...by])}>Export CSV</button>}>
    <div className="filters"><label>From<input type="date" value={a} onChange={e=>setA(e.target.value)}/></label><label>To<input type="date" value={b} onChange={e=>setB(e.target.value)}/></label></div>
    <div className="grid"><section className="card"><span className="muted">Total</span><div className="big">{fmt(tot)}</div></section><section className="card"><span className="muted">Daily average</span><div className="big">{fmt(tot/n)}</div></section><section className="card"><span className="muted">Transactions</span><div className="big">{rows.length}</div></section></div>
    <section className="card"><h2>By category</h2>{by.map(([k,v])=><div className="bi" key={k}><div><b>{k}</b><span className="muted">{fmt(v)} · {Math.round(v/tot*100)}%</span></div><Bar v={v} max={by[0][1]}/></div>)}{!by.length&&<p className="muted">No data in this range.</p>}</section>
  </Wrap>;
}
