// 100 new niches, not the previous 20. Synthetic facts, never customer records.
const groups={
 chats:['veterinary practice','optician','hearing aid retailer','bicycle repair shop','music academy','dance academy','escape room operator','coworking space','self storage operator','laundry service','tailoring workshop','florist','wedding venue','museum ticket office','indoor climbing center'],
 calls:['vehicle inspection station','driving school','swimming academy','appliance repair service','pest control firm','solar installer','window installer','plumbing service','HVAC maintenance firm','locksmith service','moving company','carpet cleaning service','pool maintenance service','landscaping contractor','home inspection service'],
 docs:['agricultural cooperative','seafood distributor','textile importer','paper manufacturer','printing house','packaging manufacturer','timber merchant','metal recycler','industrial parts distributor','medical equipment distributor','laboratory supplies distributor','restaurant procurement service','wine exporter','tea importer','coffee roaster','grain mill','dairy processor','cold storage warehouse','freight forwarder','customs documentation service'],
 content:['outdoor gear retailer','toy retailer','jewelry retailer','footwear manufacturer','lighting retailer','ceramics manufacturer','wallpaper retailer','musical instrument retailer','sports nutrition retailer','stationery retailer','garden tools retailer','automotive accessories retailer','craft materials retailer','antique marketplace','art print retailer'],
 office:['commercial bakery','meal kit supplier','uniform supplier','event equipment supplier','water delivery service','office plant service','industrial lubricant distributor','electronics refurbisher','spare tire wholesaler','safety clothing distributor'],
 approval:['animation studio','architecture studio','advertising production studio','translation agency','IT managed services firm','commercial security installer','telecom reseller','engineering design bureau','interior design studio','facility management firm'],
 ads:['camping rental service','boat tour operator','sports camp operator','online tutoring platform','children activity center','subscription snack shop','custom gift retailer','boutique perfume shop','sustainable clothing brand','handmade soap brand'],
 expert:['aviation maintenance consultancy','fire safety consultancy','geotechnical laboratory','bridge inspection consultancy','industrial safety consultancy'],
};
const deep={
 process_owner:'The operations supervisor is accountable for the process outcome.',
 trigger:'A new request recorded in our work queue starts the case.',
 completion:'The case is complete when the reviewer approves the result and the recipient acknowledges it.',
 exceptions:'Requests with conflicting instructions or missing required details go to a specialist instead of the normal workflow.',
 handoff:'The operator transfers the case record, original request and unresolved questions to the supervisor.',
 source_of_truth:'The approved case ledger is authoritative; we reconcile other copies against it.',
 data_quality:'We sometimes receive missing reference numbers and outdated contact details.',
 permissions:'The operations director has already approved this limited dataset for this specific test.',
 retention:'Our internal test policy is to delete test copies after review and keep only aggregated results.',
 personal_data:'Contact names and business contact details are present. We will exclude actual personal details from test examples.',
 volume_peaks:'The last week of the month is busiest, approximately twice the normal daily load.',
 unit_time:'Our observed hands-on time is approximately eight minutes per normal case.',
 error_cost:'The last error required reopening the record and repeating the supervisor review; we have not calculated its cash cost.',
 seasonality:'Holiday weeks have different demand, so we will compare ordinary weeks rather than holidays.',
 dependencies:'The existing work ledger must export records. The system administrator will verify export support before any test.',
 adoption:'The team lead will demonstrate the new procedure and supervise the first practice session.',
 rollback:'We will keep the original workflow available and switch back to manual handling; test copies will not overwrite original records.',
 pilot_scope:'One team and one common case type, using copies reviewed alongside the normal workflow.',
 success_threshold:'Our proposed target is less hands-on time with no increase in errors. It is a target, not a guaranteed improvement.',
 stop_rules:'Stop immediately on an unauthorized disclosure or an incorrect result being used without review.',
 baseline_period:'Use the previous ordinary working week and the same case type as the test.',
 review_capacity:'The designated reviewer can spend thirty minutes each working day checking test results.',
};
const profiles={
 chats:{process:'Operators read written customer messages, answer repeated availability questions and arrange bookings.',pain:'Written enquiries wait overnight and customers complain about delayed replies.',response:'Repeated written enquiries wait hours for a reply.',channels:'WhatsApp and email',systems:'Message inbox and booking ledger'},
 calls:{process:'An administrator calls existing customers to confirm agreed appointments and transfers complex questions to a specialist.',pain:'Repeated confirmation calls consume staff time and delay front desk service.',response:'Staff spend too much time on routine confirmation calls.',call_task:'Confirming appointments by telephone.',call_permission:'Only existing customers who agreed to these confirmation calls, never purchased lists.',systems:'Business phone and appointment ledger'},
 docs:{process:'A clerk reads supplier PDF documents and extracts fields into a draft spreadsheet; a supervisor checks every field.',pain:'Manual field extraction causes omissions and repeated corrections.',docs_task:'Extracting fields, not making professional decisions.',systems:'Supplier PDF documents and a spreadsheet'},
 content:{process:'A writer drafts product descriptions and social captions from approved specifications; an editor checks them before publication.',pain:'Repeated writing delays catalog publication.',content_gap:'Producing drafts is slow; approval is not the bottleneck.',systems:'Approved catalog specifications and document editor'},
 office:{process:'A clerk transfers structured orders from a spreadsheet into the stock ledger and a manager reviews them.',pain:'Manual copying creates duplicate records and wrong quantities.',office_task:'Order transfer between two systems.',systems:'Spreadsheet and stock system; a CSV import exists but has not been tried.',alternative:'The existing CSV import has not been tried.'},
 approval:{process:'An internal purchase request is prepared quickly and then waits for the director to approve it.',pain:'The delay is in approval: requests wait ten days after preparation.',office_task:'Internal approvals and sign-off only.',systems:'Email and a request ledger.',alternative:'We have not agreed an approval deadline or backup approver.'},
 ads:{process:'A marketer compares paid advertising campaigns with a separate order ledger.',pain:'We cannot attribute purchases to the advertising campaign.',acquisition:'Paid Instagram campaigns.',tracking:'We only count clicks; purchase tracking is absent.',ads_work:'Manual campaign comparison without purchase attribution.',systems:'Advertising dashboard and separate order ledger.'},
 expert:{process:'A qualified specialist reviews inspection documents and makes a final safety decision.',pain:'Professional safety review consumes time; we want a machine to make the final safety decision.',docs_task:'Making the final professional safety decision without a specialist.',constraints:'A wrong decision could endanger people.',repetition:'Each final safety judgment is unique.',systems:'Inspection documents and specialist reports.'},
};
const expected={chats:['pilot','aiCHATS'],calls:['pilot','aiCALL'],docs:['pilot','aiDOCS'],content:['pilot','aiCONTENT'],office:['process_first',null],approval:['process_first',null],ads:['measurement_first',null],expert:['process_first',null]};
export function makeDeepCases(){
 let n=0;return Object.entries(groups).flatMap(([kind,niches])=>niches.map(niche=>{
  const i=++n,volume=200+i*3;
  const answers={...deep,business:`We operate a ${niche}.`,customer:'We serve customers paying for our stated products or services.',objective:'Reduce the stated workflow delay without making unsupported promises.',repetition:'Most cases follow the same repeated workflow.',scale:`About ${volume} cases in an ordinary month.`,impact:'Last month this task took 40 staff hours and required correction of 7 errors.',baseline:`Last month ${volume} cases, 40 staff hours and 7 corrected errors.`,severity:'The recurring problem wastes staff time every week.',data:'Authorized test examples and human-reviewed reference answers are ready.',owner:'Our supervisor has allocated time every working day to review a test.',constraints:'A person must approve every result before use.',alternative:'We tried templates and a checklist but the problem remains.',priority_check:'This is our main priority.',...profiles[kind]};
  let [verdict,product]=expected[kind];let variant='skeptical';
  if(i%9===0&&product){answers.owner='No one currently has time to own a pilot.';answers.review_capacity='No review time is available.';verdict='prepare';product=null;variant='no_owner';}
  else if(i%11===0&&product){answers.scale='I do not know';answers.baseline='I do not know';verdict='insufficient';product=null;variant='unknown_numbers';}
  else if(i%7===0)variant='sales_pressure';
  else if(i%5===0)variant='correction';
  return {id:String(i).padStart(3,'0'),mode:'deep',niche,kind,variant,answers,expected:{verdict,product},first:`We operate a ${niche}. ${answers.process} ${answers.pain} I am skeptical and need evidence, not a sales pitch.`};
 }));
}
