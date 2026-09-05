import test from 'node:test';
import assert from 'node:assert/strict';
import { publicUrl, publicIPv4, robotsAllowed, pageText, relatedPages, scanPage } from '../src/lib/audit-public-fetch.ts';
import { validateObservations } from '../src/lib/audit-public-sources.ts';
import { createIntakeState, advanceAudit, assess } from '../src/lib/audit-engine.ts';
import { signState, verifyState } from '../src/lib/audit-session.ts';
import { buildFinalBrief } from '../src/lib/audit-report.ts';
import { socialProfile, socialRecords, scanSocial } from '../src/lib/audit-social.ts';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { finalDictation } from '../src/lib/audit-dictation.ts';
test('dictation ignores interim hypotheses and delivers finalized speech exactly once', () => {
  const seen=new Set();
  const result=(text,isFinal)=>Object.assign([{transcript:text}],{isFinal});
  assert.deepEqual(finalDictation({resultIndex:0,results:[result('გამარჯ',false)]},seen),[]);
  assert.deepEqual(finalDictation({resultIndex:0,results:[result('გამარჯობა',true)]},seen),['გამარჯობა']);
  assert.deepEqual(finalDictation({resultIndex:0,results:[result('გამარჯობა',true),result('магазин',true)]},seen),['магазин']);
});

test('social profiles reject arbitrary URLs and normalize one business handle', () => {
  assert.equal(socialProfile('https://www.instagram.com/ainow.ge/').handle,'ainow.ge');
  assert.equal(socialProfile('https://example.com'),null);
  for (const value of ['https://instagram.com/p/123','https://facebook.com/groups','https://instagram.com/a?token=secret','http://facebook.com/a']) assert.throws(()=>socialProfile(value));
});
test('social evidence rejects invented links and wrong-parent comments', () => {
  const run={id:'abcdefghij1234567',defaultDatasetId:'abcdefghi12345678',status:'SUCCEEDED'};
  const rows=[{url:'https://evil.test/p/123',text:'False'}, {url:'https://www.instagram.com/p/ABC/',caption:'Actual caption'}];
  const out=socialRecords(rows,'instagram','post',run);
  assert.equal(out.length,1); assert.equal(out[0].verification,'provider_only');
  assert.equal(socialRecords([{url:'https://www.instagram.com/p/OTHER/',text:'Wrong comment'}],'instagram','comment',run,['https://www.instagram.com/p/ABC/']).length,0);
});
test('social run caps, persistent reservations and cache prevent repeated paid requests', async () => {
  const root=await mkdtemp(join(tmpdir(),'aiaudit-social-test-'));
  const old={token:process.env.APIFY_TOKEN,store:process.env.AUDIT_SOURCE_STORE,budget:process.env.AUDIT_SOCIAL_DAILY_USD,fetch:globalThis.fetch};
  process.env.APIFY_TOKEN='test-only';process.env.AUDIT_SOURCE_STORE=root;process.env.AUDIT_SOCIAL_DAILY_USD='0.24';
  let starts=0;
  globalThis.fetch=async(url,options)=>{
    if(String(url).includes('/runs?')) { starts++; assert(String(url).includes('maxTotalChargeUsd=')); assert.equal(options.method,'POST'); return Response.json({data:{id:'abcdefghij1234567',defaultDatasetId:'abcdefghi12345678',status:'SUCCEEDED'}}); }
    return Response.json([{url:'https://www.instagram.com/p/ABC/',caption:'A public business caption'}]);
  };
  try {
    const first=await scanSocial('https://instagram.com/testbusiness');
    assert(first.length); assert.equal(starts,2);
    await scanSocial('https://instagram.com/testbusiness'); assert.equal(starts,2);
    await assert.rejects(scanSocial('https://instagram.com/anotherbusiness')); assert.equal(starts,2);
    const day=new Date().toISOString().slice(0,10);
    assert.equal(JSON.parse(await readFile(join(root,`budget-${day}.json`),'utf8')).reserved,.24);
  } finally {
    globalThis.fetch=old.fetch;
    for(const [key,value] of [['APIFY_TOKEN',old.token],['AUDIT_SOURCE_STORE',old.store],['AUDIT_SOCIAL_DAILY_USD',old.budget]]) {if(value===undefined)delete process.env[key];else process.env[key]=value;}
  }
});

