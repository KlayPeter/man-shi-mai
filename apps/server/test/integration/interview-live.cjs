/* Explicit, bounded real-provider acceptance. Synthetic users only; isolated Mongo; no production. */
require('reflect-metadata');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.RUN_INTERVIEW_LIVE !== '1' || process.env.MONGODB_URI !== 'mongodb://127.0.0.1:27028/msm_live_acceptance') throw Error('Explicit live opt-in and isolated database required');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { JwtService } = require('@nestjs/jwt');
const { getConnectionToken } = require('@nestjs/mongoose');
const { AppModule } = require('../../dist/src/app.module');
const { AIModelFactory } = require('../../dist/src/ai/services/ai-model.factory');
const base = process.env.TEST_API_BASE || 'http://127.0.0.1:3016';
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const artifact = process.env.LIVE_ARTIFACT || '/tmp/msm-live-acceptance.json';
const fresh = { startedAt: new Date().toISOString(), model: process.env.DEEPSEEK_MODEL, modelCalls: 0, usage: [], sessions: [] };
const result = process.env.LIVE_RESUME === '1' ? JSON.parse(fs.readFileSync(artifact, 'utf8')) : fresh;
delete result.error;
let app;
const save = () => fs.writeFileSync(artifact, JSON.stringify(result, null, 2), { mode: 0o600 });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function boot() {
 app = await NestFactory.create(AppModule, { logger: false });
 app.useBodyParser('json', { limit: '8mb' });
 app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
 const factory = app.get(AIModelFactory);
 const original = factory.createDefaultModel.bind(factory);
 factory.createDefaultModel = () => {
  if (++result.modelCalls > 50) throw Error('Live acceptance model call cap reached');
  const model = original();
  model.callbacks = [{ handleLLMEnd(output) {
   const message = output.generations?.[0]?.[0]?.message;
   const usage = message?.usage_metadata || output.llmOutput?.tokenUsage || output.llmOutput?.usage;
   result.usage.push(usage || { unavailable: true }); save();
  } }];
  return model;
 };
 await app.listen(3016, '127.0.0.1');
}
async function http(path, token, body, stream = false) {
 const start = Date.now();
 const response = await fetch(`${base}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body:JSON.stringify(body) }), signal:AbortSignal.timeout(150000) });
 assert(response.ok, `${path} HTTP ${response.status}`);
 if (stream) {
  const text = await response.text();
  const events = text.split('\n').filter(line=>line.startsWith('data: ')).map(line=>JSON.parse(line.slice(6)));
  assert(!events.some(e=>e.type==='error'), `${path} stream error: ${events.find(e=>e.type==='error')?.error}`);
  return { events, ms: Date.now()-start };
 }
 if(response.headers.get('content-type')?.startsWith('audio/'))return { audio:Buffer.from(await response.arrayBuffer()), ms:Date.now()-start };
 const envelope = await response.json();
 assert.equal(envelope.code, 200, `${path} business response`);
 return { data:envelope.data, ms:Date.now()-start };
}
function answer(question, type, index) {
 if (index===0) return '我有一年React前端开发经历，参与订单后台，负责列表性能优化和接口联调。我把虚拟列表接入后，在同一套测试数据上把首屏渲染从一点八秒降到零点九秒。';
 if (/你(?:还有)?什么.*问题|你.*想.*问|你还有什么想了解|请.*反问/.test(question)) return '我想了解这个岗位入职前三个月的主要任务，以及团队如何评估交付质量。';
 if (/薪资期望|期望薪|多久.*到岗|何时.*入职/.test(question)) return '我可以在一个月内到岗，希望薪资结合岗位职责和团队标准沟通，不把模拟面试的信息当成真实录用承诺。';
 if (/算法|复杂度|手写|代码|编程/.test(question)) return '这类算法我还不熟悉，不能声称已经掌握。我会先明确输入输出和边界，尝试用遍历给出正确解法，再分析时间复杂度并通过测试优化。';
 if (/冲突|分歧|沟通|协作|团队|推动/.test(question)) return '产品希望尽快上线，但我担心空状态会影响操作。我把问题做成可复现清单，和产品一起按影响排序，先修阻断问题，再约定补齐时间，最后按清单共同验收。';
 if (/失败|不足|缺点|压力|困难|挑战/.test(question)) return '有一次上线遗漏空状态，是我的验收清单不完整。我先补提示并跟进修复，再把空数据和接口失败加入回归清单。之后两次发布没有再出现同类问题，但样本仍然有限。';
 if (/为什么|选择|规划|职业|动机/.test(question) && type==='behavior') return '我希望继续做前端工程，因为喜欢把复杂流程变成清晰的操作。我想先补齐测试和性能分析能力，未来两年独立负责一个业务模块，而不是追求不熟悉的管理岗位。';
 if (/缓存|一致性|过期|字典/.test(question)) return '我只缓存变化较少的字典数据，设置五分钟过期，写入成功后主动失效；订单余额仍然实时读取。我的项目没有处理过跨机房一致性，不能把这个方案泛化到所有数据。';
 if (/验证|指标|性能|优化|结果|监控|量化/.test(question)) return '我固定浏览器和测试数据，分别重复测试十次，对比首屏渲染和交互延迟，也检查错误率。提升主要来自减少一次渲染的行数；这是测试环境结果，不能等同于生产用户收益。';
 if (/学习|新技术|不会|成长/.test(question)) return '我先用最小示例确认新技术的约束，再在独立分支验证，并写下失败条件。遇到无法解释的问题会请同事评审，确认回退方案后才合入业务。';
 return '在订单后台项目里，我负责列表和接口联调，先复现问题并拆分任务，再和产品确认验收标准。完成后用固定数据回归并请同事复核；没有验证的效果，我不会写成已实现。';
}
async function voice(text, token) {
 const parts = Array.from(text);
 const speech = [];
 for(let offset=0;offset<parts.length;offset+=240) speech.push(await http('/interview/speech/synthesize', token, { text:parts.slice(offset,offset+240).join('') }));
 return speech;
}
(async()=>{
 await boot();
 try {
  const types = process.env.LIVE_TYPES ? process.env.LIVE_TYPES.split(',') : ['special','behavior'];
  assert(types.length > 0 && types.length <= 2 && types.every(type=>['special','behavior'].includes(type)));
  for(const type of types) {
   const previous=result.sessions.find(item=>item.type===type);
   const session=previous || { type, rounds:[], timings:[], resume:'合成测试资料：一年React前端开发，参与订单后台，负责虚拟列表优化与接口联调。测试环境首屏从1.8秒到0.9秒；无管理经历，无分布式生产运维经历。' };
   if(!previous) result.sessions.push(session);save();
   let token, userId=session.userId, resultId=session.resultId;
   if(resultId) { assert.equal(session.rounds.at(-1)?.event, 'end', 'Only ended interviews can resume report verification'); token=app.get(JwtService).sign({userId}); }
   else {
   const identity=randomUUID().slice(0,8); const credentials={username:`live-${identity}`,email:`live-${identity}@example.test`,password:`Synthetic-${randomUUID()}`};
   await http('/user/register',null,credentials);
   const login=await http('/user/login',null,{email:credentials.email,password:credentials.password});
   token=login.data.token;userId=login.data.user._id;session.userId=userId;
   assert.equal(login.data.user[`${type==='special'?'special':'behavior'}RemainingCount`],1);
   const dto={requestId:randomUUID(),interviewType:type,positionName:'前端开发工程师',company:'合成测试团队',practiceIntensity:'warmup',resumeContent:session.resume,jd:'负责React订单管理后台开发，关注组件设计、性能分析、接口联调、自动化测试及团队协作。'};
   const opening=await http('/interview/mock/start',token,dto,true);
   const opened=opening.events.find(e=>e.resultId&&e.sessionId);assert(opened,'opening IDs missing');
   resultId=opened.resultId;session.resultId=resultId;
   let state=(await http(`/interview/mock/resume/${resultId}`,token,{})).data;
   for(let round=0;round<6;round++){
    const question=[...state.conversationHistory].reverse().find(m=>m.role==='interviewer')?.content;assert(question);
    const record={number:round+1,question};session.rounds.push(record);save();
    console.log(JSON.stringify({type,round:round+1,question}));
    const played=await voice(question,token);record.questionTtsMs=played.reduce((sum,x)=>sum+x.ms,0);
    record.answer=answer(question,type,round);
    const speech=await voice(record.answer,token);
    const recognized=await http('/interview/speech-to-text',token,{audio:speech[0].audio.toString('base64')});
    record.recognized=recognized.data.text;record.asrMs=recognized.ms;
    assert(record.recognized.length>5,'empty recognition');
    // Explicit correction step: the user reviews ASR text before sending their intended answer.
    const request={sessionId:state.sessionId,requestId:randomUUID(),expectedVersion:state.questionVersion,answer:record.answer};
    const response=await http('/interview/mock/answer',token,request,true);record.turnMs=response.ms;
    const terminal=response.events.at(-1);record.event=terminal.type;save();
    console.log(JSON.stringify({type,round:round+1,event:terminal.type,ms:response.ms}));
    if(round===0){const calls=result.modelCalls;await http('/interview/mock/answer',token,request,true);assert.equal(result.modelCalls,calls,'retry called model');}
    if(round===1){
     await http(`/interview/mock/pause/${resultId}`,token,{});
     await app.close();await boot();session.restarted=true;
    }
    if(terminal.type==='end')break;
    state=(await http(`/interview/mock/resume/${resultId}`,token,{})).data;
   }
   }
   const reportStart=Date.now();
   await http(`/interview/mock/review/${resultId}/generate`,token,{});
   let review;
   for(let poll=0;poll<60;poll++){
    review=(await http(`/interview/mock/review/${resultId}`,token)).data;
    if(['completed','failed','insufficient_data'].includes(review.status))break;
    await sleep(2000);
   }
   session.review=review;session.reportMs=Date.now()-reportStart;save();
   assert.equal(review.status,'completed',`${type} report ${review.status}`);
   assert(review.report.evidence.length>0);
   for(const evidence of review.report.evidence)assert(session.rounds[evidence.questionNumber-1].answer.includes(evidence.quote),'unsupported report evidence');
   const account=(await http('/user/info',token)).data;
   assert.equal(account[type==='special'?'specialRemainingCount':'behaviorRemainingCount'],0,'unexpected quota');
   const db=app.get(getConnectionToken());
   const saved=await db.collection('aiinterviewresults').findOne({resultId});
   assert(saved,'stored interview missing');assert.equal(saved.status,'completed');
   session.savedAnswers=saved.qaList.filter(x=>x.answer?.trim()).length;
   assert.equal(session.savedAnswers,session.rounds.length);session.passed=true;save();
   console.log(JSON.stringify({type,passed:true,rounds:session.rounds.length,reportScore:review.report.overallScore,reportMs:session.reportMs}));
  }
  result.completedAt=new Date().toISOString();result.passed=true;save();
 } finally { await app.close(); }
})().catch(error=>{result.error=String(error.message).replace(/sk-[\w-]+/g,'[redacted]');save();console.error('LIVE_FAILED:',result.error);process.exitCode=1});
