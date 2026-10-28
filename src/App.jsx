import {createContext,useContext,useEffect,useState} from 'react';
import {NavLink,Navigate,Route,Routes} from 'react-router-dom';
import {api} from './api';
import {Overview,Expenses,Budgets,Reports} from './pages';
const Auth=createContext();export const useAuth=()=>useContext(Auth);
export const Logo=({s=34})=><svg width={s} height={s*.58} viewBox="0 0 48 28" fill="none" aria-hidden="true"><path d="M24 14C20 7 16 5 12 5a9 9 0 1 0 0 18c4 0 8-2 12-9s8-9 12-9a9 9 0 1 1 0 18c-4 0-8-2-12-9z" stroke="#2A63D6" strokeWidth="4" strokeLinejoin="round"/></svg>;
function Login({onDone}){
  const [reg,setReg]=useState(false),[f,setF]=useState({firstName:'',lastName:'',email:'',password:''}),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
  const set=k=>e=>setF({...f,[k]:e.target.value});
  async function go(e){e.preventDefault();setErr('');setBusy(true);
    try{if(reg)await api('/auth/register',{method:'POST',body:f});await api('/auth/login',{method:'POST',body:{email:f.email,password:f.password}});await onDone()}
    catch(x){setErr(x.message)}setBusy(false)}
  return <main className="login"><form className="card" onSubmit={go}>
    <div className="brand"><Logo/>smartspend</div><h1>{reg?'Create your account':'Welcome back'}</h1>
    {reg&&<div className="two"><label>First name<input required value={f.firstName} onChange={set('firstName')}/></label><label>Last name<input value={f.lastName} onChange={set('lastName')}/></label></div>}
    <label>Email<input type="email" required autoComplete="email" value={f.email} onChange={set('email')}/></label>
    <label>Password<input type="password" required minLength={reg?8:1} autoComplete={reg?'new-password':'current-password'} value={f.password} onChange={set('password')}/></label>
    {err&&<p className="err" role="alert">{err}</p>}
    <button className="btn" disabled={busy}>{busy?'Please wait…':reg?'Sign up':'Sign in'}</button>
    <button type="button" className="link" onClick={()=>{setReg(!reg);setErr('')}}>{reg?'Have an account? Sign in':'New here? Create an account'}</button>
  </form></main>;
}
export default function App(){
  const [user,setUser]=useState(null),[ready,setReady]=useState(false);
  const me=async()=>{try{setUser(await api('/auth/me'))}catch{setUser(null)}setReady(true)};
  useEffect(()=>{me();const h=()=>setUser(null);window.addEventListener('unauth',h);return()=>window.removeEventListener('unauth',h)},[]);
  const out=async()=>{try{await api('/auth/logout',{method:'POST'})}catch{}setUser(null)};
  if(!ready)return <div className="splash"><Logo s={56}/></div>;
  if(!user)return <Login onDone={me}/>;
  return <Auth.Provider value={{user}}><div className="shell">
    <div className="top"><div className="brand"><Logo/>smartspend</div>
      <div className="who"><span>Hi, {user.firstName??user.name??user.email}</span><button className="btn ghost" onClick={out}>Sign out</button></div></div>
    <nav className="pill" aria-label="Main">{[['/','Overview'],['/expenses','Expenses'],['/budgets','Budgets'],['/reports','Reports']].map(([to,l])=><NavLink key={to} to={to} end={to==='/'} className="tab">{l}</NavLink>)}</nav>
    <Routes><Route path="/" element={<Overview/>}/><Route path="/expenses" element={<Expenses/>}/><Route path="/budgets" element={<Budgets/>}/><Route path="/reports" element={<Reports/>}/><Route path="*" element={<Navigate to="/"/>}/></Routes>
  </div></Auth.Provider>;
}