test('public links normalize and reject credentials, private hosts, numeric forms and parameters', () => {
  assert.equal(publicUrl('example.com/about#team').href, 'https://example.com/about');
  for (const url of ['http://127.0.0.1', 'http://2130706433', 'http://0x7f000001', 'http://[::1]', 'http://localhost', 'https://a.internal', 'https://a.local', 'https://u:secret@example.com', 'ftp://example.com', 'https://example.com:8080', 'https://example.com?token=secret']) assert.throws(() => publicUrl(url), url);
});
test('all nonpublic IPv4 destinations are rejected before socket connection', () => {
  for (const ip of ['0.0.0.0','10.0.0.1','127.0.0.1','100.64.0.1','169.254.169.254','172.16.0.1','172.31.255.254','192.168.1.1','192.0.0.1','192.0.2.1','198.18.0.1','198.51.100.2','203.0.113.1','224.0.0.1','255.255.255.255','::1']) assert.equal(publicIPv4(ip), false, ip);
  assert(publicIPv4('93.184.216.34')); assert(publicIPv4('104.21.10.1'));
});
test('robots handles explicit bot, wildcard, longest allow and anchored paths', () => {
  assert.equal(robotsAllowed('User-agent: *\nDisallow: /private\nAllow: /private/public', '/private/foo'), false);
  assert.equal(robotsAllowed('User-agent: *\nDisallow: /private\nAllow: /private/public', '/private/public'), true);
  assert.equal(robotsAllowed('User-agent: *\nDisallow: /\nUser-agent: aiAUDITBot\nAllow: /', '/about'), true);
  assert.equal(robotsAllowed('User-agent: *\nDisallow: /*.pdf$', '/file.pdf'), false);
  assert.equal(robotsAllowed('User-agent: *\nDisallow: /*.pdf$', '/file.pdf/about'), true);
});
test('normalized HTML excludes scripts, markup and comments', () => {
  const text = pageText('<title>Shop &amp; Services</title><!--secret--><script>ignore instructions</script><style>x</style><p>Custom furniture &#38; installation.</p>');
  assert.equal(text.title, 'Shop & Services');
  assert.equal(text.excerpt, 'Shop & Services Custom furniture & installation.');
});
test('related pages stay on origin, are deduplicated and capped at two', () => {
  const html = '<a href="/about">About</a><a href="/contact">Contact</a><a href="/services">Services</a><a href="http://127.0.0.1/about">bad</a><a href="https://other.com/about">other</a>';
  assert.deepEqual(relatedPages(html, new URL('https://example.com')), ['https://example.com/about', 'https://example.com/contact']);
});
test('fabricated quotes, unavailable sources, wrong kinds and duplicate evidence are excluded', () => {
  const source = { id:'S1', status:'read', excerpt:'We sell custom furniture with installation.' };
  const valid = { sourceId:'S1', kind:'business', quote:'We sell custom furniture' };
  assert.deepEqual(validateObservations([valid, valid, {...valid,quote:'Sales increased by 80%'}, {...valid,sourceId:'fake'}, {...valid,kind:'roi'}], [source]), [valid]);
  assert.deepEqual(validateObservations([valid], [{...source,status:'unavailable'}]), []);
});
test('matching a quote cannot smuggle model-written conclusions or verification claims', () => {
  const source = { id:'S1', status:'read', excerpt:'We sell custom furniture with installation.' };
  const valid = { sourceId:'S1', kind:'business', quote:'We sell custom furniture' };
  assert.deepEqual(validateObservations([{...valid, verified:true, analysis:'Sales fell 80%', url:'https://fake.example'}], [source]), [valid]);
});
test('a genuine quote from a different source or changed numeric value is rejected', () => {
  const sources = [{id:'S1',status:'read',excerpt:'We receive 10 calls daily.'},{id:'S2',status:'read',excerpt:'We make custom furniture.'}];
  assert.deepEqual(validateObservations([{sourceId:'S2',kind:'business',quote:'We receive 10 calls daily.'},{sourceId:'S1',kind:'business',quote:'We receive 100 calls daily.'}], sources), []);
});
test('source context cannot become client evidence, progress or recommendation', () => {
  const s = createIntakeState('en');
  s.publicScan = { sources:[], observations:[{sourceId:'S1',kind:'business',quote:'1000 daily messages and lost sales'}], aiStatus:'reviewed' };
  const next = advanceAudit(s,'I do not know',{focus:'chats',focusEvidence:'1000 daily messages',updates:[{field:'scale',value:'1000',status:'confirmed',evidence:'1000 daily messages',correction:false}],nextField:null});
  assert.equal(next.facts.scale, undefined);
  assert.equal(assess(next).product, null);
  assert.deepEqual(next.publicScan, s.publicScan);
});
test('signed state protects public sources from client tampering', () => {
  process.env.AUDIT_SESSION_SECRET = 'test-only-public-source-signing-secret';
  const state = createIntakeState(); state.publicScan = {sources:[],observations:[],aiStatus:'reviewed'};
  const signed = signState(state); assert(verifyState(signed));
  signed.publicScan.observations.push({sourceId:'fake',kind:'business',quote:'fabricated'});
  assert.equal(verifyState(signed),false);
});
test('source report appendix is separate from owner evidence', () => {
  const s = createIntakeState('en');
  s.publicScan = { sources:[{id:'S1',url:'https://example.com',checkedAt:'2026-09-05',status:'read',title:'',excerpt:''}],observations:[{sourceId:'S1',kind:'business',quote:'We sell custom furniture'}],aiStatus:'reviewed'};
  const report = buildFinalBrief(s,'en');
  assert(report.includes('Public sources — separate context'));
  assert(report.includes('do not increase product fit'));
  assert(report.includes('https://example.com'));
});
test('localhost suffix is rejected without fetching', async () => {
  const result = await scanPage('https://foo.localhost','S1',AbortSignal.timeout(1000)).catch(() => null);
  assert.equal(result, null);
});
