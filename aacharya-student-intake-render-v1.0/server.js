const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const SUB_DIR = path.join(DATA_DIR, 'submissions');
const ADMIN_SYNC_KEY = String(process.env.ADMIN_SYNC_KEY || '');
const MAX_BODY = 64 * 1024;
const rate = new Map();
fs.mkdirSync(SUB_DIR, { recursive: true });

function headers(extra={}) { return {
  'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY', 'Referrer-Policy':'no-referrer',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  ...extra
}; }
function cors(extra={}) { return headers({'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization',...extra}); }
function send(res,status,body,type='application/json; charset=utf-8',extra={}) { res.writeHead(status,cors({'Content-Type':type,'Cache-Control':'no-store',...extra})); res.end(type.startsWith('application/json')?JSON.stringify(body):body); }
function clean(v,max=160){ return String(v||'').trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max); }
function validEmail(v){ return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function validPhone(v){ return !v || /^[0-9+() .-]{7,20}$/.test(v); }
function readBody(req){ return new Promise((resolve,reject)=>{ let bufs=[],n=0; req.on('data',c=>{n+=c.length;if(n>MAX_BODY){reject(new Error('too_large'));req.destroy();return}bufs.push(c)});req.on('end',()=>resolve(Buffer.concat(bufs).toString('utf8')));req.on('error',reject); }); }
function csvCell(v){ const s=String(v??''); return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }
function appendCsv(rec){ const f=path.join(DATA_DIR,'submissions.csv'); const exists=fs.existsSync(f); const cols=['id','submittedAt','studentName','grade','school','board','studentPhone','studentEmail','parentName','parentPhone','parentEmail','subjects','preferredMode','address','notes']; if(!exists)fs.appendFileSync(f,cols.join(',')+'\n'); const row=cols.map(k=>csvCell(k==='id'?rec.id:k==='submittedAt'?rec.submittedAt:Array.isArray(rec.data[k])?rec.data[k].join('; '):rec.data[k])).join(','); fs.appendFileSync(f,row+'\n'); }
function isRateLimited(ip){ const now=Date.now(),w=rate.get(ip)||[]; const recent=w.filter(t=>now-t<10*60*1000); if(recent.length>=8){rate.set(ip,recent);return true} recent.push(now); rate.set(ip,recent); return false; }
function listSubmissions(){ return fs.readdirSync(SUB_DIR).filter(n=>n.endsWith('.json')).sort().reverse().slice(0,2000).map(n=>{try{return JSON.parse(fs.readFileSync(path.join(SUB_DIR,n),'utf8'))}catch{return null}}).filter(Boolean); }
function auth(req){ if(!ADMIN_SYNC_KEY)return false; const h=String(req.headers.authorization||''); const provided=h.startsWith('Bearer ')?h.slice(7):''; if(provided.length!==ADMIN_SYNC_KEY.length)return false; try{return crypto.timingSafeEqual(Buffer.from(provided),Buffer.from(ADMIN_SYNC_KEY))}catch{return false} }

const server=http.createServer(async (req,res)=>{
  const u=new URL(req.url,'http://localhost');
  if(req.method==='OPTIONS'){res.writeHead(204,cors());return res.end();}
  if(u.pathname==='/api/health'&&req.method==='GET') return send(res,200,{ok:true,service:'Aacharya Student Information Form',storage:DATA_DIR});
  if(u.pathname==='/api/apply'&&req.method==='POST'){
    const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim(); if(isRateLimited(ip))return send(res,429,{ok:false,message:'Too many submissions. Please try again later.'});
    try{
      const raw=await readBody(req); let body; try{body=JSON.parse(raw)}catch{return send(res,400,{ok:false,message:'Invalid form data.'})}
      if(clean(body.website,80)) return send(res,200,{ok:true,message:'Thank you.'}); // honeypot
      const data={studentName:clean(body.studentName,100),grade:clean(body.grade,80),school:clean(body.school,120),board:clean(body.board,80),studentPhone:clean(body.studentPhone,24),studentEmail:clean(body.studentEmail,120),parentName:clean(body.parentName,100),parentPhone:clean(body.parentPhone,24),parentEmail:clean(body.parentEmail,120),subjects:Array.isArray(body.subjects)?body.subjects.map(x=>clean(x,60)).filter(Boolean).slice(0,12):clean(body.subjects,300).split(',').map(x=>x.trim()).filter(Boolean).slice(0,12),preferredMode:clean(body.preferredMode,30),address:clean(body.address,400),notes:clean(body.notes,800)};
      if(!data.studentName||!data.grade||!data.parentName||!data.parentPhone||!data.subjects.length) return send(res,400,{ok:false,message:'Please complete student name, class/grade, parent name, parent phone, and at least one subject.'});
      if(!validPhone(data.parentPhone)||!validPhone(data.studentPhone)||!validEmail(data.studentEmail)||!validEmail(data.parentEmail)) return send(res,400,{ok:false,message:'Please check phone number or email formatting.'});
      const id=crypto.randomUUID(),submittedAt=new Date().toISOString(),rec={id,submittedAt,data}; fs.writeFileSync(path.join(SUB_DIR,`${submittedAt.slice(0,10)}_${id}.json`),JSON.stringify(rec,null,2)); appendCsv(rec);
      return send(res,201,{ok:true,submissionId:id,message:'Information submitted successfully.'});
    }catch(e){ if(e.message==='too_large')return send(res,413,{ok:false,message:'Submission is too large.'}); console.error(e); return send(res,500,{ok:false,message:'Could not save the form.'}); }
  }
  if(u.pathname==='/api/admin/submissions'&&req.method==='GET'){
    if(!ADMIN_SYNC_KEY)return send(res,503,{ok:false,message:'ADMIN_SYNC_KEY is not configured on the server.'});
    if(!auth(req))return send(res,401,{ok:false,message:'Unauthorized.'});
    return send(res,200,{ok:true,submissions:listSubmissions()});
  }
  if(req.method==='GET'){
    let rel=u.pathname==='/'?'index.html':u.pathname.replace(/^\/+/, ''); if(rel.includes('..'))return send(res,400,'Bad request','text/plain; charset=utf-8'); const file=path.join(PUBLIC_DIR,rel); if(file.startsWith(PUBLIC_DIR)&&fs.existsSync(file)&&fs.statSync(file).isFile()){const ext=path.extname(file).toLowerCase(),types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml'};res.writeHead(200,headers({'Content-Type':types[ext]||'application/octet-stream','Cache-Control':ext==='.html'?'no-store':'public, max-age=3600'}));return fs.createReadStream(file).pipe(res)}
  }
  return send(res,404,{ok:false,message:'Not found.'});
});
server.listen(PORT,'0.0.0.0',()=>console.log(`Aacharya student intake running on port ${PORT}; data directory: ${DATA_DIR}`));
